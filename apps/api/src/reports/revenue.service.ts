import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ConversationRevenue {
  conversationId: string;
  currency: string;
  totalCents: number;
  orderCount: number;
  orders: Array<{ amountCents: number; reference: string | null; at: Date }>;
}

export interface AgentRevenue {
  membershipId: string;
  name: string;
  email: string;
  chatsWithRevenue: number;
  totalCents: number;
  currency: string;
}

export interface RevenueOverview {
  currency: string;
  totalCents: number;
  chatsWithRevenue: number;
  /** Of every chat in the period, the share that ended in a sale. */
  conversionRate: number;
  averageOrderCents: number;
  agents: AgentRevenue[];
  topChats: Array<{
    conversationId: string;
    subject: string | null;
    totalCents: number;
    agentName: string | null;
  }>;
}

/**
 * What the chats were worth. The sales are already recorded against the conversation that
 * produced them (the widget's trackSale call), so this reads them back per chat and per agent
 * — the number to show a customer who asks what the chat widget is actually doing for them.
 */
@Injectable()
export class RevenueService {
  constructor(private readonly prisma: PrismaService) {}

  /** Revenue for one chat, for the panel next to the conversation. */
  async forConversation(
    organizationId: string,
    conversationId: string
  ): Promise<ConversationRevenue> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      select: { id: true }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const sales = await this.prisma.sale.findMany({
      where: { organizationId, conversationId },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return {
      conversationId,
      currency: sales[0]?.currency?.toUpperCase() ?? "USD",
      totalCents: sales.reduce((total, sale) => total + sale.amountCents, 0),
      orderCount: sales.length,
      orders: sales.map((sale) => ({
        amountCents: sale.amountCents,
        reference: sale.reference,
        at: sale.createdAt
      }))
    };
  }

  /** The whole picture for the reports screen. */
  async overview(organizationId: string, days = 30): Promise<RevenueOverview> {
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 24 * 60 * 60 * 1000);

    const [sales, totalChats] = await Promise.all([
      this.prisma.sale.findMany({
        where: { organizationId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5000
      }),
      this.prisma.conversation.count({ where: { organizationId, createdAt: { gte: since } } })
    ]);

    const withConversation = sales.filter(
      (sale): sale is typeof sale & { conversationId: string } => Boolean(sale.conversationId)
    );
    const conversationIds = Array.from(new Set(withConversation.map((sale) => sale.conversationId)));

    const conversations = conversationIds.length
      ? await this.prisma.conversation.findMany({
          where: { id: { in: conversationIds } },
          select: { id: true, subject: true, assignedAgentId: true }
        })
      : [];
    const byConversation = new Map(conversations.map((item) => [item.id, item]));

    // Who was handling the chat when it turned into a sale?
    const membershipIds = Array.from(
      new Set(
        conversations
          .map((item) => item.assignedAgentId)
          .filter((id): id is string => Boolean(id))
      )
    );
    const memberships = membershipIds.length
      ? await this.prisma.userOrganization.findMany({ where: { id: { in: membershipIds } } })
      : [];
    const users = memberships.length
      ? await this.prisma.user.findMany({
          where: { id: { in: memberships.map((membership) => membership.userId) } },
          select: { id: true, name: true, email: true }
        })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));
    const membershipById = new Map(memberships.map((membership) => [membership.id, membership]));

    const perConversation = new Map<string, number>();
    const perAgent = new Map<string, { total: number; chats: Set<string> }>();

    for (const sale of withConversation) {
      perConversation.set(
        sale.conversationId,
        (perConversation.get(sale.conversationId) ?? 0) + sale.amountCents
      );

      const agentId = byConversation.get(sale.conversationId)?.assignedAgentId;

      if (agentId) {
        const entry = perAgent.get(agentId) ?? { total: 0, chats: new Set<string>() };
        entry.total += sale.amountCents;
        entry.chats.add(sale.conversationId);
        perAgent.set(agentId, entry);
      }
    }

    const totalCents = sales.reduce((total, sale) => total + sale.amountCents, 0);
    const chatsWithRevenue = perConversation.size;

    return {
      currency: sales[0]?.currency?.toUpperCase() ?? "USD",
      totalCents,
      chatsWithRevenue,
      conversionRate: totalChats > 0 ? Math.round((chatsWithRevenue / totalChats) * 1000) / 10 : 0,
      averageOrderCents: sales.length > 0 ? Math.round(totalCents / sales.length) : 0,
      agents: [...perAgent.entries()]
        .map(([membershipId, entry]) => {
          const membership = membershipById.get(membershipId);
          const user = membership ? userById.get(membership.userId) : undefined;

          return {
            membershipId,
            name: membership?.displayName ?? user?.name ?? "Agent",
            email: user?.email ?? "",
            chatsWithRevenue: entry.chats.size,
            totalCents: entry.total,
            currency: sales[0]?.currency?.toUpperCase() ?? "USD"
          };
        })
        .sort((a, b) => b.totalCents - a.totalCents),
      topChats: [...perConversation.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([conversationId, cents]) => {
          const conversation = byConversation.get(conversationId);
          const membership = conversation?.assignedAgentId
            ? membershipById.get(conversation.assignedAgentId)
            : undefined;
          const user = membership ? userById.get(membership.userId) : undefined;

          return {
            conversationId,
            subject: conversation?.subject ?? null,
            totalCents: cents,
            agentName: membership?.displayName ?? user?.name ?? null
          };
        })
    };
  }
}
