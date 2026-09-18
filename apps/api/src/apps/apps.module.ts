import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AppsController } from "./apps.controller";
import { AppsService } from "./apps.service";
import { IntegrationHubService } from "./integration-hub.service";

@Module({
  imports: [AuthModule, OrganizationsModule, PrismaModule],
  controllers: [AppsController],
  providers: [AppsService, IntegrationHubService],
  exports: [AppsService, IntegrationHubService]
})
export class AppsModule {}
