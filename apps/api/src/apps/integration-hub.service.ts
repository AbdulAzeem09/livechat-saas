import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import { safeFetch } from "../common/network/safe-fetch";
import { APP_SECRET_FIELDS } from "./apps.service";

export interface CommerceOrder {
  id: string;
  number: string;
  placedAt: string | null;
  total: string;
  currency: string;
  status: string;
  items: string[];
}

export interface IntegrationTestResult {
  ok: boolean;
  message: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The installed apps that actually reach outside: Slack alerts, a Shopify customer's recent
 * orders shown next to the chat, and contacts pushed into HubSpot. Each one reads its keys
 * from the workspace's app install, so nothing is hard-coded and nothing runs uninstalled.
 */
@Injectable()
export class IntegrationHubService {
  private readonly logger = new Logger(IntegrationHubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService
  ) {}

  // ------------------------------------------------------------------- Slack

  /** Post a line into the workspace's Slack channel. Silent when Slack isn't installed. */
  async notifySlack(organizationId: string, text: string): Promise<boolean> {
    const settings = await this.settingsFor(organizationId, "slack");
    const webhookUrl = this.stringOf(settings.webhookUrl);

    if (!webhookUrl) {
      return false;
    }

    try {
      const response = await safeFetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxRedirects: 0
      });

      return response.ok;
    } catch (error) {
      this.logger.warn(
        `Slack notification failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  // ----------------------------------------------------------------- Shopify

  /**
   * The customer's recent orders, so an agent answering "where is my parcel?" can see it
   * without leaving the chat. Returns an empty list when Shopify isn't installed.
   */
  async recentOrders(organizationId: string, email: string): Promise<CommerceOrder[]> {
    const settings = await this.settingsFor(organizationId, "shopify");
    const shopDomain = this.stringOf(settings.shopDomain);
    const accessToken = this.stringOf(settings.accessToken);

    if (!shopDomain || !accessToken || !email) {
      return [];
    }

    const base = this.config.get<string>("SHOPIFY_API_BASE_URL") ?? `https://${shopDomain}`;
    const url = `${base.replace(/\/$/, "")}/admin/api/2024-10/orders.json?status=any&limit=5&email=${encodeURIComponent(email)}`;

    try {
      const response = await safeFetch(url, {
        headers: { "x-shopify-access-token": accessToken, accept: "application/json" },
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxRedirects: 0
      });

      if (!response.ok) {
        this.logger.warn(`Shopify order lookup failed with status ${response.status}`);
        return [];
      }

      const data = (await response.json()) as { orders?: unknown[] };

      return Array.isArray(data.orders) ? data.orders.slice(0, 5).map((order) => this.mapOrder(order)) : [];
    } catch (error) {
      this.logger.warn(
        `Shopify order lookup failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  // ----------------------------------------------------------------- HubSpot

  /** Create or update the customer in HubSpot. Silent when HubSpot isn't installed. */
  async syncContactToHubspot(
    organizationId: string,
    contact: { email: string; name?: string | null; phone?: string | null; company?: string | null }
  ): Promise<boolean> {
    const settings = await this.settingsFor(organizationId, "hubspot");
    const accessToken = this.stringOf(settings.accessToken);

    if (!accessToken || !contact.email) {
      return false;
    }

    const base = this.config.get<string>("HUBSPOT_API_BASE_URL") ?? "https://api.hubapi.com";
    const [firstname, ...rest] = (contact.name ?? "").trim().split(/\s+/).filter(Boolean);

    try {
      const response = await safeFetch(`${base.replace(/\/$/, "")}/crm/v3/objects/contacts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          properties: {
            email: contact.email,
            ...(firstname ? { firstname } : {}),
            ...(rest.length ? { lastname: rest.join(" ") } : {}),
            ...(contact.phone ? { phone: contact.phone } : {}),
            ...(contact.company ? { company: contact.company } : {})
          }
        }),
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxRedirects: 0
      });

      // 409 means HubSpot already has this email — that is a success for our purposes.
      return response.ok || response.status === 409;
    } catch (error) {
      this.logger.warn(
        `HubSpot sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  // -------------------------------------------------------------------- test

  /** "Send a test" from the app card, so setup mistakes are caught immediately. */
  async test(organizationId: string, appKey: string): Promise<IntegrationTestResult> {
    const settings = await this.settingsFor(organizationId, appKey);

    if (appKey === "slack") {
      if (!this.stringOf(settings.webhookUrl)) {
        throw new BadRequestException("Add your Slack webhook URL first");
      }
      const ok = await this.notifySlack(organizationId, "✅ Chatme is connected to this channel.");

      return {
        ok,
        message: ok ? "Test message sent to Slack." : "Slack did not accept the message — check the webhook URL."
      };
    }

    if (appKey === "shopify") {
      if (!this.stringOf(settings.shopDomain) || !this.stringOf(settings.accessToken)) {
        throw new BadRequestException("Add your shop domain and access token first");
      }
      const orders = await this.recentOrders(organizationId, "test@example.com");

      return {
        ok: true,
        message: `Shopify answered — ${orders.length} order${orders.length === 1 ? "" : "s"} for the test email.`
      };
    }

    if (appKey === "hubspot") {
      if (!this.stringOf(settings.accessToken)) {
        throw new BadRequestException("Add your HubSpot private app token first");
      }
      const ok = await this.syncContactToHubspot(organizationId, {
        email: `livechat-test@${organizationId.slice(0, 8)}.invalid`,
        name: "Chatme Test"
      });

      return {
        ok,
        message: ok ? "HubSpot accepted a test contact." : "HubSpot rejected the request — check the token."
      };
    }

    throw new BadRequestException("This app has nothing to test");
  }

  /** True when the workspace has this app installed. */
  async isInstalled(organizationId: string, appKey: string): Promise<boolean> {
    const install = await this.prisma.appInstall.findFirst({ where: { organizationId, appKey } });

    return Boolean(install);
  }

  // --------------------------------------------------------------- utilities

  private async settingsFor(
    organizationId: string,
    appKey: string
  ): Promise<Record<string, unknown>> {
    const install = await this.prisma.appInstall.findFirst({ where: { organizationId, appKey } });

    const settings =
      install?.settings && typeof install.settings === "object" && !Array.isArray(install.settings)
        ? install.settings
        : {};

    return this.encryption.decryptFields(settings, APP_SECRET_FIELDS);
  }

  private mapOrder(raw: unknown): CommerceOrder {
    const order = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const lineItems = Array.isArray(order.line_items) ? order.line_items : [];

    return {
      id: this.textOf(order.id),
      number: this.textOf(order.name) || this.textOf(order.order_number),
      placedAt: typeof order.created_at === "string" ? order.created_at : null,
      total: this.textOf(order.total_price) || "0",
      currency: this.textOf(order.currency),
      status: this.textOf(order.fulfillment_status) || this.textOf(order.financial_status) || "pending",
      items: lineItems
        .slice(0, 5)
        .map((item) =>
          item && typeof item === "object"
            ? this.textOf((item as Record<string, unknown>).title)
            : ""
        )
        .filter(Boolean)
    };
  }

  /** Shopify sends numbers and strings for the same field; anything else is dropped. */
  private textOf(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  }

  private stringOf(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }
}
