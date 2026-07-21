import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ChatWidget,
  Conversation,
  ConversationPriority,
  ConversationSource,
  ConversationStatus,
  Message,
  MessageStatus,
  MessageType,
  MessageVisibility,
  ParticipantType,
  Prisma,
  VisitorSession
} from "@prisma/client";
import { AutomationService } from "../automation/automation.service";
import { ConversationsGateway } from "../conversations/conversations.gateway";
import type { ConversationDto, MessageDto } from "../conversations/dto/conversation-response.dto";
import { IntegrationsService } from "../integrations/integrations.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateWidgetConversationDto } from "./dto/create-widget-conversation.dto";
import type { RateWidgetDto } from "./dto/rate-widget.dto";
import type { RecordSaleDto } from "./dto/record-sale.dto";
import type { SendWidgetMessageDto } from "./dto/send-widget-message.dto";
import type { StartWidgetSessionDto } from "./dto/start-widget-session.dto";
import type { FormFieldDto, MenuOptionDto, UpdateWidgetDto } from "./dto/update-widget.dto";
import type { MenuReplyDto } from "./dto/menu-reply.dto";
import type {
  PublicWidgetConfigDto,
  WidgetConversationResponseDto,
  WidgetInstallDto,
  WidgetSessionDto
} from "./dto/widget-response.dto";

export interface WidgetRequestMetadata {
  ipAddress: string | undefined;
  userAgent: string | undefined;
  origin: string | undefined;
}

@Injectable()
export class WidgetsService {
  constructor(
    private readonly automation: AutomationService,
    private readonly config: ConfigService,
    private readonly gateway: ConversationsGateway,
    private readonly integrations: IntegrationsService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService
  ) {}

  async getDefaultInstall(organizationId: string): Promise<WidgetInstallDto> {
    const widget = await this.ensureDefaultWidget(organizationId);

    return this.mapInstall(widget);
  }

  async updateDefaultWidget(
    organizationId: string,
    dto: UpdateWidgetDto
  ): Promise<WidgetInstallDto> {
    const widget = await this.ensureDefaultWidget(organizationId);

    const currentTheme =
      widget.theme && typeof widget.theme === "object" && !Array.isArray(widget.theme)
        ? (widget.theme as Record<string, unknown>)
        : {};

    const theme = {
      ...currentTheme,
      ...(dto.accentColor !== undefined ? { accentColor: dto.accentColor } : {}),
      ...(dto.position !== undefined ? { position: dto.position } : {}),
      ...(dto.preChatEnabled !== undefined ? { preChatEnabled: dto.preChatEnabled } : {}),
      ...(dto.gtmContainerId !== undefined ? { gtmContainerId: dto.gtmContainerId } : {}),
      ...(dto.language !== undefined ? { language: dto.language } : {}),
      ...(dto.highContrast !== undefined ? { highContrast: dto.highContrast } : {}),
      ...(dto.largeText !== undefined ? { largeText: dto.largeText } : {}),
      ...(dto.cookieConsent !== undefined ? { cookieConsent: dto.cookieConsent } : {}),
      ...(dto.emailForwardTo !== undefined ? { emailForwardTo: dto.emailForwardTo.trim() } : {}),
      ...(dto.emailForwardEnabled !== undefined ? { emailForwardEnabled: dto.emailForwardEnabled } : {}),
      ...(dto.workingHoursEnabled !== undefined ? { workingHoursEnabled: dto.workingHoursEnabled } : {}),
      ...(dto.workingHours !== undefined ? { workingHours: dto.workingHours } : {}),
      ...(dto.eyeCatcher !== undefined ? { eyeCatcher: dto.eyeCatcher.trim() } : {}),
      ...(dto.eyeCatcherEnabled !== undefined ? { eyeCatcherEnabled: dto.eyeCatcherEnabled } : {}),
      ...(dto.slackWebhookUrl !== undefined ? { slackWebhookUrl: dto.slackWebhookUrl.trim() } : {}),
      ...(dto.preChatFields !== undefined
        ? { preChatFields: this.normalizeFormFields(dto.preChatFields) }
        : {}),
      ...(dto.postChatEnabled !== undefined ? { postChatEnabled: dto.postChatEnabled } : {}),
      ...(dto.postChatMessage !== undefined ? { postChatMessage: dto.postChatMessage.trim() } : {}),
      ...(dto.bannedIps !== undefined
        ? {
            bannedIps: dto.bannedIps
              .map((ip) => ip.trim().toLowerCase())
              .filter((ip) => ip.length > 0)
              .slice(0, 200)
          }
        : {}),
      ...(dto.inactivityEnabled !== undefined ? { inactivityEnabled: dto.inactivityEnabled } : {}),
      ...(dto.inactivityMessage !== undefined ? { inactivityMessage: dto.inactivityMessage.trim() } : {}),
      ...(dto.inactivitySeconds !== undefined ? { inactivitySeconds: dto.inactivitySeconds } : {}),
      ...(dto.menuOptions !== undefined
        ? { menuOptions: this.normalizeMenuOptions(dto.menuOptions) }
        : {})
    };

    const updated = await this.prisma.chatWidget.update({
      where: { id: widget.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.welcomeMessage !== undefined ? { welcomeMessage: dto.welcomeMessage } : {}),
        ...(dto.offlineMessage !== undefined ? { offlineMessage: dto.offlineMessage } : {}),
        ...(dto.allowedDomains !== undefined
          ? {
              allowedDomains: dto.allowedDomains
                .map((domain) => domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
                .filter((domain) => domain.length > 0)
            }
          : {}),
        theme: theme as Prisma.InputJsonValue
      }
    });

    return this.mapInstall(updated);
  }

  async getPublicConfig(
    publicKey: string,
    metadata: WidgetRequestMetadata
  ): Promise<PublicWidgetConfigDto> {
    const widget = await this.getPublicWidget(publicKey);

    this.assertDomainAllowed(widget, metadata.origin);
    this.assertNotBanned(widget, metadata.ipAddress);
    return this.mapPublicConfig(widget);
  }

  async startSession(
    publicKey: string,
    dto: StartWidgetSessionDto,
    metadata: WidgetRequestMetadata
  ): Promise<WidgetSessionDto> {
    const widget = await this.getPublicWidget(publicKey);

    this.assertDomainAllowed(widget, metadata.origin);
    this.assertNotBanned(widget, metadata.ipAddress);

    const externalId = this.normalizeExternalId(dto.visitorExternalId);
    const visitor = await this.prisma.visitor.upsert({
      where: {
        organizationId_externalId: {
          organizationId: widget.organizationId,
          externalId
        }
      },
      create: {
        organizationId: widget.organizationId,
        externalId,
        ...(metadata.ipAddress ? { lastIp: metadata.ipAddress } : {}),
        ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
        lastSeenAt: new Date(),
        attributes: this.toJsonInput(dto.metadata)
      },
      update: {
        ...(metadata.ipAddress ? { lastIp: metadata.ipAddress } : {}),
        ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
        lastSeenAt: new Date(),
        attributes: this.toJsonInput(dto.metadata)
      }
    });
    const session = await this.prisma.visitorSession.create({
      data: {
        organizationId: widget.organizationId,
        visitorId: visitor.id,
        widgetId: widget.id,
        sessionToken: this.generateSessionToken(),
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
        ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
        ...(dto.referrer ? { referrer: dto.referrer } : {}),
        ...(dto.pageUrl ? { landingPage: dto.pageUrl } : {}),
        metadata: this.toJsonInput(dto.metadata)
      }
    });

    // Resolve the visitor's country/state/city from their IP in the background
    // (skips localhost/private IPs, which have no gelocation).
    void this.resolveSessionGeo(session.id, metadata.ipAddress);

    if (dto.pageUrl) {
      await this.prisma.visitorPageView.create({
        data: {
          organizationId: widget.organizationId,
          visitorId: visitor.id,
          sessionId: session.id,
          url: dto.pageUrl,
          ...(dto.pageTitle ? { title: dto.pageTitle } : {}),
          ...(dto.referrer ? { referrer: dto.referrer } : {})
        }
      });
    }

    return {
      sessionToken: session.sessionToken,
      visitorId: visitor.id,
      widget: this.mapPublicConfig(widget)
    };
  }

  async createConversation(
    publicKey: string,
    dto: CreateWidgetConversationDto,
    metadata: WidgetRequestMetadata
  ): Promise<WidgetConversationResponseDto> {
    const widget = await this.getPublicWidget(publicKey);

    this.assertDomainAllowed(widget, metadata.origin);

    const session = await this.getSessionOrThrow(widget, dto.sessionToken);
    const body = this.trimBody(dto.body);

    if (dto.name || dto.email) {
      await this.prisma.visitor.update({
        where: { id: session.visitorId },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
          lastSeenAt: new Date()
        }
      });
    }

    // Auto-routing: assign the new chat to the least-busy online agent (else queue).
    const assignedAgentId = await this.pickAgentForRouting(widget.organizationId);

    const result = await this.prisma.$transaction(async (transaction) => {
      const conversation = await transaction.conversation.create({
        data: {
          organizationId: widget.organizationId,
          visitorId: session.visitorId,
          widgetId: widget.id,
          source: ConversationSource.WIDGET,
          status: assignedAgentId ? ConversationStatus.OPEN : ConversationStatus.QUEUED,
          ...(assignedAgentId ? { assignedAgentId } : {}),
          priority: ConversationPriority.NORMAL,
          subject: dto.subject?.trim() || "Website visitor",
          metadata: this.toJsonInput({
            ...dto.metadata,
            visitorPageUrl: session.landingPage,
            visitorReferrer: session.referrer
          })
        }
      });

      await transaction.conversationParticipant.create({
        data: {
          organizationId: widget.organizationId,
          conversationId: conversation.id,
          participantType: ParticipantType.VISITOR,
          visitorId: session.visitorId,
          displayName: dto.name?.trim() || "Website visitor"
        }
      });

      const message = await transaction.message.create({
        data: {
          organizationId: widget.organizationId,
          conversationId: conversation.id,
          senderType: ParticipantType.VISITOR,
          senderVisitorId: session.visitorId,
          type: MessageType.TEXT,
          visibility: MessageVisibility.PUBLIC,
          status: MessageStatus.SENT,
          body,
          metadata: this.toJsonInput(dto.metadata)
        }
      });
      const updatedConversation = await transaction.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: message.createdAt }
      });

      return { conversation: updatedConversation, message };
    });
    const conversation = this.mapConversation(result.conversation, result.message);
    const message = this.mapMessage(result.message);

    this.gateway.emitConversationCreated(conversation);
    this.gateway.emitMessageCreated(message);

    await this.automation
      .evaluateAndReply(widget.organizationId, conversation.id, body, { isFirstMessage: true })
      .catch(() => {});

    void this.integrations
      .dispatch(widget.organizationId, "conversation.created", {
        conversationId: conversation.id,
        visitorId: conversation.visitorId,
        subject: conversation.subject,
        firstMessage: body
      })
      .catch(() => {});

    // Email by HelpDesk: forward the new chat to the configured inbox (no-ops if
    // forwarding is off or SMTP isn't configured).
    void this.forwardChatByEmail(widget, conversation.subject, body, dto).catch(() => {});
    // Slack: post a notification to the configured Incoming Webhook.
    void this.notifySlack(widget, conversation.subject, body, dto).catch(() => {});

    return { conversation, message };
  }

  private async notifySlack(
    widget: ChatWidget,
    subject: string | null,
    body: string,
    dto: CreateWidgetConversationDto
  ): Promise<void> {
    const theme = this.toRecord(widget.theme);
    const url = typeof theme.slackWebhookUrl === "string" ? theme.slackWebhookUrl.trim() : "";
    if (!url) {
      return;
    }
    const who = [dto.name, dto.email].filter(Boolean).join(" · ") || "Website visitor";
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `:speech_balloon: *New chat* on ${widget.name}\n*From:* ${who}\n*Subject:* ${subject ?? "Website chat"}\n> ${body}`
      })
    });
  }

  private async forwardChatByEmail(
    widget: ChatWidget,
    subject: string | null,
    body: string,
    dto: CreateWidgetConversationDto
  ): Promise<void> {
    const theme = this.toRecord(widget.theme);
    const to = typeof theme.emailForwardTo === "string" ? theme.emailForwardTo.trim() : "";
    if (theme.emailForwardEnabled !== true || !to) {
      return;
    }

    const who = [dto.name, dto.email].filter(Boolean).join(" · ") || "Website visitor";
    await this.mail.send({
      to,
      subject: `New chat: ${subject ?? "Website chat"}`,
      text: `You received a new chat on ${widget.name}.\n\nFrom: ${who}\n\nMessage:\n${body}\n\nReply from your LiveChat dashboard.`
    });
  }

  async listMessages(
    publicKey: string,
    conversationId: string,
    sessionToken: string | undefined,
    metadata: WidgetRequestMetadata
  ): Promise<MessageDto[]> {
    const widget = await this.getPublicWidget(publicKey);

    this.assertDomainAllowed(widget, metadata.origin);
    await this.ensureVisitorConversationAccess(widget, conversationId, sessionToken);

    const messages = await this.prisma.message.findMany({
      where: {
        organizationId: widget.organizationId,
        conversationId,
        visibility: MessageVisibility.PUBLIC,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" },
      take: 100
    });

    return messages.map((message) => this.mapMessage(message));
  }

  async getConversationStatus(
    publicKey: string,
    conversationId: string,
    sessionToken: string | undefined,
    metadata: WidgetRequestMetadata
  ): Promise<{ id: string; status: string; subject: string | null }> {
    const widget = await this.getPublicWidget(publicKey);

    this.assertDomainAllowed(widget, metadata.origin);
    const conversation = await this.ensureVisitorConversationAccess(
      widget,
      conversationId,
      sessionToken
    );

    return {
      id: conversation.id,
      status: conversation.status,
      subject: conversation.subject
    };
  }

  async rateConversation(
    publicKey: string,
    conversationId: string,
    dto: RateWidgetDto,
    metadata: WidgetRequestMetadata
  ): Promise<{ success: true }> {
    const widget = await this.getPublicWidget(publicKey);

    this.assertDomainAllowed(widget, metadata.origin);
    const conversation = await this.ensureVisitorConversationAccess(
      widget,
      conversationId,
      dto.sessionToken
    );

    const meta = this.toRecord(conversation.metadata);
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        metadata: {
          ...meta,
          rating: dto.rating,
          ratingComment: dto.comment ?? "",
          ratedAt: new Date().toISOString()
        } as Prisma.InputJsonValue
      }
    });

    return { success: true };
  }

  /** Record an ecommerce sale attributed to a visitor / conversation. */
  async recordSale(
    publicKey: string,
    dto: RecordSaleDto,
    metadata: WidgetRequestMetadata
  ): Promise<{ success: true }> {
    const widget = await this.getPublicWidget(publicKey);
    this.assertDomainAllowed(widget, metadata.origin);

    const session = await this.getSessionOrThrow(widget, dto.sessionToken);

    // Only attribute a conversation the visitor actually owns.
    let conversationId: string | null = null;
    if (dto.conversationId) {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: dto.conversationId, organizationId: widget.organizationId }
      });
      if (conversation) {
        conversationId = conversation.id;
      }
    }

    await this.prisma.sale.create({
      data: {
        organizationId: widget.organizationId,
        visitorId: session.visitorId,
        conversationId,
        amountCents: Math.max(0, Math.round(dto.amountCents)),
        currency: (dto.currency ?? "usd").toLowerCase().slice(0, 3),
        ...(dto.reference ? { reference: dto.reference.slice(0, 191) } : {}),
        source: "widget"
      }
    });

    return { success: true };
  }

  /** Chatbot flow: post the configured bot reply for a tapped quick-reply option. */
  async postMenuReply(
    publicKey: string,
    conversationId: string,
    dto: MenuReplyDto,
    metadata: WidgetRequestMetadata
  ): Promise<MessageDto | null> {
    const widget = await this.getPublicWidget(publicKey);
    this.assertDomainAllowed(widget, metadata.origin);
    await this.ensureVisitorConversationAccess(widget, conversationId, dto.sessionToken);

    const option = this.menuOptionsFor(this.toRecord(widget.theme)).find(
      (item) => item.id === dto.optionId
    );
    if (!option) {
      return null;
    }

    const message = await this.prisma.message.create({
      data: {
        organizationId: widget.organizationId,
        conversationId,
        senderType: ParticipantType.SYSTEM,
        type: MessageType.TEXT,
        visibility: MessageVisibility.PUBLIC,
        status: MessageStatus.SENT,
        body: option.reply,
        metadata: { bot: true, menuOptionId: option.id } as Prisma.InputJsonValue
      }
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt }
    });

    const mapped = this.mapMessage(message);
    this.gateway.emitMessageCreated(mapped);
    return mapped;
  }

  async sendMessage(
    publicKey: string,
    conversationId: string,
    dto: SendWidgetMessageDto,
    metadata: WidgetRequestMetadata
  ): Promise<MessageDto> {
    const widget = await this.getPublicWidget(publicKey);

    this.assertDomainAllowed(widget, metadata.origin);

    const session = await this.getSessionOrThrow(widget, dto.sessionToken);
    const conversation = await this.ensureVisitorConversationAccess(
      widget,
      conversationId,
      dto.sessionToken
    );
    const body = this.trimBody(dto.body);

    if (dto.idempotencyKey) {
      const existingMessage = await this.prisma.message.findFirst({
        where: {
          conversationId,
          idempotencyKey: dto.idempotencyKey
        }
      });

      if (existingMessage) {
        return this.mapMessage(existingMessage);
      }
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const message = await transaction.message.create({
        data: {
          organizationId: widget.organizationId,
          conversationId,
          senderType: ParticipantType.VISITOR,
          senderVisitorId: session.visitorId,
          type: MessageType.TEXT,
          visibility: MessageVisibility.PUBLIC,
          status: MessageStatus.SENT,
          body,
          ...(dto.idempotencyKey ? { idempotencyKey: dto.idempotencyKey } : {}),
          metadata: this.toJsonInput(dto.metadata)
        }
      });
      const updatedConversation = await transaction.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.createdAt,
          status:
            conversation.status === ConversationStatus.CLOSED ||
            conversation.status === ConversationStatus.RESOLVED
              ? ConversationStatus.OPEN
              : conversation.status
        }
      });

      return { conversation: updatedConversation, message };
    });
    const message = this.mapMessage(result.message);

    this.gateway.emitMessageCreated(message);
    this.gateway.emitConversationUpdated(this.mapConversation(result.conversation, result.message));

    await this.automation
      .evaluateAndReply(widget.organizationId, conversationId, body, { isFirstMessage: false })
      .catch(() => {});

    return message;
  }

  async recordHeartbeat(
    publicKey: string,
    dto: { sessionToken: string; pageUrl?: string; pageTitle?: string },
    metadata: WidgetRequestMetadata
  ): Promise<{ ok: true }> {
    const widget = await this.getPublicWidget(publicKey);
    const session = await this.getSessionOrThrow(widget, dto.sessionToken);

    await this.prisma.visitor.update({
      where: { id: session.visitorId },
      data: {
        lastSeenAt: new Date(),
        ...(metadata.ipAddress ? { lastIp: metadata.ipAddress } : {})
      }
    });

    if (dto.pageUrl) {
      const lastPageView = await this.prisma.visitorPageView.findFirst({
        where: { organizationId: widget.organizationId, sessionId: session.id },
        orderBy: { viewedAt: "desc" }
      });

      if (!lastPageView || lastPageView.url !== dto.pageUrl) {
        await this.prisma.visitorPageView.create({
          data: {
            organizationId: widget.organizationId,
            visitorId: session.visitorId,
            sessionId: session.id,
            url: dto.pageUrl,
            ...(dto.pageTitle ? { title: dto.pageTitle } : {})
          }
        });
      }
    }

    return { ok: true };
  }

  async validateVisitorSocket(
    publicKey: string,
    sessionToken: string
  ): Promise<{
    organizationId: string;
    widgetId: string;
    visitorId: string;
    sessionToken: string;
  }> {
    const widget = await this.getPublicWidget(publicKey);
    const session = await this.getSessionOrThrow(widget, sessionToken);

    return {
      organizationId: widget.organizationId,
      widgetId: widget.id,
      visitorId: session.visitorId,
      sessionToken: session.sessionToken
    };
  }

  async ensureVisitorSocketConversationAccess(
    widgetId: string,
    visitorId: string,
    conversationId: string
  ): Promise<{ organizationId: string }> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        widgetId,
        visitorId
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    return { organizationId: conversation.organizationId };
  }

  buildWidgetScript(): string {
    return buildWidgetScript();
  }

  private async ensureDefaultWidget(organizationId: string): Promise<ChatWidget> {
    const existingWidget = await this.prisma.chatWidget.findFirst({
      where: {
        organizationId,
        isEnabled: true
      },
      orderBy: { createdAt: "asc" }
    });

    if (existingWidget) {
      return existingWidget;
    }

    return this.prisma.chatWidget.create({
      data: {
        organizationId,
        name: "Website widget",
        publicKey: this.generateWidgetKey(),
        secretHash: this.hashToken(this.generateWidgetSecret()),
        welcomeMessage: "Hi there. How can we help?",
        offlineMessage: "Leave a message and the team will reply soon.",
        theme: {
          accentColor: "#ff5a00",
          position: "right"
        }
      }
    });
  }

  private async getPublicWidget(publicKey: string): Promise<ChatWidget> {
    const widget = await this.prisma.chatWidget.findFirst({
      where: {
        publicKey,
        isEnabled: true
      }
    });

    if (!widget) {
      throw new NotFoundException("Widget not found");
    }

    return widget;
  }

  private async getSessionOrThrow(
    widget: ChatWidget,
    sessionToken: string
  ): Promise<VisitorSession> {
    const session = await this.prisma.visitorSession.findFirst({
      where: {
        sessionToken,
        organizationId: widget.organizationId,
        widgetId: widget.id,
        endedAt: null
      }
    });

    if (!session) {
      throw new ForbiddenException("Invalid widget session");
    }

    return session;
  }

  private async ensureVisitorConversationAccess(
    widget: ChatWidget,
    conversationId: string,
    sessionToken: string | undefined
  ): Promise<Conversation> {
    if (!sessionToken) {
      throw new ForbiddenException("Missing widget session");
    }

    const session = await this.getSessionOrThrow(widget, sessionToken);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId: widget.organizationId,
        widgetId: widget.id,
        visitorId: session.visitorId
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    return conversation;
  }

  private isPublicIp(ip: string): boolean {
    const clean = ip.replace(/^::ffff:/, "");
    if (clean === "127.0.0.1" || clean === "::1" || clean === "localhost") {
      return false;
    }
    // Private ranges: 10.x, 192.168.x, 172.16-31.x, and IPv6 unique-local fc/fd.
    if (/^10\./.test(clean) || /^192\.168\./.test(clean)) {
      return false;
    }
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(clean)) {
      return false;
    }
    if (/^(fc|fd)/i.test(clean)) {
      return false;
    }
    return true;
  }

  /**
   * Look up the visitor's geolocation from their IP (free ip-api.com, no key) and
   * store country/region/city on the session. Fire-and-forget: never blocks the
   * widget response and silently no-ops for localhost/private IPs or on failure.
   */
  private async resolveSessionGeo(sessionId: string, ip: string | undefined): Promise<void> {
    if (!ip || !this.isPublicIp(ip)) {
      return;
    }

    try {
      const clean = ip.replace(/^::ffff:/, "");
      const response = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(clean)}?fields=status,country,regionName,city`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (!response.ok) {
        return;
      }
      const geo = (await response.json()) as {
        status?: string;
        country?: string;
        regionName?: string;
        city?: string;
      };
      if (geo.status !== "success") {
        return;
      }
      await this.prisma.visitorSession.update({
        where: { id: sessionId },
        data: {
          ...(geo.country ? { country: geo.country } : {}),
          ...(geo.regionName ? { region: geo.regionName } : {}),
          ...(geo.city ? { city: geo.city } : {})
        }
      });
    } catch {
      // geolocation is best-effort; ignore network/timeout failures
    }
  }

  private assertDomainAllowed(widget: ChatWidget, origin: string | undefined): void {
    if (!widget.allowedDomains.length || !origin) {
      return;
    }

    let hostname = "";

    try {
      hostname = new URL(origin).hostname.toLowerCase();
    } catch {
      throw new ForbiddenException("Widget origin is not allowed");
    }

    const allowed = widget.allowedDomains.some((domain) => {
      const normalizedDomain = domain.trim().toLowerCase();

      return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
    });

    if (!allowed) {
      throw new ForbiddenException("Widget origin is not allowed");
    }
  }

  /** Block banned visitor IPs (exact match or CIDR-free prefix) from starting chats. */
  private assertNotBanned(widget: ChatWidget, ipAddress: string | undefined): void {
    if (!ipAddress) {
      return;
    }
    const banned = this.bannedIpsFor(this.toRecord(widget.theme));
    if (!banned.length) {
      return;
    }
    const ip = ipAddress.trim().toLowerCase();
    const isBanned = banned.some((entry) => {
      // Support a trailing "*" wildcard prefix, otherwise exact match.
      if (entry.endsWith("*")) {
        return ip.startsWith(entry.slice(0, -1));
      }
      return ip === entry;
    });
    if (isBanned) {
      throw new ForbiddenException("Access to chat has been restricted");
    }
  }

  /** Chatbot quick-reply menu options stored on the widget theme. */
  private menuOptionsFor(theme: Record<string, unknown>): MenuOptionDto[] {
    if (!Array.isArray(theme.menuOptions)) {
      return [];
    }
    return this.normalizeMenuOptions(theme.menuOptions as unknown[]);
  }

  private normalizeMenuOptions(raw: unknown): MenuOptionDto[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const seen = new Set<string>();
    const options: MenuOptionDto[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim().slice(0, 60) : "";
      const reply = typeof record.reply === "string" ? record.reply.trim().slice(0, 600) : "";
      if (!label || !reply) {
        continue;
      }
      let id = typeof record.id === "string" && record.id.trim()
        ? record.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40)
        : `opt_${options.length + 1}`;
      while (seen.has(id)) {
        id = `${id}_${options.length + 1}`;
      }
      seen.add(id);
      options.push({ id, label, reply });
      if (options.length >= 10) {
        break;
      }
    }
    return options;
  }

  private bannedIpsFor(theme: Record<string, unknown>): string[] {
    if (!Array.isArray(theme.bannedIps)) {
      return [];
    }
    return theme.bannedIps
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
      .slice(0, 200);
  }

  private mapInstall(widget: ChatWidget): WidgetInstallDto {
    const theme = this.toRecord(widget.theme);
    const apiUrl = this.config.getOrThrow<string>("API_URL").replace(/\/$/, "");
    const appUrl = this.config.getOrThrow<string>("APP_URL").replace(/\/$/, "");
    const globalPrefix = this.config.getOrThrow<string>("API_GLOBAL_PREFIX").replace(/^\/|\/$/g, "");
    const scriptUrl = `${apiUrl}/${globalPrefix}/widget.js`;
    const installCode = `<script async src="${scriptUrl}" data-widget-key="${widget.publicKey}"></script>`;

    return {
      id: widget.id,
      publicKey: widget.publicKey,
      name: widget.name,
      scriptUrl,
      installCode,
      demoUrl: `${appUrl}/widget-demo?key=${encodeURIComponent(widget.publicKey)}`,
      allowedDomains: widget.allowedDomains,
      emailForwardTo: typeof theme.emailForwardTo === "string" ? theme.emailForwardTo : "",
      emailForwardEnabled: theme.emailForwardEnabled === true,
      workingHoursEnabled: theme.workingHoursEnabled === true,
      workingHours:
        theme.workingHours && typeof theme.workingHours === "object"
          ? (theme.workingHours as Record<string, unknown>)
          : null,
      eyeCatcher: typeof theme.eyeCatcher === "string" ? theme.eyeCatcher : "",
      eyeCatcherEnabled: theme.eyeCatcherEnabled === true,
      slackWebhookUrl: typeof theme.slackWebhookUrl === "string" ? theme.slackWebhookUrl : "",
      preChatEnabled: theme.preChatEnabled === true,
      preChatFields: this.preChatFieldsFor(theme),
      postChatEnabled: theme.postChatEnabled === true,
      postChatMessage: typeof theme.postChatMessage === "string" ? theme.postChatMessage : "",
      bannedIps: this.bannedIpsFor(theme),
      inactivityEnabled: theme.inactivityEnabled === true,
      inactivityMessage: typeof theme.inactivityMessage === "string" ? theme.inactivityMessage : "",
      inactivitySeconds: typeof theme.inactivitySeconds === "number" ? theme.inactivitySeconds : 60,
      menuOptions: this.menuOptionsFor(theme),
      publicConfig: this.mapPublicConfig(widget)
    };
  }

  private mapPublicConfig(widget: ChatWidget): PublicWidgetConfigDto {
    const theme = this.toRecord(widget.theme);

    return {
      publicKey: widget.publicKey,
      name: widget.name,
      welcomeMessage: widget.welcomeMessage ?? "Hi there. How can we help?",
      offlineMessage: widget.offlineMessage ?? "Leave a message and the team will reply soon.",
      theme: {
        accentColor: typeof theme.accentColor === "string" ? theme.accentColor : "#ff5a00",
        position: theme.position === "left" ? "left" : "right"
      },
      preChatEnabled: theme.preChatEnabled === true,
      preChatFields: this.preChatFieldsFor(theme),
      postChatEnabled: theme.postChatEnabled === true,
      postChatMessage:
        typeof theme.postChatMessage === "string" && theme.postChatMessage
          ? theme.postChatMessage
          : "Thanks for chatting! Anything else we can help with?",
      gtmContainerId: typeof theme.gtmContainerId === "string" ? theme.gtmContainerId : "",
      language: typeof theme.language === "string" ? theme.language : "en",
      highContrast: theme.highContrast === true,
      largeText: theme.largeText === true,
      cookieConsent: theme.cookieConsent === true,
      workingHoursEnabled: theme.workingHoursEnabled === true,
      online: this.isWithinWorkingHours(theme.workingHoursEnabled === true, theme.workingHours),
      eyeCatcher: typeof theme.eyeCatcher === "string" ? theme.eyeCatcher : "",
      eyeCatcherEnabled: theme.eyeCatcherEnabled === true,
      inactivityEnabled: theme.inactivityEnabled === true,
      inactivityMessage:
        typeof theme.inactivityMessage === "string" && theme.inactivityMessage
          ? theme.inactivityMessage
          : "Are you still there? Let us know how we can help.",
      inactivitySeconds:
        typeof theme.inactivitySeconds === "number" ? theme.inactivitySeconds : 60,
      // Only the id + label reach the visitor; the reply is resolved server-side on tap.
      menuOptions: this.menuOptionsFor(theme).map((option) => ({
        id: option.id,
        label: option.label
      }))
    };
  }

  /** Default pre-chat fields (name + email) used when none are configured. */
  private static readonly DEFAULT_PRECHAT_FIELDS: FormFieldDto[] = [
    { id: "name", label: "Your name", type: "text", required: false },
    { id: "email", label: "Email", type: "email", required: false }
  ];

  private preChatFieldsFor(theme: Record<string, unknown>): FormFieldDto[] {
    const stored = this.normalizeFormFields(theme.preChatFields);
    return stored.length ? stored : WidgetsService.DEFAULT_PRECHAT_FIELDS;
  }

  /** Sanitize + de-duplicate a form-field array coming from the client or theme JSON. */
  private normalizeFormFields(raw: unknown): FormFieldDto[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const allowedTypes = new Set(["text", "email", "phone", "textarea"]);
    const seen = new Set<string>();
    const fields: FormFieldDto[] = [];

    for (const entry of raw) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim().slice(0, 80) : "";
      if (!label) {
        continue;
      }
      const type = typeof record.type === "string" && allowedTypes.has(record.type)
        ? (record.type as FormFieldDto["type"])
        : "text";
      let id = typeof record.id === "string" && record.id.trim()
        ? record.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40)
        : label.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
      if (!id) {
        id = `field_${fields.length + 1}`;
      }
      while (seen.has(id)) {
        id = `${id}_${fields.length + 1}`;
      }
      seen.add(id);
      fields.push({ id, label, type, required: record.required === true });
      if (fields.length >= 8) {
        break;
      }
    }

    return fields;
  }

  /** Auto-routing: pick the least-busy ONLINE agent, or null (queue) if none online. */
  private async pickAgentForRouting(organizationId: string): Promise<string | null> {
    const members = await this.prisma.userOrganization.findMany({
      where: { organizationId, agentStatus: "ONLINE" },
      select: { id: true }
    });
    if (!members.length) {
      return null;
    }
    const counts = await Promise.all(
      members.map(async (m) => ({
        id: m.id,
        open: await this.prisma.conversation.count({
          where: {
            organizationId,
            assignedAgentId: m.id,
            status: {
              in: [ConversationStatus.OPEN, ConversationStatus.PENDING, ConversationStatus.QUEUED]
            }
          }
        })
      }))
    );
    counts.sort((a, b) => a.open - b.open);
    return counts[0]?.id ?? null;
  }

  /** True if now (in the schedule's timezone) is within the weekly working hours. */
  private isWithinWorkingHours(enabled: boolean, raw: unknown): boolean {
    if (!enabled) {
      return true;
    }
    const wh =
      raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const days = Array.isArray(wh.days) ? (wh.days as Array<Record<string, unknown>>) : [];
    if (days.length !== 7) {
      return true;
    }
    const tz = typeof wh.timezone === "string" && wh.timezone ? wh.timezone : "UTC";

    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(new Date());
      const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
      const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
      const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
      const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const day = days[order.indexOf(wd)];
      if (!day || day.on !== true) {
        return false;
      }
      const nowMin = (hour % 24) * 60 + minute;
      const parse = (value: unknown): number => {
        const str = typeof value === "string" ? value : "00:00";
        const [h, m] = str.split(":");
        return Number(h) * 60 + Number(m);
      };
      const from = parse(day.from);
      const to = parse(day.to);
      return nowMin >= from && nowMin <= to;
    } catch {
      return true;
    }
  }

  private mapConversation(
    conversation: Conversation,
    latestMessage?: Message | null
  ): ConversationDto {
    return {
      id: conversation.id,
      organizationId: conversation.organizationId,
      visitorId: conversation.visitorId,
      contactId: conversation.contactId,
      widgetId: conversation.widgetId,
      departmentId: conversation.departmentId,
      assignedAgentId: conversation.assignedAgentId,
      source: conversation.source,
      status: conversation.status,
      priority: conversation.priority,
      subject: conversation.subject,
      locale: conversation.locale,
      metadata: this.toRecord(conversation.metadata),
      firstResponseAt: conversation.firstResponseAt,
      lastMessageAt: conversation.lastMessageAt,
      resolvedAt: conversation.resolvedAt,
      closedAt: conversation.closedAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      latestMessage: latestMessage ? this.mapMessage(latestMessage) : null
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
      metadata: this.toRecord(message.metadata),
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt
    };
  }

  private normalizeExternalId(value: string | undefined): string {
    const trimmedValue = value?.trim();

    return trimmedValue ? `web:${trimmedValue.slice(0, 187)}` : `web:${this.generateSessionToken()}`;
  }

  private trimBody(value: string): string {
    const body = value.trim();

    if (!body) {
      throw new BadRequestException("Message body cannot be empty");
    }

    return body;
  }

  private generateWidgetKey(): string {
    return `lcw_${randomBytes(18).toString("base64url")}`;
  }

  private generateWidgetSecret(): string {
    return randomBytes(32).toString("base64url");
  }

  private generateSessionToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private toRecord(value: Prisma.JsonValue): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }

    return {};
  }

  private toJsonInput(value: Record<string, unknown> | undefined): Prisma.InputJsonValue {
    return (value ?? {}) as Prisma.InputJsonValue;
  }
}

function buildWidgetScript(): string {
  return String.raw`
(function () {
  if (window.LiveChatSaaSWidgetLoaded) return;
  window.LiveChatSaaSWidgetLoaded = true;

  function readKey(el) {
    if (!el) return null;
    return el.getAttribute("data-widget-key") || (el.src ? new URL(el.src).searchParams.get("key") : null);
  }

  var currentScript = document.currentScript;
  var widgetKey = readKey(currentScript);

  if (!widgetKey || !currentScript || !currentScript.src) {
    currentScript =
      document.querySelector("script[data-widget-key]") ||
      document.querySelector('script[src*="widget.js"]') ||
      currentScript;
    widgetKey = readKey(currentScript);
  }

  if (!widgetKey || !currentScript || !currentScript.src) {
    console.warn("[LiveChat SaaS] Missing data-widget-key.");
    return;
  }

  var scriptUrl = new URL(currentScript.src);
  var apiBase = scriptUrl.origin + scriptUrl.pathname.replace(/\/widget\.js$/, "");
  var socketOrigin = scriptUrl.origin;
  var storagePrefix = "lcw:" + widgetKey + ":";
  var state = {
    config: null,
    conversationId: localStorage.getItem(storagePrefix + "conversationId") || "",
    preChatDone: localStorage.getItem(storagePrefix + "preChatDone") === "1",
    preChatAnswers: null,
    inactivityShown: false,
    renderedMessageIds: {},
    sessionToken: localStorage.getItem(storagePrefix + "sessionToken") || "",
    socket: null,
    visitorEmail: localStorage.getItem(storagePrefix + "visitorEmail") || "",
    visitorExternalId: localStorage.getItem(storagePrefix + "visitorExternalId") || "",
    visitorName: localStorage.getItem(storagePrefix + "visitorName") || ""
  };

  if (!state.visitorExternalId) {
    state.visitorExternalId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(storagePrefix + "visitorExternalId", state.visitorExternalId);
  }

  var root = document.createElement("div");
  root.setAttribute("data-livechat-widget", widgetKey);
  root.innerHTML =
    '<style>' +
    '.lcw-root{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
    '.lcw-panel{display:none;width:min(380px,calc(100vw - 24px));height:min(620px,calc(100vh - 40px));overflow:hidden;border-radius:20px;background:#1b1b1e;color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.45)}' +
    '.lcw-open .lcw-panel{display:flex;flex-direction:column}.lcw-open .lcw-launcher{display:none}' +
    '.lcw-panel .lcw-home,.lcw-panel .lcw-chat{display:none;flex-direction:column;height:100%;min-height:0}' +
    '.lcw-panel .lcw-home{display:flex}.lcw-panel.lcw-chat-active .lcw-home{display:none}.lcw-panel.lcw-chat-active .lcw-chat{display:flex}' +
    '.lcw-hero{background:linear-gradient(165deg,var(--lcw-accent,#ff5a00),#1b1b1e 66%);padding:20px 22px 30px;position:relative}' +
    '.lcw-min{position:absolute;top:14px;right:16px;height:26px;width:26px;border:0;border-radius:8px;background:rgba(255,255,255,.16);color:#fff;cursor:pointer;font-size:15px;line-height:1}' +
    '.lcw-hero-title{font-size:25px;font-weight:800;line-height:1.15;margin-top:30px;max-width:15ch;text-transform:uppercase}' +
    '.lcw-home-body{flex:1;overflow:auto;padding:14px}' +
    '.lcw-brand-card{background:#2a2a2f;border-radius:16px;padding:16px;margin-top:-16px}' +
    '.lcw-brand-top{display:flex;align-items:center;gap:10px}' +
    '.lcw-av{height:34px;width:34px;border-radius:50%;background:#3a3a42;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;position:relative;flex:none}' +
    '.lcw-dot{position:absolute;right:-1px;top:-1px;height:10px;width:10px;border-radius:50%;background:#22c55e;border:2px solid #2a2a2f}' +
    '.lcw-brand-name{font-size:13px;font-weight:700}.lcw-brand-time{font-size:11px;color:#8a8a92}' +
    '.lcw-brand-msg{font-size:14px;color:#e6e6ea;margin:12px 0 14px;line-height:1.45}' +
    '.lcw-letschat{width:100%;border:0;border-radius:12px;background:var(--lcw-accent,#ffd21e);color:#111;font-weight:800;font-size:15px;padding:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}' +
    '.lcw-tabs{display:flex;border-top:1px solid #2c2c31}.lcw-tab{flex:1;background:none;border:0;color:#8a8a92;padding:11px;cursor:pointer;font-size:11px;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:3px}.lcw-tab.on{color:#fff}.lcw-tab b{font-size:17px;font-weight:400}' +
    '.lcw-chead{display:flex;align-items:center;gap:8px;padding:12px 14px}.lcw-icbtn{height:30px;width:30px;border:0;border-radius:8px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;font-size:14px}' +
    '.lcw-abar{display:flex;align-items:center;gap:10px;background:#26262b;margin:0 14px;padding:10px 12px;border-radius:12px}.lcw-agent-name{font-size:13px;font-weight:700}.lcw-agent-role{font-size:11px;color:#9a9aa2}' +
    '.lcw-messages{flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}' +
    '.lcw-msg{max-width:82%;border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word}.lcw-agent{align-self:flex-start;background:#2f2f36;color:#fff;border-bottom-left-radius:5px}.lcw-visitor{align-self:flex-end;background:var(--lcw-accent,#ffd21e);color:#111;border-bottom-right-radius:5px}.lcw-system{align-self:center;background:transparent;color:#8a8a92;font-size:12px}' +
    '.lcw-greet{align-self:stretch;background:#2f2f36;border-radius:14px;padding:12px}.lcw-greet-emoji{background:#f3f4f6;border-radius:10px;text-align:center;font-size:36px;padding:16px}.lcw-greet-txt{font-size:13px;color:#e6e6ea;margin-top:10px}.lcw-quick{display:flex;gap:8px;margin-top:10px}.lcw-q{border:0;border-radius:999px;padding:8px 15px;font-size:12px;font-weight:700;cursor:pointer}.lcw-q1{background:var(--lcw-accent,#ffd21e);color:#111}.lcw-q2{background:#3a3a42;color:#dcdce2}' +
    '.lcw-form{display:flex;gap:8px;align-items:center;padding:12px 14px}.lcw-input{flex:1;min-width:0;border:1px solid #3a3a42;border-radius:999px;padding:11px 14px;font-size:13px;outline:none;background:#26262b;color:#fff}.lcw-input::placeholder{color:#8a8a92}.lcw-input:focus{border-color:var(--lcw-accent,#ffd21e)}.lcw-send{height:38px;width:38px;flex:none;border:1px solid var(--lcw-accent,#ffd21e);border-radius:50%;background:transparent;color:var(--lcw-accent,#ffd21e);cursor:pointer;font-weight:900;font-size:16px}' +
    '.lcw-launcher{height:60px;width:60px;border:0;border-radius:50%;background:var(--lcw-accent,#ff5a00);color:#fff;box-shadow:0 16px 40px rgba(0,0,0,.3);cursor:pointer;font-size:26px}.lcw-powered{font-size:10px;color:#6b6b72;text-align:center;padding:8px}' +
    '</style>' +
    '<div class="lcw-root">' +
      '<section class="lcw-panel" aria-label="Live chat">' +
        '<div class="lcw-home">' +
          '<div class="lcw-hero"><button class="lcw-min" type="button" aria-label="Minimize">&#8722;</button><div class="lcw-hero-title">Welcome \u{1F44B}</div></div>' +
          '<div class="lcw-home-body"><div class="lcw-brand-card">' +
            '<div class="lcw-brand-top"><div class="lcw-av"><span class="lcw-brand-ini">LC</span><span class="lcw-dot"></span></div><div><div class="lcw-brand-name">Support</div><div class="lcw-brand-time">Online</div></div></div>' +
            '<div class="lcw-brand-msg">Hi, let us know if you have any questions.</div>' +
            '<button class="lcw-letschat" type="button">Let’s chat ➤</button>' +
          '</div></div>' +
          '<div class="lcw-tabs"><button class="lcw-tab lcw-tab-home on" type="button"><b>\u{1F3E0}</b>Home</button><button class="lcw-tab lcw-tab-chat" type="button"><b>\u{1F4AC}</b>Chat</button></div>' +
          '<div class="lcw-powered">Powered by LiveChat SaaS</div>' +
        '</div>' +
        '<div class="lcw-chat">' +
          '<header class="lcw-chead"><button class="lcw-back lcw-icbtn" type="button" aria-label="Back">&#8592;</button><div style="flex:1"></div><button class="lcw-close lcw-icbtn" type="button" aria-label="Close">&#10005;</button></header>' +
          '<div class="lcw-abar"><div class="lcw-av"><span class="lcw-agent-ini">LC</span><span class="lcw-dot" style="border-color:#26262b"></span></div><div><div class="lcw-agent-name">Support</div><div class="lcw-agent-role">We reply in a few minutes</div></div></div>' +
          '<div class="lcw-messages"></div>' +
          '<form class="lcw-form"><input class="lcw-input" autocomplete="off" placeholder="Write a message..." /><button class="lcw-send" type="submit">➤</button></form>' +
          '<div class="lcw-powered">Powered by LiveChat SaaS</div>' +
        '</div>' +
      '</section>' +
      '<button class="lcw-launcher" type="button" aria-label="Open chat">\u{1F4AC}</button>' +
    '</div>';
  document.body.appendChild(root);

  var container = root.querySelector(".lcw-root");
  var panel = root.querySelector(".lcw-panel");
  var launcher = root.querySelector(".lcw-launcher");
  var closeButton = root.querySelector(".lcw-close");
  var messages = root.querySelector(".lcw-messages");
  var form = root.querySelector(".lcw-form");
  var input = root.querySelector(".lcw-input");
  var tabHome = root.querySelector(".lcw-tab-home");
  var tabChat = root.querySelector(".lcw-tab-chat");
  var letsChat = root.querySelector(".lcw-letschat");
  var backBtn = root.querySelector(".lcw-back");
  var minBtn = root.querySelector(".lcw-min");

  function showHome() {
    panel.classList.remove("lcw-chat-active");
    tabHome.classList.add("on");
    tabChat.classList.remove("on");
  }
  function showChat() {
    panel.classList.add("lcw-chat-active");
    tabHome.classList.remove("on");
    tabChat.classList.add("on");
    ensureReady().then(function () { maybeShowPreChat(); maybeShowGreeting(); resetInactivityTimer(); }).catch(function () {});
    setTimeout(function () { input.focus(); }, 40);
  }
  function openPanel() {
    container.classList.add("lcw-open");
    if (state.conversationId) { showChat(); } else { showHome(); }
  }

  // Inactivity nudge: auto-post a message if the visitor goes quiet mid-chat.
  var inactivityTimer = null;
  function resetInactivityTimer() {
    if (!state.config || !state.config.inactivityEnabled) return;
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (state.inactivityShown) return;
    var seconds = Number(state.config.inactivitySeconds) || 60;
    inactivityTimer = setTimeout(function () {
      if (state.inactivityShown) return;
      if (!container.classList.contains("lcw-open")) return;
      state.inactivityShown = true;
      addSystem(state.config.inactivityMessage || "Are you still there?");
    }, seconds * 1000);
  }

  launcher.addEventListener("click", openPanel);
  letsChat.addEventListener("click", showChat);
  tabChat.addEventListener("click", showChat);
  tabHome.addEventListener("click", showHome);
  backBtn.addEventListener("click", showHome);
  minBtn.addEventListener("click", function () { container.classList.remove("lcw-open"); });

  // The 👋 greeting card with quick-reply buttons (first thing in a fresh chat).
  function maybeShowGreeting() {
    if (state.conversationId || root.querySelector(".lcw-greet") || messages.children.length > 0) return;
    var welcome = state.away
      ? ((state.config && state.config.offlineMessage) || "We are away. Leave a message and we will reply soon.")
      : ((state.config && state.config.welcomeMessage) || t("welcome"));
    var card = document.createElement("div");
    card.className = "lcw-greet";
    card.innerHTML =
      '<div class="lcw-greet-emoji">\u{1F44B}</div>' +
      '<div class="lcw-greet-txt"></div>' +
      '<div class="lcw-quick"><button class="lcw-q lcw-q1" type="button"></button><button class="lcw-q lcw-q2" type="button"></button></div>';
    card.querySelector(".lcw-greet-txt").textContent = welcome;
    card.querySelector(".lcw-q1").textContent = t("chatNow");
    card.querySelector(".lcw-q2").textContent = t("browsing");
    messages.appendChild(card);
    card.querySelector(".lcw-q1").addEventListener("click", function () { card.remove(); showMenuOptions(); input.focus(); });
    card.querySelector(".lcw-q2").addEventListener("click", function () { card.remove(); });
    // If quick-reply menu options are configured, show them right away too.
    if (state.config && state.config.menuOptions && state.config.menuOptions.length) {
      showMenuOptions();
    }
  }

  // Chatbot flow: render configured quick-reply buttons; a tap sends the label + bot reply.
  function showMenuOptions() {
    var opts = state.config && state.config.menuOptions;
    if (!opts || !opts.length) return;
    if (root.querySelector(".lcw-menu")) return;
    var wrap = document.createElement("div");
    wrap.className = "lcw-menu";
    wrap.style.cssText = "display:flex;flex-direction:column;gap:6px;align-self:flex-start;max-width:82%;margin-top:2px";
    opts.forEach(function (opt) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = opt.label;
      b.style.cssText = "text-align:left;border:1px solid var(--lcw-accent,#ffd21e);background:transparent;color:inherit;border-radius:10px;padding:9px 12px;font-size:13px;cursor:pointer";
      b.addEventListener("click", function () { wrap.remove(); selectMenuOption(opt); });
      wrap.appendChild(b);
    });
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  function selectMenuOption(opt) {
    var reqReply = function (convId) {
      fetchJson("/widgets/public/" + encodeURIComponent(widgetKey) + "/conversations/" + encodeURIComponent(convId) + "/menu-reply", {
        method: "POST",
        body: { sessionToken: state.sessionToken, optionId: opt.id }
      }).then(function (msg) { if (msg) renderMessage(msg); }).catch(function () {});
    };
    ensureReady().then(function () {
      if (!state.conversationId) {
        var chatMeta = { pageUrl: window.location.href };
        if (state.preChatAnswers) chatMeta.preChat = state.preChatAnswers;
        var createBody = { sessionToken: state.sessionToken, body: opt.label, subject: "Website chat", metadata: chatMeta };
        if (state.visitorName) createBody.name = state.visitorName;
        if (state.visitorEmail) createBody.email = state.visitorEmail;
        return fetchJson("/widgets/public/" + encodeURIComponent(widgetKey) + "/conversations", {
          method: "POST",
          body: createBody
        }).then(function (result) {
          state.conversationId = result.conversation.id;
          localStorage.setItem(storagePrefix + "conversationId", state.conversationId);
          renderMessage(result.message);
          if (state.socket) state.socket.emit("conversation.join", { conversationId: state.conversationId });
          reqReply(state.conversationId);
        });
      }
      return fetchJson("/widgets/public/" + encodeURIComponent(widgetKey) + "/conversations/" + encodeURIComponent(state.conversationId) + "/messages", {
        method: "POST",
        body: { sessionToken: state.sessionToken, body: opt.label, idempotencyKey: "menu-" + Date.now() + "-" + Math.random().toString(36).slice(2) }
      }).then(function (msg) { renderMessage(msg); reqReply(state.conversationId); });
    }).catch(function () { addSystem("Could not load that option. Please try again."); });
  }

  function maybeShowPreChat() {
    if (
      state.config &&
      state.config.preChatEnabled &&
      !state.preChatDone &&
      !state.conversationId
    ) {
      showPreChatForm();
    }
  }

  function preChatFields() {
    var fields = state.config && state.config.preChatFields;
    if (!fields || !fields.length) {
      return [
        { id: "name", label: "Your name", type: "text", required: false },
        { id: "email", label: "Email", type: "email", required: false }
      ];
    }
    return fields;
  }

  function showPreChatForm() {
    if (root.querySelector(".lcw-prechat")) return;
    var wrap = document.createElement("form");
    wrap.className = "lcw-prechat lcw-msg lcw-agent";
    wrap.style.maxWidth = "100%";
    var fieldStyle = "width:100%;box-sizing:border-box;margin-bottom:8px;padding:10px;border:1px solid #3a3a42;border-radius:9px;font-size:13px;background:#26262b;color:#fff;outline:none";
    var html = '<div style="font-weight:700;margin-bottom:10px">Before we start, who are we chatting with?</div>';
    var fields = preChatFields();
    fields.forEach(function (field, index) {
      var req = field.required ? " required" : "";
      var star = field.required ? " *" : "";
      if (field.type === "textarea") {
        html += '<textarea data-field="' + index + '" placeholder="' + escapeAttr(field.label) + star + '" rows="2" style="' + fieldStyle + '"' + req + '></textarea>';
      } else {
        var inputType = field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
        html += '<input data-field="' + index + '" type="' + inputType + '" placeholder="' + escapeAttr(field.label) + star + '" style="' + fieldStyle + '"' + req + ' />';
      }
    });
    html += '<button type="submit" style="width:100%;padding:11px;border:0;border-radius:9px;background:var(--lcw-accent,#ffd21e);color:#111;font-weight:800;cursor:pointer">' + t("startChat") + '</button>';
    wrap.innerHTML = html;
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
    form.style.display = "none";
    wrap.addEventListener("submit", function (event) {
      event.preventDefault();
      var answers = {};
      var anyValue = false;
      var els = wrap.querySelectorAll("[data-field]");
      for (var i = 0; i < els.length; i++) {
        var field = fields[i];
        var value = els[i].value.trim();
        if (field.required && !value) { els[i].focus(); return; }
        if (value) {
          answers[field.id] = value;
          anyValue = true;
          if (field.id === "name" || field.type === "text" && !state.visitorName) state.visitorName = state.visitorName || value;
          if (field.id === "email" || field.type === "email") state.visitorEmail = value;
        }
      }
      if (answers.name) state.visitorName = answers.name;
      if (!anyValue) return;
      state.preChatAnswers = answers;
      if (state.visitorName) localStorage.setItem(storagePrefix + "visitorName", state.visitorName);
      if (state.visitorEmail) localStorage.setItem(storagePrefix + "visitorEmail", state.visitorEmail);
      localStorage.setItem(storagePrefix + "preChatDone", "1");
      state.preChatDone = true;
      wrap.remove();
      form.style.display = "";
      input.focus();
    });
  }

  function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Post-chat form: shown once the visitor rates the chat, if enabled.
  function maybeShowPostChat() {
    if (!state.config || !state.config.postChatEnabled) return;
    if (!state.conversationId) return;
    if (localStorage.getItem(storagePrefix + "postChat:" + state.conversationId)) return;
    if (root.querySelector(".lcw-postchat")) return;
    var wrap = document.createElement("form");
    wrap.className = "lcw-postchat lcw-msg lcw-agent";
    wrap.style.maxWidth = "100%";
    var fieldStyle = "width:100%;box-sizing:border-box;margin-bottom:8px;padding:10px;border:1px solid #3a3a42;border-radius:9px;font-size:13px;background:#26262b;color:#fff;outline:none";
    var msg = state.config.postChatMessage || "Thanks for chatting! Anything else we can help with?";
    wrap.innerHTML =
      '<div style="font-weight:700;margin-bottom:10px">' + escapeAttr(msg) + '</div>' +
      '<textarea class="lcw-post-note" placeholder="Leave us a note (optional)" rows="2" style="' + fieldStyle + '"></textarea>' +
      '<button type="submit" style="width:100%;padding:11px;border:0;border-radius:9px;background:var(--lcw-accent,#ffd21e);color:#111;font-weight:800;cursor:pointer">Send</button>';
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
    wrap.addEventListener("submit", function (event) {
      event.preventDefault();
      var note = wrap.querySelector(".lcw-post-note").value.trim();
      localStorage.setItem(storagePrefix + "postChat:" + state.conversationId, "1");
      if (note) { sendMessage(note); }
      wrap.remove();
      addSystem("Thanks for your feedback!");
    });
  }
  closeButton.addEventListener("click", function () {
    container.classList.remove("lcw-open");
  });
  var stopTypingTimer = null;
  function emitTyping(isTyping, preview) {
    if (!state.socket || !state.conversationId) return;
    state.socket.emit("typing.update", {
      conversationId: state.conversationId,
      isTyping: isTyping,
      preview: isTyping ? String(preview || "").slice(0, 200) : ""
    });
  }
  // Message sneak-peek: show what the visitor is typing in the agent's live-visitors
  // list, EVEN before the first message is sent (no conversation yet).
  function emitVisitorPreview(isTyping, preview) {
    if (!state.socket) return;
    state.socket.emit("visitor.preview", {
      isTyping: isTyping,
      preview: isTyping ? String(preview || "").slice(0, 200) : ""
    });
  }
  input.addEventListener("input", function () {
    emitTyping(input.value.length > 0, input.value);
    emitVisitorPreview(input.value.length > 0, input.value);
    if (stopTypingTimer) clearTimeout(stopTypingTimer);
    stopTypingTimer = setTimeout(function () {
      emitTyping(false, "");
      emitVisitorPreview(false, "");
    }, 2500);
    state.inactivityShown = false;
    resetInactivityTimer();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var body = input.value.trim();
    if (!body) return;
    input.value = "";
    if (stopTypingTimer) clearTimeout(stopTypingTimer);
    emitTyping(false, "");
    emitVisitorPreview(false, "");
    sendMessage(body);
  });

  fetchJson("/widgets/public/" + encodeURIComponent(widgetKey) + "/config")
    .then(function (config) {
      state.config = config;
      container.style.setProperty("--lcw-accent", config.theme && config.theme.accentColor ? config.theme.accentColor : "#ff5a00");
      if (config.theme && config.theme.position === "left") {
        container.style.left = "20px";
        container.style.right = "auto";
      }
      var brand = config.name || "Support";
      var ini = brand.replace(/[^A-Za-z0-9 ]/g, "").split(" ").map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase() || "LC";
      root.querySelector(".lcw-brand-name").textContent = brand;
      root.querySelector(".lcw-agent-name").textContent = brand;
      root.querySelector(".lcw-brand-ini").textContent = ini;
      root.querySelector(".lcw-agent-ini").textContent = ini;
      // Working hours: if enabled and currently offline, show "away" mode.
      var away = config.workingHoursEnabled === true && config.online === false;
      state.away = away;
      var welcome = away
        ? (config.offlineMessage || "We are away right now. Leave a message and we will reply soon.")
        : (config.welcomeMessage || t("welcome"));
      root.querySelector(".lcw-brand-msg").textContent = welcome;
      if (away) {
        var dots = root.querySelectorAll(".lcw-dot");
        for (var di = 0; di < dots.length; di++) { dots[di].style.background = "#94a3b8"; }
        var bt = root.querySelector(".lcw-brand-time"); if (bt) bt.textContent = "Away";
        var ar = root.querySelector(".lcw-agent-role"); if (ar) ar.textContent = "Away — leave a message";
      }
      applyLanguage(config.language || "en");
      applyAccessibility(config);
      if (config.cookieConsent) {
        showCookieConsent();
      }
      if (config.gtmContainerId) {
        setupGtm(config.gtmContainerId);
      }
      if (config.eyeCatcherEnabled && config.eyeCatcher) {
        setTimeout(showEyeCatcher, 2500);
      }
    })
    .catch(function () {
      addSystem("Chat is temporarily unavailable.");
    });

  // Eye-catcher: a small teaser bubble above the launcher before the widget opens.
  function showEyeCatcher() {
    if (container.classList.contains("lcw-open")) return;
    if (root.querySelector(".lcw-eye") || localStorage.getItem(storagePrefix + "eyeSeen")) return;
    var tip = document.createElement("div");
    tip.className = "lcw-eye";
    tip.style.cssText = "position:absolute;bottom:74px;right:0;max-width:230px;background:#fff;color:#111;border-radius:14px;padding:12px 30px 12px 14px;font-size:13px;line-height:1.4;box-shadow:0 12px 34px rgba(0,0,0,.25);cursor:pointer";
    tip.textContent = state.config.eyeCatcher;
    var x = document.createElement("button");
    x.type = "button";
    x.textContent = "×";
    x.style.cssText = "position:absolute;top:4px;right:6px;border:0;background:none;font-size:16px;cursor:pointer;color:#888";
    x.onclick = function (e) { e.stopPropagation(); localStorage.setItem(storagePrefix + "eyeSeen", "1"); tip.remove(); };
    tip.appendChild(x);
    tip.addEventListener("click", function () { tip.remove(); openPanel(); showChat(); });
    container.appendChild(tip);
  }

  // Public JS API so sites can open chat / track sales (sales tracker).
  window.LiveChatSaaS = window.LiveChatSaaS || {};
  window.LiveChatSaaS.open = function () { openPanel(); showChat(); };
  window.LiveChatSaaS.trackSale = function (amount, currency, reference) {
    var value = Number(amount) || 0;
    var cur = currency || "USD";
    trackGtm("livechat_sale", { value: value, currency: cur });
    try { localStorage.setItem(storagePrefix + "lastSale", String(amount)); } catch (e) {}
    // Persist the sale so it shows up in Ecommerce reports (needs an active session).
    ensureReady().then(function () {
      if (!state.sessionToken) return;
      var body = {
        sessionToken: state.sessionToken,
        amountCents: Math.round(value * 100),
        currency: String(cur).toLowerCase()
      };
      if (reference) body.reference = String(reference);
      if (state.conversationId) body.conversationId = state.conversationId;
      fetchJson("/widgets/public/" + encodeURIComponent(widgetKey) + "/sales", {
        method: "POST",
        body: body
      }).catch(function () {});
    }).catch(function () {});
  };

  // --- Languages: translate the widget's own UI chrome ---
  var LCW_I18N = {
    en: { subtitle: "We usually reply instantly", placeholder: "Write a message...", welcome: "Hi, let us know if you have any questions.", startChat: "Start chat", cookie: "We use cookies to power this chat.", accept: "OK", chatNow: "Chat now", browsing: "Just browsing" },
    ur: { subtitle: "ہم عام طور پر فوری جواب دیتے ہیں", placeholder: "پیغام لکھیں...", welcome: "سلام! کوئی سوال ہو تو بتائیں۔", startChat: "چیٹ شروع کریں", cookie: "یہ چیٹ کوکیز استعمال کرتی ہے۔", accept: "ٹھیک ہے", chatNow: "ابھی چیٹ کریں", browsing: "بس دیکھ رہا ہوں" },
    es: { subtitle: "Solemos responder al instante", placeholder: "Escribe un mensaje...", welcome: "Hola, dinos si tienes alguna pregunta.", startChat: "Iniciar chat", cookie: "Usamos cookies para este chat.", accept: "OK", chatNow: "Chatear ahora", browsing: "Solo mirando" },
    fr: { subtitle: "Nous répondons généralement vite", placeholder: "Écrivez un message...", welcome: "Bonjour, dites-nous si vous avez des questions.", startChat: "Démarrer le chat", cookie: "Nous utilisons des cookies pour ce chat.", accept: "OK", chatNow: "Discuter", browsing: "Je regarde" },
    de: { subtitle: "Wir antworten meist sofort", placeholder: "Nachricht schreiben...", welcome: "Hallo, sag uns Bescheid, wenn du Fragen hast.", startChat: "Chat starten", cookie: "Wir verwenden Cookies für diesen Chat.", accept: "OK", chatNow: "Jetzt chatten", browsing: "Nur schauen" },
    ar: { subtitle: "عادة ما نرد فورًا", placeholder: "اكتب رسالة...", welcome: "مرحبًا، أخبرنا إن كان لديك أي أسئلة.", startChat: "ابدأ المحادثة", cookie: "نستخدم ملفات تعريف الارتباط.", accept: "حسنًا", chatNow: "تحدث الآن", browsing: "أتصفح فقط" },
    hi: { subtitle: "हम आमतौर पर तुरंत जवाब देते हैं", placeholder: "संदेश लिखें...", welcome: "नमस्ते, कोई सवाल हो तो बताएं।", startChat: "चैट शुरू करें", cookie: "हम इस चैट के लिए कुकीज़ का उपयोग करते हैं।", accept: "ठीक है", chatNow: "अभी चैट करें", browsing: "बस देख रहा हूँ" },
    pt: { subtitle: "Costumamos responder na hora", placeholder: "Escreva uma mensagem...", welcome: "Olá, avise-nos se tiver alguma dúvida.", startChat: "Iniciar chat", cookie: "Usamos cookies para este chat.", accept: "OK", chatNow: "Conversar", browsing: "Só olhando" }
  };
  function t(key) {
    var lang = (state.config && state.config.language) || "en";
    var table = LCW_I18N[lang] || LCW_I18N.en;
    return table[key] || LCW_I18N.en[key] || key;
  }
  function applyLanguage(lang) {
    var rtl = lang === "ar" || lang === "ur";
    root.setAttribute("dir", rtl ? "rtl" : "ltr");
    var sub = root.querySelector(".lcw-subtitle");
    if (sub) sub.textContent = t("subtitle");
    if (input) input.setAttribute("placeholder", t("placeholder"));
  }
  function applyAccessibility(config) {
    if (config.highContrast) {
      container.style.setProperty("--lcw-accent", "#000000");
      root.style.filter = "contrast(1.15)";
    }
    if (config.largeText) {
      root.style.fontSize = "16px";
    }
  }
  function showCookieConsent() {
    if (localStorage.getItem(storagePrefix + "cookieOk")) return;
    var bar = document.createElement("div");
    bar.style.cssText = "position:absolute;left:0;right:0;bottom:0;background:#111214;color:#fff;font-size:12px;padding:10px 12px;display:flex;gap:8px;align-items:center;z-index:5";
    bar.innerHTML = '<span style="flex:1">' + t("cookie") + '</span>';
    var btn = document.createElement("button");
    btn.textContent = t("accept");
    btn.style.cssText = "border:0;border-radius:6px;background:var(--lcw-accent,#ff5a00);color:#fff;padding:6px 12px;font-weight:800;cursor:pointer";
    btn.onclick = function () { localStorage.setItem(storagePrefix + "cookieOk", "1"); bar.remove(); };
    bar.appendChild(btn);
    root.appendChild(bar);
  }

  // Google Tag Manager: load the real container and push chat events to dataLayer.
  function setupGtm(containerId) {
    if (window.__lcwGtmLoaded) return;
    window.__lcwGtmLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(containerId);
    document.head.appendChild(s);
    trackGtm("livechat_loaded");
  }

  function trackGtm(event, extra) {
    if (!state.config || !state.config.gtmContainerId || !window.dataLayer) return;
    var payload = { event: event };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
      }
    }
    window.dataLayer.push(payload);
  }

  function ensureSession() {
    if (state.sessionToken) return Promise.resolve();

    return fetchJson("/widgets/public/" + encodeURIComponent(widgetKey) + "/sessions", {
      method: "POST",
      body: {
        visitorExternalId: state.visitorExternalId,
        pageUrl: window.location.href,
        pageTitle: document.title,
        referrer: document.referrer || "",
        metadata: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ""
        }
      }
    }).then(function (session) {
      state.sessionToken = session.sessionToken;
      localStorage.setItem(storagePrefix + "sessionToken", state.sessionToken);
    });
  }

  function ensureReady() {
    return ensureSession().then(function () {
      connectSocket();
      loadHistory();
    });
  }

  function sendHeartbeat() {
    if (!state.sessionToken) return;
    fetch(apiBase + "/widgets/public/" + encodeURIComponent(widgetKey) + "/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionToken: state.sessionToken,
        pageUrl: window.location.href,
        pageTitle: document.title
      }),
      mode: "cors",
      keepalive: true
    }).catch(function () {});
  }

  // Track every visitor on the site (even if they never open the chat),
  // so agents can see who is live and on which page.
  ensureSession()
    .then(function () {
      sendHeartbeat();
      setInterval(function () {
        if (document.visibilityState !== "hidden") sendHeartbeat();
      }, 25000);
    })
    .catch(function () {});

  function connectSocket() {
    if (!state.sessionToken || state.socket || !window.io) {
      if (!window.io) loadSocketClient();
      return;
    }

    state.socket = window.io(socketOrigin + "/chat", {
      transports: ["websocket"],
      auth: {
        widgetKey: widgetKey,
        sessionToken: state.sessionToken,
        visitor: true
      }
    });
    state.socket.on("chat.ready", function () {
      if (state.conversationId) {
        state.socket.emit("conversation.join", { conversationId: state.conversationId });
      }
    });
    state.socket.on("message.created", function (payload) {
      if (!payload || !payload.message || payload.message.conversationId !== state.conversationId) return;
      hideAgentTyping();
      renderMessage(payload.message);
    });
    state.socket.on("typing.updated", function (payload) {
      if (!payload || payload.conversationId !== state.conversationId) return;
      if (payload.senderType === "AGENT") {
        if (payload.isTyping) showAgentTyping();
        else hideAgentTyping();
      }
    });
  }

  function showAgentTyping() {
    if (document.querySelector(".lcw-typing")) return;
    var el = document.createElement("div");
    el.className = "lcw-msg lcw-agent lcw-typing";
    el.textContent = "typing…";
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideAgentTyping() {
    var el = document.querySelector(".lcw-typing");
    if (el) el.remove();
  }

  function loadSocketClient() {
    if (document.querySelector("script[data-lcw-socket-client]")) return;
    var socketScript = document.createElement("script");
    socketScript.async = true;
    socketScript.src = socketOrigin + "/socket.io/socket.io.js";
    socketScript.setAttribute("data-lcw-socket-client", "true");
    socketScript.onload = connectSocket;
    document.head.appendChild(socketScript);
  }

  function sendMessage(body) {
    trackGtm("livechat_message_sent");
    ensureReady().then(function () {
      if (!state.conversationId) {
        var chatMeta = { pageUrl: window.location.href };
        if (state.preChatAnswers) chatMeta.preChat = state.preChatAnswers;
        var createBody = {
          sessionToken: state.sessionToken,
          body: body,
          subject: "Website chat",
          metadata: chatMeta
        };
        if (state.visitorName) createBody.name = state.visitorName;
        if (state.visitorEmail) createBody.email = state.visitorEmail;
        return fetchJson("/widgets/public/" + encodeURIComponent(widgetKey) + "/conversations", {
          method: "POST",
          body: createBody
        }).then(function (result) {
          state.conversationId = result.conversation.id;
          localStorage.setItem(storagePrefix + "conversationId", state.conversationId);
          renderMessage(result.message);
          trackGtm("livechat_conversation_started");
          if (state.socket) state.socket.emit("conversation.join", { conversationId: state.conversationId });
        });
      }

      return fetchJson("/widgets/public/" + encodeURIComponent(widgetKey) + "/conversations/" + encodeURIComponent(state.conversationId) + "/messages", {
        method: "POST",
        body: {
          sessionToken: state.sessionToken,
          body: body,
          idempotencyKey: "visitor-" + Date.now() + "-" + Math.random().toString(36).slice(2)
        }
      }).then(renderMessage);
    }).catch(function () {
      addSystem("Message could not be sent. Please try again.");
    });
  }

  function loadHistory() {
    if (!state.conversationId || !state.sessionToken) return;
    fetchJson("/widgets/public/" + encodeURIComponent(widgetKey) + "/conversations/" + encodeURIComponent(state.conversationId) + "/messages?sessionToken=" + encodeURIComponent(state.sessionToken))
      .then(function (items) { items.forEach(renderMessage); })
      .catch(function () {});
  }

  function renderMessage(message) {
    if (!message || state.renderedMessageIds[message.id]) return;
    state.renderedMessageIds[message.id] = true;
    var card = message.metadata && message.metadata.productCard;
    if (card && typeof card === "object") {
      messages.appendChild(buildProductCard(card));
      messages.scrollTop = messages.scrollHeight;
      if (message.senderType === "AGENT") { maybeShowRating(); }
      return;
    }
    var bubble = document.createElement("div");
    bubble.className = "lcw-msg " + (message.senderType === "VISITOR" ? "lcw-visitor" : "lcw-agent");
    bubble.textContent = message.body || "Attachment";
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    if (message.senderType === "AGENT") { maybeShowRating(); }
    // Any real message resets the quiet timer.
    state.inactivityShown = false;
    resetInactivityTimer();
  }

  // Ecommerce: render an agent-sent product recommendation as a rich card.
  function buildProductCard(card) {
    var wrap = document.createElement("div");
    wrap.className = "lcw-msg lcw-agent lcw-product";
    wrap.style.cssText = "padding:0;overflow:hidden;background:#fff;color:#111;border:1px solid #e4e4e8";
    if (card.image) {
      var img = document.createElement("img");
      img.src = String(card.image);
      img.alt = String(card.title || "Product");
      img.style.cssText = "width:100%;height:120px;object-fit:cover;display:block";
      wrap.appendChild(img);
    }
    var body = document.createElement("div");
    body.style.cssText = "padding:10px 12px";
    var title = document.createElement("div");
    title.style.cssText = "font-weight:700;font-size:13px";
    title.textContent = String(card.title || "Product");
    body.appendChild(title);
    if (card.description) {
      var desc = document.createElement("div");
      desc.style.cssText = "font-size:12px;color:#666;margin-top:3px";
      desc.textContent = String(card.description);
      body.appendChild(desc);
    }
    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:8px";
    if (card.price) {
      var price = document.createElement("span");
      price.style.cssText = "font-weight:700;font-size:14px";
      price.textContent = String(card.price);
      row.appendChild(price);
    }
    if (card.url) {
      var link = document.createElement("a");
      link.href = String(card.url);
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = card.buttonLabel ? String(card.buttonLabel) : "View";
      link.style.cssText = "background:var(--lcw-accent,#ffd21e);color:#111;font-weight:700;font-size:12px;text-decoration:none;padding:6px 12px;border-radius:8px";
      row.appendChild(link);
    }
    body.appendChild(row);
    wrap.appendChild(body);
    return wrap;
  }

  // CSAT: once an agent has replied, let the visitor rate the chat 👍/👎.
  function maybeShowRating() {
    if (!state.conversationId) return;
    if (localStorage.getItem(storagePrefix + "rated:" + state.conversationId)) return;
    if (root.querySelector(".lcw-rate")) return;
    var bar = document.createElement("div");
    bar.className = "lcw-rate";
    bar.style.cssText = "align-self:center;background:#2f2f36;border-radius:12px;padding:9px 13px;font-size:12px;color:#cfcfd6;display:flex;align-items:center;gap:8px;margin-top:4px";
    var label = document.createElement("span");
    label.textContent = "How was this chat?";
    bar.appendChild(label);
    ["good", "bad"].forEach(function (r) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = r === "good" ? "\u{1F44D}" : "\u{1F44E}";
      b.style.cssText = "border:0;background:#3a3a42;border-radius:8px;padding:5px 9px;font-size:15px;cursor:pointer";
      b.onclick = function () { submitRating(r, bar); };
      bar.appendChild(b);
    });
    messages.appendChild(bar);
    messages.scrollTop = messages.scrollHeight;
  }

  function submitRating(rating, bar) {
    if (!state.conversationId || !state.sessionToken) return;
    fetchJson("/widgets/public/" + encodeURIComponent(widgetKey) + "/conversations/" + encodeURIComponent(state.conversationId) + "/rate", {
      method: "POST",
      body: { sessionToken: state.sessionToken, rating: rating }
    }).then(function () {
      localStorage.setItem(storagePrefix + "rated:" + state.conversationId, "1");
      bar.textContent = rating === "good" ? "Thanks for your feedback! \u{1F60A}" : "Thanks — we'll do better. \u{1F64F}";
      trackGtm("livechat_rated", { rating: rating });
      maybeShowPostChat();
    }).catch(function () {});
  }

  function addSystem(text) {
    var bubble = document.createElement("div");
    bubble.className = "lcw-msg lcw-system";
    bubble.textContent = text;
    messages.appendChild(bubble);
  }

  function fetchJson(path, options) {
    options = options || {};
    return fetch(apiBase + path, {
      method: options.method || "GET",
      headers: options.body ? { "content-type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      mode: "cors"
    }).then(function (response) {
      if (!response.ok) throw new Error("Request failed");
      return response.json();
    });
  }
})();
`;
}
