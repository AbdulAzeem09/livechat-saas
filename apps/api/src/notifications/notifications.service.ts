import { Injectable, Logger } from "@nestjs/common";
import { NotificationChannel, NotificationStatus, Prisma } from "@prisma/client";
import { ConversationsGateway } from "../conversations/conversations.gateway";
import { PrismaService } from "../prisma/prisma.service";

export interface NotificationDto {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * In-app notifications (the bell). Rows live in the notifications table and are pushed to the
 * agent's socket room, so the bell updates without a refresh.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ConversationsGateway
  ) {}

  /** Fire-and-forget: notifying an agent must never break the action that triggered it. */
  notify(input: {
    organizationId: string;
    membershipId: string;
    type: string;
    subject: string;
    body?: string;
    payload?: Record<string, unknown>;
  }): void {
    void this.prisma.notification
      .create({
        data: {
          organizationId: input.organizationId,
          recipientMembershipId: input.membershipId,
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.SENT,
          type: input.type,
          subject: input.subject,
          ...(input.body ? { body: input.body } : {}),
          payload: (input.payload ?? {}) as Prisma.InputJsonValue,
          sentAt: new Date()
        }
      })
      .then((created) => {
        this.gateway.emitNotification(input.membershipId, this.map(created));
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not create notification: ${error instanceof Error ? error.message : String(error)}`
        );
      });
  }

  /** Notify every active member of the workspace (used for chats nobody is assigned to yet). */
  async notifyOrganization(input: {
    organizationId: string;
    type: string;
    subject: string;
    body?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const memberships = await this.prisma.userOrganization
      .findMany({
        where: { organizationId: input.organizationId, status: "ACTIVE" },
        select: { id: true },
        take: 25
      })
      .catch(() => []);

    for (const membership of memberships) {
      this.notify({ ...input, membershipId: membership.id });
    }
  }

  async list(
    organizationId: string,
    membershipId: string,
    query: { unreadOnly?: boolean; limit?: number }
  ): Promise<{ items: NotificationDto[]; unread: number }> {
    const where = {
      organizationId,
      recipientMembershipId: membershipId,
      channel: NotificationChannel.IN_APP,
      ...(query.unreadOnly ? { readAt: null } : {})
    };
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit ?? 30
      }),
      this.prisma.notification.count({
        where: {
          organizationId,
          recipientMembershipId: membershipId,
          channel: NotificationChannel.IN_APP,
          readAt: null
        }
      })
    ]);

    return { items: rows.map((row) => this.map(row)), unread };
  }

  async markRead(
    organizationId: string,
    membershipId: string,
    notificationId?: string
  ): Promise<{ unread: number }> {
    await this.prisma.notification.updateMany({
      where: {
        organizationId,
        recipientMembershipId: membershipId,
        readAt: null,
        ...(notificationId ? { id: notificationId } : {})
      },
      data: { readAt: new Date() }
    });

    const unread = await this.prisma.notification.count({
      where: { organizationId, recipientMembershipId: membershipId, channel: NotificationChannel.IN_APP, readAt: null }
    });

    return { unread };
  }

  private map(row: {
    id: string;
    type: string;
    subject: string | null;
    body: string | null;
    payload: unknown;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: row.id,
      type: row.type,
      subject: row.subject,
      body: row.body,
      payload:
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {},
      readAt: row.readAt,
      createdAt: row.createdAt
    };
  }
}
