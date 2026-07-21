import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BillingPlan,
  BillingSubscription,
  Prisma,
  SubscriptionStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthorizeNetService } from "./authorizenet.service";
import {
  BillingInvoiceDto,
  BillingOverviewDto,
  BillingPlanDto,
  BillingSubscriptionDto
} from "./dto/billing-response.dto";
import { SubscribeDto } from "./dto/subscribe.dto";
import { buildInvoicePdf } from "./invoice-pdf";

@Injectable()
export class BillingService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authorizeNet: AuthorizeNetService
  ) {}

  /** Whether a real payment gateway (Authorize.net) is configured via env. */
  private get gatewayConfigured(): boolean {
    return this.authorizeNet.configured;
  }

  async getOverview(organizationId: string): Promise<BillingOverviewDto> {
    const [plans, subscription] = await Promise.all([
      this.listPlans(),
      this.getCurrentSubscription(organizationId)
    ]);

    return {
      plans,
      subscription,
      gatewayConfigured: this.gatewayConfigured,
      acceptJs: this.authorizeNet.acceptJsConfig
    };
  }

  async listPlans(): Promise<BillingPlanDto[]> {
    const plans = await this.prisma.billingPlan.findMany({
      where: { isActive: true },
      orderBy: { priceCents: "asc" }
    });

    return plans.map((plan) => this.mapPlan(plan));
  }

  async getCurrentSubscription(organizationId: string): Promise<BillingSubscriptionDto | null> {
    const subscription = await this.prisma.billingSubscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    });

    if (!subscription) {
      return null;
    }

    const plan = subscription.planId
      ? await this.prisma.billingPlan.findUnique({ where: { id: subscription.planId } })
      : null;

    return this.mapSubscription(subscription, plan);
  }

  async subscribe(organizationId: string, dto: SubscribeDto): Promise<BillingSubscriptionDto> {
    const plan = await this.prisma.billingPlan.findFirst({
      where: { code: dto.planCode, isActive: true }
    });

    if (!plan) {
      throw new NotFoundException("Plan not found");
    }

    // Per-seat plans charge (per-agent price × active agents); flat plans have an agent cap.
    const seats = await this.seatCount(organizationId);
    const perSeat = this.isPerSeat(plan);
    const agentCap = this.agentCap(plan);
    if (!perSeat && agentCap !== null && seats > agentCap) {
      throw new BadRequestException(
        `The ${plan.name} plan allows ${agentCap} agent${agentCap === 1 ? "" : "s"}. You have ${seats}. Remove agents or pick a per-agent plan.`
      );
    }
    const amountCents = perSeat ? plan.priceCents * Math.max(1, seats) : plan.priceCents;

    const provider = this.gatewayConfigured ? "authorizenet" : "mock";

    const customer = await this.prisma.billingCustomer.upsert({
      where: { organizationId },
      create: {
        organizationId,
        provider,
        ...(dto.billingEmail ? { billingEmail: dto.billingEmail } : {})
      },
      update: {
        provider,
        ...(dto.billingEmail ? { billingEmail: dto.billingEmail } : {})
      }
    });

    const now = new Date();
    const periodDays = plan.interval === "YEARLY" ? 365 : 30;
    const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    const existing = await this.prisma.billingSubscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    });

    // Charge through Authorize.net when the gateway is configured.
    let providerSubscriptionId: string | null = null;
    if (this.gatewayConfigured) {
      if (!dto.opaqueDataDescriptor || !dto.opaqueDataValue) {
        throw new BadRequestException("Card details are required to subscribe");
      }
      try {
        const result = await this.authorizeNet.createSubscription({
          planName: plan.name,
          amountCents,
          intervalMonths: plan.interval === "YEARLY" ? 12 : 1,
          opaqueData: {
            dataDescriptor: dto.opaqueDataDescriptor,
            dataValue: dto.opaqueDataValue
          },
          invoiceNumber: `SUB-${plan.code}`.toUpperCase(),
          ...(dto.billingEmail ? { email: dto.billingEmail } : {}),
          ...(dto.cardholderName ? { cardholderName: dto.cardholderName } : {})
        });
        providerSubscriptionId = result.subscriptionId;

        // Cancel any prior live gateway subscription so we don't double-bill.
        if (existing?.providerSubscriptionId) {
          await this.authorizeNet.cancelSubscription(existing.providerSubscriptionId);
        }
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : "Payment could not be processed"
        );
      }
    }

    const data = {
      provider,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      ...(providerSubscriptionId ? { providerSubscriptionId } : {}),
      metadata: {
        mock: provider === "mock",
        perSeat,
        seatCount: seats,
        perAgentCents: perSeat ? plan.priceCents : null,
        amountCents
      } as Prisma.InputJsonValue
    };

    const subscription = existing
      ? await this.prisma.billingSubscription.update({
          where: { id: existing.id },
          data
        })
      : await this.prisma.billingSubscription.create({
          data: {
            organizationId,
            billingCustomerId: customer.id,
            ...data
          }
        });

    // Reflect the active plan on the organization for feature gating.
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { planCode: plan.code, status: "ACTIVE" }
    });

    // Record a paid invoice for this billing period so the customer has a receipt.
    await this.prisma.billingInvoice.create({
      data: {
        organizationId,
        subscriptionId: subscription.id,
        status: "paid",
        currency: plan.currency,
        amountDueCents: amountCents,
        amountPaidCents: amountCents,
        paidAt: now
      }
    });

    return this.mapSubscription(subscription, plan);
  }

  /** Number of billable agents (active memberships) in the organization. */
  private async seatCount(organizationId: string): Promise<number> {
    return this.prisma.userOrganization.count({
      where: { organizationId, status: "ACTIVE" }
    });
  }

  private isPerSeat(plan: BillingPlan): boolean {
    const features = this.planFeatures(plan);
    return features.perSeat === true;
  }

  private agentCap(plan: BillingPlan): number | null {
    const features = this.planFeatures(plan);
    return typeof features.agents === "number" ? features.agents : null;
  }

  private planFeatures(plan: BillingPlan): Record<string, unknown> {
    return plan.features && typeof plan.features === "object" && !Array.isArray(plan.features)
      ? (plan.features as Record<string, unknown>)
      : {};
  }

  /**
   * Recompute the charge for a per-seat subscription after the team size changes,
   * and push the new amount to Authorize.net. Safe to call on every seat change.
   */
  async syncSeats(organizationId: string): Promise<void> {
    const subscription = await this.prisma.billingSubscription.findFirst({
      where: { organizationId, status: SubscriptionStatus.ACTIVE },
      orderBy: { createdAt: "desc" }
    });
    if (!subscription || !subscription.planId) {
      return;
    }
    const plan = await this.prisma.billingPlan.findUnique({ where: { id: subscription.planId } });
    if (!plan || !this.isPerSeat(plan)) {
      return;
    }

    const seats = Math.max(1, await this.seatCount(organizationId));
    const amountCents = plan.priceCents * seats;
    const meta = this.subscriptionMetadata(subscription);
    if (meta.seatCount === seats && meta.amountCents === amountCents) {
      return;
    }

    if (subscription.providerSubscriptionId) {
      try {
        await this.authorizeNet.updateSubscriptionAmount(subscription.providerSubscriptionId, amountCents);
      } catch {
        // Gateway update is best-effort; keep the local record in sync regardless.
      }
    }

    await this.prisma.billingSubscription.update({
      where: { id: subscription.id },
      data: {
        metadata: { ...meta, seatCount: seats, amountCents } as Prisma.InputJsonValue
      }
    });
  }

  private subscriptionMetadata(subscription: BillingSubscription): Record<string, unknown> {
    return subscription.metadata &&
      typeof subscription.metadata === "object" &&
      !Array.isArray(subscription.metadata)
      ? (subscription.metadata as Record<string, unknown>)
      : {};
  }

  async listInvoices(organizationId: string): Promise<BillingInvoiceDto[]> {
    const invoices = await this.prisma.billingInvoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    const planNameById = await this.planNamesFor(invoices);

    return invoices.map((invoice) => ({
      id: invoice.id,
      number: this.invoiceNumber(invoice.id, invoice.createdAt),
      status: invoice.status,
      currency: invoice.currency,
      amountDueCents: invoice.amountDueCents,
      amountPaidCents: invoice.amountPaidCents,
      planName: this.planNameForInvoice(invoice, planNameById),
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt
    }));
  }

  /** Render one invoice as a downloadable PDF. Returns the buffer + filename. */
  async getInvoicePdf(
    organizationId: string,
    invoiceId: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.prisma.billingInvoice.findFirst({
      where: { id: invoiceId, organizationId }
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    const [organization, customer, subscription] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.billingCustomer.findUnique({ where: { organizationId } }),
      invoice.subscriptionId
        ? this.prisma.billingSubscription.findUnique({ where: { id: invoice.subscriptionId } })
        : Promise.resolve(null)
    ]);

    const plan = subscription?.planId
      ? await this.prisma.billingPlan.findUnique({ where: { id: subscription.planId } })
      : null;

    const number = this.invoiceNumber(invoice.id, invoice.createdAt);
    const buffer = buildInvoicePdf({
      invoiceNumber: number,
      status: invoice.status,
      issuedOn: invoice.createdAt.toISOString().slice(0, 10),
      paidOn: invoice.paidAt ? invoice.paidAt.toISOString().slice(0, 10) : null,
      organizationName: organization?.name ?? "Customer",
      billingEmail: customer?.billingEmail ?? null,
      planName: plan?.name ?? "Subscription",
      interval: plan?.interval ?? "MONTHLY",
      currency: invoice.currency,
      amountDueCents: invoice.amountDueCents,
      amountPaidCents: invoice.amountPaidCents,
      provider: subscription?.provider ?? customer?.provider ?? "mock"
    });

    return { buffer, filename: `invoice-${number}.pdf` };
  }

  private async planNamesFor(
    invoices: { subscriptionId: string | null }[]
  ): Promise<Map<string, string>> {
    const subscriptionIds = Array.from(
      new Set(invoices.map((i) => i.subscriptionId).filter((id): id is string => Boolean(id)))
    );
    if (!subscriptionIds.length) {
      return new Map();
    }

    const subscriptions = await this.prisma.billingSubscription.findMany({
      where: { id: { in: subscriptionIds } }
    });
    const planIds = Array.from(
      new Set(subscriptions.map((s) => s.planId).filter((id): id is string => Boolean(id)))
    );
    const plans = planIds.length
      ? await this.prisma.billingPlan.findMany({ where: { id: { in: planIds } } })
      : [];
    const planNameByPlanId = new Map(plans.map((p) => [p.id, p.name]));

    const map = new Map<string, string>();
    for (const sub of subscriptions) {
      if (sub.planId && planNameByPlanId.has(sub.planId)) {
        map.set(sub.id, planNameByPlanId.get(sub.planId) as string);
      }
    }
    return map;
  }

  private planNameForInvoice(
    invoice: { subscriptionId: string | null },
    planNameBySubscriptionId: Map<string, string>
  ): string | null {
    if (invoice.subscriptionId && planNameBySubscriptionId.has(invoice.subscriptionId)) {
      return planNameBySubscriptionId.get(invoice.subscriptionId) as string;
    }
    return null;
  }

  /** Deterministic human-friendly invoice number: INV-YYYYMM-XXXXXX. */
  private invoiceNumber(id: string, createdAt: Date): string {
    const ym = `${createdAt.getUTCFullYear()}${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const suffix = id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();
    return `INV-${ym}-${suffix}`;
  }

  async cancel(organizationId: string): Promise<BillingSubscriptionDto> {
    const subscription = await this.prisma.billingSubscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    });

    if (!subscription) {
      throw new NotFoundException("No subscription to cancel");
    }

    // Stop billing at the gateway too (best-effort).
    if (subscription.providerSubscriptionId) {
      await this.authorizeNet.cancelSubscription(subscription.providerSubscriptionId);
    }

    const updated = await this.prisma.billingSubscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: true,
        canceledAt: new Date()
      }
    });

    const plan = updated.planId
      ? await this.prisma.billingPlan.findUnique({ where: { id: updated.planId } })
      : null;

    return this.mapSubscription(updated, plan);
  }

  private mapPlan(plan: BillingPlan): BillingPlanDto {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      interval: plan.interval,
      priceCents: plan.priceCents,
      currency: plan.currency,
      features:
        plan.features && typeof plan.features === "object" && !Array.isArray(plan.features)
          ? (plan.features as Record<string, unknown>)
          : {}
    };
  }

  private mapSubscription(
    subscription: BillingSubscription,
    plan: BillingPlan | null
  ): BillingSubscriptionDto {
    const meta = this.subscriptionMetadata(subscription);
    const perSeat = meta.perSeat === true || (plan ? this.isPerSeat(plan) : false);
    const seatCount = typeof meta.seatCount === "number" ? meta.seatCount : 1;
    const perAgentCents =
      typeof meta.perAgentCents === "number"
        ? meta.perAgentCents
        : perSeat && plan
          ? plan.priceCents
          : null;
    const amountCents =
      typeof meta.amountCents === "number"
        ? meta.amountCents
        : perSeat && perAgentCents
          ? perAgentCents * seatCount
          : plan?.priceCents ?? 0;

    return {
      id: subscription.id,
      planId: subscription.planId,
      planCode: plan?.code ?? null,
      planName: plan?.name ?? null,
      provider: subscription.provider,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      isMock: subscription.provider === "mock",
      perSeat,
      seatCount,
      perAgentCents,
      amountCents
    };
  }
}
