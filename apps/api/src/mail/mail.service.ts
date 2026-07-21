import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

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
  async send(input: { to: string; subject: string; text: string; html?: string }): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(
        `Email not sent (SMTP not configured). Would send "${input.subject}" to ${input.to}`
      );
      return false;
    }

    try {
      await transporter.sendMail({
        from: this.config.get<string>("SMTP_FROM") ?? "LiveChat SaaS <no-reply@example.com>",
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {})
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
