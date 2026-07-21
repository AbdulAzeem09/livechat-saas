import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";
import type { UploadedFileLike } from "../storage/file-storage.service";
import { CurrentOrganization } from "../organizations/decorators/current-organization.decorator";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { AssignConversationDto } from "./dto/assign-conversation.dto";
import { ConversationDto, MessageDto } from "./dto/conversation-response.dto";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { ListConversationsQuery } from "./dto/list-conversations.query";
import { ListMessagesQuery } from "./dto/list-messages.query";
import { SendMessageDto } from "./dto/send-message.dto";
import { UpdateConversationDto } from "./dto/update-conversation.dto";
import { UpdateTagsDto } from "./dto/update-tags.dto";
import { ConversationsService } from "./conversations.service";

@ApiTags("Conversations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @Permissions("chat:read")
  @ApiOperation({ summary: "List conversations for an organization" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [ConversationDto] })
  listConversations(
    @Param("organizationId") organizationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Query() query: ListConversationsQuery
  ): Promise<ConversationDto[]> {
    return this.conversationsService.listConversations(organizationId, context, query);
  }

  @Post()
  @Permissions("chat:write")
  @ApiOperation({ summary: "Create a manual conversation assigned to an agent" })
  @ApiParam({ name: "organizationId" })
  @ApiCreatedResponse({ type: ConversationDto })
  createConversation(
    @Param("organizationId") organizationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: CreateConversationDto
  ): Promise<ConversationDto> {
    return this.conversationsService.createConversation(organizationId, context, dto);
  }

  @Get(":conversationId")
  @Permissions("chat:read")
  @ApiOperation({ summary: "Get one conversation" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  @ApiOkResponse({ type: ConversationDto })
  getConversation(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string
  ): Promise<ConversationDto> {
    return this.conversationsService.getConversation(organizationId, conversationId);
  }

  @Patch(":conversationId")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Update conversation status, priority, subject, or metadata" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  @ApiOkResponse({ type: ConversationDto })
  updateConversation(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string,
    @Body() dto: UpdateConversationDto
  ): Promise<ConversationDto> {
    return this.conversationsService.updateConversation(organizationId, conversationId, dto);
  }

  @Post(":conversationId/assign")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Assign or transfer a conversation to another agent" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  @ApiOkResponse({ type: ConversationDto })
  assignConversation(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: AssignConversationDto
  ): Promise<ConversationDto> {
    return this.conversationsService.assignConversation(
      organizationId,
      conversationId,
      context,
      dto
    );
  }

  @Patch(":conversationId/tags")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Set the tags on a conversation" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  @ApiOkResponse({ type: ConversationDto })
  updateTags(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string,
    @Body() dto: UpdateTagsDto
  ): Promise<ConversationDto> {
    return this.conversationsService.updateTags(organizationId, conversationId, dto.tags);
  }

  @Post(":conversationId/attachments")
  @Permissions("chat:write")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Upload a file attachment as a message" })
  @ApiConsumes("multipart/form-data")
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  @ApiCreatedResponse({ type: MessageDto })
  uploadAttachment(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @UploadedFile() file: UploadedFileLike | undefined
  ): Promise<MessageDto> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    return this.conversationsService.createFileMessage(organizationId, conversationId, context, file);
  }

  @Get(":conversationId/messages")
  @Permissions("chat:read")
  @ApiOperation({ summary: "List messages in a conversation" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  @ApiOkResponse({ type: [MessageDto] })
  listMessages(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string,
    @Query() query: ListMessagesQuery
  ): Promise<MessageDto[]> {
    return this.conversationsService.listMessages(organizationId, conversationId, query);
  }

  @Post(":conversationId/messages")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Send an agent message in a conversation" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  @ApiCreatedResponse({ type: MessageDto })
  sendMessage(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: SendMessageDto
  ): Promise<MessageDto> {
    return this.conversationsService.sendMessage(organizationId, conversationId, context, dto);
  }
}
