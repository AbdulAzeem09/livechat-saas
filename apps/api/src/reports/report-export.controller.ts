import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { ApiKeyGuard, type ApiKeyRequest } from "../common/auth/api-key.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { ReportExportService, type ReportScheduleDto, type ReportType } from "./report-export.service";
import { ReportsService, type ReportSummary } from "./reports.service";


export class CreateReportScheduleDto {
  @ApiProperty({ enum: ["chats", "agents", "tags"] })
  @IsString()
  reportType!: string;

  @ApiProperty({ enum: ["daily", "weekly"] })
  @IsString()
  frequency!: string;

  @ApiProperty({ type: [String], example: ["owner@acme.com"] })
  @IsArray()
  recipients!: string[];

  @ApiPropertyOptional({ description: "Hour of the day (UTC) to send it", default: 7 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  hourUtc?: number;
}

export class UpdateReportScheduleDto {
  @ApiPropertyOptional({ enum: ["daily", "weekly"] })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  recipients?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  hourUtc?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/reports")
export class ReportExportController {
  constructor(private readonly exports: ReportExportService) {}

  @Get("export")
  @Permissions("analytics:read")
  @Header("content-type", "text/csv; charset=utf-8")
  @ApiOperation({ summary: "Download the raw numbers as a CSV" })
  @ApiParam({ name: "organizationId" })
  @ApiQuery({ name: "type", enum: ["chats", "agents", "tags"], required: false })
  @ApiQuery({ name: "days", required: false })
  export(
    @Param("organizationId") organizationId: string,
    @Query("type") type = "chats",
    @Query("days") days = "30"
  ): Promise<string> {
    return this.exports.toCsv(organizationId, type as ReportType, Number.parseInt(days, 10) || 30);
  }

  @Get("schedules")
  @Permissions("analytics:read")
  @ApiOperation({ summary: "Reports that are emailed on a schedule" })
  @ApiParam({ name: "organizationId" })
  list(@Param("organizationId") organizationId: string): Promise<ReportScheduleDto[]> {
    return this.exports.listSchedules(organizationId);
  }

  @Post("schedules")
  @Permissions("analytics:read")
  @ApiOperation({ summary: "Email this report every day or every week" })
  @ApiParam({ name: "organizationId" })
  create(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateReportScheduleDto
  ): Promise<ReportScheduleDto> {
    return this.exports.createSchedule(organizationId, dto);
  }

  @Patch("schedules/:scheduleId")
  @Permissions("analytics:read")
  @ApiOperation({ summary: "Change or pause a scheduled report" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "scheduleId" })
  update(
    @Param("organizationId") organizationId: string,
    @Param("scheduleId") scheduleId: string,
    @Body() dto: UpdateReportScheduleDto
  ): Promise<ReportScheduleDto> {
    return this.exports.updateSchedule(organizationId, scheduleId, dto);
  }

  @Post("schedules/:scheduleId/run")
  @Permissions("analytics:read")
  @ApiOperation({ summary: "Send this report now" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "scheduleId" })
  run(
    @Param("organizationId") organizationId: string,
    @Param("scheduleId") scheduleId: string
  ): Promise<{ sent: boolean; recipients: string[] }> {
    return this.exports.runSchedule(organizationId, scheduleId);
  }

  @Delete("schedules/:scheduleId")
  @Permissions("analytics:read")
  @ApiOperation({ summary: "Stop sending this report" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "scheduleId" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("scheduleId") scheduleId: string
  ): Promise<{ success: true }> {
    return this.exports.removeSchedule(organizationId, scheduleId);
  }
}

/**
 * The Reports API: same numbers, for other systems. Authenticated with an API key
 * (Settings → Integrations) rather than a signed-in user.
 */
@ApiTags("Reports API")
@UseGuards(ApiKeyGuard)
@Controller("public/reports")
export class PublicReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exports: ReportExportService
  ) {}

  @Get("summary")
  @ApiOperation({ summary: "Workspace metrics as JSON (x-api-key header)" })
  summary(@Req() request: ApiKeyRequest): Promise<ReportSummary> {
    return this.reports.getSummary(request.apiKeyOrganizationId as string);
  }

  @Get("export")
  @Header("content-type", "text/csv; charset=utf-8")
  @ApiOperation({ summary: "The same rows as CSV (x-api-key header)" })
  @ApiQuery({ name: "type", enum: ["chats", "agents", "tags"], required: false })
  @ApiQuery({ name: "days", required: false })
  export(
    @Req() request: ApiKeyRequest,
    @Query("type") type = "chats",
    @Query("days") days = "30"
  ): Promise<string> {
    return this.exports.toCsv(
      request.apiKeyOrganizationId as string,
      type as ReportType,
      Number.parseInt(days, 10) || 30
    );
  }
}
