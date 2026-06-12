import type { Request } from "express";
import type { AuthUser } from "../../auth/types/auth-user";

export interface RequestWithUser extends Request {
  user?: AuthUser;
}
