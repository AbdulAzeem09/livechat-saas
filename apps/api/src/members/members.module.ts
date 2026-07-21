import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";

@Module({
  imports: [AuthModule, BillingModule, OrganizationsModule, PrismaModule],
  controllers: [MembersController],
  providers: [MembersService]
})
export class MembersModule {}
