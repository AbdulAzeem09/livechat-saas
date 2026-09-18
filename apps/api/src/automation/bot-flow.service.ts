import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { BotFlow, Prisma } from "@prisma/client";
import { ContactsService } from "../contacts/contacts.service";
import { PrismaService } from "../prisma/prisma.service";

export type FlowNodeType = "message" | "question" | "collect" | "condition" | "handoff" | "end";

export interface FlowChoice {
  label: string;
  next?: string | null;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  /** What the bot says at this step. */
  text?: string;
  /** Buttons shown for a question step. */
  choices?: FlowChoice[];
  /** Which customer detail a collect step saves. */
  field?: "name" | "email" | "phone" | "company";
  /** Words a condition step looks for in the visitor's message. */
  keywords?: string[];
  next?: string | null;
  /** Condition branches. */
  whenMatch?: string | null;
  otherwise?: string | null;
  /** Where the card sits on the builder canvas. */
  x?: number;
  y?: number;
}

export interface BotFlowDto {
  id: string;
  name: string;
  isActive: boolean;
  startNodeId: string | null;
  nodes: FlowNode[];
  createdAt: Date;
  updatedAt: Date;
}

/** State kept on the conversation while a visitor is walking through a flow. */
interface FlowState {
  flowId: string;
  nodeId: string;
  awaiting: "choice" | "text";
}

const NODE_TYPES: FlowNodeType[] = ["message", "question", "collect", "condition", "handoff", "end"];
/** Stops a badly wired flow (a loop) from posting messages forever. */
const MAX_STEPS_PER_TURN = 12;

/**
 * The chatbot people actually draw: connected steps rather than a list of keywords.
 * A flow asks questions, branches on the answer, saves details onto the customer
 * record, and hands over to a human when it runs out of road.
 */
@Injectable()
export class BotFlowService {
  private readonly logger = new Logger(BotFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService
  ) {}

  // ---------------------------------------------------------------- management

  async list(organizationId: string): Promise<BotFlowDto[]> {
    const flows = await this.prisma.botFlow.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    });

    return flows.map((flow) => this.map(flow));
  }

  async get(organizationId: string, flowId: string): Promise<BotFlowDto> {
    return this.map(await this.getOrThrow(organizationId, flowId));
  }

  async create(organizationId: string, name: string): Promise<BotFlowDto> {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new BadRequestException("Give the chatbot a name");
    }

    // A new flow starts with a greeting and a question, so the canvas is never empty.
    const greeting: FlowNode = {
      id: "start",
      type: "message",
      text: "Hi! I'm the Acme assistant. I can help with a few things.",
      next: "ask",
      x: 60,
      y: 60
    };
    const question: FlowNode = {
      id: "ask",
      type: "question",
      text: "What can I help you with?",
      choices: [
        { label: "Sales question", next: "handover" },
        { label: "Something else", next: "handover" }
      ],
      x: 60,
      y: 220
    };
    const handover: FlowNode = {
      id: "handover",
      type: "handoff",
      text: "Let me get a colleague to help you — one moment.",
      x: 60,
      y: 400
    };

    const flow = await this.prisma.botFlow.create({
      data: {
        organizationId,
        name: trimmed.slice(0, 120),
        startNodeId: greeting.id,
        nodes: [greeting, question, handover] as unknown as Prisma.InputJsonValue
      }
    });

    return this.map(flow);
  }

  async update(
    organizationId: string,
    flowId: string,
    input: { name?: string; isActive?: boolean; startNodeId?: string | null; nodes?: FlowNode[] }
  ): Promise<BotFlowDto> {
    const flow = await this.getOrThrow(organizationId, flowId);
    const nodes = input.nodes ? this.validateNodes(input.nodes) : this.nodesOf(flow);
    const startNodeId =
      input.startNodeId !== undefined ? input.startNodeId : flow.startNodeId;

    if (startNodeId && !nodes.some((node) => node.id === startNodeId)) {
      throw new BadRequestException("The first step points at a step that no longer exists");
    }

    // Only one chatbot answers visitors at a time.
    if (input.isActive === true) {
      if (!nodes.length || !startNodeId) {
        throw new BadRequestException("Add at least one step before switching the chatbot on");
      }

      await this.prisma.botFlow.updateMany({
        where: { organizationId, id: { not: flowId } },
        data: { isActive: false }
      });
    }

    const updated = await this.prisma.botFlow.update({
      where: { id: flow.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        startNodeId,
        ...(input.nodes ? { nodes: nodes as unknown as Prisma.InputJsonValue } : {})
      }
    });

    return this.map(updated);
  }

  async remove(organizationId: string, flowId: string): Promise<{ success: true }> {
    const flow = await this.getOrThrow(organizationId, flowId);
    await this.prisma.botFlow.delete({ where: { id: flow.id } });

    return { success: true };
  }

  // ------------------------------------------------------------------- runtime

  /**
   * Walk the active flow one turn. Returns true when the flow handled the message,
   * so keyword rules and the AI stay out of the way.
   */
  async handleVisitorMessage(
    organizationId: string,
    conversationId: string,
    body: string,
    options: {
      isFirstMessage: boolean;
      say: (text: string, metadata?: Record<string, unknown>) => Promise<void>;
      handOver: () => Promise<void>;
    }
  ): Promise<boolean> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      select: { metadata: true, visitorId: true, contactId: true }
    });

    if (!conversation) {
      return false;
    }

    const metadata = this.toRecord(conversation.metadata);

    // Once a human has taken over, the bot stays quiet.
    if (metadata.aiPaused === true) {
      return false;
    }

    const state = this.readState(metadata);
    const flow = state
      ? await this.prisma.botFlow.findFirst({ where: { id: state.flowId, organizationId } })
      : await this.prisma.botFlow.findFirst({ where: { organizationId, isActive: true } });

    if (!flow || !flow.isActive) {
      return false;
    }

    const nodes = new Map(this.nodesOf(flow).map((node) => [node.id, node]));
    let nextNodeId: string | null | undefined;

    if (state) {
      const current = nodes.get(state.nodeId);
      if (!current) {
        await this.clearState(conversationId, metadata);
        return false;
      }

      nextNodeId = await this.resolveAnswer(current, body, {
        organizationId,
        conversationId,
        visitorId: conversation.visitorId,
        contactId: conversation.contactId,
        say: options.say
      });

      // The answer did not match any button: ask again, don't lose the visitor.
      if (nextNodeId === undefined) {
        return true;
      }
    } else {
      if (!options.isFirstMessage || !flow.startNodeId) {
        return false;
      }
      nextNodeId = flow.startNodeId;
    }

    await this.run(nextNodeId ?? null, nodes, flow, {
      organizationId,
      conversationId,
      metadata,
      body,
      say: options.say,
      handOver: options.handOver
    });

    return true;
  }

  /** Follow the flow until it needs the visitor to say something (or it ends). */
  private async run(
    startId: string | null,
    nodes: Map<string, FlowNode>,
    flow: BotFlow,
    context: {
      organizationId: string;
      conversationId: string;
      metadata: Record<string, unknown>;
      body: string;
      say: (text: string, metadata?: Record<string, unknown>) => Promise<void>;
      handOver: () => Promise<void>;
    }
  ): Promise<void> {
    let nodeId: string | null | undefined = startId;

    for (let step = 0; step < MAX_STEPS_PER_TURN; step += 1) {
      if (!nodeId) {
        await this.clearState(context.conversationId, context.metadata);
        return;
      }

      const node = nodes.get(nodeId);
      if (!node) {
        await this.clearState(context.conversationId, context.metadata);
        return;
      }

      if (node.type === "message") {
        if (node.text?.trim()) {
          await context.say(node.text.trim());
        }
        nodeId = node.next ?? null;
        continue;
      }

      if (node.type === "condition") {
        const lower = context.body.toLowerCase();
        const matched = (node.keywords ?? []).some((keyword) =>
          lower.includes(keyword.toLowerCase())
        );
        nodeId = matched ? node.whenMatch ?? null : node.otherwise ?? null;
        continue;
      }

      if (node.type === "question") {
        const choices = (node.choices ?? []).filter((choice) => choice.label.trim());
        if (node.text?.trim()) {
          await context.say(node.text.trim(), {
            choices: choices.map((choice) => choice.label.trim())
          });
        }
        await this.saveState(context.conversationId, context.metadata, {
          flowId: flow.id,
          nodeId: node.id,
          awaiting: "choice"
        });
        return;
      }

      if (node.type === "collect") {
        if (node.text?.trim()) {
          await context.say(node.text.trim());
        }
        await this.saveState(context.conversationId, context.metadata, {
          flowId: flow.id,
          nodeId: node.id,
          awaiting: "text"
        });
        return;
      }

      if (node.type === "handoff") {
        if (node.text?.trim()) {
          await context.say(node.text.trim());
        }
        await this.clearState(context.conversationId, context.metadata);
        await context.handOver();
        return;
      }

      // "end"
      if (node.text?.trim()) {
        await context.say(node.text.trim());
      }
      await this.clearState(context.conversationId, context.metadata);
      return;
    }

    this.logger.warn(`Chatbot flow ${flow.id} stopped after ${MAX_STEPS_PER_TURN} steps (loop?)`);
    await this.clearState(context.conversationId, context.metadata);
  }

  /**
   * Turn what the visitor typed into the next step.
   * Returns undefined when a question's answer did not match, so the bot can wait.
   */
  private async resolveAnswer(
    node: FlowNode,
    body: string,
    context: {
      organizationId: string;
      conversationId: string;
      visitorId: string | null;
      contactId: string | null;
      say: (text: string, metadata?: Record<string, unknown>) => Promise<void>;
    }
  ): Promise<string | null | undefined> {
    if (node.type === "question") {
      const choices = (node.choices ?? []).filter((choice) => choice.label.trim());
      const answer = body.trim().toLowerCase();
      const byNumber = Number.parseInt(answer, 10);

      const picked =
        choices.find((choice) => choice.label.trim().toLowerCase() === answer) ??
        choices.find((choice) => answer.includes(choice.label.trim().toLowerCase())) ??
        (Number.isFinite(byNumber) && byNumber >= 1 && byNumber <= choices.length
          ? choices[byNumber - 1]
          : undefined);

      if (!picked) {
        await context.say(
          `Sorry, I didn't catch that. Please pick one: ${choices
            .map((choice) => choice.label.trim())
            .join(", ")}`,
          { choices: choices.map((choice) => choice.label.trim()) }
        );
        return undefined;
      }

      return picked.next ?? null;
    }

    if (node.type === "collect") {
      await this.saveCollected(node.field ?? "name", body.trim(), context);
      return node.next ?? null;
    }

    return node.next ?? null;
  }

  /** Save what the visitor typed onto their visitor record and customer card. */
  private async saveCollected(
    field: "name" | "email" | "phone" | "company",
    value: string,
    context: { organizationId: string; visitorId: string | null }
  ): Promise<void> {
    const clean = value.slice(0, 160).trim();

    if (!clean || !context.visitorId) {
      return;
    }

    if (field !== "company") {
      await this.prisma.visitor
        .update({ where: { id: context.visitorId }, data: { [field]: clean } })
        .catch(() => undefined);
    }

    await this.contacts
      .linkVisitorToContact({
        organizationId: context.organizationId,
        visitorId: context.visitorId,
        [field]: clean
      })
      .catch(() => undefined);
  }

  // --------------------------------------------------------------- state + map

  private readState(metadata: Record<string, unknown>): FlowState | null {
    const state = metadata.botFlow;

    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return null;
    }

    const record = state as Record<string, unknown>;

    return typeof record.flowId === "string" && typeof record.nodeId === "string"
      ? {
          flowId: record.flowId,
          nodeId: record.nodeId,
          awaiting: record.awaiting === "text" ? "text" : "choice"
        }
      : null;
  }

  private async saveState(
    conversationId: string,
    metadata: Record<string, unknown>,
    state: FlowState
  ): Promise<void> {
    metadata.botFlow = state;
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...metadata, botFlow: { ...state } } }
    });
  }

  private async clearState(
    conversationId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const rest = { ...metadata };
    delete rest.botFlow;
    delete metadata.botFlow;

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: rest as Prisma.InputJsonValue }
    });
  }

  private validateNodes(nodes: FlowNode[]): FlowNode[] {
    if (nodes.length > 100) {
      throw new BadRequestException("A chatbot can have at most 100 steps");
    }

    const ids = new Set<string>();

    return nodes.map((node) => {
      const id = String(node.id ?? "").trim();

      if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
        throw new BadRequestException("Every step needs a simple id");
      }
      if (ids.has(id)) {
        throw new BadRequestException(`Two steps share the id "${id}"`);
      }
      ids.add(id);

      if (!NODE_TYPES.includes(node.type)) {
        throw new BadRequestException(`"${node.type}" is not a kind of step`);
      }

      return {
        id,
        type: node.type,
        ...(node.text !== undefined ? { text: String(node.text).slice(0, 2000) } : {}),
        ...(node.choices
          ? {
              choices: node.choices.slice(0, 10).map((choice) => ({
                label: String(choice.label ?? "").slice(0, 80),
                next: choice.next ?? null
              }))
            }
          : {}),
        ...(node.field ? { field: node.field } : {}),
        ...(node.keywords
          ? { keywords: node.keywords.slice(0, 20).map((keyword) => String(keyword).slice(0, 60)) }
          : {}),
        ...(node.next !== undefined ? { next: node.next } : {}),
        ...(node.whenMatch !== undefined ? { whenMatch: node.whenMatch } : {}),
        ...(node.otherwise !== undefined ? { otherwise: node.otherwise } : {}),
        x: Number.isFinite(node.x) ? Number(node.x) : 0,
        y: Number.isFinite(node.y) ? Number(node.y) : 0
      };
    });
  }

  private nodesOf(flow: BotFlow): FlowNode[] {
    return Array.isArray(flow.nodes) ? (flow.nodes as unknown as FlowNode[]) : [];
  }

  private async getOrThrow(organizationId: string, flowId: string): Promise<BotFlow> {
    const flow = await this.prisma.botFlow.findFirst({ where: { id: flowId, organizationId } });

    if (!flow) {
      throw new NotFoundException("Chatbot not found");
    }

    return flow;
  }

  private map(flow: BotFlow): BotFlowDto {
    return {
      id: flow.id,
      name: flow.name,
      isActive: flow.isActive,
      startNodeId: flow.startNodeId,
      nodes: this.nodesOf(flow),
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt
    };
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  }
}
