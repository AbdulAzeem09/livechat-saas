import { Injectable, NotFoundException } from "@nestjs/common";
import { Campaign, Goal } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignDto, GoalDto } from "./dto/campaign-response.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";
import { UpdateGoalDto } from "./dto/update-goal.dto";

/** Default campaigns seeded for a brand-new workspace (mirrors LiveChat defaults). */
const DEFAULT_CAMPAIGNS: Array<Omit<CreateCampaignDto, "name"> & { name: string; displayedCount: number; chatsCount: number }> = [
  { name: "Exit Intent Campaign", type: "recurring", triggerType: "exit_intent", triggerValue: "", message: "Wait! Before you go — can we help?", displayedCount: 50, chatsCount: 0 },
  { name: "Offer discount on your checkout page", type: "recurring", triggerType: "page_visit", triggerValue: "/checkout", message: "Use code SAVE10 for 10% off your order!", displayedCount: 0, chatsCount: 0 },
  { name: "Offer help on your pricing page", type: "recurring", triggerType: "page_visit", triggerValue: "/pricing", message: "Questions about pricing? Chat with us!", displayedCount: 0, chatsCount: 0 },
  { name: "Welcome returning customers", type: "recurring", triggerType: "welcome", triggerValue: "", message: "Welcome back! How can we help today?", displayedCount: 49, chatsCount: 1 },
  { name: "Welcome your customers", type: "recurring", triggerType: "welcome", triggerValue: "", message: "Hi there 👋 Let us know if you need anything!", displayedCount: 122, chatsCount: 6 }
];

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Campaigns -----------------------------------------------------------

  async listCampaigns(organizationId: string): Promise<CampaignDto[]> {
    const existing = await this.prisma.campaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    });

    if (existing.length === 0) {
      await this.prisma.campaign.createMany({
        data: DEFAULT_CAMPAIGNS.map((campaign) => ({ organizationId, ...campaign }))
      });

      const seeded = await this.prisma.campaign.findMany({
        where: { organizationId },
        orderBy: { createdAt: "asc" }
      });
      return seeded.map((campaign) => this.mapCampaign(campaign));
    }

    return existing.map((campaign) => this.mapCampaign(campaign));
  }

  async createCampaign(organizationId: string, dto: CreateCampaignDto): Promise<CampaignDto> {
    const campaign = await this.prisma.campaign.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.triggerType !== undefined ? { triggerType: dto.triggerType } : {}),
        ...(dto.triggerValue !== undefined ? { triggerValue: dto.triggerValue.trim() } : {}),
        ...(dto.message !== undefined ? { message: dto.message.trim() } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
      }
    });

    return this.mapCampaign(campaign);
  }

  async updateCampaign(
    organizationId: string,
    campaignId: string,
    dto: UpdateCampaignDto
  ): Promise<CampaignDto> {
    await this.getCampaignOrThrow(organizationId, campaignId);

    const campaign = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.triggerType !== undefined ? { triggerType: dto.triggerType } : {}),
        ...(dto.triggerValue !== undefined ? { triggerValue: dto.triggerValue.trim() } : {}),
        ...(dto.message !== undefined ? { message: dto.message.trim() } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
      }
    });

    return this.mapCampaign(campaign);
  }

  async removeCampaign(organizationId: string, campaignId: string): Promise<{ success: true }> {
    await this.getCampaignOrThrow(organizationId, campaignId);
    await this.prisma.campaign.delete({ where: { id: campaignId } });
    return { success: true };
  }

  // ---- Goals ---------------------------------------------------------------

  async listGoals(organizationId: string): Promise<GoalDto[]> {
    const goals = await this.prisma.goal.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    });

    return goals.map((goal) => this.mapGoal(goal));
  }

  async createGoal(organizationId: string, dto: CreateGoalDto): Promise<GoalDto> {
    const goal = await this.prisma.goal.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.target !== undefined ? { target: dto.target.trim() } : {}),
        ...(dto.valueCents !== undefined ? { valueCents: dto.valueCents } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
      }
    });

    return this.mapGoal(goal);
  }

  async updateGoal(organizationId: string, goalId: string, dto: UpdateGoalDto): Promise<GoalDto> {
    await this.getGoalOrThrow(organizationId, goalId);

    const goal = await this.prisma.goal.update({
      where: { id: goalId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.target !== undefined ? { target: dto.target.trim() } : {}),
        ...(dto.valueCents !== undefined ? { valueCents: dto.valueCents } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
      }
    });

    return this.mapGoal(goal);
  }

  async removeGoal(organizationId: string, goalId: string): Promise<{ success: true }> {
    await this.getGoalOrThrow(organizationId, goalId);
    await this.prisma.goal.delete({ where: { id: goalId } });
    return { success: true };
  }

  // ---- Helpers -------------------------------------------------------------

  private async getCampaignOrThrow(organizationId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, organizationId }
    });

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    return campaign;
  }

  private async getGoalOrThrow(organizationId: string, goalId: string): Promise<Goal> {
    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, organizationId } });

    if (!goal) {
      throw new NotFoundException("Goal not found");
    }

    return goal;
  }

  private mapCampaign(campaign: Campaign): CampaignDto {
    return {
      id: campaign.id,
      organizationId: campaign.organizationId,
      name: campaign.name,
      type: campaign.type,
      triggerType: campaign.triggerType,
      triggerValue: campaign.triggerValue,
      message: campaign.message,
      enabled: campaign.enabled,
      displayedCount: campaign.displayedCount,
      chatsCount: campaign.chatsCount,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt
    };
  }

  private mapGoal(goal: Goal): GoalDto {
    return {
      id: goal.id,
      organizationId: goal.organizationId,
      name: goal.name,
      type: goal.type,
      target: goal.target,
      valueCents: goal.valueCents,
      enabled: goal.enabled,
      completedCount: goal.completedCount,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt
    };
  }
}
