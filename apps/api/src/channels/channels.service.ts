import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  forwardRef
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ChannelConnection,
  ConversationPriority,
  ConversationSource,
  ConversationStatus,
  MessageStatus,
  MessageType,
  MessageVisibility,
  MessagingChannel,
  ParticipantType
} from "@prisma/client";
import { maskCardNumbers } from "../common/text/mask-sensitive";
import { ContactsService } from "../contacts/contacts.service";
import { ConversationsGateway } from "../conversations/conversations.gateway";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailChannelService } from "./email-channel.service";

export interface ChannelConnectionDto {
  channel: MessagingChannel;
  externalId: string;
  displayName: string | null;
  isActive: boolean;
  connected: boolean;
  webhookUrl: string;
  verifyToken: string | null;
  lastEventAt: Date | null;
}

export interface InboundMessage {
  externalId: string;
  threadId: string;
  messageId: string;
  text: string;
  senderName?: string;
  senderPhone?: string;
  senderEmail?: string;
  /** Email subject line; becomes the chat title. */
  subject?: string;
  /** Set when the sender replied to an existing thread, so the message joins that chat. */
  conversationId?: string;
}

/**
 * WhatsApp Cloud API, Messenger and Instagram all speak Meta's Graph API: the same webhook
 * shape in, the same send endpoint out. Apple Messages for Business needs a separate business
 * registration with Apple and is not wired here.
 */
@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: ConversationsGateway,
    private readonly contacts: ContactsService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => EmailChannelService))
    private readonly email: EmailChannelService
  ) {}

  async list(organizationId: string): Promise<ChannelConnectionDto[]> {
    const rows = await this.prisma.channelConnection.findMany({ where: { organizationId } });
    const byChannel = new Map(rows.map((row) => [row.channel, row]));

    return [
      MessagingChannel.WHATSAPP,
      MessagingChannel.MESSENGER,
      MessagingChannel.INSTAGRAM,
      MessagingChannel.EMAIL,
      MessagingChannel.APPLE
    ].map((channel) => {
      const row = byChannel.get(channel);

      return row
        ? this.map(row)
        : {
            channel,
            externalId: "",
            displayName: null,
            isActive: false,
            connected: false,
            webhookUrl: this.webhookUrl(channel),
            verifyToken: null,
            lastEventAt: null
          };
    });
  }

  async connect(
    organizationId: string,
    channel: MessagingChannel,
    input: {
      externalId: string;
      accessToken?: string;
      appSecret?: string;
      verifyToken?: string;
      displayName?: string;
    }
  ): Promise<ChannelConnectionDto> {
    if (channel === MessagingChannel.APPLE) {
      throw new BadRequestException(
        "Apple Messages for Business needs an approved Apple business account; it can't be connected here yet."
      );
    }

    if (channel === MessagingChannel.EMAIL) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.externalId.trim())) {
        throw new BadRequestException("Enter the support email address, for example support@yourcompany.com");
      }
    } else if (!input.accessToken?.trim()) {
      throw new BadRequestException("An access token from Meta is required to connect this channel");
    }

    const data = {
      externalId: input.externalId.trim(),
      accessToken: input.accessToken?.trim() ?? null,
      appSecret: input.appSecret?.trim() ?? null,
      verifyToken: input.verifyToken?.trim() || this.randomVerifyToken(),
      displayName: input.displayName?.trim() ?? null,
      isActive: true
    };

    const connection = await this.prisma.channelConnection.upsert({
      where: { organizationId_channel: { organizationId, channel } },
      create: { organizationId, channel, ...data },
      update: data
    });

    return this.map(connection);
  }

  async disconnect(organizationId: string, channel: MessagingChannel): Promise<{ success: true }> {
    await this.prisma.channelConnection.deleteMany({ where: { organizationId, channel } });
    return { success: true };
  }

  /** Meta calls this once with a challenge when you save the webhook URL. */
  async verifyWebhook(
    channel: MessagingChannel,
    mode: string | undefined,
    verifyToken: string | undefined,
    challenge: string | undefined
  ): Promise<string> {
    if (mode !== "subscribe" || !verifyToken) {
      throw new BadRequestException("Unsupported verification request");
    }

    const connection = await this.prisma.channelConnection.findFirst({
      where: { channel, verifyToken }
    });

    if (!connection) {
      throw new UnauthorizedException("Verification token does not match any connection");
    }

    return challenge ?? "";
  }

  /** Inbound messages from Meta: verify the signature, then store them as normal chats. */
  async handleWebhook(
    channel: MessagingChannel,
    rawBody: Buffer | undefined,
    signature: string | undefined,
    payload: unknown
  ): Promise<{ received: true }> {
    const messages = this.parseInbound(channel, payload);

    for (const message of messages) {
      const connection = await this.prisma.channelConnection.findFirst({
        where: { channel, externalId: message.externalId, isActive: true }
      });

      if (!connection) {
        this.logger.warn(`Ignoring ${channel} event for unknown account ${message.externalId}`);
        continue;
      }

      this.assertSignature(connection, rawBody, signature);
      await this.storeInbound(connection, message);
    }

    return { received: true };
  }

  /** Deliver an agent reply back to the customer on the channel they wrote from. */
  async sendOutbound(input: {
    organizationId: string;
    channel: MessagingChannel;
    threadId: string;
    body: string;
    conversationId?: string;
    messageId?: string;
  }): Promise<void> {
    if (input.channel === MessagingChannel.EMAIL) {
      if (!input.conversationId || !input.messageId) {
        return;
      }

      await this.email.sendReply({
        organizationId: input.organizationId,
        to: input.threadId,
        body: input.body,
        conversationId: input.conversationId,
        messageId: input.messageId
      });
      return;
    }

    const connection = await this.prisma.channelConnection.findFirst({
      where: { organizationId: input.organizationId, channel: input.channel, isActive: true }
    });

    if (!connection?.accessToken) {
      return;
    }

    const base = this.config.get<string>("GRAPH_API_BASE_URL") ?? "https://graph.facebook.com/v21.0";
    const url =
      connection.channel === MessagingChannel.WHATSAPP
        ? `${base}/${encodeURIComponent(connection.externalId)}/messages`
        : `${base}/${encodeURIComponent(connection.externalId)}/messages`;
    const body =
      connection.channel === MessagingChannel.WHATSAPP
        ? {
            messaging_product: "whatsapp",
            to: input.threadId,
            type: "text",
            text: { body: input.body }
          }
        : {
            recipient: { id: input.threadId },
            message: { text: input.body },
            messaging_type: "RESPONSE"
          };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${connection.accessToken}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000)
      });

      if (!response.ok) {
        this.logger.warn(`${connection.channel} send failed with status ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `${connection.channel} send failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async storeInbound(connection: ChannelConnection, message: InboundMessage): Promise<void> {
    const existing = await this.prisma.message.findFirst({
      where: { organizationId: connection.organizationId, channelMessageId: message.messageId }
    });

    if (existing) {
      return; // Meta retries webhooks; never store the same message twice.
    }

    const visitor = await this.prisma.visitor.upsert({
      where: {
        organizationId_externalId: {
          organizationId: connection.organizationId,
          externalId: `${connection.channel.toLowerCase()}:${message.threadId}`
        }
      },
      create: {
        organizationId: connection.organizationId,
        externalId: `${connection.channel.toLowerCase()}:${message.threadId}`,
        ...(message.senderName ? { name: message.senderName } : {}),
        ...(message.senderPhone ? { phone: message.senderPhone } : {}),
        ...(message.senderEmail ? { email: message.senderEmail } : {})
      },
      update: { lastSeenAt: new Date() }
    });

    const contact = await this.contacts
      .linkVisitorToContact({
        organizationId: connection.organizationId,
        visitorId: visitor.id,
        ...(message.senderName ? { name: message.senderName } : {}),
        ...(message.senderPhone ? { phone: message.senderPhone } : {}),
        ...(message.senderEmail ? { email: message.senderEmail } : {})
      })
      .catch(() => null);

    let conversation = message.conversationId
      ? await this.prisma.conversation.findFirst({
          where: { id: message.conversationId, organizationId: connection.organizationId }
        })
      : null;

    conversation ??= await this.prisma.conversation.findFirst({
      where: {
        organizationId: connection.organizationId,
        channel: connection.channel,
        channelThreadId: message.threadId,
        status: { notIn: [ConversationStatus.CLOSED, ConversationStatus.RESOLVED] }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          organizationId: connection.organizationId,
          visitorId: visitor.id,
          ...(contact ? { contactId: contact.id } : {}),
          channel: connection.channel,
          channelThreadId: message.threadId,
          source:
            connection.channel === MessagingChannel.EMAIL
              ? ConversationSource.EMAIL
              : ConversationSource.SOCIAL,
          status: ConversationStatus.QUEUED,
          priority: ConversationPriority.NORMAL,
          subject:
            message.subject ?? message.senderName ?? this.channelLabel(connection.channel)
        }
      });

      await this.prisma.conversationParticipant.create({
        data: {
          organizationId: connection.organizationId,
          conversationId: conversation.id,
          participantType: ParticipantType.VISITOR,
          visitorId: visitor.id
        }
      });

      this.gateway.emitConversationCreated(this.mapConversation(conversation));
      void this.notifications.notifyOrganization({
        organizationId: connection.organizationId,
        type: "chat.channel",
        subject: `New ${this.channelLabel(connection.channel)} message`,
        body: message.text,
        payload: { conversationId: conversation.id }
      });
    }

    const created = await this.prisma.message.create({
      data: {
        organizationId: connection.organizationId,
        conversationId: conversation.id,
        senderType: ParticipantType.VISITOR,
        senderVisitorId: visitor.id,
        type: MessageType.TEXT,
        visibility: MessageVisibility.PUBLIC,
        status: MessageStatus.SENT,
        body: maskCardNumbers(message.text),
        channelMessageId: message.messageId,
        metadata: { channel: connection.channel }
      }
    });

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: created.createdAt }
      }),
      this.prisma.channelConnection.update({
        where: { id: connection.id },
        data: { lastEventAt: new Date() }
      })
    ]);

    this.gateway.emitMessageCreated({
      id: created.id,
      organizationId: created.organizationId,
      conversationId: created.conversationId,
      senderType: created.senderType,
      senderVisitorId: created.senderVisitorId,
      senderMembershipId: created.senderMembershipId,
      type: created.type,
      visibility: created.visibility,
      status: created.status,
      body: created.body,
      idempotencyKey: created.idempotencyKey,
      metadata: (created.metadata ?? {}) as Record<string, unknown>,
      createdAt: created.createdAt,
      editedAt: created.editedAt,
      deletedAt: created.deletedAt
    });
  }

  /** Meta signs every webhook body with the app secret. */
  private assertSignature(
    connection: ChannelConnection,
    rawBody: Buffer | undefined,
    signature: string | undefined
  ): void {
    if (!connection.appSecret) {
      return; // No app secret stored (e.g. local testing) — nothing to verify against.
    }

    if (!rawBody || !signature) {
      throw new UnauthorizedException("Missing webhook signature");
    }

    const expected = Buffer.from(
      `sha256=${createHmac("sha256", connection.appSecret).update(rawBody).digest("hex")}`
    );
    const received = Buffer.from(signature.trim());

    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
  }

  private parseInbound(channel: MessagingChannel, payload: unknown): InboundMessage[] {
    const root = this.asRecord(payload);
    const entries = Array.isArray(root.entry) ? root.entry : [];
    const messages: InboundMessage[] = [];

    for (const rawEntry of entries) {
      const entry = this.asRecord(rawEntry);

      if (channel === MessagingChannel.WHATSAPP) {
        for (const rawChange of Array.isArray(entry.changes) ? entry.changes : []) {
          const value = this.asRecord(this.asRecord(rawChange).value);
          const metadata = this.asRecord(value.metadata);
          const contacts = Array.isArray(value.contacts) ? value.contacts : [];
          const profileName = this.asRecord(this.asRecord(contacts[0]).profile).name;

          for (const rawMessage of Array.isArray(value.messages) ? value.messages : []) {
            const message = this.asRecord(rawMessage);
            const text = this.asRecord(message.text).body;

            if (typeof message.id === "string" && typeof message.from === "string" && typeof text === "string") {
              messages.push({
                externalId: this.asString(metadata.phone_number_id),
                threadId: message.from,
                messageId: message.id,
                text,
                ...(typeof profileName === "string" ? { senderName: profileName } : {}),
                senderPhone: message.from
              });
            }
          }
        }
        continue;
      }

      // Messenger and Instagram share the "messaging" shape.
      for (const rawEvent of Array.isArray(entry.messaging) ? entry.messaging : []) {
        const event = this.asRecord(rawEvent);
        const sender = this.asRecord(event.sender);
        const message = this.asRecord(event.message);

        if (typeof message.mid === "string" && typeof sender.id === "string" && typeof message.text === "string") {
          messages.push({
            externalId:
              this.asString(this.asRecord(event.recipient).id) ||
              this.asString(entry.id),
            threadId: sender.id,
            messageId: message.mid,
            text: message.text
          });
        }
      }
    }

    return messages;
  }

  private mapConversation(conversation: {
    id: string;
    organizationId: string;
    visitorId: string | null;
    contactId: string | null;
    widgetId: string | null;
    departmentId: string | null;
    assignedAgentId: string | null;
    source: ConversationSource;
    channel: MessagingChannel | null;
    channelThreadId: string | null;
    status: ConversationStatus;
    priority: ConversationPriority;
    subject: string | null;
    locale: string | null;
    metadata: unknown;
    firstResponseAt: Date | null;
    lastMessageAt: Date | null;
    resolvedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: conversation.id,
      organizationId: conversation.organizationId,
      visitorId: conversation.visitorId,
      contactId: conversation.contactId,
      widgetId: conversation.widgetId,
      departmentId: conversation.departmentId,
      assignedAgentId: conversation.assignedAgentId,
      source: conversation.source,
      channel: conversation.channel,
      channelThreadId: conversation.channelThreadId,
      status: conversation.status,
      priority: conversation.priority,
      subject: conversation.subject,
      locale: conversation.locale,
      metadata: (conversation.metadata ?? {}) as Record<string, unknown>,
      firstResponseAt: conversation.firstResponseAt,
      lastMessageAt: conversation.lastMessageAt,
      resolvedAt: conversation.resolvedAt,
      closedAt: conversation.closedAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      latestMessage: null,
      unreadCount: 0
    };
  }

  private map(connection: ChannelConnection): ChannelConnectionDto {
    return {
      channel: connection.channel,
      externalId: connection.externalId,
      displayName: connection.displayName,
      isActive: connection.isActive,
      connected: true,
      webhookUrl: this.webhookUrl(connection.channel),
      verifyToken: connection.verifyToken,
      lastEventAt: connection.lastEventAt
    };
  }

  private webhookUrl(channel: MessagingChannel): string {
    const apiUrl = (this.config.get<string>("API_URL") ?? "http://localhost:4000").replace(/\/$/, "");
    const prefix = (this.config.get<string>("API_GLOBAL_PREFIX") ?? "api/v1").replace(/^\/|\/$/g, "");

    return `${apiUrl}/${prefix}/channels/webhooks/${channel.toLowerCase()}`;
  }

  private channelLabel(channel: MessagingChannel): string {
    return channel === MessagingChannel.WHATSAPP
      ? "WhatsApp"
      : channel === MessagingChannel.MESSENGER
        ? "Messenger"
        : channel === MessagingChannel.INSTAGRAM
          ? "Instagram"
          : channel === MessagingChannel.EMAIL
            ? "Email"
            : "Apple Messages";
  }

  private randomVerifyToken(): string {
    return `lcv_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  /** Webhook ids arrive as untrusted JSON; anything that is not a string is treated as missing. */
  private asString(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  static channelFromSlug(slug: string): MessagingChannel {
    const channel = slug.toUpperCase();
    const known = Object.values(MessagingChannel) as string[];

    if (!known.includes(channel)) {
      throw new NotFoundException("Unknown channel");
    }

    return channel as MessagingChannel;
  }
}
