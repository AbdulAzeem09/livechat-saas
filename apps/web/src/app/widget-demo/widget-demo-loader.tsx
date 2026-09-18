"use client";

import { useEffect } from "react";
import { apiBaseUrl } from "@/lib/api-url";

interface WidgetDemoLoaderProps {
  widgetKey: string;
}

export function WidgetDemoLoader({ widgetKey }: WidgetDemoLoaderProps) {
  useEffect(() => {
    if (!widgetKey || document.querySelector(`[data-livechat-widget="${widgetKey}"]`)) {
      return;
    }

    const script = document.createElement("script");

    script.async = true;
    // Built in the browser so the demo keeps working when this PC gets a new LAN IP.
    script.src = `${apiBaseUrl().replace(/\/$/, "")}/widget.js`;
    script.setAttribute("data-widget-key", widgetKey);
    script.setAttribute("data-livechat-demo-loader", "true");
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [widgetKey]);

  return null;
}
