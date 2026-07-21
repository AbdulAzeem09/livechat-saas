import { createHash, randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ApiKey, WebhookEndpoint } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiKeyDto, CreatedApiKeyDto } from "./dto/api-key-response.dto";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
import { CreatedWebhookDto, WebhookDto } from "./dto/webhook-response.dto";

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- API keys ----

  async listApiKeys(organizationId: string): Promise<ApiKeyDto[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    });

    return keys.map((key) => this.mapApiKey(key));
  }

  async createApiKey(
    organizationId: string,
    createdById: string | null,
    dto: CreateApiKeyDto
  ): Promise<CreatedApiKeyDto> {
    const secret = `lck_${randomBytes(24).toString("base64url")}`;
    const keyPrefix = secret.slice(0, 12);

    const key = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        keyPrefix,
        keyHash: this.hash(secret),
        scopes: dto.scopes ?? [],
        ...(createdById ? { createdById } : {})
      }
    });

    // The full secret is returned only once, at creation time.
    return { ...this.mapApiKey(key), secret };
  }

  async revokeApiKey(organizationId: string, apiKeyId: string): Promise<{ success: true }> {
    const key = await this.prisma.apiKey.findFirst({ where: { id: apiKeyId, organizationId } });

    if (!key) {
      throw new NotFoundException("API key not found");
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() }
    });

    return { success: true };
  }

  // ---- Webhooks ----

  async listWebhooks(organizationId: string): Promise<WebhookDto[]> {
    const hooks = await this.prisma.webhookEndpoint.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    });

    return hooks.map((hook) => this.mapWebhook(hook));
  }

  async createWebhook(
    organizationId: string,
    dto: CreateWebhookDto
  ): Promise<CreatedWebhookDto> {
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;

    const hook = await this.prisma.webhookEndpoint.create({
      data: {
        organizationId,
        url: dto.url.trim(),
        secretHash: this.hash(secret),
        events: dto.events ?? ["conversation.created", "message.created"]
      }
    });

    return { ...this.mapWebhook(hook), secret };
  }

  async deleteWebhook(organizationId: string, webhookId: string): Promise<{ success: true }> {
    const hook = await this.prisma.webhookEndpoint.findFirst({
      where: { id: webhookId, organizationId }
    });

    if (!hook) {
      throw new NotFoundException("Webhook not found");
    }

    await this.prisma.webhookEndpoint.delete({ where: { id: webhookId } });
    return { success: true };
  }

  /**
   * Fire an event to all active webhook endpoints for an organization.
   * Best-effort: failures are recorded but never block the caller.
   */
  async dispatch(
    organizationId: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const hooks = await this.prisma.webhookEndpoint.findMany({
      where: { organizationId, isActive: true }
    });

    const targets = hooks.filter((hook) => !hook.events.length || hook.events.includes(event));

    await Promise.all(
      targets.map(async (hook) => {
        try {
          const response = await fetch(hook.url, {
            method: "POST",
            headers: { "content-type": "application/json", "x-livechat-event": event },
            body: JSON.stringify({ event, organizationId, data: payload, sentAt: new Date().toISOString() })
          });

          await this.prisma.webhookEndpoint.update({
            where: { id: hook.id },
            data: response.ok ? { lastSuccessAt: new Date() } : { lastFailureAt: new Date() }
          });
        } catch {
          await this.prisma.webhookEndpoint
            .update({ where: { id: hook.id }, data: { lastFailureAt: new Date() } })
            .catch(() => {});
        }
      })
    );
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private mapApiKey(key: ApiKey): ApiKeyDto {
    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt
    };
  }

  private mapWebhook(hook: WebhookEndpoint): WebhookDto {
    return {
      id: hook.id,
      url: hook.url,
      events: hook.events,
      isActive: hook.isActive,
      lastSuccessAt: hook.lastSuccessAt,
      lastFailureAt: hook.lastFailureAt,
      createdAt: hook.createdAt
    };
  }
}
