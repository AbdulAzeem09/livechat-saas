"use client";

import { useEffect } from "react";
import { apiBaseUrl } from "@/lib/api-url";

/**
 * Our own widget, on our own site.
 *
 * It is the contact channel and the demo at once — a visitor deciding whether to buy chat
 * software can see it working before they sign up. Set NEXT_PUBLIC_SITE_WIDGET_KEY to the
 * public key of the workspace that should receive these chats; without it nothing loads,
 * so a misconfigured build shows no broken bubble.
 */
export function SiteChat() {
  const widgetKey = process.env.NEXT_PUBLIC_SITE_WIDGET_KEY;

  useEffect(() => {
    if (!widgetKey || document.querySelector("script[data-site-chat]")) {
      return;
    }

    const script = document.createElement("script");

    script.async = true;
    script.src = `${apiBaseUrl().replace(/\/$/, "")}/widget.js`;
    script.setAttribute("data-widget-key", widgetKey);
    script.setAttribute("data-site-chat", "true");
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [widgetKey]);

  return null;
}
