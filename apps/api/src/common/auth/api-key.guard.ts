import { createHash } from "node:crypto";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";

export interface ApiKeyRequest extends Request {
  /** Set by this guard: the workspace the key belongs to. */
  apiKeyOrganizationId?: string;
  apiKeyScopes?: string[];
}

/**
 * Authenticates machine-to-machine calls with the `x-api-key` header — the keys people
 * create in Settings → Integrations. Revoked and expired keys are refused.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const header = request.headers["x-api-key"];
    const secret = typeof header === "string" ? header.trim() : "";

    if (!secret) {
      throw new UnauthorizedException("Add your API key in the x-api-key header");
    }

    const key = await this.prisma.apiKey.findFirst({
      where: { keyHash: createHash("sha256").update(secret).digest("hex") }
    });

    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt.getTime() < Date.now())) {
      throw new UnauthorizedException("That API key is not valid");
    }

    request.apiKeyOrganizationId = key.organizationId;
    request.apiKeyScopes = key.scopes;

    // Last used is useful when someone asks "is this key still in use?" before revoking it.
    void this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return true;
  }
}
