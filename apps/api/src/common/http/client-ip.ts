import { isIP } from "node:net";
import type { Request } from "express";
import { isBlockedAddress } from "../network/safe-fetch";

/**
 * Best-effort real client IP, used for bans, geolocation and rate limiting.
 *
 * Render's edge is Cloudflare, which overwrites `CF-Connecting-IP` (and `True-Client-IP`)
 * with the connecting address, so those can't be forged by the browser. X-Forwarded-For is
 * client-controlled and is only a fallback when no CDN header is present.
 */
export function resolveClientIp(request: Request): string | undefined {
  for (const name of ["cf-connecting-ip", "true-client-ip"]) {
    const value = readHeader(request, name);
    if (value && isIP(value)) {
      return value;
    }
  }

  const forwarded = readHeader(request, "x-forwarded-for");
  if (forwarded) {
    const publicIp = forwarded
      .split(",")
      .map((part) => part.trim().replace(/^::ffff:/, ""))
      .find((ip) => isIP(ip) && !isBlockedAddress(ip));
    if (publicIp) {
      return publicIp;
    }
  }

  return request.ip;
}

function readHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.trim() ? first.trim() : undefined;
}
