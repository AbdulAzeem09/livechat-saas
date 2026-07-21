import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { DataService } from "./data.service";

@ApiTags("Data")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/data")
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Get("export")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Export all chat + visitor data as JSON (GDPR portability)" })
  @ApiParam({ name: "organizationId" })
  export(@Param("organizationId") organizationId: string): Promise<Record<string, unknown>> {
    return this.dataService.exportData(organizationId);
  }

  @Post("clear-visitors")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Erase/anonymize visitor tracking data (GDPR erasure)" })
  @ApiParam({ name: "organizationId" })
  clearVisitors(
    @Param("organizationId") organizationId: string
  ): Promise<{ success: true; anonymizedVisitors: number }> {
    return this.dataService.clearVisitorData(organizationId);
  }
}
