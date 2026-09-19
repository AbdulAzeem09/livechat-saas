import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailService } from "../../mail/mail.service";
import { PrismaService } from "../../prisma/prisma.service";

export interface SystemHealth {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  database: { reachable: boolean; latencyMs: number | null };
  memory: { usedMb: number; totalMb: number };
  /** Counted since the server started. */
  errorsLastHour: number;
  failedLoginsLastHour: number;
  checkedAt: string;
}

interface TimedEvent {
  at: number;
  detail: string;
}

/** Don't email the same kind of alert more often than this. */
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
/** Failed sign-ins within an hour that suggest someone is guessing passwords. */
const FAILED_LOGIN_ALERT_THRESHOLD = 25;
/** Server errors within an hour that suggest something is broken, not just unlucky. */
const ERROR_ALERT_THRESHOLD = 25;

/**
 * Answers the question every security review asks: "how would you know something was wrong?"
 *
 * Keeps a rolling count of server errors and failed sign-ins, emails the people in
 * SUPER_ADMIN_EMAILS when either spikes, and exposes a health endpoint a monitor can poll.
 */
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly startedAt = Date.now();
  private errors: TimedEvent[] = [];
  private failedLogins: TimedEvent[] = [];
  private lastAlertAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService
  ) {}

  recordError(detail: string): void {
    this.errors = this.trim([...this.errors, { at: Date.now(), detail }]);

    if (this.errors.length >= ERROR_ALERT_THRESHOLD) {
      void this.alert(
        "errors",
        `${this.errors.length} server errors in the last hour`,
        this.errors.slice(-5).map((event) => event.detail)
      );
    }
  }

  recordFailedLogin(detail: string): void {
    this.failedLogins = this.trim([...this.failedLogins, { at: Date.now(), detail }]);

    if (this.failedLogins.length >= FAILED_LOGIN_ALERT_THRESHOLD) {
      void this.alert(
        "failed-logins",
        `${this.failedLogins.length} failed sign-ins in the last hour`,
        this.failedLogins.slice(-5).map((event) => event.detail)
      );
    }
  }

  async health(): Promise<SystemHealth> {
    const startedAt = Date.now();
    let reachable = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      reachable = false;
    }

    const latencyMs = reachable ? Date.now() - startedAt : null;
    const memory = process.memoryUsage();

    this.errors = this.trim(this.errors);
    this.failedLogins = this.trim(this.failedLogins);

    return {
      status: reachable ? "ok" : "degraded",
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      database: { reachable, latencyMs },
      memory: {
        usedMb: Math.round(memory.heapUsed / 1024 / 1024),
        totalMb: Math.round(memory.rss / 1024 / 1024)
      },
      errorsLastHour: this.errors.length,
      failedLoginsLastHour: this.failedLogins.length,
      checkedAt: new Date().toISOString()
    };
  }

  /** Email the platform owners, at most once per cooldown per kind of alert. */
  private async alert(kind: string, subject: string, examples: string[]): Promise<void> {
    const lastAt = this.lastAlertAt.get(kind) ?? 0;

    if (Date.now() - lastAt < ALERT_COOLDOWN_MS) {
      return;
    }

    this.lastAlertAt.set(kind, Date.now());
    this.logger.warn(`ALERT: ${subject}`);

    const recipients = (this.config.get<string>("SUPER_ADMIN_EMAILS") ?? "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    if (!recipients.length) {
      return;
    }

    const text = [
      subject,
      "",
      "Most recent:",
      ...examples.map((example) => `  - ${example}`),
      "",
      `Server started ${Math.round((Date.now() - this.startedAt) / 60000)} minutes ago.`
    ].join("\n");

    await Promise.all(
      recipients.map((to) => this.mail.send({ to, subject: `LiveChat alert: ${subject}`, text }))
    ).catch(() => undefined);
  }

  private trim(events: TimedEvent[]): TimedEvent[] {
    const cutoff = Date.now() - ONE_HOUR_MS;

    return events.filter((event) => event.at >= cutoff).slice(-500);
  }
}
