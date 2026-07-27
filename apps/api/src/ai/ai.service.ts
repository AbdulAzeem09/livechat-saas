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

/**
 * Optional "legal firm mode" that turns the receptionist into a compliant legal
 * intake assistant. Stored on Organization.metadata.legalIntake (no dedicated
 * table). When disabled the receptionist behaves exactly as before.
 */
export interface LegalIntakeSettings {
  enabled: boolean;
  firmName: string;
  /** States/jurisdictions the firm is licensed in (for the jurisdiction check). */
  licensedStates: string[];
  /** Practice areas the firm handles (PI, Family, Estate, Immigration, …). */
  practiceAreas: string[];
  /** Opposing-party / entity names to flag during conflict pre-screening. */
  conflictNames: string[];
  /** No-attorney-client-relationship disclaimer shown + timestamped to visitors. */
  disclaimer: string;
  /** Respond in English and Spanish. */
  bilingual: boolean;
}

const DEFAULT_LEGAL_SETTINGS: LegalIntakeSettings = {
  enabled: false,
  firmName: "",
  licensedStates: [],
  practiceAreas: [],
  conflictNames: [],
  disclaimer:
    "I'm an automated intake assistant, not an attorney. This chat does not create an attorney-client relationship and nothing here is legal advice.",
  bilingual: true
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
    const metadata = await this.loadOrgMetadata(organizationId);
    return this.readSettings(metadata);
  }

  async getLegalSettings(organizationId: string): Promise<LegalIntakeSettings> {
    const metadata = await this.loadOrgMetadata(organizationId);
    return this.readLegalSettings(metadata);
  }

  private async loadOrgMetadata(organizationId: string): Promise<unknown> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { metadata: true }
    });
    return org?.metadata;
  }

  private readLegalSettings(metadata: unknown): LegalIntakeSettings {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return { ...DEFAULT_LEGAL_SETTINGS };
    }
    const raw = (metadata as Record<string, unknown>).legalIntake;
    if (!raw || typeof raw !== "object") {
      return { ...DEFAULT_LEGAL_SETTINGS };
    }
    const r = raw as Record<string, unknown>;
    const strList = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
        : [];
    return {
      enabled: r.enabled === true,
      firmName: typeof r.firmName === "string" ? r.firmName.trim() : DEFAULT_LEGAL_SETTINGS.firmName,
      licensedStates: strList(r.licensedStates),
      practiceAreas: strList(r.practiceAreas),
      conflictNames: strList(r.conflictNames),
      disclaimer:
        typeof r.disclaimer === "string" && r.disclaimer.trim() ? r.disclaimer.trim() : DEFAULT_LEGAL_SETTINGS.disclaimer,
      bilingual: r.bilingual !== false
    };
  }

  /** Build the strict guardrail preamble used whenever legal firm mode is on. */
  private legalPreamble(legal: LegalIntakeSettings, assistantName: string): string {
    const firm = legal.firmName || "the law firm";
    const areas = legal.practiceAreas.length ? legal.practiceAreas.join(", ") : "various practice areas";
    const states = legal.licensedStates.length ? legal.licensedStates.join(", ") : "the firm's licensed states";
    return [
      `You are ${assistantName}, a legal intake assistant for ${firm}. You are NOT an attorney.`,
      "ABSOLUTE RULES (never break these):",
      "- NEVER give legal advice, legal opinions, case strategy, or predict outcomes. If the visitor asks a legal question, politely decline and offer to collect their details for an attorney to review.",
      "- Never state or imply that an attorney-client relationship exists. This chat is intake only.",
      `- You may only: greet, answer general firm FAQs from the knowledge provided, collect intake details, and offer to connect a human or book a consultation.`,
      legal.bilingual ? "- Reply in the visitor's language — English or Spanish." : "",
      `Firm practice areas: ${areas}. Licensed jurisdictions: ${states}.`,
      "Keep replies short (1-4 sentences), warm, and professional."
    ]
      .filter(Boolean)
      .join("\n");
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

    const metadata = await this.loadOrgMetadata(organizationId);
    const settings = this.readSettings(metadata);
    const legal = this.readLegalSettings(metadata);
    const lastQuestion = this.lastVisitorText(messages);
    const knowledge = await this.retrieveKnowledge(organizationId, lastQuestion);
    const transcript = this.transcript(messages);

    const persona = legal.enabled
      ? this.legalPreamble(legal, settings.name)
      : `You are ${settings.name}, a ${settings.tone} customer-support agent.`;

    const system = [
      persona,
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
    const metadata = await this.loadOrgMetadata(organizationId);
    const settings = this.readSettings(metadata);
    const legal = this.readLegalSettings(metadata);
    const knowledge = await this.retrieveKnowledge(organizationId, question);

    if (!apiKey) {
      return { answer: "", confident: false, usedAI: false, model: null };
    }

    // Legal intake mode: the assistant engages even without matching knowledge
    // (collecting details is its job) but is hard-guarded against legal advice.
    if (legal.enabled) {
      const system = [
        this.legalPreamble(legal, settings.name),
        knowledge
          ? `Use ONLY the firm knowledge below for any factual answer; never invent facts.\n--- FIRM KNOWLEDGE ---\n${knowledge}\n--- END KNOWLEDGE ---`
          : "You have no firm knowledge for this question — do not make anything up; offer to collect details or connect a human.",
        `If you genuinely cannot help and no human is warranted, reply with EXACTLY: ${UNKNOWN_MARKER}`
      ].join("\n\n");
      const text = await this.callClaude(apiKey, system, `Visitor said: ${question}`);
      if (text === null || !text || text.includes(UNKNOWN_MARKER)) {
        return { answer: "", confident: false, usedAI: text !== null, model: null };
      }
      return { answer: text, confident: true, usedAI: true, model: SUGGESTION_MODEL };
    }

    // Standard mode: only answer when the knowledge base covers the question.
    if (!knowledge) {
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
