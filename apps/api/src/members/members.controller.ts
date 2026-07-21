import { Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
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
    @Param("membershipId") membershipId: string
  ): Promise<{ success: true }> {
    return this.membersService.removeMember(organizationId, membershipId);
  }
}
