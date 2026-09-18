import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Conversation,
  ConversationPriority,
  ConversationSource,
  ConversationStatus,
  Message,
  MessageStatus,
  MessageType,
  MessageVisibility,
  ParticipantType,
  Prisma,
  UserStatus
} from "@prisma/client";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { ChannelsService } from "../channels/channels.service";
import { maskCardNumbers } from "../common/text/mask-sensitive";
import { PrismaService } from "../prisma/prisma.service";
import { FileStorageService, type UploadedFileLike } from "../storage/file-storage.service";
import type { AssignConversationDto } from "./dto/assign-conversation.dto";
import type { ConversationDto, MessageDto } from "./dto/conversation-response.dto";
import type { CreateConversationDto } from "./dto/create-conversation.dto";
import type { ListConversationsQuery } from "./dto/list-conversations.query";
import type { ListMessagesQuery } from "./dto/list-messages.query";
import type { SendMessageDto } from "./dto/send-message.dto";
import type { UpdateConversationDto } from "./dto/update-conversation.dto";
import { ConversationInsightsService } from "../ai/conversation-insights.service";
import { IntegrationHubService, type CommerceOrder } from "../apps/integration-hub.service";
import { ConversationsGateway } from "./conversations.gateway";

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(forwardRef(() => ChannelsService))
    private readonly channels: ChannelsService,
    private readonly prisma: PrismaService,
    private readonly gateway: ConversationsGateway,
    private readonly fileStorage: FileStorageService,
    private readonly insights: ConversationInsightsService,
    private readonly integrations: IntegrationHubService
  ) {}

  async listConversations(
    organizationId: string,
    context: OrganizationRequestContext,
    query: ListConversationsQuery
  ): Promise<ConversationDto[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        organizationId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.assignedAgentId ? { assignedAgentId: query.assignedAgentId } : {}),
        ...(query.assignedToMe ? { assignedAgentId: context.membershipId } : {})
      },
      orderBy: [
        { lastMessageAt: "desc" },
        { createdAt: "desc" }
      ],
      take: query.limit ?? 25
    });
    const latestMessages = await this.getLatestMessages(conversations.map((item) => item.id));

    return conversations.map((conversation) =>
      this.mapConversation(conversation, latestMessages.get(conversation.id) ?? null)
    );
  }

  async getConversation(
    organizationId: string,
    conversationId: string
  ): Promise<ConversationDto> {
    const conversation = await this.getConversationOrThrow(organizationId, conversationId);
    const latestMessages = await this.getLatestMessages([conversation.id]);

    return this.mapConversation(conversation, latestMessages.get(conversation.id) ?? null);
  }

  async createConversation(
    organizationId: string,
    context: OrganizationRequestContext,
    dto: CreateConversationDto
  ): Promise<ConversationDto> {
    const assignedAgentId = dto.assignedAgentId ?? context.membershipId;
    const initialMessage = this.trimOptional(dto.initialMessage);

    await this.ensureMembership(organizationId, assignedAgentId);
    await this.ensureOptionalReferences(organizationId, dto);

    const result = await this.prisma.$transaction(async (transaction) => {
      // Test chat: attribute the first message to a real (simulated) visitor so the
      // transcript shows it as the customer, not the agent.
      let visitorId = dto.visitorId ?? null;
      if (dto.simulateVisitor && !visitorId) {
        const visitor = await transaction.visitor.create({
          data: {
            organizationId,
            externalId: `test:${randomBytes(12).toString("hex")}`,
            name: "Test visitor",
            lastSeenAt: new Date()
          }
        });
        visitorId = visitor.id;
      }

      let conversation = await transaction.conversation.create({
        data: {
          organizationId,
          ...(visitorId ? { visitorId } : {}),
          ...(dto.contactId ? { contactId: dto.contactId } : {}),
          ...(dto.widgetId ? { widgetId: dto.widgetId } : {}),
          ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
          assignedAgentId,
          source: dto.source ?? ConversationSource.MANUAL,
          status: ConversationStatus.OPEN,
          priority: dto.priority ?? ConversationPriority.NORMAL,
          ...(dto.subject ? { subject: dto.subject } : {}),
          ...(dto.locale ? { locale: dto.locale } : {}),
          metadata: this.toJsonInput(dto.metadata)
        }
      });

      await transaction.conversationParticipant.create({
        data: {
          organizationId,
          conversationId: conversation.id,
          participantType: ParticipantType.AGENT,
          membershipId: assignedAgentId
        }
      });

      if (visitorId) {
        await transaction.conversationParticipant.create({
          data: {
            organizationId,
            conversationId: conversation.id,
            participantType: ParticipantType.VISITOR,
            visitorId
          }
        });
      }

      let latestMessage: Message | null = null;

      if (initialMessage) {
        const fromVisitor = Boolean(dto.simulateVisitor && visitorId);
        latestMessage = await transaction.message.create({
          data: {
            organizationId,
            conversationId: conversation.id,
            senderType: fromVisitor ? ParticipantType.VISITOR : ParticipantType.AGENT,
            ...(fromVisitor
              ? { senderVisitorId: visitorId as string }
              : { senderMembershipId: context.membershipId }),
            type: MessageType.TEXT,
            visibility: MessageVisibility.PUBLIC,
            status: MessageStatus.SENT,
            body: initialMessage
          }
        });
        conversation = await transaction.conversation.update({
          where: { id: conversation.id },
          data: {
            // A visitor's opening message isn't an agent "first response".
            ...(fromVisitor ? {} : { firstResponseAt: latestMessage.createdAt }),
            lastMessageAt: latestMessage.createdAt
          }
        });
      }

      return { conversation, latestMessage };
    });
    const response = this.mapConversation(result.conversation, result.latestMessage);

    this.gateway.emitConversationCreated(response);

    if (result.latestMessage) {
      this.gateway.emitMessageCreated(this.mapMessage(result.latestMessage));
    }

    return response;
  }

  /**
   * The customer's recent orders from the connected shop. Empty when Shopify isn't
   * installed or the customer has no email on file.
   */
  async recentOrders(organizationId: string, conversationId: string): Promise<CommerceOrder[]> {
    const conversation = await this.getConversationOrThrow(organizationId, conversationId);
    const [contact, visitor] = await Promise.all([
      conversation.contactId
        ? this.prisma.contact.findUnique({ where: { id: conversation.contactId } })
        : null,
      conversation.visitorId
        ? this.prisma.visitor.findUnique({ where: { id: conversation.visitorId } })
        : null
    ]);
    const email = contact?.email ?? visitor?.email ?? "";

    return email ? this.integrations.recentOrders(organizationId, email) : [];
  }

  /** Push the customer into HubSpot once the chat is done. */
  private syncContactWhenFinished(
    organizationId: string,
    conversationId: string,
    status: ConversationStatus | undefined
  ): void {
    if (status !== ConversationStatus.RESOLVED && status !== ConversationStatus.CLOSED) {
      return;
    }

    void (async () => {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: conversationId, organizationId },
        select: { contactId: true, visitorId: true }
      });
      const contact = conversation?.contactId
        ? await this.prisma.contact.findUnique({ where: { id: conversation.contactId } })
        : null;
      const visitor = conversation?.visitorId
        ? await this.prisma.visitor.findUnique({ where: { id: conversation.visitorId } })
        : null;
      const email = contact?.email ?? visitor?.email;

      if (!email) {
        return;
      }

      await this.integrations.syncContactToHubspot(organizationId, {
        email,
        name: contact?.name ?? visitor?.name ?? null,
        phone: contact?.phone ?? visitor?.phone ?? null,
        company: contact?.company ?? null
      });
    })().catch(() => undefined);
  }

  /** Label a finished chat by topic so Archives and the tag report stay useful. */
  private autoTagWhenFinished(
    organizationId: string,
    conversationId: string,
    status: ConversationStatus | undefined
  ): void {
    if (status !== ConversationStatus.RESOLVED && status !== ConversationStatus.CLOSED) {
      return;
    }

    void this.insights.tag(organizationId, conversationId, { apply: true }).catch(() => undefined);
  }

  async updateConversation(
    organizationId: string,
    conversationId: string,
    dto: UpdateConversationDto
  ): Promise<ConversationDto> {
    await this.getConversationOrThrow(organizationId, conversationId);

    if (!dto.status && !dto.priority && dto.subject === undefined && dto.metadata === undefined) {
      throw new BadRequestException("At least one conversation field is required");
    }

    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(dto.status ? this.buildStatusUpdate(dto.status) : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.metadata !== undefined ? { metadata: this.toJsonInput(dto.metadata) } : {})
      }
    });
    const response = this.mapConversation(conversation);

    this.autoTagWhenFinished(organizationId, conversationId, dto.status);
    this.syncContactWhenFinished(organizationId, conversationId, dto.status);
    this.gateway.emitConversationUpdated(response);
    return response;
  }

  async updateTags(
    organizationId: string,
    conversationId: string,
    tags: string[]
  ): Promise<ConversationDto> {
    const existing = await this.getConversationOrThrow(organizationId, conversationId);

    const normalizedTags = Array.from(
      new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
    ).slice(0, 20);

    const baseMetadata =
      existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};

    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: this.toJsonInput({ ...baseMetadata, tags: normalizedTags }) }
    });
    const response = this.mapConversation(conversation);

    this.gateway.emitConversationUpdated(response);
    return response;
  }

  async assignConversation(
    organizationId: string,
    conversationId: string,
    context: OrganizationRequestContext,
    dto: AssignConversationDto
  ): Promise<ConversationDto> {
    await this.getConversationOrThrow(organizationId, conversationId);
    await this.ensureMembership(organizationId, dto.assignedAgentId);

    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.conversation.update({
        where: { id: conversationId },
        data: {
          assignedAgentId: dto.assignedAgentId,
          status: ConversationStatus.OPEN
        }
      });

      await transaction.conversationAssignment.create({
        data: {
          organizationId,
          conversationId,
          agentId: dto.assignedAgentId,
          assignedById: context.membershipId,
          ...(dto.reason ? { reason: dto.reason } : {})
        }
      });

      const existingParticipant = await transaction.conversationParticipant.findFirst({
        where: {
          organizationId,
          conversationId,
          membershipId: dto.assignedAgentId,
          participantType: ParticipantType.AGENT
        }
      });

      if (existingParticipant) {
        await transaction.conversationParticipant.update({
          where: { id: existingParticipant.id },
          data: { leftAt: null }
        });
      } else {
        await transaction.conversationParticipant.create({
          data: {
            organizationId,
            conversationId,
            participantType: ParticipantType.AGENT,
            membershipId: dto.assignedAgentId
          }
        });
      }

      const eventMessage = await transaction.message.create({
        data: {
          organizationId,
          conversationId,
          senderType: ParticipantType.SYSTEM,
          type: MessageType.EVENT,
          visibility: MessageVisibility.INTERNAL,
          status: MessageStatus.SENT,
          body: dto.reason
            ? `Conversation assigned. Reason: ${dto.reason}`
            : "Conversation assigned."
        }
      });

      const updatedConversation = await transaction.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: eventMessage.createdAt }
      });

      return { conversation: updatedConversation, eventMessage };
    });
    const response = this.mapConversation(result.conversation, result.eventMessage);

    this.gateway.emitConversationAssigned(response, dto.assignedAgentId);
    this.gateway.emitMessageCreated(this.mapMessage(result.eventMessage));
    return response;
  }

  async listMessages(
    organizationId: string,
    conversationId: string,
    query: ListMessagesQuery
  ): Promise<MessageDto[]> {
    await this.getConversationOrThrow(organizationId, conversationId);

    const messages = await this.prisma.message.findMany({
      where: {
        organizationId,
        conversationId,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" },
      take: query.limit ?? 50
    });

    return messages.reverse().map((message) => this.mapMessage(message));
  }

  /**
   * Mark the other side's messages as read. Called when an agent opens a conversation and
   * when the visitor's widget is on screen, so both sides can show delivered/read ticks.
   */
  async markRead(
    organizationId: string,
    conversationId: string,
    reader: "AGENT" | "VISITOR",
    participant: { membershipId?: string; visitorId?: string }
  ): Promise<{ readAt: Date; messageIds: string[] }> {
    const readAt = new Date();
    // An agent reads what the visitor sent, and vice versa.
    const senderType = reader === "AGENT" ? ParticipantType.VISITOR : ParticipantType.AGENT;
    const unread = await this.prisma.message.findMany({
      where: {
        organizationId,
        conversationId,
        senderType,
        visibility: MessageVisibility.PUBLIC,
        deletedAt: null,
        status: { not: MessageStatus.READ }
      },
      select: { id: true }
    });
    const messageIds = unread.map((message) => message.id);

    if (messageIds.length) {
      await this.prisma.message.updateMany({
        where: { id: { in: messageIds } },
        data: { status: MessageStatus.READ }
      });
    }

    const where = {
      organizationId,
      conversationId,
      ...(participant.membershipId
        ? { membershipId: participant.membershipId }
        : participant.visitorId
          ? { visitorId: participant.visitorId }
          : {})
    };
    const existing = participant.membershipId || participant.visitorId
      ? await this.prisma.conversationParticipant.findFirst({ where })
      : null;

    if (existing) {
      await this.prisma.conversationParticipant.update({
        where: { id: existing.id },
        data: { lastReadAt: readAt }
      });
    }

    if (messageIds.length) {
      this.gateway.emitMessagesRead({ organizationId, conversationId, reader, readAt, messageIds });
    }

    return { readAt, messageIds };
  }

  async sendMessage(
    organizationId: string,
    conversationId: string,
    context: OrganizationRequestContext,
    dto: SendMessageDto
  ): Promise<MessageDto> {
    const conversation = await this.getConversationOrThrow(organizationId, conversationId);
    // Agents paste card numbers too; mask before anything is written to the database.
    const body = maskCardNumbers(dto.body.trim());

    if (!body) {
      throw new BadRequestException("Message body cannot be empty");
    }

    if (dto.idempotencyKey) {
      const existingMessage = await this.prisma.message.findFirst({
        where: {
          conversationId,
          idempotencyKey: dto.idempotencyKey
        }
      });

      if (existingMessage) {
        return this.mapMessage(existingMessage);
      }
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const message = await transaction.message.create({
        data: {
          organizationId,
          conversationId,
          senderType: ParticipantType.AGENT,
          senderMembershipId: context.membershipId,
          type: dto.type ?? MessageType.TEXT,
          visibility: dto.visibility ?? MessageVisibility.PUBLIC,
          status: MessageStatus.SENT,
          body,
          ...(dto.idempotencyKey ? { idempotencyKey: dto.idempotencyKey } : {}),
          metadata: this.toJsonInput(dto.metadata)
        }
      });
      const shouldSetFirstResponse =
        message.visibility === MessageVisibility.PUBLIC && conversation.firstResponseAt === null;
      const updatedConversation = await transaction.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: message.createdAt,
          ...(shouldSetFirstResponse ? { firstResponseAt: message.createdAt } : {})
        }
      });

      return { message, conversation: updatedConversation };
    });
    const messageResponse = this.mapMessage(result.message);

    this.gateway.emitMessageCreated(messageResponse);
    this.gateway.emitConversationUpdated(this.mapConversation(result.conversation, result.message));

    // WhatsApp / Messenger / Instagram / email chats: deliver the reply back to the customer.
    if (
      conversation.channel &&
      conversation.channelThreadId &&
      (dto.visibility ?? MessageVisibility.PUBLIC) === MessageVisibility.PUBLIC
    ) {
      void this.channels
        .sendOutbound({
          organizationId,
          channel: conversation.channel,
          threadId: conversation.channelThreadId,
          body,
          conversationId: conversation.id,
          messageId: result.message.id
        })
        .catch(() => {});
    }

    return messageResponse;
  }

  async createFileMessage(
    organizationId: string,
    conversationId: string,
    context: OrganizationRequestContext,
    file: UploadedFileLike
  ): Promise<MessageDto> {
    if (!file.size || !file.buffer?.length) {
      throw new BadRequestException("The uploaded file is empty");
    }

    const conversation = await this.getConversationOrThrow(organizationId, conversationId);
    const stored = await this.fileStorage.save(organizationId, file);

    const attachmentMetadata = {
      attachment: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        url: stored.publicUrl
      }
    };

    const result = await this.prisma.$transaction(async (transaction) => {
      const message = await transaction.message.create({
        data: {
          organizationId,
          conversationId,
          senderType: ParticipantType.AGENT,
          senderMembershipId: context.membershipId,
          type: MessageType.FILE,
          visibility: MessageVisibility.PUBLIC,
          status: MessageStatus.SENT,
          body: file.originalname,
          metadata: this.toJsonInput(attachmentMetadata)
        }
      });

      await transaction.messageAttachment.create({
        data: {
          organizationId,
          messageId: message.id,
          uploadedByMembershipId: context.membershipId,
          storageKey: stored.storageKey,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: BigInt(file.size),
          publicUrl: stored.publicUrl
        }
      });

      const updatedConversation = await transaction.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: message.createdAt,
          ...(conversation.firstResponseAt === null
            ? { firstResponseAt: message.createdAt }
            : {})
        }
      });

      return { message, conversation: updatedConversation };
    });

    const messageResponse = this.mapMessage(result.message);

    this.gateway.emitMessageCreated(messageResponse);
    this.gateway.emitConversationUpdated(this.mapConversation(result.conversation, result.message));
    return messageResponse;
  }

  async ensureConversationAccess(
    organizationId: string,
    conversationId: string
  ): Promise<void> {
    await this.getConversationOrThrow(organizationId, conversationId);
  }

  private async getConversationOrThrow(
    organizationId: string,
    conversationId: string
  ): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    return conversation;
  }

  private async getLatestMessages(conversationIds: string[]): Promise<Map<string, Message>> {
    if (!conversationIds.length) {
      return new Map();
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: {
          in: conversationIds
        },
        deletedAt: null
      },
      orderBy: { createdAt: "desc" }
    });
    const latestByConversationId = new Map<string, Message>();

    for (const message of messages) {
      if (!latestByConversationId.has(message.conversationId)) {
        latestByConversationId.set(message.conversationId, message);
      }
    }

    return latestByConversationId;
  }

  private async ensureMembership(organizationId: string, membershipId: string): Promise<void> {
    const membership = await this.prisma.userOrganization.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: UserStatus.ACTIVE
      }
    });

    if (!membership) {
      throw new BadRequestException("Assigned agent does not belong to this organization");
    }
  }

  private async ensureOptionalReferences(
    organizationId: string,
    dto: CreateConversationDto
  ): Promise<void> {
    const checks: Array<Promise<unknown>> = [];

    if (dto.visitorId) {
      checks.push(
        this.prisma.visitor.findFirstOrThrow({
          where: { id: dto.visitorId, organizationId }
        })
      );
    }

    if (dto.contactId) {
      checks.push(
        this.prisma.contact.findFirstOrThrow({
          where: { id: dto.contactId, organizationId, deletedAt: null }
        })
      );
    }

    if (dto.widgetId) {
      checks.push(
        this.prisma.chatWidget.findFirstOrThrow({
          where: { id: dto.widgetId, organizationId, isEnabled: true }
        })
      );
    }

    if (dto.departmentId) {
      checks.push(
        this.prisma.department.findFirstOrThrow({
          where: { id: dto.departmentId, organizationId }
        })
      );
    }

    try {
      await Promise.all(checks);
    } catch {
      throw new BadRequestException("Conversation reference does not belong to this organization");
    }
  }

  private buildStatusUpdate(status: ConversationStatus): Prisma.ConversationUpdateInput {
    const now = new Date();

    if (status === ConversationStatus.RESOLVED) {
      return { status, resolvedAt: now };
    }

    if (status === ConversationStatus.CLOSED) {
      return { status, closedAt: now };
    }

    return { status };
  }

  private trimOptional(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new BadRequestException("Initial message cannot be empty");
    }

    return trimmedValue;
  }

  private mapConversation(
    conversation: Conversation,
    latestMessage?: Message | null
  ): ConversationDto {
    return {
      id: conversation.id,
      organizationId: conversation.organizationId,
      visitorId: conversation.visitorId,
      contactId: conversation.contactId,
      widgetId: conversation.widgetId,
      departmentId: conversation.departmentId,
      assignedAgentId: conversation.assignedAgentId,
      source: conversation.source,
      channel: conversation.channel,
      channelThreadId: conversation.channelThreadId,
      status: conversation.status,
      priority: conversation.priority,
      subject: conversation.subject,
      locale: conversation.locale,
      metadata: this.toRecord(conversation.metadata),
      firstResponseAt: conversation.firstResponseAt,
      lastMessageAt: conversation.lastMessageAt,
      resolvedAt: conversation.resolvedAt,
      closedAt: conversation.closedAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      latestMessage: latestMessage ? this.mapMessage(latestMessage) : null
    };
  }

  private mapMessage(message: Message): MessageDto {
    return {
      id: message.id,
      organizationId: message.organizationId,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderVisitorId: message.senderVisitorId,
      senderMembershipId: message.senderMembershipId,
      type: message.type,
      visibility: message.visibility,
      status: message.status,
      body: message.body,
      idempotencyKey: message.idempotencyKey,
      metadata: this.toRecord(message.metadata),
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt
    };
  }

  private toRecord(value: Prisma.JsonValue): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }

    return {};
  }

  private toJsonInput(value: Record<string, unknown> | undefined): Prisma.InputJsonValue {
    return (value ?? {}) as Prisma.InputJsonValue;
  }
}
