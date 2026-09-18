import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { RoleKey, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { OrganizationRequestContext } from "./types/organization-context";

@Injectable()
export class OrganizationAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getContextOrThrow(
    userId: string,
    organizationId: string
  ): Promise<OrganizationRequestContext> {
    const membership = await this.prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId,
        status: UserStatus.ACTIVE
      }
    });

    if (!membership) {
      throw new ForbiddenException("You do not have access to this organization");
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        organizationId,
        membershipId: membership.id
      }
    });
    const roleIds = userRoles.map((userRole) => userRole.roleId);
    const roles = roleIds.length
      ? await this.prisma.role.findMany({
          where: {
            organizationId,
            id: {
              in: roleIds
            }
          }
        })
      : [];

    return {
      organizationId,
      membershipId: membership.id,
      roles: roles.map((role) => role.key ?? role.name),
      permissions: [
        ...new Set(roles.flatMap((role) => this.readPermissions(role.permissions)))
      ]
    };
  }

  assertPermissions(
    context: OrganizationRequestContext,
    requiredPermissions: string[]
  ): void {
    const hasAllPermissions = requiredPermissions.every((permission) =>
      context.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException("You do not have the required permission");
    }
  }

  async ensureOrganizationExists(organizationId: string): Promise<void> {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null
      }
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
  }

  readPermissions(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === "string");
  }

  /**
   * Stop privilege escalation: a caller can only hand out a role whose permissions they
   * already hold, and only an Owner can hand out the Owner role.
   */
  assertCanGrantRole(
    context: OrganizationRequestContext,
    role: { key: RoleKey | null; permissions: unknown }
  ): void {
    if (role.key === RoleKey.OWNER && !this.isOwner(context)) {
      throw new ForbiddenException("Only an Owner can grant the Owner role");
    }

    this.assertCanGrantPermissions(context, this.readPermissions(role.permissions));
  }

  assertCanGrantPermissions(context: OrganizationRequestContext, permissions: string[]): void {
    if (permissions.some((permission) => !context.permissions.includes(permission))) {
      throw new ForbiddenException("You can't grant permissions you don't have");
    }
  }

  /**
   * Owners can only be changed by another Owner, and a workspace always keeps one active Owner.
   * `removesOwnership` is true when the action would remove, suspend or demote the target.
   */
  async assertCanManageMember(
    context: OrganizationRequestContext,
    membershipId: string,
    removesOwnership: boolean
  ): Promise<void> {
    const ownerRole = await this.prisma.role.findFirst({
      where: { organizationId: context.organizationId, key: RoleKey.OWNER },
      select: { id: true }
    });

    if (!ownerRole) {
      return;
    }

    const targetIsOwner = await this.prisma.userRole.findFirst({
      where: { organizationId: context.organizationId, membershipId, roleId: ownerRole.id },
      select: { id: true }
    });

    if (!targetIsOwner) {
      return;
    }

    if (!this.isOwner(context)) {
      throw new ForbiddenException("Only an Owner can change another Owner");
    }

    if (removesOwnership) {
      const activeMemberships = await this.prisma.userOrganization.findMany({
        where: { organizationId: context.organizationId, status: UserStatus.ACTIVE },
        select: { id: true }
      });
      const activeOwners = await this.prisma.userRole.count({
        where: {
          organizationId: context.organizationId,
          roleId: ownerRole.id,
          membershipId: { in: activeMemberships.map((membership) => membership.id) }
        }
      });

      if (activeOwners <= 1) {
        throw new BadRequestException("A workspace must keep at least one active Owner");
      }
    }
  }

  private isOwner(context: OrganizationRequestContext): boolean {
    return context.roles.includes(RoleKey.OWNER);
  }
}
