import { timingSafeEqual } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiProperty,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { RATE_LIMITS } from "../common/http/client-ip-throttler.guard";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import {
  AuthResponseDto,
  AuthUserDto,
  GoogleAuthUrlResponseDto,
  LogoutResponseDto
} from "./dto/auth-response.dto";
import { GoogleCallbackDto } from "./dto/google-callback.dto";
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from "./dto/password-reset.dto";
import {
  DisableTwoFactorDto,
  EnableTwoFactorDto,
  TwoFactorChallengeDto,
  VerifyTwoFactorDto
} from "./dto/two-factor.dto";
import {
  AccountSecurityService,
  type TwoFactorEnabled,
  type TwoFactorSetup
} from "./account-security.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthUser } from "./types/auth-user";

const GOOGLE_STATE_COOKIE = "lc_google_oauth_state";

class ActionResultDto {
  @ApiProperty()
  success!: boolean;
}

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountSecurity: AccountSecurityService,
    private readonly config: ConfigService
  ) {}

  @Post("register")
  @Throttle({ default: RATE_LIMITS.register })
  @ApiOperation({ summary: "Register a user and create the first organization" })
  @ApiCreatedResponse({ type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto, this.getRequestMetadata(request));
    this.setRefreshCookie(response, result);
    return result;
  }

  @Post("login")
  @Throttle({ default: RATE_LIMITS.login })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log in with email and password" })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto | TwoFactorChallengeDto> {
    const result = await this.authService.login(dto, this.getRequestMetadata(request));

    // With two-factor on there is no session yet — only a challenge to answer.
    if ("twoFactorRequired" in result) {
      return result;
    }

    this.setRefreshCookie(response, result);

    return result;
  }

  @Post("refresh")
  @Throttle({ default: RATE_LIMITS.refresh })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate refresh token and issue a new access token" })
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto> {
    const refreshToken =
      dto.refreshToken ?? this.getCookie(request, this.getRefreshCookieName());
    const result = await this.authService.refresh(refreshToken, this.getRequestMetadata(request));
    this.setRefreshCookie(response, result);
    return result;
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke the active refresh token" })
  @ApiOkResponse({ type: LogoutResponseDto })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<LogoutResponseDto> {
    const refreshToken =
      dto.refreshToken ?? this.getCookie(request, this.getRefreshCookieName());
    await this.authService.logout(refreshToken);
    this.clearRefreshCookie(response);
    return { success: true };
  }

  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: RATE_LIMITS.login })
  @ApiOperation({ summary: "Finish signing in with the code from the authenticator app" })
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto> {
    const session = await this.authService.completeTwoFactorLogin(
      dto.challengeToken,
      dto.code,
      this.getRequestMetadata(request)
    );

    this.setRefreshCookie(response, session);

    return session;
  }

  @Post("2fa/setup")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get a secret to put into an authenticator app" })
  startTwoFactor(@CurrentUser() user: AuthUser): Promise<TwoFactorSetup> {
    return this.accountSecurity.startTwoFactorSetup(user.userId, user.email);
  }

  @Post("2fa/enable")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Switch two-factor on after the first code works" })
  enableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body() dto: EnableTwoFactorDto
  ): Promise<TwoFactorEnabled> {
    return this.accountSecurity.enableTwoFactor(user.userId, dto.code);
  }

  @Post("2fa/disable")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Switch two-factor off (asks for the password)" })
  disableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body() dto: DisableTwoFactorDto
  ): Promise<{ disabled: true }> {
    return this.accountSecurity.disableTwoFactor(user.userId, dto.password);
  }

  @Post("password/forgot")
  @Throttle({ default: RATE_LIMITS.passwordReset })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Email a password reset link (always returns success)" })
  @ApiOkResponse({ type: ActionResultDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ActionResultDto> {
    await this.authService.requestPasswordReset(dto.email);
    return { success: true };
  }

  @Post("password/reset")
  @Throttle({ default: RATE_LIMITS.passwordReset })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Set a new password using the emailed token" })
  @ApiOkResponse({ type: ActionResultDto })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<ActionResultDto> {
    await this.authService.resetPassword(dto.token, dto.password);
    return { success: true };
  }

  @Post("email/verify")
  @Throttle({ default: RATE_LIMITS.passwordReset })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm an email address using the emailed token" })
  @ApiOkResponse({ type: ActionResultDto })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<ActionResultDto> {
    await this.authService.verifyEmail(dto.token);
    return { success: true };
  }

  @Post("email/verify/resend")
  @Throttle({ default: RATE_LIMITS.passwordReset })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send the email confirmation link again" })
  @ApiOkResponse({ type: ActionResultDto })
  async resendEmailVerification(@CurrentUser() user: AuthUser): Promise<ActionResultDto> {
    const sent = await this.authService.sendEmailVerification(user.userId);
    return { success: sent };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current authenticated user" })
  @ApiOkResponse({ type: AuthUserDto })
  getMe(@CurrentUser() user: AuthUser): Promise<AuthUserDto> {
    return this.authService.getMe(user.userId);
  }

  @Get("google/url")
  @ApiOperation({ summary: "Create a Google OAuth authorization URL" })
  @ApiOkResponse({ type: GoogleAuthUrlResponseDto })
  getGoogleAuthUrl(): GoogleAuthUrlResponseDto {
    this.authService.assertGoogleConfigured();
    const apiUrl = this.config.getOrThrow<string>("API_URL").replace(/\/$/, "");

    // The browser must start the flow on the API origin so the state cookie is first-party.
    return {
      authUrl: `${apiUrl}${this.getGoogleCookiePath()}/start`,
      state: ""
    };
  }

  @Get("google/start")
  @ApiOperation({ summary: "Start Google OAuth: sets a state cookie and redirects to Google" })
  startGoogleLogin(@Res() response: Response): void {
    const { authUrl, state } = this.authService.getGoogleAuthUrl();

    response.cookie(GOOGLE_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 10 * 60 * 1000,
      path: this.getGoogleCookiePath(),
      sameSite: "lax",
      secure: this.config.getOrThrow<boolean>("AUTH_COOKIE_SECURE")
    });
    response.redirect(authUrl);
  }

  @Get("google/callback")
  @ApiOperation({ summary: "Handle Google OAuth callback (redirects back to the app)" })
  async handleGoogleCallback(
    @Query() query: GoogleCallbackDto,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<void> {
    const appUrl = this.config.getOrThrow<string>("APP_URL").replace(/\/$/, "");
    const expectedState = this.getCookie(request, GOOGLE_STATE_COOKIE);

    response.clearCookie(GOOGLE_STATE_COOKIE, {
      path: this.getGoogleCookiePath(),
      sameSite: "lax",
      secure: this.config.getOrThrow<boolean>("AUTH_COOKIE_SECURE")
    });

    if (!this.statesMatch(expectedState, query.state)) {
      response.redirect(
        `${appUrl}/login?error=${encodeURIComponent("Google sign-in expired. Please try again.")}`
      );
      return;
    }

    try {
      const result = await this.authService.handleGoogleCallback(
        query.code,
        this.getRequestMetadata(request)
      );
      this.setRefreshCookie(response, result);
      // Tokens ride in the URL fragment so they never hit the server logs.
      const fragment = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
      response.redirect(`${appUrl}/auth/callback#${fragment.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed";
      response.redirect(`${appUrl}/login?error=${encodeURIComponent(message)}`);
    }
  }

  private getRequestMetadata(request: Request) {
    const userAgent = request.headers["user-agent"];

    return {
      ipAddress: request.ip,
      ...(typeof userAgent === "string" ? { userAgent } : {})
    };
  }

  private setRefreshCookie(response: Response, result: AuthResponseDto): void {
    response.cookie(this.getRefreshCookieName(), result.refreshToken, {
      httpOnly: true,
      maxAge: result.refreshExpiresInSeconds * 1000,
      path: this.getRefreshCookiePath(),
      sameSite: "lax",
      secure: this.config.getOrThrow<boolean>("AUTH_COOKIE_SECURE")
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(this.getRefreshCookieName(), {
      path: this.getRefreshCookiePath(),
      sameSite: "lax",
      secure: this.config.getOrThrow<boolean>("AUTH_COOKIE_SECURE")
    });
  }

  private getRefreshCookieName(): string {
    return this.config.getOrThrow<string>("AUTH_REFRESH_COOKIE_NAME");
  }

  private getRefreshCookiePath(): string {
    return `/${this.config.getOrThrow<string>("API_GLOBAL_PREFIX")}/auth`;
  }

  private getGoogleCookiePath(): string {
    return `${this.getRefreshCookiePath()}/google`;
  }

  private statesMatch(expected: string | undefined, received: string | undefined): boolean {
    if (!expected || !received) {
      return false;
    }

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return (
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  }

  private getCookie(request: Request, name: string): string | undefined {
    const cookies = (request as Request & { cookies?: Record<string, unknown> }).cookies;
    const value = cookies?.[name];
    return typeof value === "string" ? value : undefined;
  }
}
