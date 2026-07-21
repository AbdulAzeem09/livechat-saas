import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AutomationController } from "./automation.controller";
import { AutomationService } from "./automation.service";

@Module({
  imports: [AuthModule, ConversationsModule, OrganizationsModule, PrismaModule],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService]
})
export class AutomationModule {}
