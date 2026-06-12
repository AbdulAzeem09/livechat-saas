import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";
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
import { UpdateMemberDto } from "./dto/update-member.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationAccessGuard } from "./guards/organization-access.guard";
import { OrganizationsService } from "./organizations.service";
import type { OrganizationRequestContext } from "./types/organization-context";

@ApiTags("Organizations")
@ApiBearerAuth()
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List organizations for the current user" })
  @ApiOkResponse({ type: [OrganizationDto] })
  listOrganizations(@CurrentUser() user: AuthUser): Promise<OrganizationDto[]> {
    return this.organizationsService.listForUser(user);
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
    @Body() dto: UpdateMemberDto
  ): Promise<OrganizationMemberDto> {
    return this.organizationsService.updateMember(organizationId, membershipId, dto);
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
    return this.organizationsService.createInvitation(
      organizationId,
      context.membershipId,
      dto
    );
  }
}
