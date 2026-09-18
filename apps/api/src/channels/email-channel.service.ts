import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, Logger, UnauthorizedException, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MessagingChannel } from "@prisma/client";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { ChannelsService } from "./channels.service";

/** What we need out of an inbound email, whichever provider delivered it. */
export interface InboundEmail {
  to: string;
  from: string;
  fromName?: string;
  subject?: string;
  text: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
}

/**
 * Email as a messaging channel.
 *
 * Inbound: a mail provider (SendGrid Inbound Parse, Mailgun routes, Postmark, or a forwarder)
 * posts each incoming message to `/channels/webhooks/email`. Outbound: the agent's reply goes
 * out over SMTP from the workspace's support address, carrying the headers that make the
 * customer's mail client keep everything in one thread.
 */
@Injectable()
export class EmailChannelService {
  private readonly logger = new Logger(EmailChannelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    @Inject(forwardRef(() => ChannelsService))
    private readonly channels: ChannelsService
  ) {}

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    payload: unknown
  ): Promise<{ received: true }> {
    const email = this.normalize(payload);

    if (!email) {
      this.logger.warn("Ignoring email webhook: could not read a sender and a body from it");
      return { received: true };
    }

    // Which workspace does this belong to? The address it was sent to.
    const recipients = [email.to, ...(this.extractPlusAddresses(payload) ?? [])];
    const connection = await this.findConnection(recipients);

    if (!connection) {
      this.logger.warn(`Ignoring email for unknown support address ${email.to}`);
      return { received: true };
    }

    this.assertSignature(connection.appSecret, rawBody, signature);

    const threadId = this.addressOf(email.from);
    if (!threadId) {
      return { received: true };
    }

    // A reply to one of our own emails carries the conversation token, so it joins that
    // conversation even when the customer writes from a different address.
    const conversationId =
      this.conversationFromRecipients(recipients) ??
      (await this.conversationFromReferences(connection.organizationId, email));

    await this.channels.storeInbound(connection, {
      externalId: connection.externalId,
      threadId,
      messageId: email.messageId?.trim() || `email:${randomUUID()}`,
      text: this.stripQuotedReply(email.text),
      ...(email.fromName ? { senderName: email.fromName } : {}),
      senderEmail: threadId,
      ...(email.subject ? { subject: this.stripReplyPrefix(email.subject) } : {}),
      ...(conversationId ? { conversationId } : {})
    });

    return { received: true };
  }

  /** Send an agent's reply back out as an email on the same thread. */
  async sendReply(input: {
    organizationId: string;
    to: string;
    body: string;
    conversationId: string;
    messageId: string;
  }): Promise<void> {
    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        organizationId: input.organizationId,
        channel: MessagingChannel.EMAIL,
        isActive: true
      }
    });

    if (!connection) {
      return;
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: { subject: true }
    });

    // Thread the reply onto the customer's last email.
    const lastInbound = await this.prisma.message.findFirst({
      where: {
        conversationId: input.conversationId,
        senderType: "VISITOR",
        channelMessageId: { not: null }
      },
      orderBy: { createdAt: "desc" },
      select: { channelMessageId: true }
    });

    const subject = conversation?.subject?.trim() || "Your message";
    const settings = (connection.settings ?? {}) as Record<string, unknown>;
    const fromName =
      typeof settings.fromName === "string" && settings.fromName.trim()
        ? settings.fromName.trim()
        : connection.displayName?.trim() || "Support";

    const sentMessageId = await this.mail.sendAndGetMessageId({
      to: input.to,
      subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
      text: input.body,
      from: `${fromName} <${connection.externalId}>`,
      replyTo: this.replyToAddress(connection.externalId, input.conversationId),
      ...(lastInbound?.channelMessageId ? { inReplyTo: lastInbound.channelMessageId } : {}),
      ...(lastInbound?.channelMessageId ? { references: [lastInbound.channelMessageId] } : {})
    });

    // Remember our own Message-ID so the customer's reply can be matched back to this chat.
    if (sentMessageId) {
      await this.prisma.message
        .update({ where: { id: input.messageId }, data: { channelMessageId: sentMessageId } })
        .catch(() => undefined);
    }
  }

  /** `support+c-<conversationId>@company.com` — survives clients that drop custom headers. */
  private replyToAddress(supportAddress: string, conversationId: string): string {
    const [local, domain] = supportAddress.split("@");

    return domain ? `${local}+c-${conversationId}@${domain}` : supportAddress;
  }

  private conversationFromRecipients(recipients: string[]): string | null {
    for (const recipient of recipients) {
      const match = /\+c-([0-9a-f-]{36})@/i.exec(this.addressOf(recipient) ?? recipient);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  }

  private async conversationFromReferences(
    organizationId: string,
    email: InboundEmail
  ): Promise<string | null> {
    const ids = [email.inReplyTo, ...(email.references ?? [])]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    if (!ids.length) {
      return null;
    }

    const previous = await this.prisma.message.findFirst({
      where: { organizationId, channelMessageId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { conversationId: true }
    });

    return previous?.conversationId ?? null;
  }

  private async findConnection(recipients: string[]) {
    const addresses = recipients
      .map((recipient) => this.addressOf(recipient))
      .filter((address): address is string => Boolean(address))
      // strip any +tag so support+c-123@acme.com still finds support@acme.com
      .map((address) => address.replace(/\+[^@]*@/, "@"));

    if (!addresses.length) {
      return null;
    }

    return this.prisma.channelConnection.findFirst({
      where: {
        channel: MessagingChannel.EMAIL,
        isActive: true,
        externalId: { in: Array.from(new Set(addresses)), mode: "insensitive" }
      }
    });
  }

  /**
   * Providers post different shapes; take the fields we need from any of them
   * (SendGrid Inbound Parse, Mailgun, Postmark, or a plain JSON forwarder).
   */
  private normalize(payload: unknown): InboundEmail | null {
    const body = this.asRecord(payload);
    const headers = this.asRecord(body.headers);

    const to = this.firstString([
      body.to,
      body.To,
      body.recipient,
      body.OriginalRecipient,
      headers.to,
      headers.To
    ]);
    const from = this.firstString([body.from, body.From, body.sender, headers.from, headers.From]);
    const text = this.firstString([
      body.text,
      body.TextBody,
      body["body-plain"],
      body["stripped-text"],
      body.plain
    ]);

    if (!to || !from || !text) {
      return null;
    }

    const references = this.firstString([body.references, body.References, headers.references]);

    return {
      to,
      from,
      ...(this.nameOf(from) ? { fromName: this.nameOf(from) as string } : {}),
      ...(this.firstString([body.subject, body.Subject, headers.subject])
        ? { subject: this.firstString([body.subject, body.Subject, headers.subject]) as string }
        : {}),
      text,
      ...(this.firstString([body.messageId, body["Message-Id"], body["message-id"], headers["message-id"]])
        ? {
            messageId: this.firstString([
              body.messageId,
              body["Message-Id"],
              body["message-id"],
              headers["message-id"]
            ]) as string
          }
        : {}),
      ...(this.firstString([body.inReplyTo, body["In-Reply-To"], body["in-reply-to"], headers["in-reply-to"]])
        ? {
            inReplyTo: this.firstString([
              body.inReplyTo,
              body["In-Reply-To"],
              body["in-reply-to"],
              headers["in-reply-to"]
            ]) as string
          }
        : {}),
      ...(references ? { references: references.split(/\s+/).filter(Boolean) } : {})
    };
  }

  /** Cc/envelope recipients, so a conversation token in any of them is still found. */
  private extractPlusAddresses(payload: unknown): string[] {
    const body = this.asRecord(payload);
    const values = [body.cc, body.Cc, body.envelope, body.recipient, body.to, body.To];

    return values
      .flatMap((value) => {
        if (typeof value === "string") {
          return value.split(",");
        }
        if (value && typeof value === "object") {
          const record = value as Record<string, unknown>;
          return typeof record.to === "string" ? [record.to] : [];
        }
        return [];
      })
      .map((value) => value.trim())
      .filter(Boolean);
  }

  /** "Sara Khan <sara@acme.com>" → "sara@acme.com" */
  private addressOf(value: string): string | null {
    const angled = /<([^>]+)>/.exec(value);
    const address = (angled?.[1] ?? value).trim().toLowerCase();

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : null;
  }

  /** "Sara Khan <sara@acme.com>" → "Sara Khan" */
  private nameOf(value: string): string | null {
    const name = value.replace(/<[^>]*>/, "").replace(/["']/g, "").trim();

    return name && !name.includes("@") ? name : null;
  }

  private stripReplyPrefix(subject: string): string {
    return subject.replace(/^((re|fwd|fw)\s*:\s*)+/i, "").trim() || subject.trim();
  }

  /**
   * Mail clients quote the whole previous message under the reply. Keep only what the
   * person actually typed, so the chat reads like a chat.
   */
  private stripQuotedReply(text: string): string {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const kept: string[] = [];

    for (const line of lines) {
      if (/^\s*>/.test(line)) {
        break;
      }
      if (/^\s*(on .+wrote:|-{2,}\s*original message\s*-{2,}|from:\s.+)$/i.test(line)) {
        break;
      }
      if (/^\s*--\s*$/.test(line)) {
        break; // signature separator
      }
      kept.push(line);
    }

    const body = (kept.length ? kept : lines).join("\n").trim();

    return body || text.trim();
  }

  /** Providers can sign the payload; when a secret is stored we require a matching signature. */
  private assertSignature(
    secret: string | null,
    rawBody: Buffer | undefined,
    signature: string | undefined
  ): void {
    if (!secret) {
      return;
    }

    if (!signature || !rawBody) {
      throw new UnauthorizedException("Missing webhook signature");
    }

    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const given = Buffer.from(signature);
    const wanted = Buffer.from(expected);

    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
  }

  private firstString(values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
