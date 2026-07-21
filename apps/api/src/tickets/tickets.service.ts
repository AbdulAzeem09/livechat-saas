import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ConversationStatus,
  Message,
  MessageStatus,
  MessageType,
  MessageVisibility,
  ParticipantType,
  Prisma,
  Ticket,
  TicketPriority,
  TicketStatus
} from "@prisma/client";
import { ConversationsGateway } from "../conversations/conversations.gateway";
import type { MessageDto } from "../conversations/dto/conversation-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { ConvertConversationDto } from "./dto/convert-conversation.dto";
import { TicketDto } from "./dto/ticket-response.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ConversationsGateway
  ) {}

  async list(organizationId: string): Promise<TicketDto[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    });

    return tickets.map((ticket) => this.map(ticket));
  }

  async create(organizationId: string, dto: CreateTicketDto): Promise<TicketDto> {
    const metadata: Record<string, unknown> = {};
    if (dto.requesterName) {
      metadata.requesterName = dto.requesterName.trim();
    }
    if (dto.requesterEmail) {
      metadata.requesterEmail = dto.requesterEmail.trim();
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        organizationId,
        subject: dto.subject.trim(),
        status: TicketStatus.OPEN,
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority as TicketPriority } : {}),
        ...(dto.conversationId !== undefined ? { conversationId: dto.conversationId } : {}),
        metadata: metadata as Prisma.InputJsonValue
      }
    });

    return this.map(ticket);
  }

  /** Turn a live chat into a ticket: snapshot the transcript + auto-reply in the chat. */
  async createFromConversation(
    organizationId: string,
    conversationId: string,
    createdById: string | null,
    dto: ConvertConversationDto
  ): Promise<TicketDto> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId, visibility: MessageVisibility.PUBLIC },
      orderBy: { createdAt: "asc" },
      take: 200
    });
    const transcript = this.buildTranscript(messages);
    const subject =
      (dto.subject && dto.subject.trim()) ||
      (conversation.subject && conversation.subject.trim()) ||
      "Chat follow-up";

    const metadata: Record<string, unknown> = { fromConversation: conversationId };
    const convMeta =
      conversation.metadata && typeof conversation.metadata === "object" && !Array.isArray(conversation.metadata)
        ? (conversation.metadata as Record<string, unknown>)
        : {};
    const preChat = convMeta.preChat as Record<string, unknown> | undefined;
    if (preChat && typeof preChat === "object") {
      if (typeof preChat.name === "string") metadata.requesterName = preChat.name;
      if (typeof preChat.email === "string") metadata.requesterEmail = preChat.email;
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        organizationId,
        subject: subject.slice(0, 220),
        status: TicketStatus.OPEN,
        ...(dto.priority !== undefined ? { priority: dto.priority as TicketPriority } : {}),
        description: transcript,
        conversationId: conversation.id,
        ...(conversation.visitorId ? { visitorId: conversation.visitorId } : {}),
        ...(createdById ? { createdById } : {}),
        metadata: metadata as Prisma.InputJsonValue
      }
    });

    // Auto-reply in the chat so the visitor knows a ticket was opened.
    const ackText =
      dto.autoReplyMessage?.trim() ||
      `We've turned this chat into a support ticket. Our team will follow up${
        typeof metadata.requesterEmail === "string" ? ` by email at ${metadata.requesterEmail}` : ""
      } soon. Reference: ${this.ticketReference(ticket.id, ticket.createdAt)}.`;
    await this.postSystemReply(organizationId, conversation.id, ackText);

    // Optionally take the live chat out of the queue.
    if (dto.resolveConversation) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: ConversationStatus.RESOLVED }
      });
    }

    return this.map(ticket);
  }

  async update(organizationId: string, ticketId: string, dto: UpdateTicketDto): Promise<TicketDto> {
    await this.getOrThrow(organizationId, ticketId);

    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ...(dto.subject !== undefined ? { subject: dto.subject.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status as TicketStatus } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority as TicketPriority } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
        ...(dto.status === "CLOSED" ? { closedAt: new Date() } : {})
      }
    });

    return this.map(ticket);
  }

  async remove(organizationId: string, ticketId: string): Promise<{ success: true }> {
    await this.getOrThrow(organizationId, ticketId);
    await this.prisma.ticket.delete({ where: { id: ticketId } });
    return { success: true };
  }

  private buildTranscript(messages: Message[]): string {
    if (!messages.length) {
      return "(No messages in this conversation.)";
    }
    return messages
      .map((message) => {
        const who =
          message.senderType === ParticipantType.VISITOR
            ? "Visitor"
            : message.senderType === ParticipantType.AGENT
              ? "Agent"
              : "Bot";
        return `${who}: ${message.body ?? "(attachment)"}`;
      })
      .join("\n");
  }

  /** Human-friendly ticket reference, e.g. TKT-A1B2C3. */
  private ticketReference(id: string, _createdAt: Date): string {
    return `TKT-${id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}`;
  }

  private async postSystemReply(
    organizationId: string,
    conversationId: string,
    body: string
  ): Promise<void> {
    const message = await this.prisma.message.create({
      data: {
        organizationId,
        conversationId,
        senderType: ParticipantType.SYSTEM,
        type: MessageType.TEXT,
        visibility: MessageVisibility.PUBLIC,
        status: MessageStatus.SENT,
        body,
        metadata: { ticketAck: true } as Prisma.InputJsonValue
      }
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt }
    });

    this.gateway.emitMessageCreated(this.mapMessage(message));
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
      metadata:
        message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
          ? (message.metadata as Record<string, unknown>)
          : {},
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt
    };
  }

  private async getOrThrow(organizationId: string, ticketId: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, organizationId } });

    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    return ticket;
  }

  private map(ticket: Ticket): TicketDto {
    const metadata =
      ticket.metadata && typeof ticket.metadata === "object" && !Array.isArray(ticket.metadata)
        ? (ticket.metadata as Record<string, unknown>)
        : {};

    return {
      id: ticket.id,
      organizationId: ticket.organizationId,
      subject: ticket.subject,
      requesterName: typeof metadata.requesterName === "string" ? metadata.requesterName : "",
      requesterEmail: typeof metadata.requesterEmail === "string" ? metadata.requesterEmail : "",
      description: ticket.description ?? "",
      status: ticket.status,
      priority: ticket.priority,
      conversationId: ticket.conversationId,
      assigneeId: ticket.assigneeId,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt
    };
  }
}
