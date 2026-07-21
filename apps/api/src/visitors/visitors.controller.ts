import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { LiveVisitorDto } from "./dto/visitor-response.dto";
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
}
