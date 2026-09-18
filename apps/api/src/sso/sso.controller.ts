import { Body, Controller, Delete, Get, Param, Put, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { SsoProvider } from "@prisma/client";
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { Request, Response } from "express";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { resolveClientIp } from "../common/http/client-ip";
import { RATE_LIMITS } from "../common/http/client-ip-throttler.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { SsoService, type SsoConnectionDto } from "./sso.service";

export class SaveSsoDto {
  @ApiProperty({ enum: SsoProvider })
  @IsEnum(SsoProvider)
  provider!: SsoProvider;

  @ApiProperty({ example: "acme.com" })
  @IsString()
  @MinLength(3)
  @MaxLength(191)
  emailDomain!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(400)
  clientId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  clientSecret!: string;

  @ApiPropertyOptional({ description: "Issuer URL, only for a generic OIDC provider" })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  issuer?: string;

  @ApiPropertyOptional({ description: "Create an agent account on first sign-in", default: true })
  @IsOptional()
  @IsBoolean()
  autoProvision?: boolean;
}

export class SsoStartDto {
  @ApiProperty({ example: "sara@acme.com" })
  @IsEmail()
  email!: string;
}

@ApiTags("SSO")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/sso")
export class SsoAdminController {
  constructor(private readonly ssoService: SsoService) {}

  @Get()
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Get the workspace's single sign-on setup" })
  @ApiParam({ name: "organizationId" })
  get(@Param("organizationId") organizationId: string): Promise<SsoConnectionDto | null> {
    return this.ssoService.get(organizationId);
  }

  @Put()
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Set up single sign-on for a company email domain" })
  @ApiParam({ name: "organizationId" })
  save(
    @Param("organizationId") organizationId: string,
    @Body() dto: SaveSsoDto
  ): Promise<SsoConnectionDto> {
    return this.ssoService.save(organizationId, dto);
  }

  @Delete()
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Turn single sign-on off" })
  @ApiParam({ name: "organizationId" })
  remove(@Param("organizationId") organizationId: string): Promise<{ success: true }> {
    return this.ssoService.remove(organizationId);
  }
}

@ApiTags("SSO")
@Controller("auth/sso")
export class SsoAuthController {
  constructor(private readonly ssoService: SsoService) {}

  @Get("start")
  @Throttle({ default: RATE_LIMITS.login })
  @ApiOperation({ summary: "Send the browser to the company identity provider" })
  async start(@Query("email") email: string, @Res() response: Response): Promise<void> {
    const { authUrl } = await this.ssoService.startLogin(email ?? "");
    response.redirect(authUrl);
  }

  @Get("callback")
  @Throttle({ default: RATE_LIMITS.login })
  @ApiOperation({ summary: "Identity provider callback; returns to the app with a session" })
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<void> {
    const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const userAgent = request.headers["user-agent"];

    try {
      const result = await this.ssoService.completeLogin(code, state, {
        ipAddress: resolveClientIp(request),
        ...(typeof userAgent === "string" ? { userAgent } : {})
      });
      const fragment = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
      response.redirect(`${appUrl}/auth/callback#${fragment.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Single sign-on failed";
      response.redirect(`${appUrl}/login?error=${encodeURIComponent(message)}`);
    }
  }
}
