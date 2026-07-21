import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { StorageModule } from "../storage/storage.module";
import { ConversationsController } from "./conversations.controller";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";

@Module({
  imports: [AuthModule, OrganizationsModule, StorageModule],
  controllers: [ConversationsController],
  providers: [ConversationsGateway, ConversationsService],
  exports: [ConversationsGateway, ConversationsService]
})
export class ConversationsModule {}
