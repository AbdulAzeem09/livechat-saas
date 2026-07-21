import { Injectable, NotFoundException } from "@nestjs/common";
import {
  AutomationRule,
  Message,
  MessageStatus,
  MessageType,
  MessageVisibility,
  ParticipantType,
  Prisma
} from "@prisma/client";
import { ConversationsGateway } from "../conversations/conversations.gateway";
import type { MessageDto } from "../conversations/dto/conversation-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { AutomationRuleDto } from "./dto/automation-response.dto";
import { CreateAutomationRuleDto } from "./dto/create-automation-rule.dto";
import { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";

/** Cap auto-replies per visitor message so misconfigured rules can't spam. */
const MAX_REPLIES_PER_MESSAGE = 3;

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ConversationsGateway
  ) {}

  async list(organizationId: string): Promise<AutomationRuleDto[]> {
    const rules = await this.prisma.automationRule.findMany({
      where: { organizationId },
      orderBy: [{ isGreeting: "desc" }, { createdAt: "asc" }]
    });

    return rules.map((rule) => this.map(rule));
  }

  async create(
    organizationId: string,
    dto: CreateAutomationRuleDto
  ): Promise<AutomationRuleDto> {
    const rule = await this.prisma.automationRule.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        replyMessage: dto.replyMessage.trim(),
        isGreeting: dto.isGreeting ?? false,
        keywords: this.normalizeKeywords(dto.keywords),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
      }
    });

    return this.map(rule);
  }

  async update(
    organizationId: string,
    ruleId: string,
    dto: UpdateAutomationRuleDto
  ): Promise<AutomationRuleDto> {
    await this.getOrThrow(organizationId, ruleId);

    const rule = await this.prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.replyMessage !== undefined ? { replyMessage: dto.replyMessage.trim() } : {}),
        ...(dto.isGreeting !== undefined ? { isGreeting: dto.isGreeting } : {}),
        ...(dto.keywords !== undefined ? { keywords: this.normalizeKeywords(dto.keywords) } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
      }
    });

    return this.map(rule);
  }

  async remove(organizationId: string, ruleId: string): Promise<{ success: true }> {
    await this.getOrThrow(organizationId, ruleId);
    await this.prisma.automationRule.delete({ where: { id: ruleId } });
    return { success: true };
  }

  /**
   * Evaluate enabled rules against an incoming visitor message and post any
   * matching bot auto-replies. Greeting rules fire on the first message;
   * keyword rules fire when any keyword is contained in the message body.
   */
  async evaluateAndReply(
    organizationId: string,
    conversationId: string,
    body: string,
    options: { isFirstMessage: boolean }
  ): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: { organizationId, enabled: true },
      orderBy: [{ isGreeting: "desc" }, { createdAt: "asc" }]
    });

    const lowerBody = body.toLowerCase();
    const matched = rules
      .filter((rule) => {
        if (rule.isGreeting) {
          return options.isFirstMessage;
        }

        return (
          rule.keywords.length > 0 &&
          rule.keywords.some((keyword) => lowerBody.includes(keyword.toLowerCase()))
        );
      })
      .slice(0, MAX_REPLIES_PER_MESSAGE);

    for (const rule of matched) {
      await this.postBotReply(organizationId, conversationId, rule);
    }

    // If no keyword rule answered the visitor's question, try the Knowledge Base.
    const answeredByRule = matched.some((rule) => !rule.isGreeting);
    if (!answeredByRule && body.trim().length > 4) {
      await this.answerFromKnowledgeBase(organizationId, conversationId, body).catch(() => {});
    }
  }

  /** Chatbot fallback: find a published KB article matching the message and reply with it. */
  private async answerFromKnowledgeBase(
    organizationId: string,
    conversationId: string,
    body: string
  ): Promise<void> {
    const words = body
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 8);
    if (!words.length) {
      return;
    }

    const article = await this.prisma.knowledgeArticle.findFirst({
      where: {
        organizationId,
        published: true,
        OR: words.flatMap((word) => [
          { title: { contains: word, mode: "insensitive" as const } },
          { content: { contains: word, mode: "insensitive" as const } }
        ])
      },
      orderBy: { views: "desc" }
    });
    if (!article) {
      return;
    }

    await this.prisma.knowledgeArticle.update({
      where: { id: article.id },
      data: { views: { increment: 1 } }
    });

    const reply = `${article.content}\n\n— from "${article.title}"`;
    await this.postBotReplyText(organizationId, conversationId, reply);
  }

  private async postBotReply(
    organizationId: string,
    conversationId: string,
    rule: AutomationRule
  ): Promise<void> {
    await this.postBotReplyText(organizationId, conversationId, rule.replyMessage, { ruleId: rule.id });
  }

  private async postBotReplyText(
    organizationId: string,
    conversationId: string,
    body: string,
    extraMetadata: Record<string, unknown> = {}
  ): Promise<void> {
    // Bot has no membership/visitor identity; SYSTEM satisfies messages_sender_identity_check.
    // The widget still renders non-visitor messages as an agent bubble.
    const message = await this.prisma.message.create({
      data: {
        organizationId,
        conversationId,
        senderType: ParticipantType.SYSTEM,
        type: MessageType.TEXT,
        visibility: MessageVisibility.PUBLIC,
        status: MessageStatus.SENT,
        body,
        metadata: { bot: true, ...extraMetadata } as Prisma.InputJsonValue
      }
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt }
    });

    this.gateway.emitMessageCreated(this.mapMessage(message));
  }

  private async getOrThrow(organizationId: string, ruleId: string): Promise<AutomationRule> {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id: ruleId, organizationId }
    });

    if (!rule) {
      throw new NotFoundException("Automation rule not found");
    }

    return rule;
  }

  private normalizeKeywords(keywords: string[] | undefined): string[] {
    if (!keywords) {
      return [];
    }

    return Array.from(
      new Set(
        keywords
          .map((keyword) => keyword.trim().toLowerCase())
          .filter((keyword) => keyword.length > 0)
      )
    ).slice(0, 30);
  }

  private map(rule: AutomationRule): AutomationRuleDto {
    return {
      id: rule.id,
      organizationId: rule.organizationId,
      name: rule.name,
      enabled: rule.enabled,
      isGreeting: rule.isGreeting,
      keywords: rule.keywords,
      replyMessage: rule.replyMessage,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
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
      metadata:
        message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
          ? (message.metadata as Record<string, unknown>)
          : {},
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt
    };
  }
}
