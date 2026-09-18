import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthorizeNetService } from "./authorizenet.service";
import { BillingController, BillingWebhooksController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { EntitlementsModule } from "./entitlements.module";

@Module({
  imports: [AuthModule, EntitlementsModule, OrganizationsModule, PrismaModule],
  controllers: [BillingController, BillingWebhooksController],
  providers: [BillingService, AuthorizeNetService],
  exports: [BillingService]
})
export class BillingModule {}
