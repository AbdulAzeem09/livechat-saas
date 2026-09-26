import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AgentProfilesModule } from "../widgets/agent-profiles.module";
import { VisitorsController } from "./visitors.controller";
import { VisitorsService } from "./visitors.service";

@Module({
  imports: [AgentProfilesModule, AuthModule, ConversationsModule, OrganizationsModule, PrismaModule],
  controllers: [VisitorsController],
  providers: [VisitorsService],
  exports: [VisitorsService]
})
export class VisitorsModule {}
