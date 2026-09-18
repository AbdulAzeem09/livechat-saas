import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EntitlementsService } from "./entitlements.service";

/**
 * Kept separate from BillingModule so any module can ask "is this workspace allowed to do X?"
 * without pulling in the billing controller (and creating a circular import).
 */
@Module({
  imports: [PrismaModule],
  providers: [EntitlementsService],
  exports: [EntitlementsService]
})
export class EntitlementsModule {}
