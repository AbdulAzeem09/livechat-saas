import { Logger } from "@nestjs/common";
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
}

interface ConversationRoomPayload {
  conversationId?: string;
}

interface TypingPayload extends ConversationRoomPayload {
  isTyping?: boolean;
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
        throw new Error("Missing bearer token");
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
      const message = error instanceof Error ? error.message : "Socket authentication failed";

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
    }
  }

  @SubscribeMessage("conversation.join")
  async handleConversationJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ConversationRoomPayload
  ): Promise<{ ok: true; conversationId: string }> {
    const context = this.getAuthorizedContext(client);
    const conversationId = this.requireConversationId(payload);

    await this.ensureConversationAccess(context.organizationId, conversationId);
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
    const context = this.getAuthorizedContext(client);
    const conversationId = this.requireConversationId(payload);

    await this.ensureConversationAccess(context.organizationId, conversationId);
    client.to(this.conversationRoom(conversationId)).emit("typing.updated", {
      conversationId,
      membershipId: context.membershipId,
      isTyping: payload.isTyping === true
    });

    return { ok: true, conversationId };
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

  private getAuthorizedContext(client: Socket): OrganizationRequestContext {
    const context = this.getClientData(client).organizationContext;

    if (!context) {
      throw new Error("Socket is not authenticated");
    }

    this.accessService.assertPermissions(context, ["chat:read"]);
    return context;
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
}

function parseSocketOrigins(): string[] | boolean {
  const rawValue = process.env.SOCKET_IO_CORS_ORIGIN ?? "http://localhost:3000";
  const origins = rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins.length || origins.includes("*")) {
    return true;
  }

  return origins;
}
