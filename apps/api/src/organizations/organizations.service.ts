import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import type { AuthUser } from "../auth/types/auth-user";
import { PrismaService } from "../prisma/prisma.service";
import type { OrganizationRequestContext } from "./types/organization-context";
import { OrganizationAccessService } from "./organization-access.service";
import type { CreateInvitationDto } from "./dto/create-invitation.dto";
import type {
  InvitationDto,
  OrganizationDto,
  OrganizationMemberDto,
  OrganizationMembershipDto
} from "./dto/organization-response.dto";
import type { UpdateMemberDto } from "./dto/update-member.dto";
import type { UpdateOrganizationDto } from "./dto/update-organization.dto";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: OrganizationAccessService
  ) {}

  async listForUser(user: AuthUser): Promise<OrganizationDto[]> {
    const memberships = await this.prisma.userOrganization.findMany({
      where: {
        userId: user.userId,
        status: UserStatus.ACTIVE
      },
      orderBy: { createdAt: "asc" }
    });
    const organizationIds = memberships.map((membership) => membership.organizationId);

    if (!organizationIds.length) {
      return [];
    }

    const organizations = await this.prisma.organization.findMany({
      where: {
        id: {
          in: organizationIds
        },
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });
    const membershipSummaries = await this.buildMembershipSummaries(memberships);
    const membershipByOrganizationId = new Map(
      membershipSummaries.map((membership) => [membership.organizationId, membership])
    );

    return organizations.map((organization) => {
      const membership = membershipByOrganizationId.get(organization.id);

      return {
        ...this.mapOrganization(organization),
        ...(membership ? { membership } : {})
      };
    });
  }

  async getOrganization(
    organizationId: string,
    context: OrganizationRequestContext
  ): Promise<OrganizationDto> {
    const organization = await this.getOrganizationOrThrow(organizationId);
    const membership = await this.prisma.userOrganization.findUniqueOrThrow({
      where: { id: context.membershipId }
    });

    return {
      ...this.mapOrganization(organization),
      membership: {
        id: membership.id,
        organizationId: membership.organizationId,
        userId: membership.userId,
        displayName: membership.displayName,
        title: membership.title,
        timezone: membership.timezone,
        status: membership.status,
        agentStatus: membership.agentStatus,
        maxOpenChats: membership.maxOpenChats,
        roles: context.roles,
        permissions: context.permissions
      }
    };
  }

  async updateOrganization(
    organizationId: string,
    dto: UpdateOrganizationDto
  ): Promise<OrganizationDto> {
    if (!dto.name && !dto.slug && !dto.metadata) {
      throw new BadRequestException("At least one organization field is required");
    }

    if (dto.slug) {
      const existing = await this.prisma.organization.findFirst({
        where: {
          slug: dto.slug,
          id: {
            not: organizationId
          }
        }
      });

      if (existing) {
        throw new ConflictException("An organization with this slug already exists");
      }
    }

    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: this.buildOrganizationUpdateData(dto)
    });

    return this.mapOrganization(organization);
  }

  async listMembers(organizationId: string): Promise<OrganizationMemberDto[]> {
    const memberships = await this.prisma.userOrganization.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    });
    const userIds = memberships.map((membership) => membership.userId);
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: {
            id: {
              in: userIds
            }
          }
        })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));
    const membershipSummaries = await this.buildMembershipSummaries(memberships);
    const summaryById = new Map(membershipSummaries.map((summary) => [summary.id, summary]));

    return memberships.map((membership) => {
      const account = userById.get(membership.userId);
      const summary = summaryById.get(membership.id);

      if (!account) {
        throw new NotFoundException("Member account not found");
      }

      return {
        id: membership.id,
        userId: account.id,
        email: account.email,
        name: account.name,
        avatarUrl: account.avatarUrl,
        displayName: membership.displayName,
        title: membership.title,
        timezone: membership.timezone,
        status: membership.status,
        agentStatus: membership.agentStatus,
        maxOpenChats: membership.maxOpenChats,
        roles: summary?.roles ?? [],
        permissions: summary?.permissions ?? [],
        createdAt: membership.createdAt
      };
    });
  }

  async updateMember(
    organizationId: string,
    membershipId: string,
    dto: UpdateMemberDto
  ): Promise<OrganizationMemberDto> {
    const membership = await this.prisma.userOrganization.findFirst({
      where: {
        id: membershipId,
        organizationId
      }
    });

    if (!membership) {
      throw new NotFoundException("Member not found");
    }

    await this.prisma.userOrganization.update({
      where: { id: membershipId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.agentStatus !== undefined ? { agentStatus: dto.agentStatus } : {}),
        ...(dto.maxOpenChats !== undefined ? { maxOpenChats: dto.maxOpenChats } : {})
      }
    });

    const updatedMember = (await this.listMembers(organizationId)).find(
      (item) => item.id === membershipId
    );

    if (!updatedMember) {
      throw new NotFoundException("Member not found after update");
    }

    return updatedMember;
  }

  async listInvitations(organizationId: string): Promise<InvitationDto[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    });

    return invitations.map((invitation) => this.mapInvitation(invitation));
  }

  async createInvitation(
    organizationId: string,
    invitedById: string,
    dto: CreateInvitationDto
  ): Promise<InvitationDto> {
    const email = dto.email.trim().toLowerCase();

    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({
        where: {
          id: dto.roleId,
          organizationId
        }
      });

      if (!role) {
        throw new BadRequestException("Role does not belong to this organization");
      }
    }

    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email,
        acceptedAt: null,
        revokedAt: null
      }
    });

    if (existingInvitation) {
      throw new ConflictException("An open invitation already exists for this email");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      const existingMembership = await this.prisma.userOrganization.findFirst({
        where: {
          organizationId,
          userId: existingUser.id
        }
      });

      if (existingMembership) {
        throw new ConflictException("This user is already a member");
      }
    }

    const token = randomBytes(48).toString("base64url");
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email,
        invitedById,
        ...(dto.roleId ? { roleId: dto.roleId } : {}),
        tokenHash: this.hashToken(token),
        status: UserStatus.INVITED,
        expiresAt: new Date(Date.now() + (dto.expiresInDays ?? 7) * 24 * 60 * 60 * 1000)
      }
    });

    // Surface the raw token once so the caller can build a shareable invite link.
    return { ...this.mapInvitation(invitation), token };
  }

  private async getOrganizationOrThrow(organizationId: string) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null
      }
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    return organization;
  }

  private async buildMembershipSummaries(
    memberships: Array<{
      id: string;
      organizationId: string;
      userId: string;
      displayName: string | null;
      title: string | null;
      timezone: string;
      status: UserStatus;
      agentStatus: string;
      maxOpenChats: number;
    }>
  ): Promise<OrganizationMembershipDto[]> {
    const membershipIds = memberships.map((membership) => membership.id);
    const userRoles = membershipIds.length
      ? await this.prisma.userRole.findMany({
          where: {
            membershipId: {
              in: membershipIds
            }
          }
        })
      : [];
    const roleIds = [...new Set(userRoles.map((userRole) => userRole.roleId))];
    const roles = roleIds.length
      ? await this.prisma.role.findMany({
          where: {
            id: {
              in: roleIds
            }
          }
        })
      : [];
    const roleById = new Map(roles.map((role) => [role.id, role]));
    const rolesByMembershipId = new Map<string, typeof roles>();

    for (const userRole of userRoles) {
      const role = roleById.get(userRole.roleId);

      if (!role) {
        continue;
      }

      const currentRoles = rolesByMembershipId.get(userRole.membershipId) ?? [];
      currentRoles.push(role);
      rolesByMembershipId.set(userRole.membershipId, currentRoles);
    }

    return memberships.map((membership) => {
      const membershipRoles = rolesByMembershipId.get(membership.id) ?? [];

      return {
        id: membership.id,
        organizationId: membership.organizationId,
        userId: membership.userId,
        displayName: membership.displayName,
        title: membership.title,
        timezone: membership.timezone,
        status: membership.status,
        agentStatus: membership.agentStatus,
        maxOpenChats: membership.maxOpenChats,
        roles: membershipRoles.map((role) => role.key ?? role.name),
        permissions: [
          ...new Set(
            membershipRoles.flatMap((role) =>
              this.accessService.readPermissions(role.permissions)
            )
          )
        ]
      };
    });
  }

  private mapOrganization(organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
    planCode: string;
    trialEndsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    metadata?: unknown;
  }): OrganizationDto {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      planCode: organization.planCode,
      trialEndsAt: organization.trialEndsAt,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      metadata:
        organization.metadata && typeof organization.metadata === "object" && !Array.isArray(organization.metadata)
          ? (organization.metadata as Record<string, unknown>)
          : {}
    };
  }

  private mapInvitation(invitation: {
    id: string;
    email: string;
    roleId: string | null;
    status: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }): InvitationDto {
    return {
      id: invitation.id,
      email: invitation.email,
      roleId: invitation.roleId,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
      createdAt: invitation.createdAt
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private buildOrganizationUpdateData(
    dto: UpdateOrganizationDto
  ): Prisma.OrganizationUpdateInput {
    const data: Prisma.OrganizationUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.slug !== undefined) {
      data.slug = dto.slug;
    }

    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata as Prisma.InputJsonValue;
    }

    return data;
  }
}
