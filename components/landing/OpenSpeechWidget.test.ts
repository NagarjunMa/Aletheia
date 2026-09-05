import { describe, expect, it } from "vitest";
import {
  OPENSPEECH_WIDGET_SCRIPT_PROPS,
  OPENSPEECH_WIDGET_URL,
} from "./OpenSpeechWidget";

describe("OpenSpeechWidget", () => {
  it("keeps the external script contract lazy and anonymous", () => {
    expect(OPENSPEECH_WIDGET_SCRIPT_PROPS).toEqual({
      id: "openspeech-ai-chat-widget",
      src: OPENSPEECH_WIDGET_URL,
      strategy: "lazyOnload",
      crossOrigin: "anonymous",
    });
  });
});
