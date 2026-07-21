import { Controller, ForbiddenException, Get, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { AdminService, type AdminOverview } from "./admin.service";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly config: ConfigService
  ) {}

  private assertSuperAdmin(user: AuthUser): void {
    const allowed = (this.config.get<string>("SUPER_ADMIN_EMAILS") ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (!user?.email || !allowed.includes(user.email.toLowerCase())) {
      throw new ForbiddenException("Super-admin access only");
    }
  }

  @Get("access")
  @ApiOperation({ summary: "Check whether the current user is a platform super-admin" })
  access(@CurrentUser() user: AuthUser): { isSuperAdmin: boolean } {
    try {
      this.assertSuperAdmin(user);
      return { isSuperAdmin: true };
    } catch {
      return { isSuperAdmin: false };
    }
  }

  @Get("overview")
  @ApiOperation({ summary: "Platform overview: all organizations + subscriptions" })
  overview(@CurrentUser() user: AuthUser): Promise<AdminOverview> {
    this.assertSuperAdmin(user);
    return this.adminService.getOverview();
  }
}
