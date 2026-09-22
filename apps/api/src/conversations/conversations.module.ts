import { Module, forwardRef } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AppsModule } from "../apps/apps.module";
import { ReportsModule } from "../reports/reports.module";
import { ChannelsModule } from "../channels/channels.module";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { StorageModule } from "../storage/storage.module";
import { AgentProfilesModule } from "../widgets/agent-profiles.module";
import { ConversationsController } from "./conversations.controller";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";

@Module({
  imports: [
    AgentProfilesModule,
    AiModule,
    AppsModule,
    ReportsModule,
    AuthModule,
    forwardRef(() => ChannelsModule),
    OrganizationsModule,
    StorageModule
  ],
  controllers: [ConversationsController],
  providers: [ConversationsGateway, ConversationsService],
  exports: [ConversationsGateway, ConversationsService]
})
export class ConversationsModule {}
