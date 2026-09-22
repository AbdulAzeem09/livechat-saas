import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Overrides SMTP_FROM — the email channel sends as the workspace's support address. */
  from?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** True when SMTP credentials are configured (email will actually be sent). */
  isConfigured(): boolean {
    return Boolean(this.config.get<string>("SMTP_HOST"));
  }

  private getTransporter(): Transporter | null {
    if (!this.isConfigured()) {
      return null;
    }
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.getOrThrow<string>("SMTP_HOST"),
        port: this.config.get<number>("SMTP_PORT") ?? 587,
        secure: (this.config.get<number>("SMTP_PORT") ?? 587) === 465,
        auth: {
          user: this.config.get<string>("SMTP_USER") ?? "",
          pass: this.config.get<string>("SMTP_PASSWORD") ?? ""
        }
      });
    }
    return this.transporter;
  }

  /**
   * Send an email. No-ops (logs) gracefully when SMTP isn't configured, so the
   * feature is fully wired and starts working the moment SMTP keys are added.
   */
  async send(input: MailInput): Promise<boolean> {
    return Boolean(await this.sendAndGetMessageId(input));
  }

  /**
   * Same as `send`, but returns the Message-ID the mail server gave the message.
   * The email channel stores it so the customer's reply can be threaded back onto
   * the same conversation. Returns null when nothing was sent.
   */
  async sendAndGetMessageId(input: MailInput): Promise<string | null> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(
        `Email not sent (SMTP not configured). Would send "${input.subject}" to ${input.to}`
      );
      return null;
    }

    try {
      const result = (await transporter.sendMail({
        from: input.from ?? this.config.get<string>("SMTP_FROM") ?? "Chatme <no-reply@example.com>",
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
        ...(input.references?.length ? { references: input.references } : {})
      })) as { messageId?: string };

      return result.messageId ?? "";
    } catch (error) {
      this.logger.error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
