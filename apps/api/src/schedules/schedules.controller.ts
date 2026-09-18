import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, Max, Min, ValidateNested } from "class-validator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { SchedulesService, type MemberSchedule } from "./schedules.service";

export class ShiftDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: "0 = Sunday" })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ minimum: 0, maximum: 1440, description: "Minutes from midnight, e.g. 540 = 09:00" })
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute!: number;

  @ApiProperty({ minimum: 0, maximum: 1440, description: "Minutes from midnight, e.g. 1020 = 17:00" })
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute!: number;
}

export class ReplaceScheduleDto {
  @ApiProperty({ type: [ShiftDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftDto)
  shifts!: ShiftDto[];
}

@ApiTags("Work scheduler")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/schedules")
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @Permissions("organization:read")
  @ApiOperation({ summary: "Weekly working hours for every agent" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ description: "One entry per agent that has a schedule" })
  list(@Param("organizationId") organizationId: string): Promise<MemberSchedule[]> {
    return this.schedulesService.listForOrganization(organizationId);
  }

  @Get(":membershipId")
  @Permissions("organization:read")
  @ApiOperation({ summary: "Working hours for one agent" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "membershipId" })
  get(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string
  ): Promise<MemberSchedule> {
    return this.schedulesService.get(organizationId, membershipId);
  }

  @Put(":membershipId")
  @Permissions("members:manage")
  @ApiOperation({ summary: "Set the weekly working hours for one agent" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "membershipId" })
  replace(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Body() dto: ReplaceScheduleDto
  ): Promise<MemberSchedule> {
    return this.schedulesService.replace(organizationId, membershipId, dto.shifts);
  }
}
