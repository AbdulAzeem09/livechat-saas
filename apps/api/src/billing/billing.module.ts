import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthorizeNetService } from "./authorizenet.service";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

@Module({
  imports: [AuthModule, OrganizationsModule, PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, AuthorizeNetService],
  exports: [BillingService]
})
export class BillingModule {}
