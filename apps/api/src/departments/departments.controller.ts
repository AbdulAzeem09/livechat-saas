import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { DepartmentDto } from "./dto/department-response.dto";
import { SetDepartmentAgentsDto } from "./dto/set-department-agents.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

@ApiTags("Departments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Permissions("chat:read")
  @ApiOperation({ summary: "List departments" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [DepartmentDto] })
  list(@Param("organizationId") organizationId: string): Promise<DepartmentDto[]> {
    return this.departmentsService.list(organizationId);
  }

  @Post()
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Create a department" })
  @ApiParam({ name: "organizationId" })
  @ApiCreatedResponse({ type: DepartmentDto })
  create(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateDepartmentDto
  ): Promise<DepartmentDto> {
    return this.departmentsService.create(organizationId, dto);
  }

  @Patch(":departmentId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Update a department" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "departmentId" })
  @ApiOkResponse({ type: DepartmentDto })
  update(
    @Param("organizationId") organizationId: string,
    @Param("departmentId") departmentId: string,
    @Body() dto: UpdateDepartmentDto
  ): Promise<DepartmentDto> {
    return this.departmentsService.update(organizationId, departmentId, dto);
  }

  @Put(":departmentId/agents")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Replace the agents assigned to a department" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "departmentId" })
  @ApiOkResponse({ type: DepartmentDto })
  setAgents(
    @Param("organizationId") organizationId: string,
    @Param("departmentId") departmentId: string,
    @Body() dto: SetDepartmentAgentsDto
  ): Promise<DepartmentDto> {
    return this.departmentsService.setAgents(organizationId, departmentId, dto);
  }

  @Delete(":departmentId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Delete a department" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "departmentId" })
  @ApiOkResponse({ description: "Department deleted" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("departmentId") departmentId: string
  ): Promise<{ success: true }> {
    return this.departmentsService.remove(organizationId, departmentId);
  }
}
