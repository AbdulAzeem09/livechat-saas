import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../../organizations/guards/organization-access.guard";
import { AuditService, type AuditLogEntryDto } from "./audit.service";

export class ListAuditLogsQuery {
  @ApiProperty({ required: false, description: "Filter by action prefix, e.g. \"member\"" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  action?: string;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

@ApiTags("Audit log")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions("settings:manage")
  @ApiOperation({ summary: "List security/activity log entries for the organization" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ description: "Audit log entries, newest first" })
  list(
    @Param("organizationId") organizationId: string,
    @Query() query: ListAuditLogsQuery
  ): Promise<{ items: AuditLogEntryDto[]; total: number }> {
    return this.auditService.list(organizationId, query);
  }
}
