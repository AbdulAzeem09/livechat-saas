import type {
  ApiErrorBody,
  AuthResponse,
  AuthUser,
  AutomationRule,
  ApiKey,
  BillingInvoice,
  BillingOverview,
  BillingSubscription,
  Campaign,
  CannedResponse,
  Conversation,
  ConversationPriority,
  ConversationSource,
  ConversationStatus,
  CreatedApiKey,
  CreatedWebhook,
  Department,
  Goal,
  Invitation,
  InvitationPreview,
  KnowledgeArticle,
  Ticket,
  Webhook,
  LiveVisitor,
  Message,
  MessageType,
  MessageVisibility,
  Organization,
  OrganizationMember,
  ReportSummary,
  WidgetInstall
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const SESSION_KEY = "livechat.session";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: ApiErrorBody
  ) {
    super(message);
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string | null;
}

/**
 * Read the stored access/refresh tokens from localStorage. Kept here (rather than
 * importing session.ts) to avoid a circular import; the key must match session.ts.
 */
function readStoredTokens(): { accessToken: string; refreshToken: string } | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { accessToken?: string; refreshToken?: string };
    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
  } catch {
    return null;
  }
}

function persistRefreshedSession(auth: AuthResponse): void {
  if (typeof window === "undefined") {
    return;
  }
  const raw = window.localStorage.getItem(SESSION_KEY);
  let createdAt = new Date().toISOString();
  if (raw) {
    try {
      createdAt = (JSON.parse(raw) as { createdAt?: string }).createdAt ?? createdAt;
    } catch {
      // keep default
    }
  }
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      user: auth.user,
      createdAt
    })
  );
  // Let the app sync its in-memory session so it stops sending the stale token
  // (which would otherwise force a refresh on every subsequent call).
  window.dispatchEvent(new CustomEvent("livechat:session-refreshed"));
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a fresh access token (the API rotates the
 * refresh token too). Concurrent callers share one in-flight request. On an explicit
 * auth failure the session is cleared and the user is sent to /login.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const tokens = readStoredTokens();
      if (!tokens) {
        return null;
      }
      // Retry transient failures (Supabase 5xx / network) before giving up, so a
      // one-off hiccup doesn't surface a "session expired" error or a redirect.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ refreshToken: tokens.refreshToken })
          });

          if (response.status === 401 || response.status === 403) {
            // The refresh token itself is invalid/expired — force a fresh login.
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(SESSION_KEY);
              if (!window.location.pathname.startsWith("/login")) {
                window.location.href = "/login";
              }
            }
            return null;
          }

          if (response.ok) {
            const auth = (await response.json()) as AuthResponse;
            persistRefreshedSession(auth);
            return auth.accessToken;
          }
          // 5xx — wait and retry.
        } catch {
          // network error — wait and retry.
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
      return null;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function fetchWithToken(
  path: string,
  options: RequestOptions,
  token: string | null | undefined
): Promise<Response> {
  const headers = new Headers(options.headers);

  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  // Safe to auto-retry reads on a transient error; never replay mutations.
  const retryable = method === "GET";

  let response = await fetchWithToken(path, options, options.accessToken);

  // Access token expired → transparently refresh once and retry.
  if (
    response.status === 401 &&
    options.accessToken &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/refresh") &&
    !path.startsWith("/auth/register")
  ) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await fetchWithToken(path, options, newToken);
    }
  }

  // Transient DB/pooler hiccups (Supabase) surface as 5xx — quietly retry reads
  // a couple of times with backoff so they don't flash "Internal server error".
  if (retryable && response.status >= 500) {
    for (let attempt = 0; attempt < 2 && response.status >= 500; attempt++) {
      await delay(400 * (attempt + 1));
      response = await fetchWithToken(path, options, options.accessToken);
    }
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new ApiClientError(body?.error.message ?? "Request failed", response.status, body);
  }

  return (await response.json()) as T;
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function register(input: {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  organizationSlug?: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getCurrentUser(accessToken: string): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me", {
    accessToken
  });
}

export function listOrganizations(accessToken: string): Promise<Organization[]> {
  return apiRequest<Organization[]>("/organizations", {
    accessToken
  });
}

export function updateOrganization(
  organizationId: string,
  accessToken: string,
  input: { name?: string; slug?: string; metadata?: Record<string, unknown> }
): Promise<Organization> {
  return apiRequest<Organization>(`/organizations/${organizationId}`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function listConversations(
  organizationId: string,
  accessToken: string,
  query: {
    status?: ConversationStatus;
    assignedToMe?: boolean;
    limit?: number;
  } = {}
): Promise<Conversation[]> {
  const searchParams = new URLSearchParams();

  if (query.status) {
    searchParams.set("status", query.status);
  }

  if (query.assignedToMe !== undefined) {
    searchParams.set("assignedToMe", String(query.assignedToMe));
  }

  if (query.limit) {
    searchParams.set("limit", String(query.limit));
  }

  const queryString = searchParams.toString();

  return apiRequest<Conversation[]>(
    `/organizations/${organizationId}/conversations${queryString ? `?${queryString}` : ""}`,
    { accessToken }
  );
}

export function createConversation(
  organizationId: string,
  accessToken: string,
  input: {
    subject?: string;
    priority?: ConversationPriority;
    source?: ConversationSource;
    initialMessage?: string;
    simulateVisitor?: boolean;
  }
): Promise<Conversation> {
  return apiRequest<Conversation>(`/organizations/${organizationId}/conversations`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function listMessages(
  organizationId: string,
  conversationId: string,
  accessToken: string
): Promise<Message[]> {
  return apiRequest<Message[]>(
    `/organizations/${organizationId}/conversations/${conversationId}/messages`,
    { accessToken }
  );
}

export function sendMessage(
  organizationId: string,
  conversationId: string,
  accessToken: string,
  input: {
    body: string;
    type?: MessageType;
    visibility?: MessageVisibility;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Message> {
  return apiRequest<Message>(
    `/organizations/${organizationId}/conversations/${conversationId}/messages`,
    {
      accessToken,
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function listMembers(
  organizationId: string,
  accessToken: string
): Promise<OrganizationMember[]> {
  return apiRequest<OrganizationMember[]>(`/organizations/${organizationId}/members`, {
    accessToken
  });
}

export function updateMember(
  organizationId: string,
  membershipId: string,
  accessToken: string,
  input: { agentStatus?: "ONLINE" | "OFFLINE" | "AWAY" | "BUSY"; maxOpenChats?: number }
): Promise<OrganizationMember> {
  return apiRequest<OrganizationMember>(
    `/organizations/${organizationId}/members/${membershipId}`,
    { accessToken, method: "PATCH", body: JSON.stringify(input) }
  );
}

export function listInvitations(
  organizationId: string,
  accessToken: string
): Promise<Invitation[]> {
  return apiRequest<Invitation[]>(`/organizations/${organizationId}/invitations`, {
    accessToken
  });
}

export function inviteMember(
  organizationId: string,
  accessToken: string,
  input: { email: string; roleId?: string; expiresInDays?: number }
): Promise<Invitation> {
  return apiRequest<Invitation>(`/organizations/${organizationId}/invitations`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function removeMember(
  organizationId: string,
  membershipId: string,
  accessToken: string
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(
    `/organizations/${organizationId}/members/${membershipId}`,
    { accessToken, method: "DELETE" }
  );
}

export function previewInvitation(token: string): Promise<InvitationPreview> {
  return apiRequest<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`);
}

export function acceptInvitation(
  token: string,
  accessToken: string
): Promise<{ organizationId: string }> {
  return apiRequest<{ organizationId: string }>(
    `/invitations/${encodeURIComponent(token)}/accept`,
    { accessToken, method: "POST" }
  );
}

export function assignConversation(
  organizationId: string,
  conversationId: string,
  accessToken: string,
  assignedAgentId: string,
  reason?: string
): Promise<Conversation> {
  return apiRequest<Conversation>(
    `/organizations/${organizationId}/conversations/${conversationId}/assign`,
    {
      accessToken,
      method: "POST",
      body: JSON.stringify({ assignedAgentId, reason })
    }
  );
}

export function updateConversation(
  organizationId: string,
  conversationId: string,
  accessToken: string,
  input: {
    status?: ConversationStatus;
    priority?: ConversationPriority;
    subject?: string;
  }
): Promise<Conversation> {
  return apiRequest<Conversation>(
    `/organizations/${organizationId}/conversations/${conversationId}`,
    {
      accessToken,
      method: "PATCH",
      body: JSON.stringify(input)
    }
  );
}

export function updateConversationTags(
  organizationId: string,
  conversationId: string,
  accessToken: string,
  tags: string[]
): Promise<Conversation> {
  return apiRequest<Conversation>(
    `/organizations/${organizationId}/conversations/${conversationId}/tags`,
    {
      accessToken,
      method: "PATCH",
      body: JSON.stringify({ tags })
    }
  );
}

export function getReportSummary(
  organizationId: string,
  accessToken: string
): Promise<ReportSummary> {
  return apiRequest<ReportSummary>(`/organizations/${organizationId}/reports/summary`, {
    accessToken
  });
}

export function listLiveVisitors(
  organizationId: string,
  accessToken: string
): Promise<LiveVisitor[]> {
  return apiRequest<LiveVisitor[]>(`/organizations/${organizationId}/visitors/live`, {
    accessToken
  });
}

export function suggestReply(
  organizationId: string,
  conversationId: string,
  accessToken: string
): Promise<{ suggestion: string; usedAI: boolean; model: string | null }> {
  return apiRequest<{ suggestion: string; usedAI: boolean; model: string | null }>(
    `/organizations/${organizationId}/conversations/${conversationId}/ai/suggest`,
    { accessToken, method: "POST" }
  );
}

export function getBillingOverview(
  organizationId: string,
  accessToken: string
): Promise<BillingOverview> {
  return apiRequest<BillingOverview>(`/organizations/${organizationId}/billing`, {
    accessToken
  });
}

export function subscribePlan(
  organizationId: string,
  accessToken: string,
  input: {
    planCode: string;
    billingEmail?: string;
    opaqueDataDescriptor?: string;
    opaqueDataValue?: string;
    cardholderName?: string;
  }
): Promise<BillingSubscription> {
  return apiRequest<BillingSubscription>(`/organizations/${organizationId}/billing/subscribe`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function cancelSubscription(
  organizationId: string,
  accessToken: string
): Promise<BillingSubscription> {
  return apiRequest<BillingSubscription>(`/organizations/${organizationId}/billing/cancel`, {
    accessToken,
    method: "POST"
  });
}

export function listInvoices(
  organizationId: string,
  accessToken: string
): Promise<BillingInvoice[]> {
  return apiRequest<BillingInvoice[]>(`/organizations/${organizationId}/billing/invoices`, {
    accessToken
  });
}

/** Fetch an invoice PDF (with auth header) and trigger a browser download. */
export async function downloadInvoicePdf(
  organizationId: string,
  invoiceId: string,
  accessToken: string,
  filename: string
): Promise<void> {
  const response = await fetch(
    `${API_URL}/organizations/${organizationId}/billing/invoices/${invoiceId}/pdf`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error("Failed to download invoice");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function listAutomationRules(
  organizationId: string,
  accessToken: string
): Promise<AutomationRule[]> {
  return apiRequest<AutomationRule[]>(`/organizations/${organizationId}/automation-rules`, {
    accessToken
  });
}

export function createAutomationRule(
  organizationId: string,
  accessToken: string,
  input: { name: string; replyMessage: string; isGreeting?: boolean; keywords?: string[]; enabled?: boolean }
): Promise<AutomationRule> {
  return apiRequest<AutomationRule>(`/organizations/${organizationId}/automation-rules`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateAutomationRule(
  organizationId: string,
  ruleId: string,
  accessToken: string,
  input: { name?: string; replyMessage?: string; isGreeting?: boolean; keywords?: string[]; enabled?: boolean }
): Promise<AutomationRule> {
  return apiRequest<AutomationRule>(`/organizations/${organizationId}/automation-rules/${ruleId}`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteAutomationRule(
  organizationId: string,
  ruleId: string,
  accessToken: string
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(
    `/organizations/${organizationId}/automation-rules/${ruleId}`,
    { accessToken, method: "DELETE" }
  );
}

export function listCampaigns(organizationId: string, accessToken: string): Promise<Campaign[]> {
  return apiRequest<Campaign[]>(`/organizations/${organizationId}/campaigns`, { accessToken });
}

export function createCampaign(
  organizationId: string,
  accessToken: string,
  input: {
    name: string;
    type?: string;
    triggerType?: string;
    triggerValue?: string;
    message?: string;
    enabled?: boolean;
  }
): Promise<Campaign> {
  return apiRequest<Campaign>(`/organizations/${organizationId}/campaigns`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateCampaign(
  organizationId: string,
  campaignId: string,
  accessToken: string,
  input: { name?: string; message?: string; enabled?: boolean; triggerValue?: string }
): Promise<Campaign> {
  return apiRequest<Campaign>(`/organizations/${organizationId}/campaigns/${campaignId}`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteCampaign(
  organizationId: string,
  campaignId: string,
  accessToken: string
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(
    `/organizations/${organizationId}/campaigns/${campaignId}`,
    { accessToken, method: "DELETE" }
  );
}

export function listGoals(organizationId: string, accessToken: string): Promise<Goal[]> {
  return apiRequest<Goal[]>(`/organizations/${organizationId}/goals`, { accessToken });
}

export function createGoal(
  organizationId: string,
  accessToken: string,
  input: { name: string; type?: string; target?: string; valueCents?: number; enabled?: boolean }
): Promise<Goal> {
  return apiRequest<Goal>(`/organizations/${organizationId}/goals`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function deleteGoal(
  organizationId: string,
  goalId: string,
  accessToken: string
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/organizations/${organizationId}/goals/${goalId}`, {
    accessToken,
    method: "DELETE"
  });
}

export function listTickets(organizationId: string, accessToken: string): Promise<Ticket[]> {
  return apiRequest<Ticket[]>(`/organizations/${organizationId}/tickets`, { accessToken });
}

export function createTicket(
  organizationId: string,
  accessToken: string,
  input: {
    subject: string;
    requesterName?: string;
    requesterEmail?: string;
    description?: string;
    priority?: string;
    conversationId?: string;
  }
): Promise<Ticket> {
  return apiRequest<Ticket>(`/organizations/${organizationId}/tickets`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateTicket(
  organizationId: string,
  ticketId: string,
  accessToken: string,
  input: { status?: string; priority?: string; subject?: string; assigneeId?: string }
): Promise<Ticket> {
  return apiRequest<Ticket>(`/organizations/${organizationId}/tickets/${ticketId}`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteTicket(
  organizationId: string,
  ticketId: string,
  accessToken: string
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/organizations/${organizationId}/tickets/${ticketId}`, {
    accessToken,
    method: "DELETE"
  });
}

export function convertConversationToTicket(
  organizationId: string,
  conversationId: string,
  accessToken: string,
  input: {
    subject?: string;
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    autoReplyMessage?: string;
    resolveConversation?: boolean;
  } = {}
): Promise<Ticket> {
  return apiRequest<Ticket>(
    `/organizations/${organizationId}/tickets/from-conversation/${conversationId}`,
    {
      accessToken,
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function listKnowledge(organizationId: string, accessToken: string): Promise<KnowledgeArticle[]> {
  return apiRequest<KnowledgeArticle[]>(`/organizations/${organizationId}/knowledge`, { accessToken });
}

export function createKnowledge(
  organizationId: string,
  accessToken: string,
  input: { title: string; content?: string; category?: string; published?: boolean }
): Promise<KnowledgeArticle> {
  return apiRequest<KnowledgeArticle>(`/organizations/${organizationId}/knowledge`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateKnowledge(
  organizationId: string,
  articleId: string,
  accessToken: string,
  input: { title?: string; content?: string; category?: string; published?: boolean }
): Promise<KnowledgeArticle> {
  return apiRequest<KnowledgeArticle>(`/organizations/${organizationId}/knowledge/${articleId}`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteKnowledge(
  organizationId: string,
  articleId: string,
  accessToken: string
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/organizations/${organizationId}/knowledge/${articleId}`, {
    accessToken,
    method: "DELETE"
  });
}

export function listApiKeys(organizationId: string, accessToken: string): Promise<ApiKey[]> {
  return apiRequest<ApiKey[]>(`/organizations/${organizationId}/api-keys`, { accessToken });
}

export function createApiKey(
  organizationId: string,
  accessToken: string,
  input: { name: string; scopes?: string[] }
): Promise<CreatedApiKey> {
  return apiRequest<CreatedApiKey>(`/organizations/${organizationId}/api-keys`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function revokeApiKey(
  organizationId: string,
  apiKeyId: string,
  accessToken: string
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/organizations/${organizationId}/api-keys/${apiKeyId}`, {
    accessToken,
    method: "DELETE"
  });
}

export function listWebhooks(organizationId: string, accessToken: string): Promise<Webhook[]> {
  return apiRequest<Webhook[]>(`/organizations/${organizationId}/webhooks`, { accessToken });
}

export function createWebhook(
  organizationId: string,
  accessToken: string,
  input: { url: string; events?: string[] }
): Promise<CreatedWebhook> {
  return apiRequest<CreatedWebhook>(`/organizations/${organizationId}/webhooks`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function deleteWebhook(
  organizationId: string,
  webhookId: string,
  accessToken: string
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/organizations/${organizationId}/webhooks/${webhookId}`, {
    accessToken,
    method: "DELETE"
  });
}

export function listDepartments(
  organizationId: string,
  accessToken: string
): Promise<Department[]> {
  return apiRequest<Department[]>(`/organizations/${organizationId}/departments`, {
    accessToken
  });
}

export function createDepartment(
  organizationId: string,
  accessToken: string,
  input: { name: string; description?: string; routingWeight?: number; isDefault?: boolean }
): Promise<Department> {
  return apiRequest<Department>(`/organizations/${organizationId}/departments`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateDepartment(
  organizationId: string,
  departmentId: string,
  accessToken: string,
  input: { name?: string; description?: string; routingWeight?: number; isDefault?: boolean }
): Promise<Department> {
  return apiRequest<Department>(`/organizations/${organizationId}/departments/${departmentId}`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function setDepartmentAgents(
  organizationId: string,
  departmentId: string,
  accessToken: string,
  membershipIds: string[]
): Promise<Department> {
  return apiRequest<Department>(
    `/organizations/${organizationId}/departments/${departmentId}/agents`,
    {
      accessToken,
      method: "PUT",
      body: JSON.stringify({ membershipIds })
    }
  );
}

export function deleteDepartment(
  organizationId: string,
  departmentId: string,
  accessToken: string
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(
    `/organizations/${organizationId}/departments/${departmentId}`,
    { accessToken, method: "DELETE" }
  );
}

export function listCannedResponses(
  organizationId: string,
  accessToken: string
): Promise<CannedResponse[]> {
  return apiRequest<CannedResponse[]>(`/organizations/${organizationId}/canned-responses`, {
    accessToken
  });
}

export function createCannedResponse(
  organizationId: string,
  accessToken: string,
  input: { title: string; shortcut: string; body: string; tags?: string[]; isShared?: boolean }
): Promise<CannedResponse> {
  return apiRequest<CannedResponse>(`/organizations/${organizationId}/canned-responses`, {
    accessToken,
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function deleteCannedResponse(
  organizationId: string,
  accessToken: string,
  cannedResponseId: string
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(
    `/organizations/${organizationId}/canned-responses/${cannedResponseId}`,
    { accessToken, method: "DELETE" }
  );
}

export async function uploadAttachment(
  organizationId: string,
  conversationId: string,
  accessToken: string,
  file: File
): Promise<Message> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(
    `${API_URL}/organizations/${organizationId}/conversations/${conversationId}/attachments`,
    {
      method: "POST",
      credentials: "include",
      headers: { authorization: `Bearer ${accessToken}` },
      body: form
    }
  );

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new ApiClientError(body?.error.message ?? "Upload failed", response.status, body);
  }

  return (await response.json()) as Message;
}

export function getDefaultWidgetInstall(
  organizationId: string,
  accessToken: string
): Promise<WidgetInstall> {
  return apiRequest<WidgetInstall>(`/organizations/${organizationId}/widgets/default`, {
    accessToken
  });
}

export function updateWidgetInstall(
  organizationId: string,
  accessToken: string,
  input: {
    name?: string;
    welcomeMessage?: string;
    offlineMessage?: string;
    accentColor?: string;
    position?: "left" | "right";
    preChatEnabled?: boolean;
    gtmContainerId?: string;
    allowedDomains?: string[];
    language?: string;
    highContrast?: boolean;
    largeText?: boolean;
    cookieConsent?: boolean;
    emailForwardTo?: string;
    emailForwardEnabled?: boolean;
    workingHoursEnabled?: boolean;
    workingHours?: { timezone?: string; days?: Array<{ on: boolean; from: string; to: string }> };
    eyeCatcher?: string;
    eyeCatcherEnabled?: boolean;
    slackWebhookUrl?: string;
    preChatFields?: Array<{ id: string; label: string; type: string; required: boolean }>;
    postChatEnabled?: boolean;
    postChatMessage?: string;
    bannedIps?: string[];
    inactivityEnabled?: boolean;
    inactivityMessage?: string;
    inactivitySeconds?: number;
    menuOptions?: Array<{ id: string; label: string; reply: string }>;
  }
): Promise<WidgetInstall> {
  return apiRequest<WidgetInstall>(`/organizations/${organizationId}/widgets/default`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export interface AdminOverviewData {
  totals: { organizations: number; users: number; conversations: number; activeSubscriptions: number };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    planCode: string;
    members: number;
    conversations: number;
    createdAt: string;
  }>;
}

export function adminAccess(accessToken: string): Promise<{ isSuperAdmin: boolean }> {
  return apiRequest<{ isSuperAdmin: boolean }>("/admin/access", { accessToken });
}

export function adminOverview(accessToken: string): Promise<AdminOverviewData> {
  return apiRequest<AdminOverviewData>("/admin/overview", { accessToken });
}

export function exportOrgData(
  organizationId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>(`/organizations/${organizationId}/data/export`, {
    accessToken
  });
}

export function clearVisitorData(
  organizationId: string,
  accessToken: string
): Promise<{ success: true; anonymizedVisitors: number }> {
  return apiRequest<{ success: true; anonymizedVisitors: number }>(
    `/organizations/${organizationId}/data/clear-visitors`,
    { accessToken, method: "POST" }
  );
}

export function getGoogleAuthUrl(): Promise<{ authUrl: string; state: string }> {
  return apiRequest<{ authUrl: string; state: string }>("/auth/google/url");
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | undefined> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return undefined;
  }
}
