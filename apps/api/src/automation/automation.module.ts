import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { ContactsModule } from "../contacts/contacts.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AutomationController } from "./automation.controller";
import { AutomationService } from "./automation.service";
import { BotFlowController } from "./bot-flow.controller";
import { BotFlowService } from "./bot-flow.service";

@Module({
  imports: [
    AiModule,
    AuthModule,
    ContactsModule,
    ConversationsModule,
    OrganizationsModule,
    PrismaModule
  ],
  controllers: [AutomationController, BotFlowController],
  providers: [AutomationService, BotFlowService],
  exports: [AutomationService, BotFlowService]
})
export class AutomationModule {}
