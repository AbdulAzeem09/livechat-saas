import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SsoAdminController, SsoAuthController } from "./sso.controller";
import { SsoService } from "./sso.service";

@Module({
  imports: [AuthModule, OrganizationsModule, PrismaModule],
  controllers: [SsoAdminController, SsoAuthController],
  providers: [SsoService],
  exports: [SsoService]
})
export class SsoModule {}
