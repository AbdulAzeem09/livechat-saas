import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./admin/admin.module";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { AutomationModule } from "./automation/automation.module";
import { BillingModule } from "./billing/billing.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { CannedResponsesModule } from "./canned-responses/canned-responses.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { DepartmentsModule } from "./departments/departments.module";
import { validateEnvironment } from "./config/environment";
import { HealthModule } from "./health/health.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { MembersModule } from "./members/members.module";
import { MailModule } from "./mail/mail.module";
import { DataModule } from "./data/data.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { StorageModule } from "./storage/storage.module";
import { TicketsModule } from "./tickets/tickets.module";
import { VisitorsModule } from "./visitors/visitors.module";
import { WidgetsModule } from "./widgets/widgets.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: [".env.local", ".env", "../../.env.local", "../../.env"],
      isGlobal: true,
      validate: validateEnvironment
    }),
    PrismaModule,
    MailModule,
    DataModule,
    AdminModule,
    AiModule,
    AuthModule,
    BillingModule,
    CampaignsModule,
    OrganizationsModule,
    ConversationsModule,
    CannedResponsesModule,
    AutomationModule,
    DepartmentsModule,
    IntegrationsModule,
    KnowledgeModule,
    MembersModule,
    StorageModule,
    ReportsModule,
    TicketsModule,
    VisitorsModule,
    WidgetsModule,
    HealthModule
  ]
})
export class AppModule {}
