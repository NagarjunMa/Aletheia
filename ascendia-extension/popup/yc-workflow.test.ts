import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";

const popupHtml = readFileSync(
  new URL("./popup.html", import.meta.url),
  "utf8",
);
const popupSource = readFileSync(
  new URL("./popup.js", import.meta.url),
  "utf8",
);

describe("ALE-38 popup elapsed time", () => {
  it.each([false, true])(
    "includes local preparation/rendering and handles transport failure (%s)",
    async (failed) => {
      let time = 0;
      const info = vi.fn();
      const warn = vi.fn();
      const consoleError = vi.fn();
      const sandbox = {
        document: { getElementById: () => ({ value: "yc_application" }) },
        currentProfile: null,
        validateGenerationInput: () => ({ valid: true }),
        setGeneratingState: vi.fn(),
        chrome: {
          storage: {
            local: {
              get: async () => {
                time += 5;
                return { accepted: [] };
              },
            },
          },
        },
        buildGeneratePayload: () => ({}),
        createOperationId: () => "11111111-1111-4111-8111-111111111111",
        Date: { now: () => time },
        log: { info, warn },
        sendBackgroundMessage: async () => {
          time += 20;
          if (failed) throw new Error("PRIVATE authentication detail");
          return { success: true };
        },
        displayOutput: () => {
          time += 3;
        },
        storeGeneration: async () => undefined,
        incrementUsageCount: async () => undefined,
        isAuthError: () => false,
        showError: vi.fn(),
        console: { error: consoleError },
      };
      const functionSource = popupSource.slice(
        popupSource.indexOf("async function generateMessage()"),
        popupSource.indexOf("\nfunction displayOutput("),
      );
      await runInNewContext(`(${functionSource})()`, sandbox);
      const entries = [...info.mock.calls, ...warn.mock.calls].filter(
        ([event]) => event === "generation.complete",
      );
      expect(entries).toHaveLength(1);
      expect(entries[0][1]).toMatchObject({
        durationMs: failed ? 25 : 28,
        outcome: failed ? "failure" : "success",
      });
      expect(
        JSON.stringify([
          ...info.mock.calls,
          ...warn.mock.calls,
          ...consoleError.mock.calls,
        ]),
      ).not.toContain("PRIVATE");
    },
  );
});

describe("YC application popup contract", () => {
  it("offers an accessible YC category, required job description, and editable question", () => {
    expect(popupHtml).toContain('<option value="yc_application">');
    expect(popupHtml).toContain('id="ycQuestionGroup"');
    expect(popupHtml).toContain('label for="ycQuestionInput"');
    expect(popupHtml).toContain('id="ycQuestionInput"');
    expect(popupHtml).toContain('aria-live="polite"');
    expect(popupHtml).toMatch(
      /id="errorMessage"[\s\S]*?role="alert"[\s\S]*?tabindex="-1"/,
    );
  });

  it("uses the tested core contract and keeps YC inputs out of local storage", () => {
    expect(popupSource).toContain('from "./popup-core.js"');
    expect(popupSource).toContain("buildGeneratePayload(");
    expect(popupSource).toContain("validateGenerationInput(");
    expect(popupSource).toContain("category === YC_APPLICATION_CATEGORY");
    expect(popupSource).toContain("inputs: isYcApplication");
    expect(popupSource).toContain("? { category }");
  });

  it("shows copy, regenerate, feedback, and profile-readiness actions", () => {
    expect(popupHtml).toContain('id="copyAllBtn"');
    expect(popupHtml).toContain('id="rejectBtn"');
    expect(popupHtml).toContain('id="acceptBtn"');
    expect(popupHtml).toContain('id="errorAction"');
    expect(popupSource).toContain("getGenerationErrorPresentation(");
  });
});
