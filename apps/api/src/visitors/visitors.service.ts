import { Injectable } from "@nestjs/common";
import {
  ConversationStatus,
  Visitor,
  VisitorPageView,
  VisitorSession
} from "@prisma/client";
import { Conversation } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LiveVisitorDto } from "./dto/visitor-response.dto";

/** Visitors seen within this window appear in Traffic (browsing now or recently left). */
const LIVE_WINDOW_MS = 30 * 60_000;
/** Seen more recently than this = still on the site, otherwise "Left website". */
const ONLINE_WINDOW_MS = 60_000;

@Injectable()
export class VisitorsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLive(organizationId: string): Promise<LiveVisitorDto[]> {
    const since = new Date(Date.now() - LIVE_WINDOW_MS);

    const visitors = await this.prisma.visitor.findMany({
      where: { organizationId, lastSeenAt: { gte: since } },
      orderBy: { lastSeenAt: "desc" },
      take: 200
    });

    if (!visitors.length) {
      return [];
    }

    const visitorIds = visitors.map((visitor) => visitor.id);

    const [sessions, pageViews, conversations] = await Promise.all([
      this.prisma.visitorSession.findMany({
        where: { organizationId, visitorId: { in: visitorIds } },
        orderBy: { startedAt: "desc" }
      }),
      this.prisma.visitorPageView.findMany({
        where: { organizationId, visitorId: { in: visitorIds } },
        orderBy: { viewedAt: "desc" },
        take: 2000
      }),
      this.prisma.conversation.findMany({
        where: {
          organizationId,
          visitorId: { in: visitorIds },
          status: {
            in: [ConversationStatus.QUEUED, ConversationStatus.OPEN, ConversationStatus.PENDING]
          }
        },
        orderBy: { lastMessageAt: "desc" }
      })
    ]);

    const latestSession = this.firstByVisitor(sessions);
    const latestPageView = this.firstByVisitor(pageViews);
    const pageViewCount = this.countByVisitor(pageViews);
    const activeConversation = new Map<string, Conversation>();
    for (const conversation of conversations) {
      if (conversation.visitorId && !activeConversation.has(conversation.visitorId)) {
        activeConversation.set(conversation.visitorId, conversation);
      }
    }

    return visitors.map((visitor) => this.mapVisitor(visitor, {
      session: latestSession.get(visitor.id),
      pageView: latestPageView.get(visitor.id),
      pageViews: pageViewCount.get(visitor.id) ?? 0,
      conversation: activeConversation.get(visitor.id) ?? null
    }));
  }

  private mapVisitor(
    visitor: Visitor,
    extra: {
      session: VisitorSession | undefined;
      pageView: VisitorPageView | undefined;
      pageViews: number;
      conversation: Conversation | null;
    }
  ): LiveVisitorDto {
    const lastSeen = visitor.lastSeenAt ? visitor.lastSeenAt.getTime() : 0;
    const isOnline = Date.now() - lastSeen < ONLINE_WINDOW_MS;
    const activity = extra.conversation ? "Chatting" : isOnline ? "Browsing" : "Left website";

    // ISP + network type (vpn/hosting/mobile/residential) are stored in the
    // session metadata JSON by the geo lookup — read them back defensively.
    const meta =
      extra.session?.metadata && typeof extra.session.metadata === "object"
        ? (extra.session.metadata as Record<string, unknown>)
        : {};
    const isp = typeof meta.isp === "string" ? meta.isp : null;
    const network = typeof meta.network === "string" ? meta.network : null;

    return {
      id: visitor.id,
      name: visitor.name,
      email: visitor.email,
      firstSeenAt: visitor.firstSeenAt,
      lastSeenAt: visitor.lastSeenAt,
      sessionStartedAt: extra.session?.startedAt ?? null,
      currentPage: extra.pageView?.url ?? extra.session?.landingPage ?? null,
      currentPageTitle: extra.pageView?.title ?? null,
      landingPage: extra.session?.landingPage ?? null,
      referrer: extra.session?.referrer ?? null,
      country: extra.session?.country ?? null,
      state: extra.session?.region ?? null,
      city: extra.session?.city ?? null,
      isp,
      network,
      ip: visitor.lastIp ?? extra.session?.ipAddress ?? null,
      activity,
      chattingWithAgentId: extra.conversation?.assignedAgentId ?? null,
      pageViewCount: extra.pageViews,
      activeConversationId: extra.conversation?.id ?? null
    };
  }

  /** Build a map of visitorId -> first (most recent, given pre-sorted input) row. */
  private firstByVisitor<T extends { visitorId: string }>(rows: T[]): Map<string, T> {
    const map = new Map<string, T>();
    for (const row of rows) {
      if (!map.has(row.visitorId)) {
        map.set(row.visitorId, row);
      }
    }
    return map;
  }

  private countByVisitor<T extends { visitorId: string }>(rows: T[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.visitorId, (map.get(row.visitorId) ?? 0) + 1);
    }
    return map;
  }
}
