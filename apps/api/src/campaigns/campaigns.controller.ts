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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { CampaignsService } from "./campaigns.service";
import { CampaignDto, GoalDto } from "./dto/campaign-response.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";
import { UpdateGoalDto } from "./dto/update-goal.dto";

@ApiTags("Engage")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId")
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  // ---- Campaigns -----------------------------------------------------------

  @Get("campaigns")
  @Permissions("chat:read")
  @ApiOperation({ summary: "List campaigns" })
  @ApiParam({ name: "organizationId" })
  listCampaigns(@Param("organizationId") organizationId: string): Promise<CampaignDto[]> {
    return this.campaignsService.listCampaigns(organizationId);
  }

  @Post("campaigns")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Create a campaign" })
  @ApiParam({ name: "organizationId" })
  createCampaign(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateCampaignDto
  ): Promise<CampaignDto> {
    return this.campaignsService.createCampaign(organizationId, dto);
  }

  @Patch("campaigns/:campaignId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Update a campaign" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "campaignId" })
  updateCampaign(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: UpdateCampaignDto
  ): Promise<CampaignDto> {
    return this.campaignsService.updateCampaign(organizationId, campaignId, dto);
  }

  @Delete("campaigns/:campaignId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Delete a campaign" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "campaignId" })
  removeCampaign(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string
  ): Promise<{ success: true }> {
    return this.campaignsService.removeCampaign(organizationId, campaignId);
  }

  // ---- Goals ---------------------------------------------------------------

  @Get("goals")
  @Permissions("chat:read")
  @ApiOperation({ summary: "List goals" })
  @ApiParam({ name: "organizationId" })
  listGoals(@Param("organizationId") organizationId: string): Promise<GoalDto[]> {
    return this.campaignsService.listGoals(organizationId);
  }

  @Post("goals")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Create a goal" })
  @ApiParam({ name: "organizationId" })
  createGoal(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateGoalDto
  ): Promise<GoalDto> {
    return this.campaignsService.createGoal(organizationId, dto);
  }

  @Patch("goals/:goalId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Update a goal" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "goalId" })
  updateGoal(
    @Param("organizationId") organizationId: string,
    @Param("goalId") goalId: string,
    @Body() dto: UpdateGoalDto
  ): Promise<GoalDto> {
    return this.campaignsService.updateGoal(organizationId, goalId, dto);
  }

  @Delete("goals/:goalId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Delete a goal" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "goalId" })
  removeGoal(
    @Param("organizationId") organizationId: string,
    @Param("goalId") goalId: string
  ): Promise<{ success: true }> {
    return this.campaignsService.removeGoal(organizationId, goalId);
  }
}
