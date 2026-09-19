import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import { PrismaService } from "../prisma/prisma.service";

export interface AppCatalogEntry {
  key: string;
  name: string;
  description: string;
  /** Where the app is actually configured once installed. */
  setupHint: string;
}

export interface InstalledApp extends AppCatalogEntry {
  installed: boolean;
  settings: Record<string, unknown>;
  installedAt: Date | null;
}

/** Settings keys that hold a provider secret rather than a plain setting. */
export const APP_SECRET_FIELDS = ["accessToken", "webhookUrl", "apiKey", "secret"];

/** Apps a workspace can switch on. Each one maps to a feature that already exists. */
export const APP_CATALOG: AppCatalogEntry[] = [
  {
    key: "whatsapp",
    name: "WhatsApp",
    description: "Answer WhatsApp messages in the same inbox as website chats.",
    setupHint: "Settings → Messaging channels"
  },
  {
    key: "messenger",
    name: "Facebook Messenger",
    description: "Reply to your Facebook page messages from the dashboard.",
    setupHint: "Settings → Messaging channels"
  },
  {
    key: "instagram",
    name: "Instagram",
    description: "Handle Instagram DMs alongside your other chats.",
    setupHint: "Settings → Messaging channels"
  },
  {
    key: "slack",
    name: "Slack alerts",
    description: "Post a Slack message whenever a new chat starts.",
    setupHint: "Settings → Chat settings"
  },
  {
    key: "shopify",
    name: "Shopify",
    description: "See a customer's recent orders next to the chat, without leaving the inbox.",
    setupHint: "Apps → Shopify → shop domain + Admin API token"
  },
  {
    key: "hubspot",
    name: "HubSpot",
    description: "Push customers into HubSpot as soon as a chat is resolved.",
    setupHint: "Apps → HubSpot → private app token"
  },
  {
    key: "webhooks",
    name: "Webhooks",
    description: "Send chat events to your own systems.",
    setupHint: "Apps → Automate with webhooks"
  },
  {
    key: "knowledge",
    name: "Knowledge base AI",
    description: "Let the AI receptionist answer from your articles and PDFs.",
    setupHint: "Automate → Knowledge hub"
  },
  {
    key: "wordpress",
    name: "WordPress plugin",
    description: "Drop the chat widget onto a WordPress site without editing code.",
    setupHint: "Settings → Install LiveChat"
  }
];

@Injectable()
export class AppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly encryption: EncryptionService
  ) {}

  async list(organizationId: string): Promise<InstalledApp[]> {
    const installs = await this.prisma.appInstall.findMany({ where: { organizationId } });
    const byKey = new Map(installs.map((install) => [install.appKey, install]));

    return APP_CATALOG.map((app) => {
      const install = byKey.get(app.key);

      return {
        ...app,
        installed: Boolean(install),
        // Provider keys are encrypted in the database; the screen needs them readable.
        settings: this.encryption.decryptFields(
          install?.settings && typeof install.settings === "object" && !Array.isArray(install.settings)
            ? install.settings
            : {},
          APP_SECRET_FIELDS
        ),
        installedAt: install?.installedAt ?? null
      };
    });
  }

  async install(
    organizationId: string,
    appKey: string,
    membershipId: string,
    settings: Record<string, unknown> = {}
  ): Promise<InstalledApp[]> {
    this.assertKnown(appKey);

    // Provider keys live inside this JSON, so they are encrypted before they are stored.
    const stored = this.encryption.encryptFields(settings, APP_SECRET_FIELDS) as Prisma.InputJsonValue;

    await this.prisma.appInstall.upsert({
      where: { organizationId_appKey: { organizationId, appKey } },
      create: {
        organizationId,
        appKey,
        installedByMembershipId: membershipId,
        settings: stored
      },
      update: { settings: stored }
    });
    this.audit.record({
      organizationId,
      actorMemberId: membershipId,
      action: "app.installed",
      entityType: "app",
      payload: { appKey }
    });

    return this.list(organizationId);
  }

  async uninstall(
    organizationId: string,
    appKey: string,
    membershipId: string
  ): Promise<InstalledApp[]> {
    this.assertKnown(appKey);
    await this.prisma.appInstall.deleteMany({ where: { organizationId, appKey } });
    this.audit.record({
      organizationId,
      actorMemberId: membershipId,
      action: "app.uninstalled",
      entityType: "app",
      payload: { appKey }
    });

    return this.list(organizationId);
  }

  private assertKnown(appKey: string): void {
    if (!APP_CATALOG.some((app) => app.key === appKey)) {
      throw new BadRequestException("Unknown app");
    }
  }
}
