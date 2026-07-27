import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KnowledgeArticle, Message, MessageVisibility, ParticipantType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AiSuggestion {
  suggestion: string;
  usedAI: boolean;
  model: string | null;
}

/**
 * A grounded answer produced by the AI receptionist from the org's knowledge.
 * `confident` is false when the knowledge did not cover the question — the caller
 * should then hand the visitor over to a human instead of posting the answer.
 */
export interface AiAnswer {
  answer: string;
  confident: boolean;
  usedAI: boolean;
  model: string | null;
}

/** How the AI receptionist behaves for an organization. */
export type AiMode = "off" | "suggest" | "auto";

export interface AiSettings {
  /** off = disabled, suggest = draft for agents only, auto = reply to visitors directly. */
  mode: AiMode;
  /** Display name the assistant introduces itself as. */
  name: string;
  /** Freeform persona/tone hint mixed into the system prompt. */
  tone: string;
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  mode: "off",
  name: "Assistant",
  tone: "friendly and professional"
};

/** Cheap + fast model for drafting short agent reply suggestions. */
const SUGGESTION_MODEL = "claude-haiku-4-5";
/** Sentinel the model returns when the knowledge base doesn't cover the question. */
const UNKNOWN_MARKER = "[[NO_ANSWER]]";

@Injectable()
export class AiService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  // ---------------------------------------------------------------------------
  // Settings (stored on Organization.metadata.aiReceptionist — no dedicated table)
  // ---------------------------------------------------------------------------

  async getSettings(organizationId: string): Promise<AiSettings> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { metadata: true }
    });
    return this.readSettings(org?.metadata);
  }

  private readSettings(metadata: unknown): AiSettings {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return { ...DEFAULT_AI_SETTINGS };
    }
    const raw = (metadata as Record<string, unknown>).aiReceptionist;
    if (!raw || typeof raw !== "object") {
      return { ...DEFAULT_AI_SETTINGS };
    }
    const r = raw as Record<string, unknown>;
    const mode = r.mode === "suggest" || r.mode === "auto" || r.mode === "off" ? r.mode : DEFAULT_AI_SETTINGS.mode;
    return {
      mode,
      name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : DEFAULT_AI_SETTINGS.name,
      tone: typeof r.tone === "string" && r.tone.trim() ? r.tone.trim() : DEFAULT_AI_SETTINGS.tone
    };
  }

  // ---------------------------------------------------------------------------
  // Agent-facing: draft a reply suggestion (Copilot), grounded in knowledge.
  // ---------------------------------------------------------------------------

  async suggestReply(organizationId: string, conversationId: string): Promise<AiSuggestion> {
    const messages = await this.recentMessages(organizationId, conversationId);
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return { suggestion: this.fallback(messages), usedAI: false, model: null };
    }

    const settings = await this.getSettings(organizationId);
    const lastQuestion = this.lastVisitorText(messages);
    const knowledge = await this.retrieveKnowledge(organizationId, lastQuestion);
    const transcript = this.transcript(messages);

    const system = [
      `You are ${settings.name}, a ${settings.tone} customer-support agent.`,
      "Draft the agent's next reply to the customer in 1-3 short sentences. Be warm and concise.",
      knowledge
        ? `Use ONLY the business knowledge below when it is relevant; do not invent facts.\n\n--- BUSINESS KNOWLEDGE ---\n${knowledge}\n--- END KNOWLEDGE ---`
        : "",
      "Reply with ONLY the message text — no preamble, no quotes, no 'Agent:' prefix."
    ]
      .filter(Boolean)
      .join("\n\n");

    const text = await this.callClaude(apiKey, system, `Conversation so far:\n${transcript || "(no messages yet)"}\n\nDraft the agent's next reply.`);
    if (text === null) {
      return { suggestion: this.fallback(messages), usedAI: false, model: null };
    }
    return {
      suggestion: text || this.fallback(messages),
      usedAI: Boolean(text),
      model: text ? SUGGESTION_MODEL : null
    };
  }

  // ---------------------------------------------------------------------------
  // Visitor-facing: answer a question strictly from the org's knowledge.
  // ---------------------------------------------------------------------------

  async answerFromKnowledge(organizationId: string, question: string): Promise<AiAnswer> {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    const settings = await this.getSettings(organizationId);
    const knowledge = await this.retrieveKnowledge(organizationId, question);

    // No knowledge or no AI key → not confident; caller hands off to a human.
    if (!knowledge || !apiKey) {
      return { answer: "", confident: false, usedAI: false, model: null };
    }

    const system = [
      `You are ${settings.name}, a ${settings.tone} AI receptionist answering website visitors on behalf of this business.`,
      "Answer the visitor's question using ONLY the business knowledge below. Do NOT use outside knowledge or make anything up.",
      `If the knowledge does not clearly answer the question, reply with EXACTLY this token and nothing else: ${UNKNOWN_MARKER}`,
      "Otherwise answer directly in 1-4 short, friendly sentences. Do not mention 'the knowledge' or that you are an AI.",
      `--- BUSINESS KNOWLEDGE ---\n${knowledge}\n--- END KNOWLEDGE ---`
    ].join("\n\n");

    const text = await this.callClaude(apiKey, system, `Visitor's question: ${question}`);
    if (text === null || !text || text.includes(UNKNOWN_MARKER)) {
      return { answer: "", confident: false, usedAI: text !== null, model: null };
    }
    return { answer: text, confident: true, usedAI: true, model: SUGGESTION_MODEL };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Pull the most relevant published knowledge articles and flatten to text. */
  private async retrieveKnowledge(organizationId: string, question: string): Promise<string> {
    const words = (question || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 10);

    const where = words.length
      ? {
          organizationId,
          published: true,
          OR: words.flatMap((word) => [
            { title: { contains: word, mode: "insensitive" as const } },
            { content: { contains: word, mode: "insensitive" as const } }
          ])
        }
      : { organizationId, published: true };

    const articles = await this.prisma.knowledgeArticle.findMany({
      where,
      orderBy: { views: "desc" },
      take: 6
    });

    return articles.map((a: KnowledgeArticle) => `# ${a.title}\n${a.content}`.trim()).join("\n\n").slice(0, 12000);
  }

  private async recentMessages(organizationId: string, conversationId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: {
        organizationId,
        conversationId,
        visibility: MessageVisibility.PUBLIC,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" },
      take: 20
    });
  }

  private transcript(messages: Message[]): string {
    return messages
      .map(
        (message) =>
          `${message.senderType === ParticipantType.VISITOR ? "Customer" : "Agent"}: ${message.body ?? ""}`
      )
      .join("\n");
  }

  private lastVisitorText(messages: Message[]): string {
    const last = [...messages]
      .reverse()
      .find((message) => message.senderType === ParticipantType.VISITOR && message.body);
    return last?.body ?? "";
  }

  /** POST to the Anthropic API; returns trimmed text, "" on empty, or null on failure. */
  private async callClaude(apiKey: string, system: string, userText: string): Promise<string | null> {
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
          max_tokens: 400,
          system,
          messages: [{ role: "user", content: userText }]
        })
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
      return Array.isArray(data.content)
        ? data.content
            .filter((block) => block.type === "text" && typeof block.text === "string")
            .map((block) => block.text)
            .join("")
            .trim()
        : "";
    } catch {
      return null;
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
