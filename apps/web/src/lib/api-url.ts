const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/**
 * Set when one port serves both the site and the API — nginx in production, a tunnel or a
 * dev proxy otherwise. Then the API is always on the page's own origin, whatever port that is.
 */
const SAME_ORIGIN = process.env.NEXT_PUBLIC_API_SAME_ORIGIN === "true";

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

    // Which port? From the URL alone this is genuinely undecidable: a page on :3000 with the
    // API beside it on :4000 looks exactly like a page on :8080 whose proxy serves both. So:
    //  - SAME_ORIGIN set  -> trust it (one port fronts both: nginx, a tunnel, a dev proxy)
    //  - page on 80/443   -> something is fronting both, or there would be a port
    //  - otherwise        -> the LAN case, keep the API's own port
    configured.port = SAME_ORIGIN || !window.location.port ? "" : configured.port;

    return configured.toString().replace(/\/$/, "");
  } catch {
    return CONFIGURED_API_URL;
  }
}

/** Socket.IO endpoint that goes with `apiBaseUrl()`. */
export function socketUrl(): string {
  return apiBaseUrl().replace(/\/api\/v1\/?$/, "").replace(/\/$/, "") + "/chat";
}
