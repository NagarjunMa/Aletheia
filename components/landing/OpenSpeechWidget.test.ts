import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({
    strategy: _strategy,
    ...props
  }: React.ComponentProps<"script"> & {
    strategy?: string;
  }) => React.createElement("script", props),
}));

import OpenSpeechWidget, { OPENSPEECH_WIDGET_URL } from "./OpenSpeechWidget";

describe("OpenSpeechWidget", () => {
  it("loads the configured widget anonymously without blocking page rendering", () => {
    const markup = renderToStaticMarkup(React.createElement(OpenSpeechWidget));

    expect(markup).toContain(
      `src="${OPENSPEECH_WIDGET_URL.replaceAll("&", "&amp;")}"`,
    );
    expect(markup).toContain('crossorigin="anonymous"');
    expect(markup).toContain('id="openspeech-ai-chat-widget"');
    expect(markup).not.toContain('strategy="lazyOnload"');
  });
});
