import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiPerformanceService } from "./ai-performance.service";
import { AiSkillsController } from "./ai-skills.controller";
import { AiSkillsService } from "./ai-skills.service";
import { ConversationInsightsService } from "./conversation-insights.service";
import { TextEnhancementService } from "./text-enhancement.service";

@Module({
  imports: [AuthModule, OrganizationsModule, PrismaModule],
  controllers: [AiController, AiSkillsController],
  providers: [
    AiService,
    AiSkillsService,
    AiPerformanceService,
    ConversationInsightsService,
    TextEnhancementService
  ],
  exports: [
    AiService,
    AiSkillsService,
    AiPerformanceService,
    ConversationInsightsService,
    TextEnhancementService
  ]
})
export class AiModule {}
