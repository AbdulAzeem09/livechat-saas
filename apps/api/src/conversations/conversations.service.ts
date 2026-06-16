import {
  BadRequestException,
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
import { PrismaService } from "../prisma/prisma.service";
import type { AssignConversationDto } from "./dto/assign-conversation.dto";
import type { ConversationDto, MessageDto } from "./dto/conversation-response.dto";
import type { CreateConversationDto } from "./dto/create-conversation.dto";
import type { ListConversationsQuery } from "./dto/list-conversations.query";
import type { ListMessagesQuery } from "./dto/list-messages.query";
import type { SendMessageDto } from "./dto/send-message.dto";
import type { UpdateConversationDto } from "./dto/update-conversation.dto";
import { ConversationsGateway } from "./conversations.gateway";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ConversationsGateway
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
      let conversation = await transaction.conversation.create({
        data: {
          organizationId,
          ...(dto.visitorId ? { visitorId: dto.visitorId } : {}),
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

      if (dto.visitorId) {
        await transaction.conversationParticipant.create({
          data: {
            organizationId,
            conversationId: conversation.id,
            participantType: ParticipantType.VISITOR,
            visitorId: dto.visitorId
          }
        });
      }

      let latestMessage: Message | null = null;

      if (initialMessage) {
        latestMessage = await transaction.message.create({
          data: {
            organizationId,
            conversationId: conversation.id,
            senderType: ParticipantType.AGENT,
            senderMembershipId: context.membershipId,
            type: MessageType.TEXT,
            visibility: MessageVisibility.PUBLIC,
            status: MessageStatus.SENT,
            body: initialMessage
          }
        });
        conversation = await transaction.conversation.update({
          where: { id: conversation.id },
          data: {
            firstResponseAt: latestMessage.createdAt,
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

  async sendMessage(
    organizationId: string,
    conversationId: string,
    context: OrganizationRequestContext,
    dto: SendMessageDto
  ): Promise<MessageDto> {
    const conversation = await this.getConversationOrThrow(organizationId, conversationId);
    const body = dto.body.trim();

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
