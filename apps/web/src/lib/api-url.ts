const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** localhost or a private LAN address — i.e. a build made for this machine/network, not a deployment. */
function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/**
 * Where the API lives, as seen from the browser.
 *
 * NEXT_PUBLIC_API_URL is baked in when the app is built, so a laptop whose Wi-Fi hands out a
 * new LAN IP would otherwise keep calling the old address and everything would fail to load.
 * For local/LAN builds we therefore follow whatever host the page itself was opened on and
 * keep only the API's port and path. Deployed builds (a real domain) are always used as given.
 */
export function apiBaseUrl(): string {
  if (typeof window === "undefined") {
    return CONFIGURED_API_URL;
  }

  try {
    const configured = new URL(CONFIGURED_API_URL, window.location.origin);

    if (!isLocalHost(configured.hostname) || configured.hostname === window.location.hostname) {
      return CONFIGURED_API_URL;
    }

    configured.protocol = window.location.protocol;
    configured.hostname = window.location.hostname;

    return configured.toString().replace(/\/$/, "");
  } catch {
    return CONFIGURED_API_URL;
  }
}

/** Socket.IO endpoint that goes with `apiBaseUrl()`. */
export function socketUrl(): string {
  return apiBaseUrl().replace(/\/api\/v1\/?$/, "").replace(/\/$/, "") + "/chat";
}
