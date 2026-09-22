import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy } from "@nestjs/common";
import { ReportSchedule } from "@prisma/client";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReportsService } from "./reports.service";

export type ReportType = "chats" | "agents" | "tags";

export interface ReportScheduleDto {
  id: string;
  reportType: ReportType;
  frequency: "daily" | "weekly";
  recipients: string[];
  hourUtc: number;
  isActive: boolean;
  lastRunAt: Date | null;
}

const REPORT_TYPES: ReportType[] = ["chats", "agents", "tags"];
const FREQUENCIES = ["daily", "weekly"] as const;
/** How often the runner looks for schedules that are due. */
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Reports you can take away: a CSV of the raw rows, and the same CSV emailed on a
 * schedule so the people who never open the dashboard still get the numbers.
 */
@Injectable()
export class ReportExportService implements OnModuleDestroy {
  private readonly logger = new Logger(ReportExportService.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly mail: MailService
  ) {}

  /** Started from the module so tests can construct the service without a timer running. */
  startScheduler(): void {
    if (this.sweepTimer) {
      return;
    }

    this.sweepTimer = setInterval(() => {
      void this.runDueSchedules().catch((error: unknown) => {
        this.logger.warn(
          `Scheduled report sweep failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }, SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  // -------------------------------------------------------------------- CSV

  async toCsv(organizationId: string, type: ReportType, days = 30): Promise<string> {
    this.assertType(type);

    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 24 * 60 * 60 * 1000);

    if (type === "chats") {
      const conversations = await this.prisma.conversation.findMany({
        where: { organizationId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5000
      });
      const counts = await this.messageCounts(conversations.map((conversation) => conversation.id));

      return this.csv(
        ["Chat id", "Started", "Status", "Priority", "Source", "Channel", "Subject", "Messages", "Tags"],
        conversations.map((conversation) => [
          conversation.id,
          conversation.createdAt.toISOString(),
          conversation.status,
          conversation.priority,
          conversation.source,
          conversation.channel ?? "",
          conversation.subject ?? "",
          String(counts.get(conversation.id) ?? 0),
          this.tagsOf(conversation.metadata).join(" ")
        ])
      );
    }

    if (type === "agents") {
      const members = await this.prisma.userOrganization.findMany({
        where: { organizationId, status: "ACTIVE" }
      });
      // The membership has no user relation in the schema, so names come from a second read.
      const users = await this.prisma.user.findMany({
        where: { id: { in: members.map((member) => member.userId) } },
        select: { id: true, email: true, name: true }
      });
      const byUserId = new Map(users.map((user) => [user.id, user]));
      const rows = await Promise.all(
        members.map(async (member) => {
          const user = byUserId.get(member.userId);
          const [assigned, resolved, messages] = await Promise.all([
            this.prisma.conversation.count({
              where: { organizationId, assignedAgentId: member.id, createdAt: { gte: since } }
            }),
            this.prisma.conversation.count({
              where: {
                organizationId,
                assignedAgentId: member.id,
                status: { in: ["RESOLVED", "CLOSED"] },
                createdAt: { gte: since }
              }
            }),
            this.prisma.message.count({
              where: { organizationId, senderMembershipId: member.id, createdAt: { gte: since } }
            })
          ]);

          return [
            member.displayName ?? user?.name ?? "",
            user?.email ?? "",
            member.agentStatus,
            String(assigned),
            String(resolved),
            String(messages)
          ];
        })
      );

      return this.csv(["Agent", "Email", "Status", "Chats assigned", "Chats resolved", "Messages sent"], rows);
    }

    // tags
    const conversations = await this.prisma.conversation.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { metadata: true },
      take: 5000
    });
    const tally = new Map<string, number>();

    for (const conversation of conversations) {
      for (const tag of this.tagsOf(conversation.metadata)) {
        tally.set(tag, (tally.get(tag) ?? 0) + 1);
      }
    }

    return this.csv(
      ["Tag", "Chats"],
      [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => [tag, String(count)])
    );
  }

  // --------------------------------------------------------------- schedules

  async listSchedules(organizationId: string): Promise<ReportScheduleDto[]> {
    const schedules = await this.prisma.reportSchedule.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    });

    return schedules.map((schedule) => this.map(schedule));
  }

  async createSchedule(
    organizationId: string,
    input: { reportType: string; frequency: string; recipients: string[]; hourUtc?: number }
  ): Promise<ReportScheduleDto> {
    this.assertType(input.reportType);

    if (!FREQUENCIES.includes(input.frequency as (typeof FREQUENCIES)[number])) {
      throw new BadRequestException("Pick daily or weekly");
    }

    const recipients = this.cleanRecipients(input.recipients);

    if (!recipients.length) {
      throw new BadRequestException("Add at least one email address to send the report to");
    }

    const schedule = await this.prisma.reportSchedule.create({
      data: {
        organizationId,
        reportType: input.reportType,
        frequency: input.frequency,
        recipients,
        hourUtc: Math.min(Math.max(input.hourUtc ?? 7, 0), 23)
      }
    });

    return this.map(schedule);
  }

  async updateSchedule(
    organizationId: string,
    scheduleId: string,
    input: { frequency?: string; recipients?: string[]; hourUtc?: number; isActive?: boolean }
  ): Promise<ReportScheduleDto> {
    const schedule = await this.getOrThrow(organizationId, scheduleId);

    if (input.frequency && !FREQUENCIES.includes(input.frequency as (typeof FREQUENCIES)[number])) {
      throw new BadRequestException("Pick daily or weekly");
    }

    const recipients = input.recipients ? this.cleanRecipients(input.recipients) : undefined;

    if (recipients && !recipients.length) {
      throw new BadRequestException("Add at least one email address to send the report to");
    }

    const updated = await this.prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: {
        ...(input.frequency ? { frequency: input.frequency } : {}),
        ...(recipients ? { recipients } : {}),
        ...(input.hourUtc !== undefined ? { hourUtc: Math.min(Math.max(input.hourUtc, 0), 23) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      }
    });

    return this.map(updated);
  }

  async removeSchedule(organizationId: string, scheduleId: string): Promise<{ success: true }> {
    const schedule = await this.getOrThrow(organizationId, scheduleId);
    await this.prisma.reportSchedule.delete({ where: { id: schedule.id } });

    return { success: true };
  }

  /** Send one schedule now — used by "Send now" and by the sweep. */
  async runSchedule(
    organizationId: string,
    scheduleId: string
  ): Promise<{ sent: boolean; recipients: string[] }> {
    const schedule = await this.getOrThrow(organizationId, scheduleId);

    return this.send(schedule);
  }

  /** Every active schedule whose turn has come. */
  async runDueSchedules(now: Date = new Date()): Promise<number> {
    const schedules = await this.prisma.reportSchedule.findMany({ where: { isActive: true } });
    let sent = 0;

    for (const schedule of schedules) {
      if (this.isDue(schedule, now)) {
        const result = await this.send(schedule).catch(() => ({ sent: false, recipients: [] }));
        if (result.sent) {
          sent += 1;
        }
      }
    }

    return sent;
  }

  private isDue(schedule: ReportSchedule, now: Date): boolean {
    if (now.getUTCHours() < schedule.hourUtc) {
      return false;
    }

    if (!schedule.lastRunAt) {
      return true;
    }

    const hoursSince = (now.getTime() - schedule.lastRunAt.getTime()) / (60 * 60 * 1000);

    return schedule.frequency === "daily" ? hoursSince >= 23 : hoursSince >= 24 * 7 - 1;
  }

  private async send(schedule: ReportSchedule): Promise<{ sent: boolean; recipients: string[] }> {
    const days = schedule.frequency === "daily" ? 1 : 7;
    const csv = await this.toCsv(schedule.organizationId, schedule.reportType as ReportType, days);
    const summary = await this.reports.getSummary(schedule.organizationId);
    const period = schedule.frequency === "daily" ? "yesterday" : "the last 7 days";

    const text = [
      `Here is your ${schedule.frequency} ${schedule.reportType} report for ${period}.`,
      "",
      `Chats: ${summary.totalConversations}`,
      `Messages: ${summary.totalMessages}`,
      `Missed chats (last 7 days): ${summary.engagement.missedChats}`,
      `Customers: ${summary.customers.total}`,
      "",
      "The full breakdown is attached as CSV below.",
      "",
      csv
    ].join("\n");

    const sent = await Promise.all(
      schedule.recipients.map((to) =>
        this.mail.send({
          to,
          subject: `Chatme ${schedule.frequency} ${schedule.reportType} report`,
          text
        })
      )
    );

    await this.prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: new Date() }
    });

    return { sent: sent.some(Boolean), recipients: schedule.recipients };
  }

  // --------------------------------------------------------------- utilities

  private async messageCounts(conversationIds: string[]): Promise<Map<string, number>> {
    if (!conversationIds.length) {
      return new Map();
    }

    const rows = await this.prisma.message.groupBy({
      by: ["conversationId"],
      where: { conversationId: { in: conversationIds } },
      _count: { _all: true }
    });

    return new Map(rows.map((row) => [row.conversationId, row._count._all]));
  }

  private tagsOf(metadata: unknown): string[] {
    const record =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};

    return Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === "string")
      : [];
  }

  /** Quote every field so commas, quotes and newlines in a message can't break the file. */
  private csv(headers: string[], rows: string[][]): string {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  }

  private cleanRecipients(recipients: string[]): string[] {
    return Array.from(
      new Set(
        recipients
          .map((email) => email.trim().toLowerCase())
          .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      )
    ).slice(0, 20);
  }

  private assertType(type: string): asserts type is ReportType {
    if (!REPORT_TYPES.includes(type as ReportType)) {
      throw new BadRequestException(`Pick one of: ${REPORT_TYPES.join(", ")}`);
    }
  }

  private async getOrThrow(organizationId: string, scheduleId: string): Promise<ReportSchedule> {
    const schedule = await this.prisma.reportSchedule.findFirst({
      where: { id: scheduleId, organizationId }
    });

    if (!schedule) {
      throw new NotFoundException("Scheduled report not found");
    }

    return schedule;
  }

  private map(schedule: ReportSchedule): ReportScheduleDto {
    return {
      id: schedule.id,
      reportType: schedule.reportType as ReportType,
      frequency: schedule.frequency === "daily" ? "daily" : "weekly",
      recipients: schedule.recipients,
      hourUtc: schedule.hourUtc,
      isActive: schedule.isActive,
      lastRunAt: schedule.lastRunAt
    };
  }
}
