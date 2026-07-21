import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Message, MessageVisibility, ParticipantType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AiSuggestion {
  suggestion: string;
  usedAI: boolean;
  model: string | null;
}

/** Cheap + fast model for drafting short agent reply suggestions. */
const SUGGESTION_MODEL = "claude-haiku-4-5";

@Injectable()
export class AiService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async suggestReply(organizationId: string, conversationId: string): Promise<AiSuggestion> {
    const messages = await this.prisma.message.findMany({
      where: {
        organizationId,
        conversationId,
        visibility: MessageVisibility.PUBLIC,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" },
      take: 20
    });

    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return { suggestion: this.fallback(messages), usedAI: false, model: null };
    }

    const transcript = messages
      .map((message) => `${message.senderType === ParticipantType.VISITOR ? "Customer" : "Agent"}: ${message.body ?? ""}`)
      .join("\n");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: SUGGESTION_MODEL,
          max_tokens: 300,
          system:
            "You are a helpful, friendly customer-support agent. Draft the agent's next reply to the customer in 1-3 short sentences. Be warm and concise. Reply with ONLY the message text — no preamble, no quotes, no 'Agent:' prefix.",
          messages: [
            {
              role: "user",
              content: `Conversation so far:\n${transcript || "(no messages yet)"}\n\nDraft the agent's next reply.`
            }
          ]
        })
      });

      if (!response.ok) {
        return { suggestion: this.fallback(messages), usedAI: false, model: null };
      }

      const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = Array.isArray(data.content)
        ? data.content
            .filter((block) => block.type === "text" && typeof block.text === "string")
            .map((block) => block.text)
            .join("")
            .trim()
        : "";

      return {
        suggestion: text || this.fallback(messages),
        usedAI: Boolean(text),
        model: text ? SUGGESTION_MODEL : null
      };
    } catch {
      return { suggestion: this.fallback(messages), usedAI: false, model: null };
    }
  }

  /** Heuristic reply used when no AI key is configured or the call fails. */
  private fallback(messages: Message[]): string {
    const lastVisitor = [...messages]
      .reverse()
      .find((message) => message.senderType === ParticipantType.VISITOR && message.body);

    if (!lastVisitor || !lastVisitor.body) {
      return "Hi! Thanks for reaching out. How can I help you today?";
    }

    return `Thanks for your message! Let me help you with that. Could you share a little more detail so I can assist you better?`;
  }
}
