import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { AuthProvider, Prisma, RoleKey, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { OWNER_PERMISSIONS } from "./auth.constants";
import type { AuthResponseDto, AuthUserDto, GoogleAuthUrlResponseDto } from "./dto/auth-response.dto";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AuthAccessTokenPayload,
  AuthMembershipSummary,
  AuthUser
} from "./types/auth-user";

interface RequestMetadata {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
}

interface GoogleProfileResponse {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds = 12;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async register(dto: RegisterDto, metadata: RequestMetadata): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const organizationSlug = dto.organizationSlug ?? this.slugify(dto.organizationName);
    const passwordHash = await bcrypt.hash(dto.password, this.passwordSaltRounds);

    const result = await this.prisma.$transaction(async (transaction) => {
      const existingUser = await transaction.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        throw new ConflictException("A user with this email already exists");
      }

      const existingOrganization = await transaction.organization.findUnique({
        where: { slug: organizationSlug }
      });

      if (existingOrganization) {
        throw new ConflictException("An organization with this slug already exists");
      }

      const user = await transaction.user.create({
        data: {
          email,
          name: dto.name,
          passwordHash,
          status: UserStatus.ACTIVE
        }
      });

      await transaction.authProviderIdentity.create({
        data: {
          userId: user.id,
          provider: AuthProvider.PASSWORD,
          providerUserId: email,
          providerEmail: email
        }
      });

      const organization = await transaction.organization.create({
        data: {
          name: dto.organizationName,
          slug: organizationSlug,
          status: "TRIALING",
          trialEndsAt: this.daysFromNow(14)
        }
      });
      const widgetSecret = this.generateWidgetSecret();

      await transaction.chatWidget.create({
        data: {
          organizationId: organization.id,
          name: "Website widget",
          publicKey: this.generateWidgetKey(),
          secretHash: this.hashToken(widgetSecret),
          welcomeMessage: "Hi there. How can we help?",
          offlineMessage: "Leave a message and the team will reply soon.",
          theme: {
            accentColor: "#ff5a00",
            position: "right"
          }
        }
      });

      const ownerRole = await transaction.role.create({
        data: {
          organizationId: organization.id,
          key: RoleKey.OWNER,
          name: "Owner",
          description: "Full organization access",
          permissions: [...OWNER_PERMISSIONS],
          isSystem: true
        }
      });

      const membership = await transaction.userOrganization.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          displayName: dto.name,
          status: UserStatus.ACTIVE
        }
      });

      await transaction.userRole.create({
        data: {
          organizationId: organization.id,
          membershipId: membership.id,
          roleId: ownerRole.id
        }
      });

      return {
        user,
        organizationId: organization.id
      };
    });

    return this.createSession(result.user.id, metadata, result.organizationId);
  }

  async login(dto: LoginDto, metadata: RequestMetadata): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user?.passwordHash || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return this.createSession(user.id, metadata);
  }

  async refresh(refreshToken: string | undefined, metadata: RequestMetadata): Promise<AuthResponseDto> {
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!storedToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId }
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() }
    });

    return this.createSession(user.id, metadata);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    return this.buildUserDto(userId);
  }

  getGoogleAuthUrl(state = randomBytes(16).toString("hex")): GoogleAuthUrlResponseDto {
    const { clientId, callbackUrl } = this.getGoogleConfig();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("state", state);

    return {
      authUrl: url.toString(),
      state
    };
  }

  async handleGoogleCallback(
    code: string | undefined,
    metadata: RequestMetadata
  ): Promise<AuthResponseDto> {
    if (!code) {
      throw new BadRequestException("Missing Google authorization code");
    }

    const tokens = await this.exchangeGoogleCode(code);
    const profile = await this.fetchGoogleProfile(tokens.access_token);
    const email = this.normalizeEmail(profile.email);
    const tokenExpiresAt =
      typeof tokens.expires_in === "number"
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

    const user = await this.prisma.$transaction(async (transaction) => {
      const existingIdentity = await transaction.authProviderIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: AuthProvider.GOOGLE,
            providerUserId: profile.sub
          }
        }
      });

      if (existingIdentity) {
        const existingUser = await transaction.user.update({
          where: { id: existingIdentity.userId },
          data: {
            lastLoginAt: new Date(),
            ...(profile.email_verified ? { emailVerifiedAt: new Date() } : {})
          }
        });

        await transaction.authProviderIdentity.update({
          where: { id: existingIdentity.id },
          data: {
            providerEmail: email,
            accessTokenHash: this.hashToken(tokens.access_token),
            expiresAt: tokenExpiresAt,
            ...(tokens.refresh_token
              ? { refreshTokenHash: this.hashToken(tokens.refresh_token) }
              : {})
          }
        });

        return existingUser;
      }

      const existingUser = await transaction.user.findUnique({
        where: { email }
      });

      const userRecord =
        existingUser ??
        (await transaction.user.create({
          data: {
            email,
            name: profile.name ?? email,
            avatarUrl: profile.picture ?? null,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: profile.email_verified ? new Date() : null
          }
        }));

      await transaction.authProviderIdentity.create({
        data: {
          userId: userRecord.id,
          provider: AuthProvider.GOOGLE,
          providerUserId: profile.sub,
          providerEmail: email,
          accessTokenHash: this.hashToken(tokens.access_token),
          expiresAt: tokenExpiresAt,
          ...(tokens.refresh_token
            ? { refreshTokenHash: this.hashToken(tokens.refresh_token) }
            : {})
        }
      });

      return transaction.user.update({
        where: { id: userRecord.id },
        data: {
          lastLoginAt: new Date(),
          emailVerifiedAt: profile.email_verified ? new Date() : userRecord.emailVerifiedAt
        }
      });
    });

    return this.createSession(user.id, metadata);
  }

  async validateAccessToken(token: string): Promise<AuthUser> {
    try {
      const payload = await this.jwt.verifyAsync<AuthAccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        issuer: this.config.getOrThrow<string>("JWT_ISSUER"),
        audience: this.config.getOrThrow<string>("JWT_AUDIENCE")
      });

      return {
        ...payload,
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
        userId: payload.sub
      };
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  private async createSession(
    userId: string,
    metadata: RequestMetadata,
    preferredOrganizationId?: string
  ): Promise<AuthResponseDto> {
    const user = await this.buildUserDto(userId);
    const activeMembership =
      user.memberships.find((membership) => membership.organizationId === preferredOrganizationId) ??
      user.memberships[0];
    const accessExpiresInSeconds = this.parseDurationToSeconds(
      this.config.getOrThrow<string>("JWT_ACCESS_TTL")
    );
    const refreshExpiresInSeconds = this.parseDurationToSeconds(
      this.config.getOrThrow<string>("JWT_REFRESH_TTL")
    );

    const payload: AuthAccessTokenPayload = {
      sub: user.id,
      email: user.email,
      ...(activeMembership
        ? {
            organizationId: activeMembership.organizationId,
            membershipId: activeMembership.id,
            roles: activeMembership.roles,
            permissions: activeMembership.permissions
          }
        : {
            roles: [],
            permissions: []
          })
    };
    const accessTokenTtl = this.config.getOrThrow<string>("JWT_ACCESS_TTL") as NonNullable<
      JwtSignOptions["expiresIn"]
    >;

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: accessTokenTtl,
      issuer: this.config.getOrThrow<string>("JWT_ISSUER"),
      audience: this.config.getOrThrow<string>("JWT_AUDIENCE")
    });
    const refreshToken = randomBytes(48).toString("base64url");

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshExpiresInSeconds * 1000),
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
        ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {})
      }
    });

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: accessExpiresInSeconds,
      refreshExpiresInSeconds,
      user
    };
  }

  private async buildUserDto(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("User is not active");
    }

    const memberships = await this.prisma.userOrganization.findMany({
      where: {
        userId: user.id,
        status: UserStatus.ACTIVE
      },
      orderBy: { createdAt: "asc" }
    });
    const organizationIds = memberships.map((membership) => membership.organizationId);
    const membershipIds = memberships.map((membership) => membership.id);
    const [organizations, userRoles] = await Promise.all([
      organizationIds.length
        ? this.prisma.organization.findMany({
            where: { id: { in: organizationIds } }
          })
        : [],
      membershipIds.length
        ? this.prisma.userRole.findMany({
            where: { membershipId: { in: membershipIds } }
          })
        : []
    ]);
    const roleIds = [...new Set(userRoles.map((userRole) => userRole.roleId))];
    const roles = roleIds.length
      ? await this.prisma.role.findMany({
          where: { id: { in: roleIds } }
        })
      : [];
    const organizationById = new Map(
      organizations.map((organization) => [organization.id, organization])
    );
    const roleById = new Map(roles.map((role) => [role.id, role]));
    const rolesByMembershipId = new Map<string, typeof roles>();

    for (const userRole of userRoles) {
      const role = roleById.get(userRole.roleId);

      if (!role) {
        continue;
      }

      const currentRoles = rolesByMembershipId.get(userRole.membershipId) ?? [];
      currentRoles.push(role);
      rolesByMembershipId.set(userRole.membershipId, currentRoles);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      memberships: memberships
        .map<AuthMembershipSummary | null>((membership) => {
          const organization = organizationById.get(membership.organizationId);

          if (!organization) {
            return null;
          }

          const membershipRoles = rolesByMembershipId.get(membership.id) ?? [];

          return {
            id: membership.id,
            organizationId: organization.id,
            organizationName: organization.name,
            organizationSlug: organization.slug,
            displayName: membership.displayName,
            roles: membershipRoles.map((role) => role.key ?? role.name),
            permissions: [
              ...new Set(
                membershipRoles.flatMap((role) => this.readPermissions(role.permissions))
              )
            ]
          };
        })
        .filter((membership): membership is AuthMembershipSummary => membership !== null)
    };
  }

  private async exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
    const { clientId, clientSecret, callbackUrl } = this.getGoogleConfig();
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code"
      })
    });

    if (!response.ok) {
      throw new UnauthorizedException("Google authorization failed");
    }

    return (await response.json()) as GoogleTokenResponse;
  }

  private async fetchGoogleProfile(accessToken: string): Promise<GoogleProfileResponse> {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new UnauthorizedException("Google profile lookup failed");
    }

    return (await response.json()) as GoogleProfileResponse;
  }

  private getGoogleConfig() {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID") ?? "";
    const clientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET") ?? "";
    const callbackUrl = this.config.get<string>("GOOGLE_CALLBACK_URL") ?? "";

    if (!clientId || !clientSecret || !callbackUrl) {
      throw new ServiceUnavailableException("Google login is not configured");
    }

    return {
      clientId,
      clientSecret,
      callbackUrl
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private slugify(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) {
      throw new BadRequestException("Organization name cannot produce a valid slug");
    }

    return slug.slice(0, 120);
  }

  private daysFromNow(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private generateWidgetKey(): string {
    return `lcw_${randomBytes(18).toString("base64url")}`;
  }

  private generateWidgetSecret(): string {
    return randomBytes(32).toString("base64url");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private readPermissions(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === "string");
  }

  private parseDurationToSeconds(value: string): number {
    const match = /^(\d+)([smhd])?$/.exec(value);

    if (!match) {
      throw new Error(`Unsupported duration format: ${value}`);
    }

    const amountText = match[1];

    if (!amountText) {
      throw new Error(`Unsupported duration format: ${value}`);
    }

    const amount = Number(amountText);
    const unit = match[2] ?? "s";
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60
    };
    const multiplier = multipliers[unit];

    if (!multiplier) {
      throw new Error(`Unsupported duration unit: ${unit}`);
    }

    return amount * multiplier;
  }
}
