import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { MessageDto } from "../conversations/dto/conversation-response.dto";
import { CurrentOrganization } from "../organizations/decorators/current-organization.decorator";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { CreateWidgetConversationDto } from "./dto/create-widget-conversation.dto";
import { MenuReplyDto } from "./dto/menu-reply.dto";
import { RateWidgetDto } from "./dto/rate-widget.dto";
import { RecordSaleDto } from "./dto/record-sale.dto";
import { SendWidgetMessageDto } from "./dto/send-widget-message.dto";
import { StartWidgetSessionDto } from "./dto/start-widget-session.dto";
import { WidgetHeartbeatDto } from "./dto/widget-heartbeat.dto";
import { UpdateWidgetDto } from "./dto/update-widget.dto";
import {
  PublicWidgetConfigDto,
  WidgetConversationResponseDto,
  WidgetInstallDto,
  WidgetSessionDto
} from "./dto/widget-response.dto";
import { WidgetsService } from "./widgets.service";

@ApiTags("Widgets")
@Controller()
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get("widget.js")
  @Header("content-type", "application/javascript; charset=utf-8")
  @Header("cache-control", "public, max-age=60")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "Public embeddable visitor chat widget script" })
  getWidgetScript(): string {
    return this.widgetsService.buildWidgetScript();
  }

  @Get("widgets/public/:publicKey/config")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "Read public widget configuration" })
  @ApiParam({ name: "publicKey" })
  @ApiOkResponse({ type: PublicWidgetConfigDto })
  getPublicConfig(
    @Param("publicKey") publicKey: string,
    @Req() request: Request
  ): Promise<PublicWidgetConfigDto> {
    return this.widgetsService.getPublicConfig(publicKey, this.getMetadata(request));
  }

  @Post("widgets/public/:publicKey/sessions")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "Start a public visitor session for a widget" })
  @ApiParam({ name: "publicKey" })
  @ApiCreatedResponse({ type: WidgetSessionDto })
  startSession(
    @Param("publicKey") publicKey: string,
    @Body() dto: StartWidgetSessionDto,
    @Req() request: Request
  ): Promise<WidgetSessionDto> {
    return this.widgetsService.startSession(publicKey, dto, this.getMetadata(request));
  }

  @Post("widgets/public/:publicKey/conversations")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "Create a conversation from a public visitor widget" })
  @ApiParam({ name: "publicKey" })
  @ApiCreatedResponse({ type: WidgetConversationResponseDto })
  createConversation(
    @Param("publicKey") publicKey: string,
    @Body() dto: CreateWidgetConversationDto,
    @Req() request: Request
  ): Promise<WidgetConversationResponseDto> {
    return this.widgetsService.createConversation(publicKey, dto, this.getMetadata(request));
  }

  @Post("widgets/public/:publicKey/heartbeat")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "Record a visitor heartbeat (keeps the visitor marked online + tracks page)" })
  @ApiParam({ name: "publicKey" })
  @ApiOkResponse({ description: "Heartbeat recorded" })
  heartbeat(
    @Param("publicKey") publicKey: string,
    @Body() dto: WidgetHeartbeatDto,
    @Req() request: Request
  ): Promise<{ ok: true }> {
    return this.widgetsService.recordHeartbeat(publicKey, dto, this.getMetadata(request));
  }

  @Get("widgets/public/:publicKey/conversations/:conversationId/messages")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "List public messages visible to the visitor widget" })
  @ApiParam({ name: "publicKey" })
  @ApiParam({ name: "conversationId" })
  @ApiOkResponse({ type: [MessageDto] })
  listMessages(
    @Param("publicKey") publicKey: string,
    @Param("conversationId") conversationId: string,
    @Query("sessionToken") sessionToken: string | undefined,
    @Req() request: Request
  ): Promise<MessageDto[]> {
    return this.widgetsService.listMessages(
      publicKey,
      conversationId,
      sessionToken,
      this.getMetadata(request)
    );
  }

  @Get("widgets/public/:publicKey/conversations/:conversationId")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "Get the visitor conversation status (open/resolved/closed)" })
  @ApiParam({ name: "publicKey" })
  @ApiParam({ name: "conversationId" })
  getConversationStatus(
    @Param("publicKey") publicKey: string,
    @Param("conversationId") conversationId: string,
    @Query("sessionToken") sessionToken: string | undefined,
    @Req() request: Request
  ): Promise<{ id: string; status: string; subject: string | null }> {
    return this.widgetsService.getConversationStatus(
      publicKey,
      conversationId,
      sessionToken,
      this.getMetadata(request)
    );
  }

  @Post("widgets/public/:publicKey/conversations/:conversationId/rate")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "Visitor rates the chat (good/bad) for CSAT" })
  @ApiParam({ name: "publicKey" })
  @ApiParam({ name: "conversationId" })
  rateConversation(
    @Param("publicKey") publicKey: string,
    @Param("conversationId") conversationId: string,
    @Body() dto: RateWidgetDto,
    @Req() request: Request
  ): Promise<{ success: true }> {
    return this.widgetsService.rateConversation(
      publicKey,
      conversationId,
      dto,
      this.getMetadata(request)
    );
  }

  @Post("widgets/public/:publicKey/sales")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "Record an ecommerce sale from the widget (window.LiveChatSaaS.trackSale)" })
  @ApiParam({ name: "publicKey" })
  recordSale(
    @Param("publicKey") publicKey: string,
    @Body() dto: RecordSaleDto,
    @Req() request: Request
  ): Promise<{ success: true }> {
    return this.widgetsService.recordSale(publicKey, dto, this.getMetadata(request));
  }

  @Post("widgets/public/:publicKey/conversations/:conversationId/menu-reply")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "Post the bot reply for a tapped chatbot quick-reply option" })
  @ApiParam({ name: "publicKey" })
  @ApiParam({ name: "conversationId" })
  menuReply(
    @Param("publicKey") publicKey: string,
    @Param("conversationId") conversationId: string,
    @Body() dto: MenuReplyDto,
    @Req() request: Request
  ): Promise<MessageDto | null> {
    return this.widgetsService.postMenuReply(
      publicKey,
      conversationId,
      dto,
      this.getMetadata(request)
    );
  }

  @Post("widgets/public/:publicKey/conversations/:conversationId/messages")
  @Header("access-control-allow-origin", "*")
  @ApiOperation({ summary: "Send a public visitor message" })
  @ApiParam({ name: "publicKey" })
  @ApiParam({ name: "conversationId" })
  @ApiCreatedResponse({ type: MessageDto })
  sendMessage(
    @Param("publicKey") publicKey: string,
    @Param("conversationId") conversationId: string,
    @Body() dto: SendWidgetMessageDto,
    @Req() request: Request
  ): Promise<MessageDto> {
    return this.widgetsService.sendMessage(
      publicKey,
      conversationId,
      dto,
      this.getMetadata(request)
    );
  }

  @Get("organizations/:organizationId/widgets/default")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Get or create the default installable widget for an organization" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: WidgetInstallDto })
  getDefaultWidget(
    @Param("organizationId") organizationId: string,
    @CurrentOrganization() _context: OrganizationRequestContext
  ): Promise<WidgetInstallDto> {
    return this.widgetsService.getDefaultInstall(organizationId);
  }

  @Patch("organizations/:organizationId/widgets/default")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Update the default widget appearance and messages" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: WidgetInstallDto })
  updateDefaultWidget(
    @Param("organizationId") organizationId: string,
    @Body() dto: UpdateWidgetDto
  ): Promise<WidgetInstallDto> {
    return this.widgetsService.updateDefaultWidget(organizationId, dto);
  }

  private getMetadata(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent:
        typeof request.headers["user-agent"] === "string"
          ? request.headers["user-agent"]
          : undefined,
      origin:
        typeof request.headers.origin === "string"
          ? request.headers.origin
          : typeof request.headers.referer === "string"
            ? request.headers.referer
            : undefined
    };
  }
}
