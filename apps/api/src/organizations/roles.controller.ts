import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { ActionResponseDto } from "./dto/action-response.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { RoleAssignmentDto, RoleDto } from "./dto/role-response.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { OrganizationAccessGuard } from "./guards/organization-access.guard";
import { RolesService } from "./roles.service";

@ApiTags("Roles")
@ApiBearerAuth()
@Controller("organizations/:organizationId")
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Permissions("roles:manage")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get("roles")
  @ApiOperation({ summary: "List organization roles" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [RoleDto] })
  listRoles(@Param("organizationId") organizationId: string): Promise<RoleDto[]> {
    return this.rolesService.listRoles(organizationId);
  }

  @Post("roles")
  @ApiOperation({ summary: "Create a custom organization role" })
  @ApiParam({ name: "organizationId" })
  @ApiCreatedResponse({ type: RoleDto })
  createRole(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateRoleDto
  ): Promise<RoleDto> {
    return this.rolesService.createRole(organizationId, dto);
  }

  @Patch("roles/:roleId")
  @ApiOperation({ summary: "Update a custom organization role" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "roleId" })
  @ApiOkResponse({ type: RoleDto })
  updateRole(
    @Param("organizationId") organizationId: string,
    @Param("roleId") roleId: string,
    @Body() dto: UpdateRoleDto
  ): Promise<RoleDto> {
    return this.rolesService.updateRole(organizationId, roleId, dto);
  }

  @Delete("roles/:roleId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete a custom organization role" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "roleId" })
  @ApiOkResponse({ type: ActionResponseDto })
  async deleteRole(
    @Param("organizationId") organizationId: string,
    @Param("roleId") roleId: string
  ): Promise<ActionResponseDto> {
    await this.rolesService.deleteRole(organizationId, roleId);
    return { success: true };
  }

  @Post("members/:membershipId/roles/:roleId")
  @ApiOperation({ summary: "Assign a role to a member" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "membershipId" })
  @ApiParam({ name: "roleId" })
  @ApiOkResponse({ type: RoleAssignmentDto })
  assignRole(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Param("roleId") roleId: string
  ): Promise<RoleAssignmentDto> {
    return this.rolesService.assignRole(organizationId, membershipId, roleId);
  }

  @Delete("members/:membershipId/roles/:roleId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke a role from a member" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "membershipId" })
  @ApiParam({ name: "roleId" })
  @ApiOkResponse({ type: RoleAssignmentDto })
  revokeRole(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Param("roleId") roleId: string
  ): Promise<RoleAssignmentDto> {
    return this.rolesService.revokeRole(organizationId, membershipId, roleId);
  }
}
