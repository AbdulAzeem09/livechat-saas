import { Module } from "@nestjs/common";
import { AppsModule } from "../apps/apps.module";
import { AuthModule } from "../auth/auth.module";
import { EntitlementsModule } from "../billing/entitlements.module";
import { AutomationModule } from "../automation/automation.module";
import { ContactsModule } from "../contacts/contacts.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SchedulesModule } from "../schedules/schedules.module";
import { StorageModule } from "../storage/storage.module";
import { WidgetsController } from "./widgets.controller";
import { WidgetsService } from "./widgets.service";

@Module({
  imports: [
    AppsModule,
    AuthModule,
    AutomationModule,
    EntitlementsModule,
    SchedulesModule,
    ContactsModule,
    ConversationsModule,
    IntegrationsModule,
    OrganizationsModule,
    PrismaModule,
    StorageModule
  ],
  controllers: [WidgetsController],
  providers: [WidgetsService],
  exports: [WidgetsService]
})
export class WidgetsModule {}
