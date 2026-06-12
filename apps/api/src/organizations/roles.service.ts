import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AVAILABLE_PERMISSIONS } from "../auth/auth.constants";
import { PrismaService } from "../prisma/prisma.service";
import { OrganizationAccessService } from "./organization-access.service";
import type { CreateRoleDto } from "./dto/create-role.dto";
import type { RoleAssignmentDto, RoleDto } from "./dto/role-response.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";

@Injectable()
export class RolesService {
  private readonly availablePermissions = new Set<string>(AVAILABLE_PERMISSIONS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: OrganizationAccessService
  ) {}

  async listRoles(organizationId: string): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }]
    });

    return roles.map((role) => this.mapRole(role));
  }

  async createRole(organizationId: string, dto: CreateRoleDto): Promise<RoleDto> {
    this.validatePermissions(dto.permissions);

    const existing = await this.prisma.role.findFirst({
      where: {
        organizationId,
        name: dto.name
      }
    });

    if (existing) {
      throw new ConflictException("A role with this name already exists");
    }

    const role = await this.prisma.role.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description ?? null,
        permissions: dto.permissions,
        isSystem: false
      }
    });

    return this.mapRole(role);
  }

  async updateRole(
    organizationId: string,
    roleId: string,
    dto: UpdateRoleDto
  ): Promise<RoleDto> {
    const role = await this.getRoleOrThrow(organizationId, roleId);

    if (role.isSystem) {
      throw new BadRequestException("System roles cannot be edited");
    }

    if (dto.permissions) {
      this.validatePermissions(dto.permissions);
    }

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findFirst({
        where: {
          organizationId,
          name: dto.name,
          id: {
            not: roleId
          }
        }
      });

      if (existing) {
        throw new ConflictException("A role with this name already exists");
      }
    }

    const updatedRole = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {})
      }
    });

    return this.mapRole(updatedRole);
  }

  async deleteRole(organizationId: string, roleId: string): Promise<void> {
    const role = await this.getRoleOrThrow(organizationId, roleId);

    if (role.isSystem) {
      throw new BadRequestException("System roles cannot be deleted");
    }

    await this.prisma.role.delete({
      where: { id: roleId }
    });
  }

  async assignRole(
    organizationId: string,
    membershipId: string,
    roleId: string
  ): Promise<RoleAssignmentDto> {
    await this.getMembershipOrThrow(organizationId, membershipId);
    await this.getRoleOrThrow(organizationId, roleId);

    const existingAssignment = await this.prisma.userRole.findFirst({
      where: {
        organizationId,
        membershipId,
        roleId
      }
    });

    if (!existingAssignment) {
      await this.prisma.userRole.create({
        data: {
          organizationId,
          membershipId,
          roleId
        }
      });
    }

    return this.getRoleAssignment(organizationId, membershipId, roleId);
  }

  async revokeRole(
    organizationId: string,
    membershipId: string,
    roleId: string
  ): Promise<RoleAssignmentDto> {
    await this.getMembershipOrThrow(organizationId, membershipId);
    await this.getRoleOrThrow(organizationId, roleId);

    await this.prisma.userRole.deleteMany({
      where: {
        organizationId,
        membershipId,
        roleId
      }
    });

    return this.getRoleAssignment(organizationId, membershipId, roleId);
  }

  private async getRoleAssignment(
    organizationId: string,
    membershipId: string,
    roleId: string
  ): Promise<RoleAssignmentDto> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        organizationId,
        membershipId
      },
      orderBy: { createdAt: "asc" }
    });
    const roleIds = userRoles.map((userRole) => userRole.roleId);
    const roles = roleIds.length
      ? await this.prisma.role.findMany({
          where: {
            organizationId,
            id: {
              in: roleIds
            }
          },
          orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }]
        })
      : [];

    return {
      membershipId,
      roleId,
      roles: roles.map((role) => this.mapRole(role))
    };
  }

  private async getRoleOrThrow(organizationId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        organizationId,
        id: roleId
      }
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return role;
  }

  private async getMembershipOrThrow(organizationId: string, membershipId: string) {
    const membership = await this.prisma.userOrganization.findFirst({
      where: {
        organizationId,
        id: membershipId
      }
    });

    if (!membership) {
      throw new NotFoundException("Member not found");
    }

    return membership;
  }

  private validatePermissions(permissions: string[]): void {
    const invalidPermissions = permissions.filter(
      (permission) => !this.availablePermissions.has(permission)
    );

    if (invalidPermissions.length) {
      throw new BadRequestException(
        `Unknown permissions: ${invalidPermissions.join(", ")}`
      );
    }
  }

  private mapRole(role: {
    id: string;
    key: string | null;
    name: string;
    description: string | null;
    permissions: unknown;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): RoleDto {
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: this.accessService.readPermissions(role.permissions),
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };
  }
}
