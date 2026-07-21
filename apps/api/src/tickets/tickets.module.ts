import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  imports: [AuthModule, ConversationsModule, OrganizationsModule, PrismaModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService]
})
export class TicketsModule {}
