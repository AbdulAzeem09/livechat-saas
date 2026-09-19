import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiService } from "./ai.service";

export type EnhancementTone = "professional" | "friendly" | "shorter";

export interface EnhancedText {
  text: string;
  /** False when the tidy-up was done by the rules below rather than a model. */
  usedAI: boolean;
  /** Shown to the agent when nothing needed changing. */
  changed: boolean;
}

const TONE_INSTRUCTIONS: Record<EnhancementTone, string> = {
  professional: "Rewrite it so it reads professionally, while keeping it warm and human.",
  friendly: "Rewrite it so it sounds friendly and approachable, without becoming casual.",
  shorter: "Say the same thing in fewer words, without losing anything the customer needs."
};

/** Chat shorthand agents type in a hurry, and what a customer should read instead. */
const SHORTHAND: Array<[RegExp, string]> = [
  [/\bu\b/gi, "you"],
  [/\bur\b/gi, "your"],
  [/\bpls\b|\bplz\b/gi, "please"],
  [/\bthx\b|\btnx\b/gi, "thanks"],
  [/\bk\b(?!\.)/gi, "OK"],
  [/\bidk\b/gi, "I'm not sure"],
  [/\bimo\b/gi, "in my opinion"],
  [/\bbtw\b/gi, "by the way"],
  [/\basap\b/gi, "as soon as possible"],
  [/\bwud\b/gi, "would"],
  [/\bcud\b/gi, "could"],
  [/\bdont\b/gi, "don't"],
  [/\bcant\b/gi, "can't"],
  [/\bwont\b/gi, "won't"],
  [/\bim\b/gi, "I'm"],
  [/\bive\b/gi, "I've"],
  [/\bi\b/g, "I"]
];

/**
 * Tidies up what an agent typed before the customer sees it. With an AI key it rewrites the
 * message in the chosen tone; without one it still fixes the things that make a reply look
 * careless — chat shorthand, a lower-case opening, a missing full stop, doubled spaces.
 */
@Injectable()
export class TextEnhancementService {
  constructor(
    private readonly config: ConfigService,
    private readonly ai: AiService
  ) {}

  async enhance(text: string, tone: EnhancementTone = "professional"): Promise<EnhancedText> {
    const original = text.trim();

    if (!original) {
      throw new BadRequestException("Write something first");
    }

    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");

    if (apiKey) {
      const system = [
        "You clean up a support agent's draft reply before the customer sees it.",
        TONE_INSTRUCTIONS[tone],
        "Fix spelling, grammar and punctuation. Keep every fact, name, number and link exactly as written.",
        "Do not add greetings, sign-offs or new promises. Reply with ONLY the improved message."
      ].join(" ");

      const improved = await this.ai.complete(apiKey, system, original);

      if (improved?.trim()) {
        const cleaned = improved.trim().replace(/^["']|["']$/g, "");

        return { text: cleaned, usedAI: true, changed: cleaned !== original };
      }
    }

    const tidied = this.tidy(original);

    return { text: tidied, usedAI: false, changed: tidied !== original };
  }

  /** The no-key path: make a hurried message presentable without changing its meaning. */
  private tidy(text: string): string {
    let result = text.replace(/\s+/g, " ").trim();

    for (const [pattern, replacement] of SHORTHAND) {
      result = result.replace(pattern, replacement);
    }

    // Capitalise the first letter of each sentence.
    result = result.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix: string, letter: string) =>
      `${prefix}${letter.toUpperCase()}`
    );

    // A reply that just stops reads as unfinished.
    if (!/[.!?]$/.test(result)) {
      result = `${result}.`;
    }

    return result;
  }
}
