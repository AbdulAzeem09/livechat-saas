import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { IsObject, IsOptional } from "class-validator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CurrentOrganization } from "../organizations/decorators/current-organization.decorator";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { AppsService, type InstalledApp } from "./apps.service";
import { IntegrationHubService, type IntegrationTestResult } from "./integration-hub.service";

export class InstallAppDto {
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

@ApiTags("Apps")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/apps")
export class AppsController {
  constructor(
    private readonly appsService: AppsService,
    private readonly integrations: IntegrationHubService
  ) {}

  @Get()
  @Permissions("organization:read")
  @ApiOperation({ summary: "List apps and whether this workspace has them installed" })
  @ApiParam({ name: "organizationId" })
  list(@Param("organizationId") organizationId: string): Promise<InstalledApp[]> {
    return this.appsService.list(organizationId);
  }

  @Post(":appKey")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Install an app for the whole workspace" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "appKey" })
  install(
    @Param("organizationId") organizationId: string,
    @Param("appKey") appKey: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: InstallAppDto
  ): Promise<InstalledApp[]> {
    return this.appsService.install(organizationId, appKey, context.membershipId, dto.settings ?? {});
  }

  @Post(":appKey/test")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Check the app's keys by really calling the provider" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "appKey" })
  test(
    @Param("organizationId") organizationId: string,
    @Param("appKey") appKey: string
  ): Promise<IntegrationTestResult> {
    return this.integrations.test(organizationId, appKey);
  }

  @Delete(":appKey")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Remove an app from the workspace" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "appKey" })
  uninstall(
    @Param("organizationId") organizationId: string,
    @Param("appKey") appKey: string,
    @CurrentOrganization() context: OrganizationRequestContext
  ): Promise<InstalledApp[]> {
    return this.appsService.uninstall(organizationId, appKey, context.membershipId);
  }
}
