import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Message, ParticipantType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "./ai.service";

export interface ConversationSummary {
  /** One paragraph an agent can read in three seconds. */
  summary: string;
  /** What the customer asked for, what was done, what is still open. */
  bullets: string[];
  suggestedNextStep: string;
  usedAI: boolean;
}

export interface TagSuggestion {
  tags: string[];
  applied: string[];
  usedAI: boolean;
}

/** Topic tags the rules-based tagger knows, so tagging works without an AI key. */
const TAG_RULES: Array<{ tag: string; words: string[] }> = [
  { tag: "billing", words: ["invoice", "billing", "charge", "refund", "payment", "card", "receipt", "subscription"] },
  { tag: "pricing", words: ["price", "pricing", "cost", "quote", "how much", "plan"] },
  { tag: "bug", words: ["error", "broken", "not working", "bug", "crash", "fails", "issue", "problem"] },
  { tag: "shipping", words: ["delivery", "shipping", "courier", "track", "dispatch", "parcel", "order status"] },
  { tag: "returns", words: ["return", "exchange", "refund", "damaged", "wrong item"] },
  { tag: "account", words: ["login", "log in", "password", "sign in", "account", "reset", "locked"] },
  { tag: "sales", words: ["demo", "trial", "buy", "purchase", "upgrade", "enterprise", "sales"] },
  { tag: "complaint", words: ["angry", "unacceptable", "terrible", "worst", "complain", "disappointed"] },
  { tag: "feature request", words: ["can you add", "feature request", "would be great if", "wish it", "suggestion"] },
  { tag: "urgent", words: ["urgent", "asap", "immediately", "right now", "emergency"] }
];

const MAX_TAGS = 5;
const INSIGHT_MODEL = "claude-sonnet-5";

/**
 * What the AI adds on top of the chat itself: a short summary an agent can read at a
 * glance, and topic tags so reports and archives are searchable. Both work without an
 * AI key — the summary is then assembled from the transcript and the tags from keywords.
 */
@Injectable()
export class ConversationInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ai: AiService
  ) {}

  async summarize(organizationId: string, conversationId: string): Promise<ConversationSummary> {
    const { messages } = await this.load(organizationId, conversationId);

    if (!messages.length) {
      return {
        summary: "Nothing has been said in this chat yet.",
        bullets: [],
        suggestedNextStep: "Say hello and ask how you can help.",
        usedAI: false
      };
    }

    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");

    if (apiKey) {
      const fromAi = await this.summarizeWithAi(apiKey, messages);
      if (fromAi) {
        await this.remember(conversationId, { summary: fromAi.summary, usedAI: true });
        return fromAi;
      }
    }

    const summary = this.summarizeFromTranscript(messages);
    await this.remember(conversationId, { summary: summary.summary, usedAI: false });

    return summary;
  }

  /**
   * Work out the chat's topics. `apply: true` writes them onto the conversation so they
   * show up in Archives and the tag-usage report.
   */
  async tag(
    organizationId: string,
    conversationId: string,
    options: { apply?: boolean } = {}
  ): Promise<TagSuggestion> {
    const { conversation, messages } = await this.load(organizationId, conversationId);
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");

    let tags: string[] = [];
    let usedAI = false;

    if (apiKey) {
      const fromAi = await this.tagWithAi(apiKey, messages);
      if (fromAi?.length) {
        tags = fromAi;
        usedAI = true;
      }
    }

    if (!tags.length) {
      tags = this.tagFromKeywords(messages);
    }

    if (!options.apply || !tags.length) {
      return { tags, applied: [], usedAI };
    }

    const metadata = this.toRecord(conversation.metadata);
    const existing = Array.isArray(metadata.tags)
      ? metadata.tags.filter((tag): tag is string => typeof tag === "string")
      : [];
    const merged = Array.from(new Set([...existing, ...tags])).slice(0, 20);

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...metadata, tags: merged } }
    });

    return { tags, applied: merged.filter((tag) => !existing.includes(tag)), usedAI };
  }

  // ------------------------------------------------------------------ AI paths

  private async summarizeWithAi(
    apiKey: string,
    messages: Message[]
  ): Promise<ConversationSummary | null> {
    const system = [
      "You summarise customer-support chats for the agent who picks them up next.",
      "Reply as JSON only: {\"summary\": string, \"bullets\": string[], \"nextStep\": string}.",
      "summary: one sentence, plain words. bullets: at most 4 short facts (what was asked, what was promised, anything still open). nextStep: what the agent should do next."
    ].join(" ");

    const raw = await this.ai.complete(apiKey, system, this.transcript(messages), INSIGHT_MODEL);
    const parsed = this.parseJson(raw);

    if (!parsed || typeof parsed.summary !== "string") {
      return null;
    }

    return {
      summary: parsed.summary.slice(0, 600),
      bullets: Array.isArray(parsed.bullets)
        ? parsed.bullets.filter((line): line is string => typeof line === "string").slice(0, 4)
        : [],
      suggestedNextStep: typeof parsed.nextStep === "string" ? parsed.nextStep.slice(0, 300) : "",
      usedAI: true
    };
  }

  private async tagWithAi(apiKey: string, messages: Message[]): Promise<string[] | null> {
    const system = [
      "You label customer-support chats by topic.",
      `Reply as JSON only: {"tags": string[]} with at most ${MAX_TAGS} short lowercase tags`,
      "(one or two words each, e.g. billing, shipping, bug). No explanations."
    ].join(" ");

    const parsed = this.parseJson(
      await this.ai.complete(apiKey, system, this.transcript(messages), INSIGHT_MODEL)
    );

    if (!parsed || !Array.isArray(parsed.tags)) {
      return null;
    }

    return parsed.tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim().toLowerCase().slice(0, 30))
      .filter(Boolean)
      .slice(0, MAX_TAGS);
  }

  // --------------------------------------------------------------- no-key paths

  /** A readable summary built from the transcript itself — no AI key needed. */
  private summarizeFromTranscript(messages: Message[]): ConversationSummary {
    const visitorMessages = messages.filter(
      (message) => message.senderType === ParticipantType.VISITOR && message.body?.trim()
    );
    const agentMessages = messages.filter(
      (message) => message.senderType !== ParticipantType.VISITOR && message.body?.trim()
    );

    const firstAsk = visitorMessages[0]?.body?.trim() ?? "";
    const lastAsk = visitorMessages[visitorMessages.length - 1]?.body?.trim() ?? "";
    const lastReply = agentMessages[agentMessages.length - 1]?.body?.trim() ?? "";
    const topics = this.tagFromKeywords(messages);

    const bullets: string[] = [];
    if (firstAsk) {
      bullets.push(`Customer opened with: "${this.shorten(firstAsk)}"`);
    }
    if (lastAsk && lastAsk !== firstAsk) {
      bullets.push(`Latest from the customer: "${this.shorten(lastAsk)}"`);
    }
    if (lastReply) {
      bullets.push(`Last reply sent: "${this.shorten(lastReply)}"`);
    }
    bullets.push(
      `${visitorMessages.length} message${visitorMessages.length === 1 ? "" : "s"} from the customer, ` +
        `${agentMessages.length} from your side.`
    );

    const summary = firstAsk
      ? `${topics.length ? `About ${topics.join(" and ")}. ` : ""}The customer asked: "${this.shorten(firstAsk)}"` +
        (agentMessages.length ? " and the team has replied." : " — nobody has replied yet.")
      : "The customer has not written anything yet.";

    const suggestedNextStep = !agentMessages.length
      ? "Reply to the customer — they are still waiting."
      : visitorMessages.length &&
          messages[messages.length - 1]?.senderType === ParticipantType.VISITOR
        ? "The customer wrote last — answer their latest message."
        : "Check whether the customer needs anything else, then resolve the chat.";

    return { summary, bullets, suggestedNextStep, usedAI: false };
  }

  /** Topic tags from the words used in the chat. */
  private tagFromKeywords(messages: Message[]): string[] {
    const text = messages
      .map((message) => message.body ?? "")
      .join(" ")
      .toLowerCase();

    return TAG_RULES.filter((rule) => rule.words.some((word) => text.includes(word)))
      .map((rule) => rule.tag)
      .slice(0, MAX_TAGS);
  }

  // ----------------------------------------------------------------- utilities

  private async load(organizationId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const messages = await this.prisma.message.findMany({
      where: { organizationId, conversationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 80
    });

    return { conversation, messages };
  }

  /** Keep the latest summary on the conversation so the panel can show it instantly. */
  private async remember(
    conversationId: string,
    input: { summary: string; usedAI: boolean }
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true }
    });
    const metadata = this.toRecord(conversation?.metadata);

    await this.prisma.conversation
      .update({
        where: { id: conversationId },
        data: {
          metadata: {
            ...metadata,
            aiSummary: { text: input.summary, usedAI: input.usedAI, at: new Date().toISOString() }
          }
        }
      })
      .catch(() => undefined);
  }

  private transcript(messages: Message[]): string {
    return messages
      .filter((message) => message.body?.trim())
      .map(
        (message) =>
          `${message.senderType === ParticipantType.VISITOR ? "Customer" : "Agent"}: ${message.body}`
      )
      .join("\n")
      .slice(0, 8000);
  }

  private parseJson(raw: string | null): Record<string, unknown> | null {
    if (!raw) {
      return null;
    }

    // Models sometimes wrap JSON in prose or a code fence.
    const match = /\{[\s\S]*\}/.exec(raw);

    try {
      return match ? (JSON.parse(match[0]) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  private shorten(text: string): string {
    const clean = text.replace(/\s+/g, " ").trim();

    return clean.length > 120 ? `${clean.slice(0, 117)}…` : clean;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  }
}
