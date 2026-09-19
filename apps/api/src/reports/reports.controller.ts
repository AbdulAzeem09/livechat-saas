import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { ReportsService, type ReportSummary } from "./reports.service";
import { RevenueService, type RevenueOverview } from "./revenue.service";

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/reports")
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly revenue: RevenueService
  ) {}

  @Get("revenue")
  @Permissions("analytics:read")
  @ApiOperation({ summary: "What the chats were worth: totals, conversion, per agent" })
  @ApiParam({ name: "organizationId" })
  revenueOverview(
    @Param("organizationId") organizationId: string,
    @Query("days") days = "30"
  ): Promise<RevenueOverview> {
    return this.revenue.overview(organizationId, Number.parseInt(days, 10) || 30);
  }

  @Get("summary")
  @Permissions("analytics:read")
  @ApiOperation({ summary: "Conversation and messaging summary metrics" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ description: "Report summary" })
  getSummary(@Param("organizationId") organizationId: string): Promise<ReportSummary> {
    return this.reportsService.getSummary(organizationId);
  }
}
