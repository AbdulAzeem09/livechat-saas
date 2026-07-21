"use client";

import { useEffect } from "react";

interface WidgetDemoLoaderProps {
  scriptUrl: string;
  widgetKey: string;
}

export function WidgetDemoLoader({ scriptUrl, widgetKey }: WidgetDemoLoaderProps) {
  useEffect(() => {
    if (!widgetKey || document.querySelector(`[data-livechat-widget="${widgetKey}"]`)) {
      return;
    }

    const script = document.createElement("script");

    script.async = true;
    script.src = scriptUrl;
    script.setAttribute("data-widget-key", widgetKey);
    script.setAttribute("data-livechat-demo-loader", "true");
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [scriptUrl, widgetKey]);

  return null;
}
