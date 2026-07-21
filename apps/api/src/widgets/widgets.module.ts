import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AutomationModule } from "../automation/automation.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WidgetsController } from "./widgets.controller";
import { WidgetsService } from "./widgets.service";

@Module({
  imports: [
    AuthModule,
    AutomationModule,
    ConversationsModule,
    IntegrationsModule,
    OrganizationsModule,
    PrismaModule
  ],
  controllers: [WidgetsController],
  providers: [WidgetsService],
  exports: [WidgetsService]
})
export class WidgetsModule {}
