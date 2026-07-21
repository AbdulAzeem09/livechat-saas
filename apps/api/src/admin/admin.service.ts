import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AdminOverview {
  totals: { organizations: number; users: number; conversations: number; activeSubscriptions: number };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    planCode: string;
    members: number;
    conversations: number;
    createdAt: Date;
  }>;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<AdminOverview> {
    const [orgs, users, conversations, activeSubs] = await Promise.all([
      this.prisma.organization.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 500
      }),
      this.prisma.user.count(),
      this.prisma.conversation.count(),
      this.prisma.billingSubscription.count({ where: { status: "ACTIVE" } })
    ]);

    const organizations = await Promise.all(
      orgs.map(async (org) => {
        const [members, convs] = await Promise.all([
          this.prisma.userOrganization.count({ where: { organizationId: org.id } }),
          this.prisma.conversation.count({ where: { organizationId: org.id } })
        ]);
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          planCode: org.planCode,
          members,
          conversations: convs,
          createdAt: org.createdAt
        };
      })
    );

    return {
      totals: {
        organizations: orgs.length,
        users,
        conversations,
        activeSubscriptions: activeSubs
      },
      organizations
    };
  }
}
