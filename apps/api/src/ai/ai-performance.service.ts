import { Injectable } from "@nestjs/common";
import { ParticipantType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AiPerformance {
  /** Chats the AI finished on its own — nobody from the team typed a word. */
  resolutions: number;
  /** Chats the AI took part in at all. */
  aiChats: number;
  /** Of the chats the AI touched, the share it finished alone. */
  resolutionRate: number;
  handedToHuman: number;
  /** Every chat in the period, for context. */
  totalChats: number;
  periodDays: number;
}

/**
 * How much work the AI actually took off the team. A "resolution" is a chat the AI answered
 * and that was closed without a single human message — the number to put in front of an owner
 * asking whether the assistant is worth paying for.
 */
@Injectable()
export class AiPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called when a chat is resolved or closed: decide, once, whether the AI did it alone.
   * Stored on the conversation so the report is a count rather than a scan of every message.
   */
  async markIfAiResolved(organizationId: string, conversationId: string): Promise<boolean> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      select: { metadata: true }
    });

    if (!conversation) {
      return false;
    }

    const [humanMessages, botMessages] = await Promise.all([
      this.prisma.message.count({
        where: { organizationId, conversationId, senderType: ParticipantType.AGENT }
      }),
      this.prisma.message.count({
        where: {
          organizationId,
          conversationId,
          senderType: ParticipantType.SYSTEM,
          metadata: { path: ["ai"], equals: true }
        }
      })
    ]);

    const resolvedByAi = humanMessages === 0 && botMessages > 0;
    const metadata =
      conversation.metadata && typeof conversation.metadata === "object" && !Array.isArray(conversation.metadata)
        ? (conversation.metadata as Record<string, unknown>)
        : {};

    await this.prisma.conversation
      .update({
        where: { id: conversationId },
        data: { metadata: { ...metadata, aiResolved: resolvedByAi } }
      })
      .catch(() => undefined);

    return resolvedByAi;
  }

  async overview(organizationId: string, days = 30): Promise<AiPerformance> {
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 24 * 60 * 60 * 1000);
    const where = { organizationId, createdAt: { gte: since } };

    const [totalChats, resolutions, handedToHuman, conversations] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.count({
        where: { ...where, metadata: { path: ["aiResolved"], equals: true } }
      }),
      this.prisma.conversation.count({
        where: { ...where, metadata: { path: ["aiPaused"], equals: true } }
      }),
      // Chats where the assistant said something at all.
      this.prisma.message.findMany({
        where: {
          organizationId,
          createdAt: { gte: since },
          senderType: ParticipantType.SYSTEM,
          metadata: { path: ["ai"], equals: true }
        },
        select: { conversationId: true },
        distinct: ["conversationId"],
        take: 5000
      })
    ]);

    const aiChats = conversations.length;

    return {
      resolutions,
      aiChats,
      resolutionRate: aiChats > 0 ? Math.round((resolutions / aiChats) * 1000) / 10 : 0,
      handedToHuman,
      totalChats,
      periodDays: days
    };
  }
}
