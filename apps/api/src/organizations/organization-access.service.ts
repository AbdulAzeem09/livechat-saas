import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
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
}
