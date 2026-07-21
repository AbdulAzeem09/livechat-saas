import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ReportSummary {
  totalConversations: number;
  totalMessages: number;
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
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(organizationId: string): Promise<ReportSummary> {
    const now = new Date();
    const since = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);

    const [
      totalConversations,
      totalMessages,
      grouped,
      recent,
      responded,
      goodCount,
      badCount,
      salesAggregate,
      recentSales
    ] = await Promise.all([
      this.prisma.conversation.count({ where: { organizationId } }),
      this.prisma.message.count({ where: { organizationId } }),
      this.prisma.conversation.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true }
      }),
      this.prisma.conversation.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      this.prisma.conversation.findMany({
        where: { organizationId, firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true },
        orderBy: { createdAt: "desc" },
        take: 500
      }),
      this.prisma.conversation.count({
        where: { organizationId, metadata: { path: ["rating"], equals: "good" } }
      }),
      this.prisma.conversation.count({
        where: { organizationId, metadata: { path: ["rating"], equals: "bad" } }
      }),
      this.prisma.sale.aggregate({
        where: { organizationId },
        _count: { _all: true },
        _sum: { amountCents: true }
      }),
      this.prisma.sale.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: { createdAt: true, amountCents: true, currency: true }
      })
    ]);

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

    return {
      totalConversations,
      totalMessages,
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
      }
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
