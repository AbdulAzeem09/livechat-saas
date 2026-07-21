import {
  Body,
  Controller,
  Delete,
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
import { CurrentOrganization } from "../organizations/decorators/current-organization.decorator";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CannedResponsesService } from "./canned-responses.service";
import { CannedResponseDto } from "./dto/canned-response-response.dto";
import { CreateCannedResponseDto } from "./dto/create-canned-response.dto";
import { UpdateCannedResponseDto } from "./dto/update-canned-response.dto";

@ApiTags("Canned responses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/canned-responses")
export class CannedResponsesController {
  constructor(private readonly cannedResponsesService: CannedResponsesService) {}

  @Get()
  @Permissions("chat:read")
  @ApiOperation({ summary: "List canned responses for an organization" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [CannedResponseDto] })
  list(@Param("organizationId") organizationId: string): Promise<CannedResponseDto[]> {
    return this.cannedResponsesService.list(organizationId);
  }

  @Post()
  @Permissions("chat:write")
  @ApiOperation({ summary: "Create a canned response" })
  @ApiParam({ name: "organizationId" })
  @ApiCreatedResponse({ type: CannedResponseDto })
  create(
    @Param("organizationId") organizationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: CreateCannedResponseDto
  ): Promise<CannedResponseDto> {
    return this.cannedResponsesService.create(organizationId, context.membershipId, dto);
  }

  @Patch(":cannedResponseId")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Update a canned response" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "cannedResponseId" })
  @ApiOkResponse({ type: CannedResponseDto })
  update(
    @Param("organizationId") organizationId: string,
    @Param("cannedResponseId") cannedResponseId: string,
    @Body() dto: UpdateCannedResponseDto
  ): Promise<CannedResponseDto> {
    return this.cannedResponsesService.update(organizationId, cannedResponseId, dto);
  }

  @Delete(":cannedResponseId")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Delete a canned response" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "cannedResponseId" })
  @ApiOkResponse({ description: "Canned response deleted" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("cannedResponseId") cannedResponseId: string
  ): Promise<{ success: true }> {
    return this.cannedResponsesService.remove(organizationId, cannedResponseId);
  }
}
