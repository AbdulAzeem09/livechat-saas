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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import {
  AuthResponseDto,
  AuthUserDto,
  GoogleAuthUrlResponseDto,
  LogoutResponseDto
} from "./dto/auth-response.dto";
import { GoogleCallbackDto } from "./dto/google-callback.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthUser } from "./types/auth-user";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService
  ) {}

  @Post("register")
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log in with email and password" })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto, this.getRequestMetadata(request));
    this.setRefreshCookie(response, result);
    return result;
  }

  @Post("refresh")
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
  getGoogleAuthUrl(@Query("state") state?: string): GoogleAuthUrlResponseDto {
    return this.authService.getGoogleAuthUrl(state);
  }

  @Get("google/callback")
  @ApiOperation({ summary: "Handle Google OAuth callback" })
  @ApiOkResponse({ type: AuthResponseDto })
  async handleGoogleCallback(
    @Query() query: GoogleCallbackDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto> {
    const result = await this.authService.handleGoogleCallback(
      query.code,
      this.getRequestMetadata(request)
    );
    this.setRefreshCookie(response, result);
    return result;
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

  private getCookie(request: Request, name: string): string | undefined {
    const cookies = (request as Request & { cookies?: Record<string, unknown> }).cookies;
    const value = cookies?.[name];
    return typeof value === "string" ? value : undefined;
  }
}
