import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DataService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full export of the organization's chat + visitor data (GDPR data portability). */
  async exportData(organizationId: string): Promise<Record<string, unknown>> {
    const [conversations, messages, visitors, sessions] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 5000
      }),
      this.prisma.message.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 20000
      }),
      this.prisma.visitor.findMany({ where: { organizationId }, take: 5000 }),
      this.prisma.visitorSession.findMany({ where: { organizationId }, take: 5000 })
    ]);

    return {
      exportedAt: new Date().toISOString(),
      organizationId,
      counts: {
        conversations: conversations.length,
        messages: messages.length,
        visitors: visitors.length,
        sessions: sessions.length
      },
      conversations,
      messages,
      visitors,
      sessions
    };
  }

  /**
   * Erase visitor tracking data (GDPR right to erasure): removes page views &
   * sessions and anonymizes visitor PII (name/email/IP), without breaking
   * conversation history.
   */
  async clearVisitorData(organizationId: string): Promise<{ success: true; anonymizedVisitors: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.visitorPageView.deleteMany({ where: { organizationId } });
      await tx.visitorSession.deleteMany({ where: { organizationId } });
      const result = await tx.visitor.updateMany({
        where: { organizationId },
        data: { name: null, email: null, phone: null, lastIp: null, userAgent: null }
      });
      return { success: true as const, anonymizedVisitors: result.count };
    });
  }
}
