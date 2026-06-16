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
  memberships: AuthMembership[];
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
