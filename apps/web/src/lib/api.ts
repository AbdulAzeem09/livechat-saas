import type {
  ApiErrorBody,
  AuthResponse,
  AuthUser,
  Conversation,
  ConversationPriority,
  ConversationSource,
  ConversationStatus,
  Message,
  MessageType,
  MessageVisibility,
  Organization
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }

  if (options.accessToken) {
    headers.set("authorization", `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

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
