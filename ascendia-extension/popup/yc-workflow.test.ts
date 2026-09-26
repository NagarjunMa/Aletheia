import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";

import {
  projectStoredApplication,
  buildApplicationFeedback,
  parseGenerationResponse,
} from "./popup-core.js";
import { isValidOperationId } from "../lib/logger-core.js";
import { filterOwnedAccepted } from "../lib/account-owned-cache.js";
const popupHtml = readFileSync(
  new URL("./popup.html", import.meta.url),
  "utf8",
);
const popupSource = readFileSync(
  new URL("./popup.js", import.meta.url),
  "utf8",
);

describe("ALE-37 private question handling at persistence boundaries", () => {
  const firstBody = Array.from({ length: 50 }, () => "experience").join(" ");
  const secondBody = Array.from({ length: 50 }, () => "delivery").join(" ");
  const answerOnlyBody = `${firstBody}\n\n${secondBody}`;
  const output = {
    category: "yc_application",
    evalMetadata: { generationId: "33333333-3333-4333-8333-333333333333" },
    body: `**PRIVATE QUESTION ONE**\n${firstBody}\n\n**PRIVATE QUESTION TWO**\n${secondBody}`,
    answers: [
      {
        questionId: "q1",
        question: "PRIVATE QUESTION ONE",
        body: firstBody,
        word_count: 50,
        character_count: firstBody.length,
      },
      {
        questionId: "q2",
        question: "PRIVATE QUESTION TWO",
        body: secondBody,
        word_count: 50,
        character_count: secondBody.length,
      },
    ],
  };

  function sandbox() {
    return {
      YC_APPLICATION_CATEGORY: "yc_application",
      projectStoredApplication,
      buildApplicationFeedback,
      sendBackgroundMessage: vi.fn().mockResolvedValue({ success: true }),
      currentUserId: "user-1",
      currentOutput: structuredClone(output),
      currentProfile: null,
      document: {
        getElementById: (id: string) => ({
          value:
            id === "category" ? "yc_application" : "PRIVATE_JOB_DESCRIPTION",
          classList: { add: vi.fn() },
        }),
      },
      chrome: {
        storage: {
          local: {
            get: vi
              .fn()
              .mockImplementation(async (key: string) =>
                key === "aletheia_auth"
                  ? { aletheia_auth: { user: { id: "user-1" } } }
                  : { accepted: [] },
              ),
            set: vi.fn().mockResolvedValue(undefined),
          },
        },
        runtime: { sendMessage: vi.fn().mockResolvedValue({ success: true }) },
      },
      showTemporaryFeedback: vi.fn(),
      generateMessage: vi.fn().mockResolvedValue(undefined),
      console: { error: vi.fn() },
    };
  }

  it("stores ordered answers without question text in lastGeneration", async () => {
    const context = sandbox();
    const source = popupSource.slice(
      popupSource.indexOf("async function storeGeneration(output)"),
      popupSource.indexOf("\nasync function restoreLastGeneration()"),
    );
    await runInNewContext(`(${source})(currentOutput)`, context);
    expect(context.console.error).not.toHaveBeenCalled();
    expect(context.sendBackgroundMessage).toHaveBeenCalledTimes(1);
    const stored = context.sendBackgroundMessage.mock.calls[0]?.[0].record;
    expect(stored.output.body).toBe(answerOnlyBody);
    expect(stored.inputs).toEqual({
      category: "yc_application",
    });
    expect(JSON.stringify(stored)).not.toMatch(
      /PRIVATE QUESTION|PRIVATE_JOB_DESCRIPTION/,
    );
    expect(context.currentOutput).toEqual(output);
  });

  it("keeps question text out of accepted-message storage", async () => {
    const context = sandbox();
    const source = popupSource.slice(
      popupSource.indexOf("async function saveAcceptedMessage()"),
      popupSource.indexOf("\nfunction updateUIForCategory()"),
    );
    await runInNewContext(`(${source})()`, context);
    expect(context.sendBackgroundMessage).toHaveBeenCalledTimes(1);
    const stored = context.sendBackgroundMessage.mock.calls[0]?.[0].record;
    expect(stored.body).toBe(answerOnlyBody);
    expect(JSON.stringify(stored)).not.toMatch(
      /PRIVATE QUESTION|PRIVATE_JOB_DESCRIPTION/,
    );
    expect(context.currentOutput).toEqual(output);
  });

  it.each(["accept", "reject"])(
    "sends compact %s feedback without response text or regeneration",
    async (type) => {
      const context = {
        ...sandbox(),
        saveAcceptedMessage: vi.fn().mockResolvedValue(undefined),
      };
      const source = popupSource.slice(
        popupSource.indexOf(
          "async function handleFeedback(type, rejectionReason, summary)",
        ),
        popupSource.indexOf("\nasync function saveAcceptedMessage()"),
      );
      await runInNewContext(
        `(${source})("${type}", "too_generic", "User reports generic wording.")`,
        context,
      );
      expect(context.chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
      const sent = context.chrome.runtime.sendMessage.mock.calls[0]?.[0];
      expect(sent.payload).toMatchObject({
        format: "application_summary",
        generationId: "33333333-3333-4333-8333-333333333333",
        category: "yc_application",
        approved: type === "accept",
      });
      expect(JSON.stringify(sent)).not.toMatch(
        /PRIVATE QUESTION|PRIVATE_JOB_DESCRIPTION/,
      );
      expect(sent.payload).not.toHaveProperty("message");
      expect(context.generateMessage).not.toHaveBeenCalled();
      expect(context.currentOutput).toEqual(output);
    },
  );
});

describe("ALE-38 popup elapsed time", () => {
  it.each([false, true])(
    "includes local preparation/rendering and handles transport failure (%s)",
    async (failed) => {
      let time = 0;
      const info = vi.fn();
      const warn = vi.fn();
      const consoleError = vi.fn();
      const sandbox = {
        isValidOperationId,
        parseGenerationResponse,
        popupAuthenticated: true,
        document: { getElementById: () => ({ value: "yc_application" }) },
        currentProfile: null,
        currentUserId: "user-1",
        validateGenerationInput: () => ({ valid: true }),
        setGeneratingState: vi.fn(),
        setGenerationPhase: vi.fn(),
        chrome: {
          storage: {
            local: {
              get: async (key: string) => {
                time += 5;
                return key === "aletheia_auth"
                  ? { aletheia_auth: { user: { id: "user-1" } } }
                  : { accepted: [] };
              },
            },
          },
        },
        buildGeneratePayload: () => ({}),
        filterOwnedAccepted,
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
        storeGeneration: async () => {
          time += 7;
        },
        updateUsageStats: async () => {
          time += 2;
        },
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
        durationMs: failed ? 25 : 33,
        outcome: failed ? "failure" : "success",
      });
      expect(
        info.mock.calls.find(([event]) => event === "generation.finished")?.[1],
      ).toMatchObject({
        durationMs: failed ? 25 : 42,
        outcome: failed ? "failure" : "success",
      });
      expect(sandbox.setGeneratingState).toHaveBeenLastCalledWith(false);
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
