import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CurrentOrganization } from "../organizations/decorators/current-organization.decorator";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { StartVisitorChatDto } from "./dto/start-visitor-chat.dto";
import { LiveVisitorDto, StartChatResponseDto } from "./dto/visitor-response.dto";
import { VisitorsService } from "./visitors.service";

@ApiTags("Visitors")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/visitors")
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get("live")
  @Permissions("chat:read")
  @ApiOperation({ summary: "List visitors currently active on the website" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [LiveVisitorDto] })
  listLive(@Param("organizationId") organizationId: string): Promise<LiveVisitorDto[]> {
    return this.visitorsService.listLive(organizationId);
  }

  @Post(":visitorId/start-chat")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Open a chat with a visitor who is browsing, before they've said anything" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "visitorId" })
  @ApiCreatedResponse({ type: StartChatResponseDto })
  startChat(
    @Param("organizationId") organizationId: string,
    @Param("visitorId") visitorId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: StartVisitorChatDto
  ): Promise<StartChatResponseDto> {
    return this.visitorsService.startChat(organizationId, visitorId, context.membershipId, dto.message);
  }
}
