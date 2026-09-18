import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import type { AuthResponseDto } from "../auth/dto/auth-response.dto";
import { resolveClientIp } from "../common/http/client-ip";
import { RATE_LIMITS } from "../common/http/client-ip-throttler.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { CurrentOrganization } from "../organizations/decorators/current-organization.decorator";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { InvitationSignupDto } from "./dto/invitation-signup.dto";
import { MembersService, type InvitationPreview } from "./members.service";

@ApiTags("Members")
@Controller()
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get("invitations/:token")
  @ApiOperation({ summary: "Preview an invitation (public)" })
  @ApiParam({ name: "token" })
  preview(@Param("token") token: string): Promise<InvitationPreview> {
    return this.membersService.previewInvitation(token);
  }

  @Post("invitations/:token/signup")
  @Throttle({ default: RATE_LIMITS.register })
  @ApiOperation({ summary: "Create an account from an invite link and join the workspace (public)" })
  @ApiParam({ name: "token" })
  signUp(
    @Param("token") token: string,
    @Body() dto: InvitationSignupDto,
    @Req() request: Request
  ): Promise<AuthResponseDto> {
    const userAgent = request.headers["user-agent"];
    return this.membersService.signUpWithInvitation(token, dto, {
      ipAddress: resolveClientIp(request),
      ...(typeof userAgent === "string" ? { userAgent } : {})
    });
  }

  @Post("invitations/:token/accept")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Accept an invitation and join the workspace as an agent" })
  @ApiParam({ name: "token" })
  accept(
    @Param("token") token: string,
    @CurrentUser() user: AuthUser
  ): Promise<{ organizationId: string }> {
    return this.membersService.acceptInvitation(token, { id: user.userId, email: user.email });
  }

  @Delete("organizations/:organizationId/members/:membershipId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("members:manage")
  @ApiOperation({ summary: "Remove a member from the workspace (frees a billable seat)" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "membershipId" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @CurrentOrganization() context: OrganizationRequestContext
  ): Promise<{ success: true }> {
    return this.membersService.removeMember(organizationId, membershipId, context);
  }
}
