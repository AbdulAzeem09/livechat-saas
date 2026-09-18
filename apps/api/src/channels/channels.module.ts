import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ContactsModule } from "../contacts/contacts.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";
import { ChannelWebhooksController, ChannelsController } from "./channels.controller";
import { ChannelsService } from "./channels.service";
import { EmailChannelService } from "./email-channel.service";

@Module({
  imports: [
    AuthModule,
    ContactsModule,
    forwardRef(() => ConversationsModule),
    MailModule,
    OrganizationsModule,
    PrismaModule
  ],
  controllers: [ChannelsController, ChannelWebhooksController],
  providers: [ChannelsService, EmailChannelService],
  exports: [ChannelsService, EmailChannelService]
})
export class ChannelsModule {}
