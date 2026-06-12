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
