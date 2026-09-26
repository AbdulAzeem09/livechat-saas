import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Conversation,
  ConversationSource,
  ConversationStatus,
  Message,
  MessageStatus,
  MessageType,
  MessageVisibility,
  ParticipantType,
  Visitor,
  VisitorPageView,
  VisitorSession
} from "@prisma/client";
import { ConversationsGateway } from "../conversations/conversations.gateway";
import type { ConversationDto, MessageDto } from "../conversations/dto/conversation-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { AgentProfilesService } from "../widgets/agent-profiles.service";
import { LiveVisitorDto } from "./dto/visitor-response.dto";

/** Visitors seen within this window appear in Traffic (browsing now or recently left). */
const LIVE_WINDOW_MS = 30 * 60_000;
/** Seen more recently than this = still on the site, otherwise "Left website". */
const ONLINE_WINDOW_MS = 60_000;

@Injectable()
export class VisitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ConversationsGateway,
    private readonly agentProfiles: AgentProfilesService
  ) {}

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

  /**
   * The "Start chat" button on Traffic: an agent opens a conversation with someone who is
   * just browsing, before the visitor has said anything. Only ever offered for a visitor with
   * no conversation already running, but a second click racing the first is still possible, so
   * that case is refused rather than silently creating a duplicate.
   */
  async startChat(
    organizationId: string,
    visitorId: string,
    membershipId: string,
    message: string | undefined
  ): Promise<{ conversation: ConversationDto; message: MessageDto }> {
    const visitor = await this.prisma.visitor.findFirst({ where: { id: visitorId, organizationId } });

    if (!visitor) {
      throw new NotFoundException("Visitor not found");
    }

    // Their most recent session tells us which widget they're on, and its session token is
    // the socket room a live push reaches. One outside the live window means they have
    // genuinely left, whatever the screen the agent was looking at last showed.
    const since = new Date(Date.now() - LIVE_WINDOW_MS);
    const session = await this.prisma.visitorSession.findFirst({
      where: { organizationId, visitorId, startedAt: { gte: since } },
      orderBy: { startedAt: "desc" }
    });

    if (!session) {
      throw new BadRequestException("This visitor is no longer on the site.");
    }

    const alreadyChatting = await this.prisma.conversation.findFirst({
      where: {
        organizationId,
        visitorId,
        status: { in: [ConversationStatus.QUEUED, ConversationStatus.OPEN, ConversationStatus.PENDING] }
      },
      select: { id: true }
    });

    if (alreadyChatting) {
      throw new BadRequestException("This visitor already has an open chat.");
    }

    const body = message?.trim().slice(0, 4000) || "Hi! Is there anything I can help you with?";

    const result = await this.prisma.$transaction(async (transaction) => {
      const conversation = await transaction.conversation.create({
        data: {
          organizationId,
          visitorId,
          widgetId: session.widgetId,
          assignedAgentId: membershipId,
          source: ConversationSource.WIDGET,
          status: ConversationStatus.OPEN,
          subject: "Proactive chat"
        }
      });

      await transaction.conversationParticipant.createMany({
        data: [
          {
            organizationId,
            conversationId: conversation.id,
            participantType: ParticipantType.AGENT,
            membershipId
          },
          { organizationId, conversationId: conversation.id, participantType: ParticipantType.VISITOR, visitorId }
        ]
      });

      const created = await transaction.message.create({
        data: {
          organizationId,
          conversationId: conversation.id,
          senderType: ParticipantType.AGENT,
          senderMembershipId: membershipId,
          type: MessageType.TEXT,
          visibility: MessageVisibility.PUBLIC,
          status: MessageStatus.SENT,
          body
        }
      });

      // Not a "first response": nobody asked anything here, the agent opened this themselves —
      // counting it would make the response-time report look better than it really is.
      const updated = await transaction.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: created.createdAt }
      });

      return { conversation: updated, message: created };
    });

    const agent = await this.agentProfiles.forMembership(membershipId).catch(() => null);
    const conversationDto = this.mapConversation(result.conversation);
    const messageDto: MessageDto = { ...this.mapMessage(result.message), ...(agent ? { agent } : {}) };

    this.gateway.emitConversationCreated(conversationDto);
    this.gateway.emitMessageCreated(messageDto);
    this.gateway.emitConversationInvited(session.sessionToken, conversationDto, messageDto);

    return { conversation: conversationDto, message: messageDto };
  }

  private mapConversation(conversation: Conversation): ConversationDto {
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
      metadata: (conversation.metadata as Record<string, unknown>) ?? {},
      firstResponseAt: conversation.firstResponseAt,
      lastMessageAt: conversation.lastMessageAt,
      resolvedAt: conversation.resolvedAt,
      closedAt: conversation.closedAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    };
  }

  private mapMessage(message: Message): MessageDto {
    return {
      id: message.id,
      organizationId: message.organizationId,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderVisitorId: message.senderVisitorId,
      senderMembershipId: message.senderMembershipId,
      type: message.type,
      visibility: message.visibility,
      status: message.status,
      body: message.body,
      idempotencyKey: message.idempotencyKey,
      metadata: (message.metadata as Record<string, unknown>) ?? {},
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt
    };
  }
}
