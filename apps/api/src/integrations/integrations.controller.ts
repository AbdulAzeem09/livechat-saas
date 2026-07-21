import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
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
import { CurrentOrganization } from "../organizations/decorators/current-organization.decorator";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { ApiKeyDto, CreatedApiKeyDto } from "./dto/api-key-response.dto";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
import { CreatedWebhookDto, WebhookDto } from "./dto/webhook-response.dto";
import { IntegrationsService } from "./integrations.service";

@ApiTags("Integrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId")
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get("api-keys")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "List API keys" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [ApiKeyDto] })
  listApiKeys(@Param("organizationId") organizationId: string): Promise<ApiKeyDto[]> {
    return this.integrationsService.listApiKeys(organizationId);
  }

  @Post("api-keys")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Create an API key (secret returned once)" })
  @ApiParam({ name: "organizationId" })
  @ApiCreatedResponse({ type: CreatedApiKeyDto })
  createApiKey(
    @Param("organizationId") organizationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: CreateApiKeyDto
  ): Promise<CreatedApiKeyDto> {
    return this.integrationsService.createApiKey(organizationId, context.membershipId, dto);
  }

  @Delete("api-keys/:apiKeyId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Revoke an API key" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "apiKeyId" })
  @ApiOkResponse({ description: "API key revoked" })
  revokeApiKey(
    @Param("organizationId") organizationId: string,
    @Param("apiKeyId") apiKeyId: string
  ): Promise<{ success: true }> {
    return this.integrationsService.revokeApiKey(organizationId, apiKeyId);
  }

  @Get("webhooks")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "List webhook endpoints" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [WebhookDto] })
  listWebhooks(@Param("organizationId") organizationId: string): Promise<WebhookDto[]> {
    return this.integrationsService.listWebhooks(organizationId);
  }

  @Post("webhooks")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Register a webhook endpoint (secret returned once)" })
  @ApiParam({ name: "organizationId" })
  @ApiCreatedResponse({ type: CreatedWebhookDto })
  createWebhook(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateWebhookDto
  ): Promise<CreatedWebhookDto> {
    return this.integrationsService.createWebhook(organizationId, dto);
  }

  @Delete("webhooks/:webhookId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Delete a webhook endpoint" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "webhookId" })
  @ApiOkResponse({ description: "Webhook deleted" })
  deleteWebhook(
    @Param("organizationId") organizationId: string,
    @Param("webhookId") webhookId: string
  ): Promise<{ success: true }> {
    return this.integrationsService.deleteWebhook(organizationId, webhookId);
  }
}
