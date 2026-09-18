import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CurrentOrganization } from "../organizations/decorators/current-organization.decorator";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { NotificationsService, type NotificationDto } from "./notifications.service";

@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Permissions("organization:read")
@Controller("organizations/:organizationId/notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List my in-app notifications" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ description: "Notifications, newest first, with the unread count" })
  list(
    @Param("organizationId") organizationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Query("unreadOnly") unreadOnly?: string
  ): Promise<{ items: NotificationDto[]; unread: number }> {
    return this.notificationsService.list(organizationId, context.membershipId, {
      unreadOnly: unreadOnly === "true"
    });
  }

  @Post("read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark every notification as read" })
  @ApiParam({ name: "organizationId" })
  markAllRead(
    @Param("organizationId") organizationId: string,
    @CurrentOrganization() context: OrganizationRequestContext
  ): Promise<{ unread: number }> {
    return this.notificationsService.markRead(organizationId, context.membershipId);
  }

  @Post(":notificationId/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark one notification as read" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "notificationId" })
  markRead(
    @Param("organizationId") organizationId: string,
    @Param("notificationId") notificationId: string,
    @CurrentOrganization() context: OrganizationRequestContext
  ): Promise<{ unread: number }> {
    return this.notificationsService.markRead(organizationId, context.membershipId, notificationId);
  }
}
