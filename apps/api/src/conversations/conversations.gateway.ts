import { HttpException, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationAccessService } from "../organizations/organization-access.service";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { PrismaService } from "../prisma/prisma.service";
import type { ConversationDto, MessageDto } from "./dto/conversation-response.dto";

interface ChatSocketData {
  user?: AuthUser;
  organizationContext?: OrganizationRequestContext;
  visitorContext?: VisitorSocketContext;
}

interface VisitorSocketContext {
  organizationId: string;
  widgetId: string;
  visitorId: string;
  sessionToken: string;
}

interface ConversationRoomPayload {
  conversationId?: string;
}

interface TypingPayload extends ConversationRoomPayload {
  isTyping?: boolean;
  preview?: string;
}

@WebSocketGateway({
  namespace: "/chat",
  cors: {
    credentials: true,
    origin: parseSocketOrigins()
  }
})
export class ConversationsGateway {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(ConversationsGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly accessService: OrganizationAccessService,
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);

      if (!token) {
        await this.handleVisitorConnection(client);
        return;
      }

      const user = await this.authService.validateAccessToken(token);
      const organizationId = this.extractOrganizationId(client) ?? user.organizationId;

      if (!organizationId) {
        throw new Error("Missing organization context");
      }

      const context = await this.accessService.getContextOrThrow(user.userId, organizationId);

      this.accessService.assertPermissions(context, ["chat:read"]);
      this.setClientData(client, { user, organizationContext: context });
      await client.join(this.organizationRoom(organizationId));
      await client.join(this.memberRoom(context.membershipId));
      client.emit("chat.ready", {
        organizationId,
        membershipId: context.membershipId
      });
    } catch (error) {
      // Only surface our own (safe) auth messages. Never leak internal errors
      // (e.g. a Prisma "Can't reach database server …" with a file path) to the client.
      const isKnown = error instanceof HttpException;
      const message = isKnown
        ? (error as HttpException).message
        : "Couldn't connect to chat. Retrying…";
      if (!isKnown) {
        this.logger.error(
          `Socket connection error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
        );
      }
      client.emit("chat.error", { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const data = this.getClientData(client);

    if (data.organizationContext) {
      this.logger.debug(
        `Socket disconnected for membership ${data.organizationContext.membershipId}`
      );
    } else if (data.visitorContext) {
      this.logger.debug(`Visitor socket disconnected for visitor ${data.visitorContext.visitorId}`);
    }
  }

  @SubscribeMessage("conversation.join")
  async handleConversationJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ConversationRoomPayload
  ): Promise<{ ok: true; conversationId: string }> {
    const data = this.getClientData(client);
    const conversationId = this.requireConversationId(payload);

    if (data.organizationContext) {
      this.accessService.assertPermissions(data.organizationContext, ["chat:read"]);
      await this.ensureConversationAccess(data.organizationContext.organizationId, conversationId);
    } else if (data.visitorContext) {
      await this.ensureVisitorConversationAccess(data.visitorContext, conversationId);
    } else {
      throw new Error("Socket is not authenticated");
    }

    await client.join(this.conversationRoom(conversationId));

    return { ok: true, conversationId };
  }

  @SubscribeMessage("conversation.leave")
  async handleConversationLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ConversationRoomPayload
  ): Promise<{ ok: true; conversationId: string }> {
    const conversationId = this.requireConversationId(payload);

    await client.leave(this.conversationRoom(conversationId));
    return { ok: true, conversationId };
  }

  @SubscribeMessage("typing.update")
  async handleTypingUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload
  ): Promise<{ ok: true; conversationId: string }> {
    const data = this.getClientData(client);
    const conversationId = this.requireConversationId(payload);

    const isTyping = payload.isTyping === true;
    // Live "sneak-peek" of what the other side is typing (truncated for safety).
    const preview = isTyping && typeof payload.preview === "string" ? payload.preview.slice(0, 200) : "";

    if (data.organizationContext) {
      this.accessService.assertPermissions(data.organizationContext, ["chat:read"]);
      await this.ensureConversationAccess(data.organizationContext.organizationId, conversationId);
      client.to(this.conversationRoom(conversationId)).emit("typing.updated", {
        conversationId,
        membershipId: data.organizationContext.membershipId,
        senderType: "AGENT",
        isTyping,
        preview
      });
    } else if (data.visitorContext) {
      await this.ensureVisitorConversationAccess(data.visitorContext, conversationId);
      client.to(this.conversationRoom(conversationId)).emit("typing.updated", {
        conversationId,
        visitorId: data.visitorContext.visitorId,
        senderType: "VISITOR",
        isTyping,
        preview
      });
    } else {
      throw new Error("Socket is not authenticated");
    }

    return { ok: true, conversationId };
  }

  /**
   * Message sneak-peek: relay what a visitor is typing to every agent in the org,
   * BEFORE any conversation exists. Keyed by visitorId (shown in the live-visitors list).
   */
  @SubscribeMessage("visitor.preview")
  handleVisitorPreview(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { isTyping?: boolean; preview?: string }
  ): { ok: boolean } {
    const data = this.getClientData(client);
    if (!data.visitorContext) {
      return { ok: false };
    }
    const isTyping = payload?.isTyping === true;
    const preview = isTyping && typeof payload.preview === "string" ? payload.preview.slice(0, 200) : "";
    this.server
      .to(this.organizationRoom(data.visitorContext.organizationId))
      .emit("visitor.preview", {
        visitorId: data.visitorContext.visitorId,
        isTyping,
        preview
      });
    return { ok: true };
  }

  emitConversationCreated(conversation: ConversationDto): void {
    this.server
      .to(this.organizationRoom(conversation.organizationId))
      .emit("conversation.created", { conversation });
  }

  emitConversationUpdated(conversation: ConversationDto): void {
    this.server
      .to(this.organizationRoom(conversation.organizationId))
      .to(this.conversationRoom(conversation.id))
      .emit("conversation.updated", { conversation });
  }

  emitConversationAssigned(conversation: ConversationDto, assignedAgentId: string): void {
    this.server
      .to(this.organizationRoom(conversation.organizationId))
      .to(this.conversationRoom(conversation.id))
      .to(this.memberRoom(assignedAgentId))
      .emit("conversation.assigned", { conversation, assignedAgentId });
  }

  emitMessageCreated(message: MessageDto): void {
    this.server
      .to(this.organizationRoom(message.organizationId))
      .to(this.conversationRoom(message.conversationId))
      .emit("message.created", { message });
  }

  private async handleVisitorConnection(client: Socket): Promise<void> {
    const widgetKey = this.extractWidgetKey(client);
    const sessionToken = this.extractVisitorSessionToken(client);

    if (!widgetKey || !sessionToken) {
      throw new Error("Missing visitor widget credentials");
    }

    const widget = await this.prisma.chatWidget.findFirst({
      where: {
        publicKey: widgetKey,
        isEnabled: true
      }
    });

    if (!widget) {
      throw new Error("Widget not found");
    }

    const session = await this.prisma.visitorSession.findFirst({
      where: {
        sessionToken,
        organizationId: widget.organizationId,
        widgetId: widget.id,
        endedAt: null
      }
    });

    if (!session) {
      throw new Error("Invalid visitor session");
    }

    this.setClientData(client, {
      visitorContext: {
        organizationId: widget.organizationId,
        widgetId: widget.id,
        visitorId: session.visitorId,
        sessionToken: session.sessionToken
      }
    });
    await client.join(this.visitorRoom(session.sessionToken));
    client.emit("chat.ready", {
      organizationId: widget.organizationId,
      widgetId: widget.id,
      visitorId: session.visitorId,
      visitor: true
    });
  }

  private async ensureConversationAccess(
    organizationId: string,
    conversationId: string
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }
  }

  private async ensureVisitorConversationAccess(
    context: VisitorSocketContext,
    conversationId: string
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId: context.organizationId,
        widgetId: context.widgetId,
        visitorId: context.visitorId
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = this.getHandshakeAuth(client);
    const authToken = this.getString(auth.token);

    if (authToken) {
      return authToken;
    }

    const queryToken = this.getString(client.handshake.query.token);

    if (queryToken) {
      return queryToken;
    }

    const authorization = client.handshake.headers.authorization;

    if (typeof authorization !== "string") {
      return null;
    }

    const [scheme, token] = authorization.split(" ");

    return scheme?.toLowerCase() === "bearer" && token ? token : null;
  }

  private extractOrganizationId(client: Socket): string | null {
    const auth = this.getHandshakeAuth(client);

    return (
      this.getString(auth.organizationId) ??
      this.getString(client.handshake.query.organizationId)
    );
  }

  private extractWidgetKey(client: Socket): string | null {
    const auth = this.getHandshakeAuth(client);

    return this.getString(auth.widgetKey) ?? this.getString(client.handshake.query.widgetKey);
  }

  private extractVisitorSessionToken(client: Socket): string | null {
    const auth = this.getHandshakeAuth(client);

    return (
      this.getString(auth.sessionToken) ??
      this.getString(client.handshake.query.sessionToken)
    );
  }

  private getHandshakeAuth(client: Socket): Record<string, unknown> {
    return client.handshake.auth && typeof client.handshake.auth === "object"
      ? client.handshake.auth
      : {};
  }

  private requireConversationId(payload: ConversationRoomPayload): string {
    if (!payload?.conversationId) {
      throw new Error("conversationId is required");
    }

    return payload.conversationId;
  }

  private getString(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
      return value[0];
    }

    return null;
  }

  private getClientData(client: Socket): ChatSocketData {
    return client.data as ChatSocketData;
  }

  private setClientData(client: Socket, data: ChatSocketData): void {
    client.data = {
      ...client.data,
      ...data
    };
  }

  private organizationRoom(organizationId: string): string {
    return `organization:${organizationId}`;
  }

  private memberRoom(membershipId: string): string {
    return `member:${membershipId}`;
  }

  private conversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private visitorRoom(sessionToken: string): string {
    return `visitor:${sessionToken}`;
  }
}

type SocketCorsCallback = (err: Error | null, allow?: boolean) => void;
function parseSocketOrigins():
  | boolean
  | ((origin: string | undefined, callback: SocketCorsCallback) => void) {
  const rawValue = process.env.SOCKET_IO_CORS_ORIGIN ?? "*";
  const origins = rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins.length || origins.includes("*")) {
    return true;
  }

  const normalized = origins.map((origin) => origin.replace(/\/+$/, ""));

  // Robust check: configured origins (trailing-slash tolerant), any *.vercel.app
  // deployment (production + previews), and localhost. Mirrors the HTTP CORS check.
  return (origin: string | undefined, callback: SocketCorsCallback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    const cleaned = origin.replace(/\/+$/, "");
    let hostname = "";
    try {
      hostname = new URL(origin).hostname.toLowerCase();
    } catch {
      hostname = "";
    }
    const allowed =
      normalized.includes(cleaned) ||
      hostname.endsWith(".vercel.app") ||
      hostname === "localhost";
    callback(null, allowed);
  };
}
