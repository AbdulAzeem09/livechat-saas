import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AccountSecurityService } from "./account-security.service";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RolesGuard } from "./guards/roles.guard";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AccountSecurityService, JwtAuthGuard, RolesGuard, PermissionsGuard],
  exports: [AuthService, AccountSecurityService, JwtAuthGuard, RolesGuard, PermissionsGuard]
})
export class AuthModule {}
