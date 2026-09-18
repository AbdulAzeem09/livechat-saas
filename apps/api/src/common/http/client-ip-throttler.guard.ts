import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { resolveClientIp } from "./client-ip";

/** Per-client-IP rate limiting for HTTP routes (socket events are not throttled here). */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  override canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") {
      return Promise.resolve(true);
    }

    return super.canActivate(context);
  }

  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    return Promise.resolve(resolveClientIp(request as unknown as Request) ?? "unknown");
  }
}

/** Shared per-minute limits, applied with @Throttle({ default: RATE_LIMITS.x }). */
export const RATE_LIMITS = {
  login: { limit: 20, ttl: 60_000 },
  register: { limit: 10, ttl: 60_000 },
  refresh: { limit: 60, ttl: 60_000 },
  passwordReset: { limit: 10, ttl: 60_000 },
  widgetSession: { limit: 60, ttl: 60_000 },
  widgetConversation: { limit: 20, ttl: 60_000 },
  widgetMessage: { limit: 60, ttl: 60_000 },
  import: { limit: 10, ttl: 60_000 }
} as const;
