import type { Request } from "express";
import type { AuthUser } from "../../auth/types/auth-user";
import type { OrganizationRequestContext } from "../../organizations/types/organization-context";

export interface RequestWithUser extends Request {
  user?: AuthUser;
  organizationContext?: OrganizationRequestContext;
}
