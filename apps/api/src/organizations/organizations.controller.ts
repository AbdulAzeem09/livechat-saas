import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { IsArray, IsOptional, IsString } from "class-validator";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPropertyOptional,
  ApiTags
} from "@nestjs/swagger";
import { resolveClientIp } from "../common/http/client-ip";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { CurrentOrganization } from "./decorators/current-organization.decorator";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import {
  InvitationDto,
  OrganizationDto,
  OrganizationMemberDto
} from "./dto/organization-response.dto";
import { ProvisionClientDto } from "./dto/provision-client.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationAccessGuard } from "./guards/organization-access.guard";
import { AccessRestrictionService } from "./access-restriction.service";
import { OrganizationsService } from "./organizations.service";
import type { OrganizationRequestContext } from "./types/organization-context";

export class UpdateAccessRestrictionDto {
  @ApiPropertyOptional({
    type: [String],
    description: "IPs or IPv4 ranges, e.g. 203.0.113.4 or 203.0.113.0/24. Empty means no limit."
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rules?: string[];
}

@ApiTags("Organizations")
@ApiBearerAuth()
@Controller("organizations")
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly accessRestriction: AccessRestrictionService
  ) {}

  @Get(":organizationId/access-restriction")
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Addresses allowed to open this workspace's dashboard" })
  @ApiParam({ name: "organizationId" })
  async getAccessRestriction(
    @Param("organizationId") organizationId: string,
    @Req() request: Request
  ): Promise<{ rules: string[]; yourIp: string | null }> {
    return {
      rules: await this.accessRestriction.list(organizationId),
      // Shown on the screen so an owner can add their own address without having to look it up.
      yourIp: resolveClientIp(request) ?? null
    };
  }

  @Put(":organizationId/access-restriction")
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Limit the dashboard to certain addresses (empty list removes the limit)" })
  @ApiParam({ name: "organizationId" })
  async setAccessRestriction(
    @Param("organizationId") organizationId: string,
    @Body() dto: UpdateAccessRestrictionDto,
    @Req() request: Request
  ): Promise<{ rules: string[]; yourIp: string | null }> {
    const clientIp = resolveClientIp(request);

    return {
      rules: await this.accessRestriction.replace(organizationId, dto.rules ?? [], clientIp),
      yourIp: clientIp ?? null
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List organizations for the current user" })
  @ApiOkResponse({ type: [OrganizationDto] })
  listOrganizations(@CurrentUser() user: AuthUser): Promise<OrganizationDto[]> {
    return this.organizationsService.listForUser(user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Provision a new client firm (reseller self-serve) owned by the current user" })
  @ApiCreatedResponse({ type: OrganizationDto })
  provisionClient(
    @CurrentUser() user: AuthUser,
    @Body() dto: ProvisionClientDto
  ): Promise<OrganizationDto> {
    return this.organizationsService.provisionClient(user, dto);
  }

  @Get(":organizationId")
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("organization:read")
  @ApiOperation({ summary: "Get organization details" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: OrganizationDto })
  getOrganization(
    @Param("organizationId") organizationId: string,
    @CurrentOrganization() context: OrganizationRequestContext
  ): Promise<OrganizationDto> {
    return this.organizationsService.getOrganization(organizationId, context);
  }

  @Patch(":organizationId")
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("organization:update")
  @ApiOperation({ summary: "Update organization profile" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: OrganizationDto })
  updateOrganization(
    @Param("organizationId") organizationId: string,
    @Body() dto: UpdateOrganizationDto
  ): Promise<OrganizationDto> {
    return this.organizationsService.updateOrganization(organizationId, dto);
  }

  @Get(":organizationId/members")
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("members:manage")
  @ApiOperation({ summary: "List organization members" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [OrganizationMemberDto] })
  listMembers(
    @Param("organizationId") organizationId: string
  ): Promise<OrganizationMemberDto[]> {
    return this.organizationsService.listMembers(organizationId);
  }

  @Patch(":organizationId/members/:membershipId")
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("members:manage")
  @ApiOperation({ summary: "Update an organization member" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "membershipId" })
  @ApiOkResponse({ type: OrganizationMemberDto })
  updateMember(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: UpdateMemberDto
  ): Promise<OrganizationMemberDto> {
    return this.organizationsService.updateMember(organizationId, membershipId, dto, context);
  }

  @Get(":organizationId/invitations")
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("members:manage")
  @ApiOperation({ summary: "List organization invitations" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [InvitationDto] })
  listInvitations(
    @Param("organizationId") organizationId: string
  ): Promise<InvitationDto[]> {
    return this.organizationsService.listInvitations(organizationId);
  }

  @Post(":organizationId/invitations")
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("members:manage")
  @ApiOperation({ summary: "Invite a user to the organization" })
  @ApiParam({ name: "organizationId" })
  @ApiCreatedResponse({ type: InvitationDto })
  createInvitation(
    @Param("organizationId") organizationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: CreateInvitationDto
  ): Promise<InvitationDto> {
    return this.organizationsService.createInvitation(organizationId, context, dto);
  }
}
