import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

/**
 * Outbound HTTP for user-supplied URLs (knowledge import, webhooks, Slack).
 * Blocks private/reserved destinations after DNS resolution and re-checks every redirect hop,
 * so a public hostname or a redirect can't be used to reach internal services (SSRF).
 */

const blockedRanges = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
] as const) {
  blockedRanges.addSubnet(network, prefix, "ipv4");
}

// IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) are matched against the IPv4 rules by BlockList.
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8]
] as const) {
  blockedRanges.addSubnet(network, prefix, "ipv6");
}

export class UnsafeUrlError extends Error {}

/**
 * Local development and automated tests need to point integrations at a server on this machine
 * (a fake identity provider, a stub webhook receiver). Opt in with ALLOW_PRIVATE_NETWORK_URLS=true;
 * it is ignored when NODE_ENV is production, so the SSRF guard can never be turned off in a deployment.
 */
function privateNetworkAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_PRIVATE_NETWORK_URLS === "true";
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) {
    return true;
  }
  return blockedRanges.check(address, family === 6 ? "ipv6" : "ipv4");
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("That is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs are supported.");
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [hostname]
    : await lookup(hostname, { all: true, verbatim: true })
        .then((results) => results.map((result) => result.address))
        .catch(() => {
          throw new UnsafeUrlError("That URL's host could not be resolved.");
        });

  if ((!addresses.length || addresses.some(isBlockedAddress)) && !privateNetworkAllowed()) {
    throw new UnsafeUrlError("That URL points to a private or internal address.");
  }

  return url;
}

export interface SafeFetchOptions extends Omit<RequestInit, "redirect"> {
  /** Redirects to follow (each hop is re-validated). Use 0 for webhooks. */
  maxRedirects?: number;
  timeoutMs?: number;
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { maxRedirects = 3, timeoutMs = 10_000, ...init } = options;
  let url = await assertPublicHttpUrl(rawUrl);

  for (let hop = 0; ; hop += 1) {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(timeoutMs)
    });
    const location = response.headers.get("location");

    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }

    if (hop >= maxRedirects) {
      throw new UnsafeUrlError("Too many redirects.");
    }

    url = await assertPublicHttpUrl(new URL(location, url).toString());
  }
}

/** Read a response body as text, aborting once it exceeds `maxBytes`. */
export async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new UnsafeUrlError("That page is too large to import.");
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}
