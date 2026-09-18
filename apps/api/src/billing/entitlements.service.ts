import { ForbiddenException, Injectable } from "@nestjs/common";
import { OrganizationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface Entitlements {
  /** False when the widget should stop accepting new chats. */
  active: boolean;
  reason: "trial_expired" | "past_due" | "canceled" | "suspended" | null;
  message: string | null;
  planCode: string;
  /** Max agents on a flat plan; null when the plan is per-agent (no cap). */
  agentLimit: number | null;
  /** True when that cap comes from the running trial rather than the plan itself. */
  agentLimitFromTrial: boolean;
  trialEndsAt: Date | null;
}

/**
 * Seats allowed while the free trial is running. The starter plan includes a single agent,
 * but a workspace has to be able to invite the team it is trialling with; the plan's own
 * cap applies as soon as the trial ends or a plan is picked.
 */
const TRIAL_AGENT_LIMIT = 5;

const BLOCKED_STATUS: Partial<Record<OrganizationStatus, { reason: Entitlements["reason"]; message: string }>> = {
  [OrganizationStatus.PAST_DUE]: {
    reason: "past_due",
    message: "A payment failed, so the chat widget is paused. Update your card in Billing."
  },
  [OrganizationStatus.CANCELED]: {
    reason: "canceled",
    message: "This subscription was cancelled, so the chat widget is switched off."
  },
  [OrganizationStatus.SUSPENDED]: {
    reason: "suspended",
    message: "This workspace is suspended. Please contact support."
  }
};

/**
 * What a workspace is allowed to do right now. The dashboard always stays reachable so the
 * team can pay or export their data; only the public widget stops when billing lapses.
 */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string): Promise<Entitlements> {
    const [organization, subscription] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { status: true, planCode: true, trialEndsAt: true }
      }),
      this.prisma.billingSubscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: { planId: true, status: true }
      })
    ]);

    const plan = subscription?.planId
      ? await this.prisma.billingPlan.findUnique({ where: { id: subscription.planId } })
      : await this.prisma.billingPlan.findFirst({
          where: { code: organization?.planCode ?? "starter" }
        });
    const features =
      plan?.features && typeof plan.features === "object" && !Array.isArray(plan.features)
        ? (plan.features as Record<string, unknown>)
        : {};
    const planAgentLimit =
      features.perSeat === true || typeof features.agents !== "number"
        ? null
        : features.agents;

    const trialRunning =
      organization?.status === OrganizationStatus.TRIALING &&
      (organization.trialEndsAt === null || organization.trialEndsAt.getTime() >= Date.now());

    const agentLimit =
      trialRunning && planAgentLimit !== null
        ? Math.max(planAgentLimit, TRIAL_AGENT_LIMIT)
        : planAgentLimit;

    const base = {
      planCode: organization?.planCode ?? "starter",
      agentLimit,
      agentLimitFromTrial: agentLimit !== planAgentLimit,
      trialEndsAt: organization?.trialEndsAt ?? null
    };

    const blocked = organization ? BLOCKED_STATUS[organization.status] : undefined;
    if (blocked) {
      return { active: false, ...blocked, ...base };
    }

    const trialOver =
      organization?.status === OrganizationStatus.TRIALING &&
      organization.trialEndsAt !== null &&
      organization.trialEndsAt.getTime() < Date.now();

    if (trialOver) {
      return {
        active: false,
        reason: "trial_expired",
        message: "Your free trial has ended, so the chat widget is paused. Pick a plan in Billing.",
        ...base
      };
    }

    return { active: true, reason: null, message: null, ...base };
  }

  /** Throw when the workspace may not serve visitors (used by the public widget endpoints). */
  async assertActive(organizationId: string): Promise<void> {
    const entitlements = await this.get(organizationId);

    if (!entitlements.active) {
      throw new ForbiddenException(entitlements.message ?? "This chat is unavailable right now.");
    }
  }

  /** Flat plans cap the number of agents; per-agent plans bill for each seat instead. */
  async assertCanAddAgent(organizationId: string): Promise<void> {
    const entitlements = await this.get(organizationId);

    if (entitlements.agentLimit === null) {
      return;
    }

    const seats = await this.prisma.userOrganization.count({
      where: { organizationId, status: "ACTIVE" }
    });

    if (seats >= entitlements.agentLimit) {
      const seatWord = `${entitlements.agentLimit} agent${entitlements.agentLimit === 1 ? "" : "s"}`;

      throw new ForbiddenException(
        entitlements.agentLimitFromTrial
          ? `Your free trial covers ${seatWord}. Pick a plan in Billing to add more.`
          : `The ${entitlements.planCode} plan includes ${seatWord}. Upgrade in Billing to add more.`
      );
    }
  }
}
