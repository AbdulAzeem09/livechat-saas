export const AUTH_PUBLIC_KEY = "auth:public";
export const AUTH_ROLES_KEY = "auth:roles";
export const AUTH_PERMISSIONS_KEY = "auth:permissions";

export const OWNER_PERMISSIONS = [
  "organization:read",
  "organization:update",
  "members:manage",
  "roles:manage",
  "billing:manage",
  "chat:read",
  "chat:write",
  "chat:transfer",
  "contacts:manage",
  "tickets:manage",
  "analytics:read",
  "settings:manage"
] as const;
