import { Injectable, NotFoundException } from "@nestjs/common";
import { Department } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { DepartmentDto } from "./dto/department-response.dto";
import { SetDepartmentAgentsDto } from "./dto/set-department-agents.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<DepartmentDto[]> {
    const departments = await this.prisma.department.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    });

    if (!departments.length) {
      return [];
    }

    const agents = await this.prisma.departmentAgent.findMany({
      where: { departmentId: { in: departments.map((department) => department.id) } }
    });

    const agentsByDepartment = new Map<string, string[]>();
    for (const agent of agents) {
      const list = agentsByDepartment.get(agent.departmentId) ?? [];
      list.push(agent.membershipId);
      agentsByDepartment.set(agent.departmentId, list);
    }

    return departments.map((department) =>
      this.map(department, agentsByDepartment.get(department.id) ?? [])
    );
  }

  async create(organizationId: string, dto: CreateDepartmentDto): Promise<DepartmentDto> {
    if (dto.isDefault) {
      await this.clearDefault(organizationId);
    }

    const department = await this.prisma.department.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        ...(dto.description ? { description: dto.description.trim() } : {}),
        ...(dto.routingWeight !== undefined ? { routingWeight: dto.routingWeight } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {})
      }
    });

    return this.map(department, []);
  }

  async update(
    organizationId: string,
    departmentId: string,
    dto: UpdateDepartmentDto
  ): Promise<DepartmentDto> {
    await this.getOrThrow(organizationId, departmentId);

    if (dto.isDefault) {
      await this.clearDefault(organizationId);
    }

    const department = await this.prisma.department.update({
      where: { id: departmentId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.routingWeight !== undefined ? { routingWeight: dto.routingWeight } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {})
      }
    });

    const agents = await this.prisma.departmentAgent.findMany({ where: { departmentId } });
    return this.map(department, agents.map((agent) => agent.membershipId));
  }

  async remove(organizationId: string, departmentId: string): Promise<{ success: true }> {
    await this.getOrThrow(organizationId, departmentId);

    await this.prisma.departmentAgent.deleteMany({ where: { departmentId } });
    await this.prisma.department.delete({ where: { id: departmentId } });

    return { success: true };
  }

  async setAgents(
    organizationId: string,
    departmentId: string,
    dto: SetDepartmentAgentsDto
  ): Promise<DepartmentDto> {
    const department = await this.getOrThrow(organizationId, departmentId);

    // Only accept memberships that belong to this organization.
    const validMemberships = await this.prisma.userOrganization.findMany({
      where: { organizationId, id: { in: dto.membershipIds } },
      select: { id: true }
    });
    const membershipIds = validMemberships.map((membership) => membership.id);

    await this.prisma.$transaction([
      this.prisma.departmentAgent.deleteMany({ where: { departmentId } }),
      ...(membershipIds.length
        ? [
            this.prisma.departmentAgent.createMany({
              data: membershipIds.map((membershipId) => ({ departmentId, membershipId }))
            })
          ]
        : [])
    ]);

    return this.map(department, membershipIds);
  }

  private async getOrThrow(organizationId: string, departmentId: string): Promise<Department> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId }
    });

    if (!department) {
      throw new NotFoundException("Department not found");
    }

    return department;
  }

  private async clearDefault(organizationId: string): Promise<void> {
    await this.prisma.department.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false }
    });
  }

  private map(department: Department, agentMembershipIds: string[]): DepartmentDto {
    return {
      id: department.id,
      organizationId: department.organizationId,
      name: department.name,
      description: department.description,
      routingWeight: department.routingWeight,
      isDefault: department.isDefault,
      agentMembershipIds,
      agentCount: agentMembershipIds.length,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt
    };
  }
}
