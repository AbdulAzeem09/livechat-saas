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
import { AuthProvider, Prisma, RoleKey, UserStatus, UserTokenType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { OWNER_PERMISSIONS } from "./auth.constants";
import type { AuthResponseDto, AuthUserDto, GoogleAuthUrlResponseDto } from "./dto/auth-response.dto";
import type { TwoFactorChallengeDto } from "./dto/two-factor.dto";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import { MonitoringService } from "../common/monitoring/monitoring.service";
import { AccountSecurityService } from "./account-security.service";
import { AuditService } from "../common/audit/audit.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AuthAccessTokenPayload,
  AuthMembershipSummary,
  AuthUser
} from "./types/auth-user";

export interface RequestMetadata {
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

/** The window between the password step and the authenticator code. */
const TWO_FACTOR_CHALLENGE_MINUTES = 5;

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds = 12;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly accountSecurity: AccountSecurityService,
    private readonly monitoring: MonitoringService
  ) {}

  async register(dto: RegisterDto, metadata: RequestMetadata): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(dto.email);
    this.accountSecurity.assertPasswordIsStrong(dto.password, email);
    const requestedSlug = dto.organizationSlug ?? this.slugify(dto.organizationName);
    const passwordHash = await bcrypt.hash(dto.password, this.passwordSaltRounds);

    const result = await this.prisma.$transaction(async (transaction) => {
      const existingUser = await transaction.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        throw new ConflictException("A user with this email already exists");
      }

      // Company names repeat ("Techvance"); keep the signup working with a unique suffix.
      const slugTaken = await transaction.organization.findUnique({
        where: { slug: requestedSlug }
      });
      const organizationSlug = slugTaken
        ? `${requestedSlug.slice(0, 112)}-${randomBytes(3).toString("hex")}`
        : requestedSlug;

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

    // Fire-and-forget: a mail hiccup must not fail the signup itself.
    void this.sendEmailVerification(result.user.id).catch(() => {});

    return this.createSession(result.user.id, metadata, result.organizationId);
  }

  /** Returned instead of a session when the account has two-factor sign-in switched on. */
  async login(
    dto: LoginDto,
    metadata: RequestMetadata
  ): Promise<AuthResponseDto | TwoFactorChallengeDto> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user?.passwordHash || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Repeated guessing pauses the account before it pauses the attacker's patience.
    this.accountSecurity.assertNotLocked(user);

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      await this.accountSecurity.recordFailedLogin(user.id);
      this.monitoring.recordFailedLogin(`${email} from ${metadata.ipAddress ?? "unknown IP"}`);
      void this.recordAccountEvent(user.id, "auth.login_failed", metadata, { method: "password" });
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.accountSecurity.clearFailedLogins(user.id);

    // With two-factor on, the password only earns a short-lived challenge.
    if (this.accountSecurity.isTwoFactorEnabled(user)) {
      return {
        twoFactorRequired: true,
        challengeToken: await this.issueUserToken(
          user.id,
          UserTokenType.TWO_FACTOR_CHALLENGE,
          TWO_FACTOR_CHALLENGE_MINUTES
        )
      };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    void this.recordAccountEvent(user.id, "auth.login", metadata, { method: "password" });

    return this.createSession(user.id, metadata);
  }

  /** Second step of sign-in: the code from the authenticator app, or a recovery code. */
  async completeTwoFactorLogin(
    challengeToken: string,
    code: string,
    metadata: RequestMetadata
  ): Promise<AuthResponseDto> {
    // An expired or already-used challenge should send the person back to sign-in, not read
    // as a malformed request.
    const record = await this.consumeUserToken(
      challengeToken,
      UserTokenType.TWO_FACTOR_CHALLENGE
    ).catch(() => {
      throw new UnauthorizedException("This sign-in has expired — please start again");
    });
    const userId = record.userId;

    if (!(await this.accountSecurity.verifySecondFactor(userId, code))) {
      void this.recordAccountEvent(userId, "auth.two_factor_failed", metadata, {});
      throw new UnauthorizedException("That code didn't match");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
    void this.recordAccountEvent(userId, "auth.login", metadata, { method: "password+2fa" });

    return this.createSession(userId, metadata);
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

  /**
   * Create a password account with no organization of its own. Used when someone joins a
   * workspace from an invite link, so signing up doesn't also create a new company.
   */
  async createPasswordUser(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ id: string; email: string }> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await bcrypt.hash(input.password, this.passwordSaltRounds);

    return this.prisma.$transaction(async (transaction) => {
      const existingUser = await transaction.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException(
          "An account with this email already exists. Log in to accept the invitation."
        );
      }

      const user = await transaction.user.create({
        data: { email, name: input.name, passwordHash, status: UserStatus.ACTIVE }
      });
      await transaction.authProviderIdentity.create({
        data: {
          userId: user.id,
          provider: AuthProvider.PASSWORD,
          providerUserId: email,
          providerEmail: email
        }
      });

      return { id: user.id, email };
    });
  }

  /** Issue access + refresh tokens, opening the given organization first. */
  issueSession(
    userId: string,
    metadata: RequestMetadata,
    preferredOrganizationId?: string
  ): Promise<AuthResponseDto> {
    return this.createSession(userId, metadata, preferredOrganizationId);
  }

  /**
   * Start a password reset. Always resolves the same way so the endpoint can't be used to
   * discover which email addresses have accounts.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) }
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return;
    }

    const token = await this.issueUserToken(user.id, UserTokenType.PASSWORD_RESET, 60);
    const link = `${this.appUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    await this.mail.send({
      to: user.email,
      subject: "Reset your Chatme password",
      text:
        `We received a request to reset your Chatme password.\n\nSet a new password:\n${link}\n\n` +
        "This link expires in 1 hour. If you didn't ask for it, you can ignore this email.",
      html:
        `<p>We received a request to reset your Chatme password.</p>` +
        `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#ff5100;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Set a new password</a></p>` +
        `<p style="color:#666;font-size:12px">Or open: ${link}<br>This link expires in 1 hour. If you didn't ask for it, you can ignore this email.</p>`
    });
  }

  /** Finish a password reset: set the new password and sign every other session out. */
  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.consumeUserToken(token, UserTokenType.PASSWORD_RESET);
    this.accountSecurity.assertPasswordIsStrong(password);
    const passwordHash = await bcrypt.hash(password, this.passwordSaltRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        // Clicking the emailed link also proves the address belongs to them.
        data: {
          passwordHash,
          emailVerifiedAt: new Date(),
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);
    void this.recordAccountEvent(record.userId, "auth.password_reset", {});
  }

  /** Email the "confirm your address" link. Safe to call repeatedly. */
  async sendEmailVerification(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.emailVerifiedAt) {
      return false;
    }

    const token = await this.issueUserToken(user.id, UserTokenType.EMAIL_VERIFICATION, 60 * 24);
    const link = `${this.appUrl()}/verify-email?token=${encodeURIComponent(token)}`;

    return this.mail.send({
      to: user.email,
      subject: "Confirm your email address",
      text: `Confirm your email address to finish setting up Chatme:\n${link}\n\nThis link expires in 24 hours.`,
      html:
        `<p>Confirm your email address to finish setting up Chatme.</p>` +
        `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#ff5100;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Confirm email</a></p>` +
        `<p style="color:#666;font-size:12px">Or open: ${link}<br>This link expires in 24 hours.</p>`
    });
  }

  async verifyEmail(token: string): Promise<{ email: string }> {
    const record = await this.consumeUserToken(token, UserTokenType.EMAIL_VERIFICATION);
    const user = await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() }
    });

    return { email: user.email };
  }

  /**
   * Account-level events (login, password reset) are logged once per workspace the user
   * belongs to, so each workspace's audit log shows who signed in.
   */
  private async recordAccountEvent(
    userId: string,
    action: string,
    metadata: RequestMetadata,
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    const memberships = await this.prisma.userOrganization
      .findMany({
        where: { userId, status: UserStatus.ACTIVE },
        select: { id: true, organizationId: true },
        take: 10
      })
      .catch(() => []);
    const entry = {
      actorUserId: userId,
      action,
      entityType: "user",
      entityId: userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      payload
    };

    if (!memberships.length) {
      this.audit.record(entry);
      return;
    }

    for (const membership of memberships) {
      this.audit.record({
        ...entry,
        organizationId: membership.organizationId,
        actorMemberId: membership.id
      });
    }
  }

  private appUrl(): string {
    return (this.config.get<string>("APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  }

  /** Create a single-use token, replacing any earlier unused token of the same type. */
  private async issueUserToken(
    userId: string,
    type: UserTokenType,
    expiresInMinutes: number
  ): Promise<string> {
    const token = randomBytes(48).toString("base64url");

    await this.prisma.$transaction([
      this.prisma.userToken.updateMany({
        where: { userId, type, usedAt: null },
        data: { usedAt: new Date() }
      }),
      this.prisma.userToken.create({
        data: {
          userId,
          type,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000)
        }
      })
    ]);

    return token;
  }

  private async consumeUserToken(
    token: string,
    type: UserTokenType
  ): Promise<{ userId: string }> {
    const record = await this.prisma.userToken.findUnique({
      where: { tokenHash: this.hashToken(token) }
    });

    if (!record || record.type !== type || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This link is invalid or has expired. Please request a new one.");
    }

    await this.prisma.userToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() }
    });

    return { userId: record.userId };
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    return this.buildUserDto(userId);
  }

  assertGoogleConfigured(): void {
    this.getGoogleConfig();
  }

  getGoogleAuthUrl(): GoogleAuthUrlResponseDto {
    const state = randomBytes(32).toString("base64url");
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

    if (!profile.email_verified) {
      throw new UnauthorizedException("Your Google email address is not verified");
    }

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

      // Signup never verifies email, so anyone could have pre-registered this address with a
      // password. Don't silently attach Google to such an account (account pre-hijacking).
      if (existingUser?.passwordHash && !existingUser.emailVerifiedAt) {
        throw new ConflictException(
          "An account with this email already exists. Sign in with your email and password."
        );
      }

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
      emailVerified: user.emailVerifiedAt !== null,
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
