import { Test } from "@nestjs/testing";
import {
  ConversationPriority,
  ConversationSource,
  ConversationStatus,
  MessageStatus,
  MessageType,
  MessageVisibility,
  ParticipantType
} from "@prisma/client";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { PrismaService } from "../prisma/prisma.service";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";

const organizationId = "00000000-0000-4000-8000-000000000001";
const conversationId = "00000000-0000-4000-8000-000000000002";
const membershipId = "00000000-0000-4000-8000-000000000003";
const messageId = "00000000-0000-4000-8000-000000000004";
const now = new Date("2026-06-16T10:00:00.000Z");

const context: OrganizationRequestContext = {
  organizationId,
  membershipId,
  roles: ["OWNER"],
  permissions: ["chat:read", "chat:write"]
};

function buildConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: conversationId,
    organizationId,
    visitorId: null,
    contactId: null,
    widgetId: null,
    departmentId: null,
    assignedAgentId: membershipId,
    source: ConversationSource.MANUAL,
    status: ConversationStatus.OPEN,
    priority: ConversationPriority.NORMAL,
    subject: "Checkout support",
    locale: null,
    metadata: {},
    firstResponseAt: null,
    lastMessageAt: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function buildMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: messageId,
    organizationId,
    conversationId,
    senderType: ParticipantType.AGENT,
    senderVisitorId: null,
    senderMembershipId: membershipId,
    type: MessageType.TEXT,
    visibility: MessageVisibility.PUBLIC,
    status: MessageStatus.SENT,
    body: "Hello",
    idempotencyKey: null,
    metadata: {},
    createdAt: now,
    editedAt: null,
    deletedAt: null,
    ...overrides
  };
}

describe(ConversationsService.name, () => {
  async function createSubject() {
    const transaction = {
      conversation: {
        create: jest.fn().mockResolvedValue(buildConversation()),
        update: jest.fn().mockResolvedValue(
          buildConversation({
            firstResponseAt: now,
            lastMessageAt: now
          })
        )
      },
      conversationAssignment: {
        create: jest.fn()
      },
      conversationParticipant: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      message: {
        create: jest.fn(
          (input: {
            data: {
              body?: string | null;
              idempotencyKey?: string | null;
              type?: MessageType;
              visibility?: MessageVisibility;
            };
          }) =>
            buildMessage({
              body: input.data.body ?? null,
              idempotencyKey: input.data.idempotencyKey ?? null,
              type: input.data.type ?? MessageType.TEXT,
              visibility: input.data.visibility ?? MessageVisibility.PUBLIC
            })
        )
      }
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (transactionClient: typeof transaction) => Promise<unknown>) =>
          callback(transaction)
      ),
      chatWidget: {
        findFirstOrThrow: jest.fn()
      },
      contact: {
        findFirstOrThrow: jest.fn()
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue(buildConversation()),
        findMany: jest.fn().mockResolvedValue([buildConversation()]),
        update: jest.fn().mockResolvedValue(buildConversation())
      },
      department: {
        findFirstOrThrow: jest.fn()
      },
      message: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([buildMessage()])
      },
      userOrganization: {
        findFirst: jest.fn().mockResolvedValue({
          id: membershipId,
          organizationId
        })
      },
      visitor: {
        findFirstOrThrow: jest.fn()
      }
    };
    const gateway = {
      emitConversationAssigned: jest.fn(),
      emitConversationCreated: jest.fn(),
      emitConversationUpdated: jest.fn(),
      emitMessageCreated: jest.fn()
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: PrismaService,
          useValue: prisma
        },
        {
          provide: ConversationsGateway,
          useValue: gateway
        }
      ]
    }).compile();

    return {
      gateway,
      prisma,
      service: moduleRef.get(ConversationsService),
      transaction
    };
  }

  it("creates a manual conversation with an initial message and broadcasts it", async () => {
    const { gateway, service, transaction } = await createSubject();

    const result = await service.createConversation(organizationId, context, {
      initialMessage: " Hello ",
      subject: "Checkout support"
    });

    expect(result).toMatchObject({
      id: conversationId,
      assignedAgentId: membershipId,
      latestMessage: {
        body: "Hello"
      }
    });
    expect(transaction.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedAgentId: membershipId,
          status: ConversationStatus.OPEN
        })
      })
    );
    expect(transaction.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: "Hello",
          senderMembershipId: membershipId
        })
      })
    );
    expect(gateway.emitConversationCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: conversationId })
    );
    expect(gateway.emitMessageCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: messageId })
    );
  });

  it("sends an agent message and updates the first response timestamp", async () => {
    const { gateway, service, transaction } = await createSubject();

    const result = await service.sendMessage(organizationId, conversationId, context, {
      body: " Thanks for waiting ",
      idempotencyKey: "reply-1"
    });

    expect(result).toMatchObject({
      body: "Thanks for waiting",
      idempotencyKey: "reply-1"
    });
    expect(transaction.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: "Thanks for waiting",
          idempotencyKey: "reply-1"
        })
      })
    );
    expect(transaction.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstResponseAt: now,
          lastMessageAt: now
        })
      })
    );
    expect(gateway.emitMessageCreated).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Thanks for waiting" })
    );
    expect(gateway.emitConversationUpdated).toHaveBeenCalled();
  });

  it("returns an existing idempotent message without creating a duplicate", async () => {
    const { gateway, prisma, service, transaction } = await createSubject();
    prisma.message.findFirst.mockResolvedValue(
      buildMessage({
        idempotencyKey: "reply-1"
      })
    );

    const result = await service.sendMessage(organizationId, conversationId, context, {
      body: "Retry",
      idempotencyKey: "reply-1"
    });

    expect(result).toMatchObject({
      id: messageId,
      idempotencyKey: "reply-1"
    });
    expect(transaction.message.create).not.toHaveBeenCalled();
    expect(gateway.emitMessageCreated).not.toHaveBeenCalled();
  });
});
