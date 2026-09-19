"use client";

import { useEffect } from "react";
import { apiBaseUrl } from "@/lib/api-url";

/**
 * Loads the normal widget on this page and opens it straight away, so the visitor lands in a
 * chat rather than having to find a bubble.
 */
export function HostedChatLoader({ widgetKey }: { widgetKey: string }) {
  useEffect(() => {
    if (!widgetKey || document.querySelector(`[data-livechat-widget="${widgetKey}"]`)) {
      return;
    }

    const script = document.createElement("script");

    script.async = true;
    script.src = `${apiBaseUrl().replace(/\/$/, "")}/widget.js`;
    script.setAttribute("data-widget-key", widgetKey);
    script.setAttribute("data-livechat-hosted-page", "true");
    script.addEventListener("load", () => {
      // The widget needs a moment to fetch its settings before it can be opened.
      window.setTimeout(() => {
        const api = (window as unknown as { LiveChatSaaS?: { open?: () => void } }).LiveChatSaaS;
        api?.open?.();
      }, 900);
    });
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [widgetKey]);

  return null;
}
