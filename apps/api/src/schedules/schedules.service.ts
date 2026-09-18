import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ScheduleShift {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface MemberSchedule {
  membershipId: string;
  shifts: ScheduleShift[];
}

/**
 * Weekly working hours per agent. Routing only hands new chats to agents who are on shift,
 * so an agent who forgot to go offline doesn't collect chats at 3am.
 */
@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string): Promise<MemberSchedule[]> {
    const rows = await this.prisma.agentSchedule.findMany({
      where: { organizationId },
      orderBy: [{ membershipId: "asc" }, { dayOfWeek: "asc" }, { startMinute: "asc" }]
    });
    const byMembership = new Map<string, ScheduleShift[]>();

    for (const row of rows) {
      const shifts = byMembership.get(row.membershipId) ?? [];
      shifts.push({
        dayOfWeek: row.dayOfWeek,
        startMinute: row.startMinute,
        endMinute: row.endMinute
      });
      byMembership.set(row.membershipId, shifts);
    }

    return [...byMembership.entries()].map(([membershipId, shifts]) => ({ membershipId, shifts }));
  }

  async get(organizationId: string, membershipId: string): Promise<MemberSchedule> {
    await this.assertMembership(organizationId, membershipId);
    const rows = await this.prisma.agentSchedule.findMany({
      where: { organizationId, membershipId },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }]
    });

    return {
      membershipId,
      shifts: rows.map((row) => ({
        dayOfWeek: row.dayOfWeek,
        startMinute: row.startMinute,
        endMinute: row.endMinute
      }))
    };
  }

  /** Replace the whole week for one agent (empty list = always available). */
  async replace(
    organizationId: string,
    membershipId: string,
    shifts: ScheduleShift[]
  ): Promise<MemberSchedule> {
    await this.assertMembership(organizationId, membershipId);

    for (const shift of shifts) {
      if (shift.dayOfWeek < 0 || shift.dayOfWeek > 6) {
        throw new BadRequestException("Day of week must be between 0 (Sunday) and 6 (Saturday)");
      }
      if (shift.startMinute < 0 || shift.endMinute > 1440 || shift.startMinute >= shift.endMinute) {
        throw new BadRequestException("Each shift must start before it ends, within one day");
      }
    }

    await this.prisma.$transaction([
      this.prisma.agentSchedule.deleteMany({ where: { organizationId, membershipId } }),
      ...(shifts.length
        ? [
            this.prisma.agentSchedule.createMany({
              data: shifts.map((shift) => ({
                organizationId,
                membershipId,
                dayOfWeek: shift.dayOfWeek,
                startMinute: shift.startMinute,
                endMinute: shift.endMinute
              }))
            })
          ]
        : [])
    ]);

    return this.get(organizationId, membershipId);
  }

  /**
   * Which of these agents are on shift right now. Agents without a schedule are always
   * available, so routing keeps working for teams that never set one up.
   */
  async filterOnShift(organizationId: string, membershipIds: string[]): Promise<string[]> {
    if (!membershipIds.length) {
      return [];
    }

    const rows = await this.prisma.agentSchedule.findMany({
      where: { organizationId, membershipId: { in: membershipIds } }
    });

    if (!rows.length) {
      return membershipIds;
    }

    const now = new Date();
    const day = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const scheduled = new Set(rows.map((row) => row.membershipId));

    return membershipIds.filter((membershipId) => {
      if (!scheduled.has(membershipId)) {
        return true;
      }

      return rows.some(
        (row) =>
          row.membershipId === membershipId &&
          row.dayOfWeek === day &&
          minutes >= row.startMinute &&
          minutes < row.endMinute
      );
    });
  }

  private async assertMembership(organizationId: string, membershipId: string): Promise<void> {
    const membership = await this.prisma.userOrganization.findFirst({
      where: { id: membershipId, organizationId }
    });

    if (!membership) {
      throw new NotFoundException("Member not found");
    }
  }
}
