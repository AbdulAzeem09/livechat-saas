import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { conversationFilter, type ReportFilters } from "./report-filters";

export interface ReportSummary {
  totalConversations: number;
  totalMessages: number;
  /** Real engagement figures for the last 7 days (no estimates). */
  engagement: {
    visitors: number;
    chats: number;
    /** Share of tracked visitors who started a chat, as a percentage. */
    engagementRate: number;
    /** Chats that no agent ever answered. */
    missedChats: number;
    averageMessagesPerChat: number;
  };
  customers: {
    total: number;
    returning: number;
    newLast7Days: number;
  };
  /** Most used conversation tags (counted from the chats themselves). */
  tagUsage: Array<{ tag: string; count: number }>;
  campaigns: {
    total: number;
    active: number;
    goals: number;
    goalsCompleted: number;
    /** Campaigns are not shown to visitors yet, so there is nothing to convert. */
    delivering: boolean;
  };
  byStatus: Record<string, number>;
  openCount: number;
  resolvedCount: number;
  last7Days: Array<{ date: string; count: number }>;
  averageFirstResponseSeconds: number | null;
  satisfaction: { good: number; bad: number };
  ecommerce: {
    salesCount: number;
    salesTotalCents: number;
    currency: string;
    averageOrderCents: number;
    conversionRate: number;
    last7Days: Array<{ date: string; total: number }>;
  };
  legal: {
    /** Whether any legal-intake data exists (drives whether the UI shows this). */
    active: boolean;
    /** Chats that produced a structured legal intake (last 30 days). */
    totalIntakes: number;
    /** Intakes the AI judged a real, qualified legal matter. */
    qualifiedLeads: number;
    /** Intakes captured outside 9am–6pm (after-hours leads that would be missed). */
    afterHoursLeads: number;
    /** Intakes that produced at least one risk flag. */
    flaggedLeads: number;
    flags: { conflict: number; jurisdiction: number; statute: number };
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(organizationId: string, filters: ReportFilters = {}): Promise<ReportSummary> {
    const now = new Date();
    const since = filters.from ?? this.startOfDaysAgo(now, 6);
    const filter = conversationFilter(filters);

    /**
     * Conversation queries, narrowed by whatever the caller asked for.
     *
     * Conditions go in an AND rather than a spread because several of them reach into the
     * same metadata column — a tag filter and a rating check would otherwise overwrite each
     * other. A query's own default window is dropped when the caller gave real dates, so
     * asking for last month doesn't get intersected with "the last 7 days" and come back empty.
     */
    const scoped = (
      own: Prisma.ConversationWhereInput = {},
      defaultWindow?: Prisma.DateTimeFilter
    ): Prisma.ConversationWhereInput => {
      const conditions: Prisma.ConversationWhereInput[] = [filter, own];

      if (defaultWindow && !filter.createdAt) {
        conditions.push({ createdAt: defaultWindow });
      }

      return { organizationId, AND: conditions };
    };

    const [
      totalConversations,
      totalMessages,
      grouped,
      recent,
      responded,
      goodCount,
      badCount,
      salesAggregate,
      recentSales,
      legalConvos,
      visitorsLast7Days,
      chatsLast7Days,
      answeredChatIds,
      contactsTotal,
      newContacts,
      taggedConversations,
      campaignRows,
      goalRows
    ] = await Promise.all([
      this.prisma.conversation.count({ where: scoped() }),
      this.prisma.message.count({ where: { organizationId } }),
      this.prisma.conversation.groupBy({
        by: ["status"],
        where: scoped(),
        _count: { _all: true }
      }),
      this.prisma.conversation.findMany({
        where: scoped({}, { gte: since }),
        select: { createdAt: true }
      }),
      this.prisma.conversation.findMany({
        where: scoped({ firstResponseAt: { not: null } }),
        select: { createdAt: true, firstResponseAt: true },
        orderBy: { createdAt: "desc" },
        take: 500
      }),
      this.prisma.conversation.count({
        where: scoped({ metadata: { path: ["rating"], equals: "good" } })
      }),
      this.prisma.conversation.count({
        where: scoped({ metadata: { path: ["rating"], equals: "bad" } })
      }),
      this.prisma.sale.aggregate({
        where: { organizationId },
        _count: { _all: true },
        _sum: { amountCents: true }
      }),
      this.prisma.sale.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: { createdAt: true, amountCents: true, currency: true }
      }),
      this.prisma.conversation.findMany({
        where: scoped({}, { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }),
        select: { createdAt: true, metadata: true },
        orderBy: { createdAt: "desc" },
        take: 1000
      }),
      this.prisma.visitorSession.count({ where: { organizationId, startedAt: { gte: since } } }),
      this.prisma.conversation.findMany({
        where: scoped({}, { gte: since }),
        select: { id: true }
      }),
      this.prisma.message.groupBy({
        by: ["conversationId"],
        where: { organizationId, senderType: "AGENT", createdAt: { gte: since } },
        _count: { _all: true }
      }),
      this.prisma.contact.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.contact.count({
        where: { organizationId, deletedAt: null, createdAt: { gte: since } }
      }),
      this.prisma.conversation.findMany({
        where: scoped({}, { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }),
        select: { metadata: true },
        take: 2000
      }),
      this.prisma.campaign.findMany({ where: { organizationId }, select: { enabled: true } }),
      this.prisma.goal.findMany({ where: { organizationId }, select: { completedCount: true } })
    ]);

    const legal = this.computeLegalMetrics(legalConvos);

    const byStatus: Record<string, number> = {};
    for (const row of grouped) {
      byStatus[row.status] = row._count._all;
    }

    const openCount =
      (byStatus.QUEUED ?? 0) + (byStatus.OPEN ?? 0) + (byStatus.PENDING ?? 0);
    const resolvedCount = (byStatus.RESOLVED ?? 0) + (byStatus.CLOSED ?? 0);

    const last7Days = this.buildDailyBuckets(since, recent.map((item) => item.createdAt));

    let averageFirstResponseSeconds: number | null = null;
    if (responded.length > 0) {
      const totalSeconds = responded.reduce((sum, item) => {
        const delta = (item.firstResponseAt!.getTime() - item.createdAt.getTime()) / 1000;
        return sum + Math.max(0, delta);
      }, 0);
      averageFirstResponseSeconds = Math.round(totalSeconds / responded.length);
    }

    const salesCount = salesAggregate._count._all;
    const salesTotalCents = salesAggregate._sum.amountCents ?? 0;
    const currency = recentSales[0]?.currency ?? "usd";
    const averageOrderCents = salesCount > 0 ? Math.round(salesTotalCents / salesCount) : 0;
    const conversionRate =
      totalConversations > 0 ? Math.round((salesCount / totalConversations) * 1000) / 10 : 0;
    const last7DaysSales = this.buildDailySalesBuckets(since, recentSales);

    // ---- engagement / customers / tags (measured, never estimated) ----
    const answeredIds = new Set(answeredChatIds.map((row) => row.conversationId));
    const missedChats = chatsLast7Days.filter((chat) => !answeredIds.has(chat.id)).length;
    const messagesLast7Days = await this.prisma.message.count({
      where: { organizationId, createdAt: { gte: since } }
    });
    const engagement = {
      visitors: visitorsLast7Days,
      chats: chatsLast7Days.length,
      engagementRate:
        visitorsLast7Days > 0
          ? Math.round((chatsLast7Days.length / visitorsLast7Days) * 1000) / 10
          : 0,
      missedChats,
      averageMessagesPerChat:
        chatsLast7Days.length > 0
          ? Math.round((messagesLast7Days / chatsLast7Days.length) * 10) / 10
          : 0
    };

    const returningContacts = await this.prisma.conversation.groupBy({
      by: ["contactId"],
      where: { organizationId, contactId: { not: null } },
      _count: { _all: true }
    });
    const customers = {
      total: contactsTotal,
      returning: returningContacts.filter((row) => row._count._all > 1).length,
      newLast7Days: newContacts
    };

    const tagCounts = new Map<string, number>();
    for (const conversation of taggedConversations) {
      const meta =
        conversation.metadata && typeof conversation.metadata === "object" && !Array.isArray(conversation.metadata)
          ? (conversation.metadata as Record<string, unknown>)
          : null;
      const tags = Array.isArray(meta?.tags) ? meta.tags : [];
      for (const tag of tags) {
        if (typeof tag === "string" && tag.trim()) {
          const name = tag.trim().toLowerCase();
          tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);
        }
      }
    }
    const tagUsage = [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const campaigns = {
      total: campaignRows.length,
      active: campaignRows.filter((campaign) => campaign.enabled).length,
      goals: goalRows.length,
      goalsCompleted: goalRows.reduce((sum, goal) => sum + goal.completedCount, 0),
      // Campaigns are stored but never displayed to visitors yet.
      delivering: false
    };

    return {
      totalConversations,
      totalMessages,
      engagement,
      customers,
      tagUsage,
      campaigns,
      byStatus,
      openCount,
      resolvedCount,
      last7Days,
      averageFirstResponseSeconds,
      satisfaction: { good: goodCount, bad: badCount },
      ecommerce: {
        salesCount,
        salesTotalCents,
        currency,
        averageOrderCents,
        conversionRate,
        last7Days: last7DaysSales
      },
      legal
    };
  }

  /** Aggregate legal-intake analyses stored on conversation.metadata.legalIntake. */
  private computeLegalMetrics(
    conversations: Array<{ createdAt: Date; metadata: unknown }>
  ): ReportSummary["legal"] {
    let totalIntakes = 0;
    let qualifiedLeads = 0;
    let afterHoursLeads = 0;
    let flaggedLeads = 0;
    const flags = { conflict: 0, jurisdiction: 0, statute: 0 };

    for (const convo of conversations) {
      const meta =
        convo.metadata && typeof convo.metadata === "object" && !Array.isArray(convo.metadata)
          ? (convo.metadata as Record<string, unknown>)
          : null;
      const intake = meta?.legalIntake;
      if (!intake || typeof intake !== "object") {
        continue;
      }
      const analysis = intake as { fields?: { qualified?: boolean }; flags?: Array<{ type?: string }> };
      totalIntakes += 1;
      if (analysis.fields?.qualified !== false) {
        qualifiedLeads += 1;
      }
      const hour = convo.createdAt.getHours();
      if (hour < 9 || hour >= 18) {
        afterHoursLeads += 1;
      }
      const flagList = Array.isArray(analysis.flags) ? analysis.flags : [];
      if (flagList.length > 0) {
        flaggedLeads += 1;
      }
      for (const flag of flagList) {
        if (flag?.type === "conflict") flags.conflict += 1;
        else if (flag?.type === "jurisdiction") flags.jurisdiction += 1;
        else if (flag?.type === "statute") flags.statute += 1;
      }
    }

    return {
      active: totalIntakes > 0,
      totalIntakes,
      qualifiedLeads,
      afterHoursLeads,
      flaggedLeads,
      flags
    };
  }

  private buildDailySalesBuckets(
    since: Date,
    sales: Array<{ createdAt: Date; amountCents: number }>
  ): Array<{ date: string; total: number }> {
    const keyOf = (d: Date) => d.toISOString().slice(0, 10);
    const totals = new Map<string, number>();

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      totals.set(keyOf(day), 0);
    }

    for (const sale of sales) {
      const key = keyOf(sale.createdAt);
      if (totals.has(key)) {
        totals.set(key, (totals.get(key) ?? 0) + sale.amountCents);
      }
    }

    return Array.from(totals.entries()).map(([date, total]) => ({ date, total }));
  }

  /** Midnight, n days back — the start of the default reporting window. */
  private startOfDaysAgo(now: Date, days: number): Date {
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    return start;
  }

  private buildDailyBuckets(since: Date, dates: Date[]): Array<{ date: string; count: number }> {
    const buckets: Array<{ date: string; count: number }> = [];
    const keyOf = (d: Date) => d.toISOString().slice(0, 10);
    const counts = new Map<string, number>();

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      const key = keyOf(day);
      counts.set(key, 0);
      buckets.push({ date: key, count: 0 });
    }

    for (const date of dates) {
      const key = keyOf(date);
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return buckets.map((bucket) => ({ date: bucket.date, count: counts.get(bucket.date) ?? 0 }));
  }
}
