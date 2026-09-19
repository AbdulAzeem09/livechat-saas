export interface AuthMembership {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  displayName: string | null;
  roles: string[];
  permissions: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  memberships: AuthMembership[];
}

export interface Entitlements {
  active: boolean;
  reason: string | null;
  message: string | null;
  planCode: string;
  agentLimit: number | null;
  trialEndsAt: string | null;
}

export interface AgentShift {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface MemberSchedule {
  membershipId: string;
  shifts: AgentShift[];
}

export interface AppNotification {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface ContactNote {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  attributes: Record<string, unknown>;
  tags: string[];
  conversationCount: number;
  lastConversationAt: string | null;
  notes: ContactNote[];
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
  user: AuthUser;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  planCode: string;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
  membership?: {
    id: string;
    organizationId: string;
    userId: string;
    displayName: string | null;
    title: string | null;
    timezone: string;
    status: string;
    agentStatus: string;
    maxOpenChats: number;
    roles: string[];
    permissions: string[];
  };
}

export type ConversationStatus = "QUEUED" | "OPEN" | "PENDING" | "RESOLVED" | "CLOSED" | "SPAM";
export type ConversationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ConversationSource = "WIDGET" | "EMAIL" | "API" | "SOCIAL" | "MANUAL";
export type ParticipantType = "VISITOR" | "AGENT" | "SYSTEM";
export type MessageType = "TEXT" | "FILE" | "SYSTEM" | "EVENT" | "NOTE";
export type MessageVisibility = "PUBLIC" | "INTERNAL";
export type MessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";

export interface Message {
  id: string;
  organizationId: string;
  conversationId: string;
  senderType: ParticipantType;
  senderVisitorId: string | null;
  senderMembershipId: string | null;
  type: MessageType;
  visibility: MessageVisibility;
  status: MessageStatus;
  body: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface Conversation {
  id: string;
  organizationId: string;
  visitorId: string | null;
  contactId: string | null;
  widgetId: string | null;
  departmentId: string | null;
  assignedAgentId: string | null;
  source: ConversationSource;
  status: ConversationStatus;
  priority: ConversationPriority;
  subject: string | null;
  locale: string | null;
  metadata: Record<string, unknown>;
  firstResponseAt: string | null;
  lastMessageAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestMessage?: Message | null;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  title: string | null;
  timezone: string;
  status: string;
  agentStatus: string;
  maxOpenChats: number;
  roles: string[];
  permissions: string[];
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  roleId: string | null;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  token?: string | null;
  emailSent?: boolean;
}

export interface InvitationPreview {
  valid: boolean;
  email: string | null;
  organizationName: string | null;
  reason?: string;
}

export interface BillingPlan {
  id: string;
  code: string;
  name: string;
  interval: "MONTHLY" | "YEARLY";
  priceCents: number;
  currency: string;
  features: Record<string, unknown>;
}

export interface BillingSubscription {
  id: string;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  provider: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isMock: boolean;
  perSeat: boolean;
  seatCount: number;
  perAgentCents: number | null;
  amountCents: number;
}

export interface AcceptJsConfig {
  apiLoginId: string;
  clientKey: string;
  environment: "sandbox" | "production" | string;
}

export interface BillingAddon {
  code: string;
  name: string;
  description: string;
  priceCents: number;
  active: boolean;
}

export interface BillingOverview {
  entitlements: Entitlements;
  plans: BillingPlan[];
  subscription: BillingSubscription | null;
  addons: BillingAddon[];
  gatewayConfigured: boolean;
  acceptJs: AcceptJsConfig | null;
}

export interface BillingInvoice {
  id: string;
  number: string;
  status: string;
  currency: string;
  amountDueCents: number;
  amountPaidCents: number;
  planName: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AutomationRule {
  id: string;
  organizationId: string;
  name: string;
  enabled: boolean;
  isGreeting: boolean;
  keywords: string[];
  replyMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  triggerType: string;
  triggerValue: string;
  message: string;
  enabled: boolean;
  displayedCount: number;
  chatsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  target: string;
  valueCents: number;
  enabled: boolean;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  organizationId: string;
  subject: string;
  requesterName: string;
  requesterEmail: string;
  description: string;
  status: string;
  priority: string;
  conversationId: string | null;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeArticle {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  category: string;
  published: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey extends ApiKey {
  secret: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
}

export interface CreatedWebhook extends Webhook {
  secret: string;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  routingWeight: number;
  isDefault: boolean;
  agentMembershipIds: string[];
  agentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LiveVisitor {
  id: string;
  name: string | null;
  email: string | null;
  firstSeenAt: string;
  lastSeenAt: string | null;
  sessionStartedAt: string | null;
  currentPage: string | null;
  currentPageTitle: string | null;
  landingPage: string | null;
  referrer: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  isp: string | null;
  network: string | null;
  ip: string | null;
  activity: string;
  chattingWithAgentId: string | null;
  pageViewCount: number;
  activeConversationId: string | null;
}

export interface ReportEngagement {
  visitors: number;
  chats: number;
  engagementRate: number;
  missedChats: number;
  averageMessagesPerChat: number;
}

export interface ReportSummary {
  engagement: ReportEngagement;
  customers: { total: number; returning: number; newLast7Days: number };
  tagUsage: Array<{ tag: string; count: number }>;
  campaigns: { total: number; active: number; goals: number; goalsCompleted: number; delivering: boolean };
  totalConversations: number;
  totalMessages: number;
  byStatus: Record<string, number>;
  openCount: number;
  resolvedCount: number;
  last7Days: Array<{ date: string; count: number }>;
  averageFirstResponseSeconds: number | null;
  satisfaction: { good: number; bad: number };
  ecommerce: {
    salesCount: number;
    salesTotalCents: number;
    currency: string;
    averageOrderCents: number;
    conversionRate: number;
    last7Days: Array<{ date: string; total: number }>;
  };
  legal: {
    active: boolean;
    totalIntakes: number;
    qualifiedLeads: number;
    afterHoursLeads: number;
    flaggedLeads: number;
    flags: { conflict: number; jurisdiction: number; statute: number };
  };
}

export interface CannedResponse {
  id: string;
  organizationId: string;
  categoryId: string | null;
  title: string;
  shortcut: string;
  body: string;
  tags: string[];
  isShared: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea";
  required: boolean;
}

export interface MenuOption {
  id: string;
  label: string;
  reply: string;
}

export interface WidgetInstall {
  id: string;
  publicKey: string;
  name: string;
  scriptUrl: string;
  installCode: string;
  demoUrl: string;
  allowedDomains?: string[];
  emailForwardTo?: string;
  emailForwardEnabled?: boolean;
  workingHoursEnabled?: boolean;
  workingHours?: {
    timezone?: string;
    days?: Array<{ on: boolean; from: string; to: string }>;
  } | null;
  eyeCatcher?: string;
  eyeCatcherEnabled?: boolean;
  eyeCatcherTheme?: string;
  slackWebhookUrl?: string;
  preChatEnabled?: boolean;
  preChatFields?: FormField[];
  postChatEnabled?: boolean;
  postChatMessage?: string;
  bannedIps?: string[];
  inactivityEnabled?: boolean;
  inactivityMessage?: string;
  inactivitySeconds?: number;
  menuOptions?: MenuOption[];
  publicConfig?: {
    publicKey: string;
    name: string;
    welcomeMessage: string;
    offlineMessage: string;
    theme: {
      accentColor: string;
      position: "left" | "right";
    };
    preChatEnabled: boolean;
    gtmContainerId?: string;
    language?: string;
    highContrast?: boolean;
    largeText?: boolean;
    cookieConsent?: boolean;
    hidePoweredBy?: boolean;
    poweredByText?: string;
    logoUrl?: string;
  };
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
  timestamp: string;
  path: string;
}

export type MessagingChannelKey = "WHATSAPP" | "MESSENGER" | "INSTAGRAM" | "EMAIL" | "APPLE";

export interface ChannelConnection {
  channel: MessagingChannelKey;
  externalId: string;
  displayName: string | null;
  isActive: boolean;
  connected: boolean;
  /** Paste this into Meta as the webhook callback URL. */
  webhookUrl: string;
  verifyToken: string | null;
  lastEventAt: string | null;
}

export interface ConnectChannelInput {
  externalId: string;
  /** Meta channels only; email authenticates with the workspace's own SMTP. */
  accessToken?: string;
  appSecret?: string;
  verifyToken?: string;
  displayName?: string;
}

export interface MarketplaceApp {
  key: string;
  name: string;
  description: string;
  setupHint?: string;
  installed: boolean;
  settings: Record<string, unknown>;
  installedAt: string | null;
}

export interface SsoConnection {
  provider: "GOOGLE" | "MICROSOFT" | "OIDC";
  emailDomain: string;
  issuer: string | null;
  clientId: string;
  autoProvision: boolean;
  isActive: boolean;
  /** Paste this into the identity provider as the allowed redirect URI. */
  redirectUri: string;
}

export interface SaveSsoInput {
  provider: SsoConnection["provider"];
  emailDomain: string;
  clientId: string;
  clientSecret: string;
  issuer?: string;
  autoProvision?: boolean;
}

export type FlowNodeType = "message" | "question" | "collect" | "condition" | "handoff" | "end";

export interface FlowChoice {
  label: string;
  next?: string | null;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  text?: string;
  choices?: FlowChoice[];
  field?: "name" | "email" | "phone" | "company";
  keywords?: string[];
  next?: string | null;
  whenMatch?: string | null;
  otherwise?: string | null;
  /** Where the card sits on the builder canvas. */
  x?: number;
  y?: number;
}

export interface BotFlow {
  id: string;
  name: string;
  isActive: boolean;
  startNodeId: string | null;
  nodes: FlowNode[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  summary: string;
  bullets: string[];
  suggestedNextStep: string;
  usedAI: boolean;
}

export interface TagSuggestion {
  tags: string[];
  applied: string[];
  usedAI: boolean;
}

export interface ReportSchedule {
  id: string;
  reportType: "chats" | "agents" | "tags";
  frequency: "daily" | "weekly";
  recipients: string[];
  hourUtc: number;
  isActive: boolean;
  lastRunAt: string | null;
}

export interface ConversationRevenue {
  conversationId: string;
  currency: string;
  totalCents: number;
  orderCount: number;
  orders: Array<{ amountCents: number; reference: string | null; at: string }>;
}

export interface RevenueOverview {
  currency: string;
  totalCents: number;
  chatsWithRevenue: number;
  conversionRate: number;
  averageOrderCents: number;
  agents: Array<{
    membershipId: string;
    name: string;
    email: string;
    chatsWithRevenue: number;
    totalCents: number;
    currency: string;
  }>;
  topChats: Array<{
    conversationId: string;
    subject: string | null;
    totalCents: number;
    agentName: string | null;
  }>;
}

export interface EnhancedText {
  text: string;
  usedAI: boolean;
  changed: boolean;
}
