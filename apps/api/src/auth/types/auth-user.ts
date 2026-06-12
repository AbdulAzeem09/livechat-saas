export interface AuthAccessTokenPayload {
  sub: string;
  email: string;
  organizationId?: string;
  membershipId?: string;
  roles: string[];
  permissions: string[];
}

export interface AuthUser extends AuthAccessTokenPayload {
  userId: string;
}

export interface AuthMembershipSummary {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  displayName: string | null;
  roles: string[];
  permissions: string[];
}
