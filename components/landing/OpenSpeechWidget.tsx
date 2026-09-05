"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script, { type ScriptProps } from "next/script";

export const OPENSPEECH_WIDGET_URL =
  "https://widget.openspeechai.com/widgets/chat-widget.js?widgetId=69a6b2ed-1302-4ee5-974f-c340eab71b90";

export const OPENSPEECH_WIDGET_SCRIPT_PROPS = {
  id: "openspeech-ai-chat-widget",
  src: OPENSPEECH_WIDGET_URL,
  strategy: "lazyOnload",
  crossOrigin: "anonymous",
} satisfies ScriptProps;

const WIDGET_HOST_ID = "openspeech-widget-host";
const ROUTE_HIDDEN_ATTRIBUTE = "data-aletheia-route-hidden";
const PREVIOUS_DISPLAY_ATTRIBUTE = "data-aletheia-previous-display";
const PREVIOUS_DISPLAY_PRIORITY_ATTRIBUTE =
  "data-aletheia-previous-display-priority";

function syncWidgetVisibility(isLandingPage: boolean) {
  const host = document.getElementById(WIDGET_HOST_ID);
  if (!host) return null;

  const hiddenByAletheia = host.hasAttribute(ROUTE_HIDDEN_ATTRIBUTE);

  if (isLandingPage) {
    if (!hiddenByAletheia) return host;

    const previousDisplay = host.getAttribute(PREVIOUS_DISPLAY_ATTRIBUTE) ?? "";
    const previousPriority =
      host.getAttribute(PREVIOUS_DISPLAY_PRIORITY_ATTRIBUTE) ?? "";

    if (previousDisplay) {
      host.style.setProperty("display", previousDisplay, previousPriority);
    } else {
      host.style.removeProperty("display");
    }

    host.removeAttribute(ROUTE_HIDDEN_ATTRIBUTE);
    host.removeAttribute(PREVIOUS_DISPLAY_ATTRIBUTE);
    host.removeAttribute(PREVIOUS_DISPLAY_PRIORITY_ATTRIBUTE);
    return host;
  }

  if (!hiddenByAletheia) {
    host.setAttribute(
      PREVIOUS_DISPLAY_ATTRIBUTE,
      host.style.getPropertyValue("display"),
    );
    host.setAttribute(
      PREVIOUS_DISPLAY_PRIORITY_ATTRIBUTE,
      host.style.getPropertyPriority("display"),
    );
    host.setAttribute(ROUTE_HIDDEN_ATTRIBUTE, "true");
  }

  if (
    host.style.getPropertyValue("display") !== "none" ||
    host.style.getPropertyPriority("display") !== "important"
  ) {
    host.style.setProperty("display", "none", "important");
  }

  return host;
}

export default function OpenSpeechWidget() {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const [hasInitializedWidget, setHasInitializedWidget] = useState(false);

  useEffect(() => {
    if (!hasInitializedWidget && !isLandingPage) return;

    let observedHost: HTMLElement | null = null;
    let hostObserver: MutationObserver | null = null;

    const observeHost = () => {
      const host = syncWidgetVisibility(isLandingPage);
      if (!host || host === observedHost) return;

      hostObserver?.disconnect();
      observedHost = host;
      hostObserver = new MutationObserver(() => {
        syncWidgetVisibility(isLandingPage);
      });
      hostObserver.observe(host, {
        attributes: true,
        attributeFilter: ["style"],
      });
    };

    const bodyObserver = new MutationObserver(observeHost);
    bodyObserver.observe(document.body, { childList: true });
    observeHost();

    return () => {
      bodyObserver.disconnect();
      hostObserver?.disconnect();
    };
  }, [hasInitializedWidget, isLandingPage]);

  if (!hasInitializedWidget && !isLandingPage) return null;

  return (
    <Script
      {...OPENSPEECH_WIDGET_SCRIPT_PROPS}
      onReady={() => setHasInitializedWidget(true)}
    />
  );
}
