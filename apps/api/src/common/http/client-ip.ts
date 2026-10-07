import type { Request } from "express";

/**
 * The real client IP, used for bans, geolocation and rate limiting.
 *
 * Every one of those is a security decision, so the address must be one the caller cannot
 * choose for themselves. `X-Forwarded-For` is a list the client starts and each proxy appends
 * to, which means its LEFT-hand entries are whatever the caller typed; only the entries our
 * own proxies added can be believed. Express already works this out from the `trust proxy`
 * hop count set in configureApp — it walks in from the right, past the hops we trust — so
 * request.ip is the answer and reading the raw header ourselves only reintroduces the hole.
 *
 * CDN headers (`CF-Connecting-IP` and friends) are not consulted: they are unforgeable only
 * when that CDN is actually in front of us and strips them, and this deployment goes straight
 * from nginx to node. Behind a CDN, raise the trust-proxy hop count instead.
 */
export function resolveClientIp(request: Request): string | undefined {
  const ip = request.ip?.trim().replace(/^::ffff:/, "");

  return ip ? ip : undefined;
}
