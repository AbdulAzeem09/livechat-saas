import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./common/audit/audit.module";
import { ClientIpThrottlerGuard } from "./common/http/client-ip-throttler.guard";
import { AdminModule } from "./admin/admin.module";
import { AiModule } from "./ai/ai.module";
import { AppsModule } from "./apps/apps.module";
import { AuthModule } from "./auth/auth.module";
import { AutomationModule } from "./automation/automation.module";
import { BillingModule } from "./billing/billing.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { ChannelsModule } from "./channels/channels.module";
import { CannedResponsesModule } from "./canned-responses/canned-responses.module";
import { ContactsModule } from "./contacts/contacts.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { DepartmentsModule } from "./departments/departments.module";
import { validateEnvironment } from "./config/environment";
import { HealthModule } from "./health/health.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { MembersModule } from "./members/members.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { MailModule } from "./mail/mail.module";
import { DataModule } from "./data/data.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { SsoModule } from "./sso/sso.module";
import { SchedulesModule } from "./schedules/schedules.module";
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
    // Generous default so agents sharing an office IP aren't throttled; sensitive routes are tighter.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 1000 }]),
    PrismaModule,
    AuditModule,
    MailModule,
    DataModule,
    AdminModule,
    AiModule,
    AppsModule,
    AuthModule,
    BillingModule,
    CampaignsModule,
    ChannelsModule,
    OrganizationsModule,
    ContactsModule,
    ConversationsModule,
    CannedResponsesModule,
    AutomationModule,
    DepartmentsModule,
    IntegrationsModule,
    KnowledgeModule,
    MembersModule,
    NotificationsModule,
    StorageModule,
    ReportsModule,
    SchedulesModule,
    SsoModule,
    TicketsModule,
    VisitorsModule,
    WidgetsModule,
    HealthModule
  ],
  providers: [{ provide: APP_GUARD, useClass: ClientIpThrottlerGuard }]
})
export class AppModule {}
