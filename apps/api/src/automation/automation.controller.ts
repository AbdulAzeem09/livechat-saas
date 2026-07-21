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
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { AutomationService } from "./automation.service";
import { AutomationRuleDto } from "./dto/automation-response.dto";
import { CreateAutomationRuleDto } from "./dto/create-automation-rule.dto";
import { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";

@ApiTags("Automation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/automation-rules")
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  @Permissions("chat:read")
  @ApiOperation({ summary: "List automation rules" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [AutomationRuleDto] })
  list(@Param("organizationId") organizationId: string): Promise<AutomationRuleDto[]> {
    return this.automationService.list(organizationId);
  }

  @Post()
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Create an automation rule" })
  @ApiParam({ name: "organizationId" })
  @ApiCreatedResponse({ type: AutomationRuleDto })
  create(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateAutomationRuleDto
  ): Promise<AutomationRuleDto> {
    return this.automationService.create(organizationId, dto);
  }

  @Patch(":ruleId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Update an automation rule" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "ruleId" })
  @ApiOkResponse({ type: AutomationRuleDto })
  update(
    @Param("organizationId") organizationId: string,
    @Param("ruleId") ruleId: string,
    @Body() dto: UpdateAutomationRuleDto
  ): Promise<AutomationRuleDto> {
    return this.automationService.update(organizationId, ruleId, dto);
  }

  @Delete(":ruleId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Delete an automation rule" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "ruleId" })
  @ApiOkResponse({ description: "Rule deleted" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("ruleId") ruleId: string
  ): Promise<{ success: true }> {
    return this.automationService.remove(organizationId, ruleId);
  }
}
