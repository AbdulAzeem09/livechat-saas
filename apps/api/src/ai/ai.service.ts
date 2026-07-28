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
  /** True when the visitor asked for a human — the AI should stop and hand off. */
  handoff: boolean;
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
  /** Calendly/Cal.com URL the assistant offers qualified leads to book a consult. */
  bookingUrl: string;
}

const DEFAULT_LEGAL_SETTINGS: LegalIntakeSettings = {
  enabled: false,
  firmName: "",
  licensedStates: [],
  practiceAreas: [],
  conflictNames: [],
  disclaimer:
    "I'm an automated intake assistant, not an attorney. This chat does not create an attorney-client relationship and nothing here is legal advice.",
  bilingual: true,
  bookingUrl: ""
};

/** Structured facts the AI pulls out of a legal-intake conversation. */
export interface IntakeFields {
  clientName: string | null;
  contact: string | null;
  practiceArea: string | null;
  /** ISO date (YYYY-MM-DD) of the incident, if the visitor gave one. */
  incidentDate: string | null;
  opposingParties: string[];
  state: string | null;
  summary: string | null;
  qualified: boolean;
}

export interface IntakeFlag {
  type: "conflict" | "jurisdiction" | "statute" | "unqualified";
  severity: "high" | "medium" | "low";
  message: string;
}

export interface IntakeAnalysis {
  fields: IntakeFields;
  flags: IntakeFlag[];
  analyzedAt: string;
}

/**
 * Default statute-of-limitations windows (years from the incident) by practice
 * area. Deliberately conservative; a firm can override per area via
 * legalIntake.statuteYears. NOT legal advice — just an intake early-warning.
 */
const DEFAULT_STATUTE_YEARS: Record<string, number> = {
  "personal injury": 2,
  "medical malpractice": 2,
  "car accident": 2,
  "product liability": 2,
  "wrongful death": 2,
  "premises liability": 2,
  defamation: 1,
  "breach of contract": 4,
  "property damage": 3,
  employment: 3
};

/** Cheap + fast model for drafting short agent reply suggestions. */
const SUGGESTION_MODEL = "claude-haiku-4-5";
/** Sentinel the model returns when the knowledge base doesn't cover the question. */
const UNKNOWN_MARKER = "[[NO_ANSWER]]";
/** Sentinel the model appends when the visitor asks to speak with a human. */
const HANDOFF_MARKER = "[[HANDOFF]]";

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
    // Legal mode only actually engages when BOTH the toggle is on AND the paid
    // "legal" add-on is active (organization.metadata.addons.legal === true).
    const addons = (metadata as Record<string, unknown>).addons;
    const addonActive =
      !!addons && typeof addons === "object" && !Array.isArray(addons)
        ? (addons as Record<string, unknown>).legal === true
        : false;
    return {
      enabled: r.enabled === true && addonActive,
      firmName: typeof r.firmName === "string" ? r.firmName.trim() : DEFAULT_LEGAL_SETTINGS.firmName,
      licensedStates: strList(r.licensedStates),
      practiceAreas: strList(r.practiceAreas),
      conflictNames: strList(r.conflictNames),
      disclaimer:
        typeof r.disclaimer === "string" && r.disclaimer.trim() ? r.disclaimer.trim() : DEFAULT_LEGAL_SETTINGS.disclaimer,
      bilingual: r.bilingual !== false,
      bookingUrl: typeof r.bookingUrl === "string" ? r.bookingUrl.trim() : ""
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
      legal.bookingUrl
        ? `- Once you have the visitor's name, contact, and a short description of their matter, invite them to book a consultation at this link: ${legal.bookingUrl}`
        : "",
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

  async answerFromKnowledge(
    organizationId: string,
    conversationId: string,
    question: string
  ): Promise<AiAnswer> {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    const metadata = await this.loadOrgMetadata(organizationId);
    const settings = this.readSettings(metadata);
    const legal = this.readLegalSettings(metadata);
    const knowledge = await this.retrieveKnowledge(organizationId, question);

    if (!apiKey) {
      return { answer: "", confident: false, usedAI: false, model: null, handoff: false };
    }

    // Legal intake mode: the assistant ALWAYS engages — it greets, answers firm
    // FAQs from knowledge, and progressively collects intake details. It only
    // stays silent for clear spam. Hard-guarded against giving legal advice.
    if (legal.enabled) {
      const messages = await this.recentMessages(organizationId, conversationId);
      const transcript = this.transcript(messages);
      const system = [
        this.legalPreamble(legal, settings.name),
        "ALWAYS reply with a helpful message — never stay silent. If this is the start, greet the visitor warmly, briefly say you'll take down their details so an attorney can review the matter, and ask the first question.",
        "Your job is a THOROUGH intake interview: keep asking questions, ONE or TWO at a time, until you have gathered ALL of the details below. Do not stop early. Acknowledge each answer briefly, then ask the next missing detail. Never ask for something the visitor already told you.",
        [
          "Intake checklist — collect every applicable item:",
          "1. Full legal name",
          "2. Best phone number and email, and preferred contact method/time",
          "3. Type of legal matter / practice area",
          "4. A clear description of what happened (in their own words)",
          "5. Key dates — when it happened, and any deadlines or upcoming court dates",
          "6. Location — the state, county, and city where it happened",
          "7. The other/opposing party's full name(s) (person or company)",
          "8. Is there an existing case? If yes: the case/docket number and the court name",
          "9. Do they currently have, or have they ever had, an attorney on this matter?",
          "10. Injuries and medical treatment so far, and any insurance involved (for injury/accident matters)",
          "11. Any documents, police reports, or evidence they have",
          "12. What outcome or goal they are hoping for"
        ].join("\n"),
        "Tailor which items you ask about to the type of matter (e.g. ask about injuries/insurance for a car accident; opposing party and dates for family/estate). Skip items that clearly don't apply.",
        "You are ONLY collecting information — never analyze the case, never tell them what to do, never predict outcomes, never say whether they have a good case. If they ask for advice, gently say an attorney will review the details, and continue the intake.",
        `If the visitor asks to speak with a human, a live agent, a real person, a representative, or an attorney directly (or says they don't want to answer more questions), STOP the intake. Reply briefly and warmly that you're connecting them with a team member who will follow up shortly, and end your entire message with the token ${HANDOFF_MARKER}`,
        knowledge
          ? `Answer general firm questions (hours, fees, locations) using ONLY the firm knowledge below; never invent facts.\n--- FIRM KNOWLEDGE ---\n${knowledge}\n--- END KNOWLEDGE ---`
          : "You have no firm knowledge articles yet — do not invent facts about the firm; focus on the intake interview.",
        legal.bookingUrl
          ? `Once you have collected the key details (at least name, contact, matter type, description, and dates), thank them, let them know an attorney will review everything, and invite them to book a consultation at ${legal.bookingUrl}.`
          : "Once you have collected the key details, thank them and let them know an attorney will review everything and follow up.",
        `Keep each reply short (1-3 sentences + the next question). Reply with ONLY the message text (no preamble, no quotes). Only if the visitor's message is clearly spam or abuse, reply with EXACTLY: ${UNKNOWN_MARKER}`
      ]
        .filter(Boolean)
        .join("\n\n");
      const text = await this.callClaude(
        apiKey,
        system,
        `Conversation so far:\n${transcript || `Customer: ${question}`}\n\nWrite the intake assistant's next reply.`
      );
      if (text === null || !text || text.includes(UNKNOWN_MARKER)) {
        return { answer: "", confident: false, usedAI: text !== null, model: null, handoff: false };
      }
      const handoff = text.includes(HANDOFF_MARKER);
      const clean = text.replace(HANDOFF_MARKER, "").trim();
      return { answer: clean, confident: clean.length > 0, usedAI: true, model: SUGGESTION_MODEL, handoff };
    }

    // Standard mode: only answer when the knowledge base covers the question.
    if (!knowledge) {
      return { answer: "", confident: false, usedAI: false, model: null, handoff: false };
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
      return { answer: "", confident: false, usedAI: text !== null, model: null, handoff: false };
    }
    return { answer: text, confident: true, usedAI: true, model: SUGGESTION_MODEL, handoff: false };
  }

  // ---------------------------------------------------------------------------
  // Legal intake analysis: extract structured facts + run conflict / jurisdiction
  // / statute-of-limitations checks. Persisted on conversation.metadata so agents
  // see it. Deterministic checks in code; only the extraction uses the model.
  // ---------------------------------------------------------------------------

  async analyzeIntake(organizationId: string, conversationId: string): Promise<IntakeAnalysis | null> {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    const legal = await this.getLegalSettings(organizationId);
    if (!apiKey || !legal.enabled) {
      return null;
    }

    const messages = await this.recentMessages(organizationId, conversationId);
    const transcript = this.transcript(messages);
    if (!transcript.trim()) {
      return null;
    }

    const system = [
      "You extract structured intake facts from a legal intake chat. You are NOT giving legal advice.",
      "Return ONLY a JSON object (no prose, no code fences) with exactly these keys:",
      '{"clientName": string|null, "contact": string|null, "practiceArea": string|null, "incidentDate": string|null, "opposingParties": string[], "state": string|null, "summary": string|null, "qualified": boolean}',
      "- incidentDate must be ISO YYYY-MM-DD or null (infer the year if the visitor gives a relative date; otherwise null).",
      "- opposingParties: names of the other side(s) mentioned, else [].",
      "- state: the US state/jurisdiction of the matter if stated, else null.",
      "- practiceArea: e.g. Personal Injury, Family, Estate, Immigration, Employment — else null.",
      "- qualified: false only if it's clearly spam or not a legal matter.",
      "If a field is unknown, use null (or [] for opposingParties). Output JSON only."
    ].join("\n");

    const raw = await this.callClaude(apiKey, system, `Conversation:\n${transcript}\n\nExtract the JSON.`);
    const fields = this.parseIntakeFields(raw);
    if (!fields) {
      return null;
    }

    const flags = this.computeIntakeFlags(fields, legal);
    const analysis: IntakeAnalysis = {
      fields,
      flags,
      analyzedAt: new Date().toISOString()
    };

    // Persist onto the conversation metadata (merge — never clobber tags etc.).
    try {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: conversationId, organizationId },
        select: { metadata: true }
      });
      const metadata =
        conversation?.metadata && typeof conversation.metadata === "object" && !Array.isArray(conversation.metadata)
          ? (conversation.metadata as Record<string, unknown>)
          : {};
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { metadata: { ...metadata, legalIntake: analysis } as object }
      });
    } catch {
      // persistence is best-effort; still return the analysis to the caller
    }

    return analysis;
  }

  private parseIntakeFields(raw: string | null): IntakeFields | null {
    if (!raw) {
      return null;
    }
    // Strip code fences / stray text and grab the first {...} block.
    const match = raw.replace(/```json|```/gi, "").match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
    const str = (value: unknown): string | null =>
      typeof value === "string" && value.trim() ? value.trim() : null;
    return {
      clientName: str(parsed.clientName),
      contact: str(parsed.contact),
      practiceArea: str(parsed.practiceArea),
      incidentDate: str(parsed.incidentDate),
      opposingParties: Array.isArray(parsed.opposingParties)
        ? parsed.opposingParties.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
        : [],
      state: str(parsed.state),
      summary: str(parsed.summary),
      qualified: parsed.qualified !== false
    };
  }

  private computeIntakeFlags(fields: IntakeFields, legal: LegalIntakeSettings): IntakeFlag[] {
    const flags: IntakeFlag[] = [];

    // Conflict pre-screening: opposing party matches the firm's conflict list.
    for (const opposing of fields.opposingParties) {
      const hit = legal.conflictNames.find(
        (name) =>
          name.toLowerCase().includes(opposing.toLowerCase()) ||
          opposing.toLowerCase().includes(name.toLowerCase())
      );
      if (hit) {
        flags.push({
          type: "conflict",
          severity: "high",
          message: `Possible conflict: opposing party "${opposing}" matches the firm's conflict list ("${hit}").`
        });
      }
    }

    // Jurisdiction check: matter's state is outside the firm's licensed states.
    if (fields.state && legal.licensedStates.length > 0) {
      const licensed = legal.licensedStates.some(
        (s) => s.toLowerCase() === fields.state!.toLowerCase()
      );
      if (!licensed) {
        flags.push({
          type: "jurisdiction",
          severity: "medium",
          message: `Jurisdiction: matter is in ${fields.state}, outside the firm's licensed states (${legal.licensedStates.join(", ")}).`
        });
      }
    }

    // Statute-of-limitations early warning from the incident date + practice area.
    if (fields.incidentDate && fields.practiceArea) {
      const years = this.statuteYearsFor(fields.practiceArea, legal);
      const incident = new Date(fields.incidentDate);
      if (years && !Number.isNaN(incident.getTime())) {
        const deadline = new Date(incident);
        deadline.setFullYear(deadline.getFullYear() + years);
        const now = new Date();
        const daysLeft = Math.round((deadline.getTime() - now.getTime()) / 86400000);
        if (daysLeft < 0) {
          flags.push({
            type: "statute",
            severity: "high",
            message: `Statute of limitations may have PASSED: ~${years}yr window from ${fields.incidentDate} ended ${deadline.toISOString().slice(0, 10)}.`
          });
        } else if (daysLeft <= 180) {
          flags.push({
            type: "statute",
            severity: "high",
            message: `Statute of limitations approaching: ~${daysLeft} days left (est. deadline ${deadline.toISOString().slice(0, 10)}).`
          });
        }
      }
    }

    if (!fields.qualified) {
      flags.push({ type: "unqualified", severity: "low", message: "Enquiry looks unqualified or off-topic." });
    }

    return flags;
  }

  private statuteYearsFor(practiceArea: string, legal: LegalIntakeSettings): number | null {
    const key = practiceArea.toLowerCase().trim();
    const override = (legal as unknown as { statuteYears?: Record<string, number> }).statuteYears;
    if (override && typeof override[key] === "number") {
      return override[key];
    }
    if (typeof DEFAULT_STATUTE_YEARS[key] === "number") {
      return DEFAULT_STATUTE_YEARS[key];
    }
    // Fuzzy: match on a keyword contained in the area name.
    const found = Object.keys(DEFAULT_STATUTE_YEARS).find((area) => key.includes(area) || area.includes(key));
    return found ? DEFAULT_STATUTE_YEARS[found]! : null;
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
