import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  type RawBodyRequest
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags
} from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { Request } from "express";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { ChannelsService, type ChannelConnectionDto } from "./channels.service";
import { EmailChannelService } from "./email-channel.service";

export class ConnectChannelDto {
  @ApiProperty({
    description:
      "WhatsApp phone number id, Facebook page id, Instagram account id, or the support email address"
  })
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  externalId!: string;

  @ApiPropertyOptional({ description: "Permanent access token from Meta (not used by email)" })
  @IsOptional()
  @IsString()
  @MinLength(10)
  accessToken?: string;

  @ApiPropertyOptional({ description: "App secret, used to verify incoming webhooks" })
  @IsOptional()
  @IsString()
  appSecret?: string;

  @ApiPropertyOptional({ description: "Verify token for the webhook (generated if left empty)" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  verifyToken?: string;

  @ApiPropertyOptional({ example: "Support WhatsApp" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;
}

@ApiTags("Messaging channels")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/channels")
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @Permissions("settings:manage")
  @ApiOperation({ summary: "List messaging channels and their connection state" })
  @ApiParam({ name: "organizationId" })
  list(@Param("organizationId") organizationId: string): Promise<ChannelConnectionDto[]> {
    return this.channelsService.list(organizationId);
  }

  @Put(":channel")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Connect (or update) a messaging channel" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "channel", enum: ["whatsapp", "messenger", "instagram", "apple"] })
  connect(
    @Param("organizationId") organizationId: string,
    @Param("channel") channel: string,
    @Body() dto: ConnectChannelDto
  ): Promise<ChannelConnectionDto> {
    return this.channelsService.connect(organizationId, ChannelsService.channelFromSlug(channel), dto);
  }

  @Delete(":channel")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Disconnect a messaging channel" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "channel" })
  disconnect(
    @Param("organizationId") organizationId: string,
    @Param("channel") channel: string
  ): Promise<{ success: true }> {
    return this.channelsService.disconnect(organizationId, ChannelsService.channelFromSlug(channel));
  }
}

@ApiTags("Messaging channels")
@Controller("channels/webhooks")
export class ChannelWebhooksController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly emailChannelService: EmailChannelService
  ) {}

  @Get(":channel")
  @ApiOperation({ summary: "Webhook verification handshake (Meta calls this once)" })
  @ApiParam({ name: "channel" })
  @ApiOkResponse({ description: "Echoes hub.challenge when the verify token matches" })
  verify(
    @Param("channel") channel: string,
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") verifyToken?: string,
    @Query("hub.challenge") challenge?: string
  ): Promise<string> {
    return this.channelsService.verifyWebhook(
      ChannelsService.channelFromSlug(channel),
      mode,
      verifyToken,
      challenge
    );
  }

  @Post("email")
  @ApiOperation({ summary: "Incoming email from the mail provider (SendGrid, Mailgun, Postmark…)" })
  receiveEmail(@Req() request: RawBodyRequest<Request>): Promise<{ received: true }> {
    const signature = request.headers["x-livechat-signature"];

    return this.emailChannelService.handleWebhook(
      request.rawBody,
      typeof signature === "string" ? signature : undefined,
      request.body
    );
  }

  @Post(":channel")
  @ApiOperation({ summary: "Incoming messages from WhatsApp / Messenger / Instagram" })
  @ApiParam({ name: "channel" })
  receive(
    @Param("channel") channel: string,
    @Req() request: RawBodyRequest<Request>
  ): Promise<{ received: true }> {
    const signature = request.headers["x-hub-signature-256"];

    return this.channelsService.handleWebhook(
      ChannelsService.channelFromSlug(channel),
      request.rawBody,
      typeof signature === "string" ? signature : undefined,
      request.body
    );
  }
}
