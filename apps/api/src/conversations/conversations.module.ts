import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { ConversationsController } from "./conversations.controller";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [ConversationsController],
  providers: [ConversationsGateway, ConversationsService],
  exports: [ConversationsService]
})
export class ConversationsModule {}
