import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RoleKey, SsoProvider, UserStatus } from "@prisma/client";
import { AGENT_PERMISSIONS } from "../auth/auth.constants";
import { AuthService, type RequestMetadata } from "../auth/auth.service";
import type { AuthResponseDto } from "../auth/dto/auth-response.dto";
import { assertPublicHttpUrl, safeFetch } from "../common/network/safe-fetch";
import { EncryptionService } from "../common/crypto/encryption.service";
import { PrismaService } from "../prisma/prisma.service";

export interface SsoConnectionDto {
  provider: SsoProvider;
  emailDomain: string;
  issuer: string | null;
  clientId: string;
  autoProvision: boolean;
  isActive: boolean;
  /** Paste this into the identity provider as the allowed redirect URI. */
  redirectUri: string;
}

interface ProviderEndpoints {
  authorization: string;
  token: string;
  userinfo: string;
}

/**
 * Company sign-in over OpenID Connect (Google Workspace, Microsoft Entra, or any OIDC issuer).
 * Staff type their work email, get sent to the company's identity provider, and come back with
 * a session. The email is read from the provider's userinfo endpoint over a client-authenticated
 * call, so no local JWT verification is needed.
 */
@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    private readonly authService: AuthService
  ) {}

  async get(organizationId: string): Promise<SsoConnectionDto | null> {
    const connection = await this.prisma.ssoConnection.findUnique({ where: { organizationId } });
    return connection ? this.map(connection) : null;
  }

  async save(
    organizationId: string,
    input: {
      provider: SsoProvider;
      emailDomain: string;
      clientId: string;
      clientSecret: string;
      issuer?: string;
      autoProvision?: boolean;
    }
  ): Promise<SsoConnectionDto> {
    const emailDomain = input.emailDomain.trim().toLowerCase().replace(/^@/, "");

    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(emailDomain)) {
      throw new BadRequestException("Enter a company email domain, for example acme.com");
    }

    if (input.provider === SsoProvider.OIDC) {
      if (!input.issuer) {
        throw new BadRequestException("A generic OIDC connection needs the issuer URL");
      }
      await assertPublicHttpUrl(input.issuer).catch(() => {
        throw new BadRequestException("The issuer URL must be a public https address");
      });
    }

    const taken = await this.prisma.ssoConnection.findFirst({
      where: { emailDomain, organizationId: { not: organizationId } }
    });

    if (taken) {
      throw new BadRequestException("Another workspace already uses this email domain for SSO");
    }

    const data = {
      provider: input.provider,
      emailDomain,
      clientId: input.clientId.trim(),
      clientSecret: this.encryption.encrypt(input.clientSecret.trim()) ?? input.clientSecret.trim(),
      issuer: input.issuer?.trim() ?? null,
      autoProvision: input.autoProvision ?? true,
      isActive: true
    };

    const connection = await this.prisma.ssoConnection.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data
    });

    return this.map(connection);
  }

  async remove(organizationId: string): Promise<{ success: true }> {
    await this.prisma.ssoConnection.deleteMany({ where: { organizationId } });
    return { success: true };
  }

  /** Step 1: work out where to send the browser for this email address. */
  async startLogin(email: string): Promise<{ authUrl: string; state: string }> {
    const domain = email.trim().toLowerCase().split("@")[1];

    if (!domain) {
      throw new BadRequestException("Enter your work email address");
    }

    const connection = await this.prisma.ssoConnection.findFirst({
      where: { emailDomain: domain, isActive: true }
    });

    if (!connection) {
      throw new NotFoundException("Single sign-on isn't set up for this email domain");
    }

    const endpoints = await this.endpointsFor(connection.provider, connection.issuer);
    const state = `${connection.id}.${randomBytes(24).toString("base64url")}`;
    const url = new URL(endpoints.authorization);

    url.searchParams.set("client_id", connection.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");

    return { authUrl: url.toString(), state };
  }

  /** Step 2: swap the code for tokens, read the verified email, and sign the person in. */
  async completeLogin(
    code: string | undefined,
    state: string | undefined,
    metadata: RequestMetadata
  ): Promise<AuthResponseDto> {
    if (!code || !state) {
      throw new BadRequestException("The sign-in response was incomplete");
    }

    const connectionId = state.split(".")[0] ?? "";
    const connection = await this.prisma.ssoConnection.findFirst({
      where: { id: connectionId, isActive: true }
    });

    if (!connection) {
      throw new UnauthorizedException("This sign-in link is no longer valid");
    }

    const endpoints = await this.endpointsFor(connection.provider, connection.issuer);
    // The token and userinfo endpoints come from a tenant-supplied issuer, so they go through
    // the same SSRF guard as the discovery document. Credentials must never be posted inside our network.
    const tokenResponse = await safeFetch(endpoints.token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: connection.clientId,
        client_secret: this.encryption.decrypt(connection.clientSecret) ?? connection.clientSecret,
        redirect_uri: this.redirectUri(),
        grant_type: "authorization_code"
      }),
      timeoutMs: 15_000,
      maxRedirects: 0
    }).catch(() => {
      throw new UnauthorizedException("The identity provider could not be reached");
    });

    if (!tokenResponse.ok) {
      this.logger.warn(`SSO token exchange failed with status ${tokenResponse.status}`);
      throw new UnauthorizedException("The identity provider rejected the sign-in");
    }

    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) {
      throw new UnauthorizedException("The identity provider did not return an access token");
    }

    const profileResponse = await safeFetch(endpoints.userinfo, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      timeoutMs: 15_000,
      maxRedirects: 0
    }).catch(() => {
      throw new UnauthorizedException("Could not read the profile from the identity provider");
    });

    if (!profileResponse.ok) {
      throw new UnauthorizedException("Could not read the profile from the identity provider");
    }

    const profile = (await profileResponse.json()) as {
      email?: string;
      mail?: string;
      userPrincipalName?: string;
      name?: string;
      displayName?: string;
      email_verified?: boolean;
    };
    const email = (profile.email ?? profile.mail ?? profile.userPrincipalName ?? "").toLowerCase();

    if (!email) {
      throw new UnauthorizedException("The identity provider did not return an email address");
    }

    if (email.split("@")[1] !== connection.emailDomain) {
      throw new ForbiddenException(
        `This workspace only allows @${connection.emailDomain} accounts to sign in.`
      );
    }

    const user = await this.findOrCreateUser(email, profile.name ?? profile.displayName ?? email, connection.autoProvision);
    await this.ensureMembership(connection.organizationId, user.id, connection.defaultRoleId);

    return this.authService.issueSession(user.id, metadata, connection.organizationId);
  }

  private async findOrCreateUser(
    email: string,
    name: string,
    autoProvision: boolean
  ): Promise<{ id: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        // Coming back from the company IdP proves the address.
        data: { lastLoginAt: new Date(), emailVerifiedAt: existing.emailVerifiedAt ?? new Date() }
      });
      return existing;
    }

    if (!autoProvision) {
      throw new ForbiddenException("No account exists for this email and auto-provisioning is off");
    }

    return this.prisma.user.create({
      data: { email, name, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() }
    });
  }

  private async ensureMembership(
    organizationId: string,
    userId: string,
    defaultRoleId: string | null
  ): Promise<void> {
    const existing = await this.prisma.userOrganization.findFirst({
      where: { organizationId, userId }
    });

    if (existing) {
      if (existing.status !== UserStatus.ACTIVE) {
        await this.prisma.userOrganization.update({
          where: { id: existing.id },
          data: { status: UserStatus.ACTIVE }
        });
      }
      return;
    }

    const roleId = defaultRoleId ?? (await this.ensureAgentRole(organizationId));
    const membership = await this.prisma.userOrganization.create({
      data: { organizationId, userId, status: UserStatus.ACTIVE }
    });

    await this.prisma.userRole.create({
      data: { organizationId, membershipId: membership.id, roleId }
    });
  }

  private async ensureAgentRole(organizationId: string): Promise<string> {
    const existing = await this.prisma.role.findFirst({
      where: { organizationId, key: RoleKey.AGENT }
    });

    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.role.create({
      data: {
        organizationId,
        key: RoleKey.AGENT,
        name: "Agent",
        description: "Handles chats",
        permissions: [...AGENT_PERMISSIONS],
        isSystem: true
      }
    });

    return created.id;
  }

  private async endpointsFor(
    provider: SsoProvider,
    issuer: string | null
  ): Promise<ProviderEndpoints> {
    if (provider === SsoProvider.GOOGLE) {
      return {
        authorization: "https://accounts.google.com/o/oauth2/v2/auth",
        token: "https://oauth2.googleapis.com/token",
        userinfo: "https://openidconnect.googleapis.com/v1/userinfo"
      };
    }

    if (provider === SsoProvider.MICROSOFT) {
      return {
        authorization: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        userinfo: "https://graph.microsoft.com/oidc/userinfo"
      };
    }

    if (!issuer) {
      throw new BadRequestException("This OIDC connection has no issuer URL");
    }

    // Generic OIDC: read the endpoints from the issuer's discovery document.
    const base = issuer.replace(/\/$/, "");
    const response = await safeFetch(`${base}/.well-known/openid-configuration`, {
      timeoutMs: 10_000,
      maxRedirects: 2
    }).catch(() => {
      throw new BadRequestException("Could not read the OIDC discovery document from the issuer");
    });

    if (!response.ok) {
      throw new BadRequestException("Could not read the OIDC discovery document from the issuer");
    }

    const document = (await response.json()) as {
      authorization_endpoint?: string;
      token_endpoint?: string;
      userinfo_endpoint?: string;
    };

    if (!document.authorization_endpoint || !document.token_endpoint || !document.userinfo_endpoint) {
      throw new BadRequestException("The issuer's discovery document is missing endpoints");
    }

    return {
      authorization: document.authorization_endpoint,
      token: document.token_endpoint,
      userinfo: document.userinfo_endpoint
    };
  }

  private redirectUri(): string {
    const apiUrl = (this.config.get<string>("API_URL") ?? "http://localhost:4000").replace(/\/$/, "");
    const prefix = (this.config.get<string>("API_GLOBAL_PREFIX") ?? "api/v1").replace(/^\/|\/$/g, "");

    return `${apiUrl}/${prefix}/auth/sso/callback`;
  }

  private map(connection: {
    provider: SsoProvider;
    emailDomain: string;
    issuer: string | null;
    clientId: string;
    autoProvision: boolean;
    isActive: boolean;
  }): SsoConnectionDto {
    return {
      provider: connection.provider,
      emailDomain: connection.emailDomain,
      issuer: connection.issuer,
      clientId: connection.clientId,
      autoProvision: connection.autoProvision,
      isActive: connection.isActive,
      redirectUri: this.redirectUri()
    };
  }
}
