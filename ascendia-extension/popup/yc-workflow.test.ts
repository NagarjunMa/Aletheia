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
      popupAuthenticated: true,
      generationInFlight: false,
      feedbackInFlight: false,
      document: {
        querySelectorAll: () => [],
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
      updateGenerateAvailability: vi.fn(),
      hideError: vi.fn(),
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
      popupSource.indexOf("async function saveAcceptedMessage("),
      popupSource.indexOf("\nfunction updateUIForCategory()"),
    );
    await runInNewContext(`(${source})(null, "networking")`, context);
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
        popupSource.indexOf("\nasync function saveAcceptedMessage("),
      );
      await runInNewContext(
        `(${source})("${type}", "too_generic", "User reports generic wording.")`,
        context,
      );
      expect(context.sendBackgroundMessage).toHaveBeenCalledTimes(1);
      const sent = context.sendBackgroundMessage.mock.calls[0]?.[0];
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

describe("outreach feedback acknowledgement", () => {
  const draft = {
    category: "linkedin_connection",
    body: "Hi, would you be open to connecting?",
    evalMetadata: { generationId: "33333333-3333-4333-8333-333333333333" },
  };

  function setup() {
    const reasonPicker = { classList: { add: vi.fn() } };
    const control = { disabled: false };
    const send = vi.fn().mockResolvedValue({ success: true });
    const context = {
      currentOutput: draft,
      currentProfile: { name: "Original recipient" },
      currentUserId: "user-1",
      popupAuthenticated: true,
      generationInFlight: false,
      feedbackInFlight: false,
      YC_APPLICATION_CATEGORY: "yc_application",
      document: {
        getElementById: (id: string) =>
          id === "reject-reason"
            ? reasonPicker
            : { value: "linkedin_connection" },
        querySelectorAll: () => [control],
      },
      chrome: {
        storage: {
          local: {
            get: async () => ({ aletheia_auth: { user: { id: "user-1" } } }),
          },
        },
        runtime: { sendMessage: send },
      },
      sendBackgroundMessage: send,
      saveAcceptedMessage: vi.fn().mockResolvedValue(undefined),
      updateGenerateAvailability: vi.fn(),
      hideError: vi.fn(),
      showTemporaryFeedback: vi.fn(),
      generateMessage: vi.fn().mockResolvedValue(undefined),
    };
    const source = popupSource.slice(
      popupSource.indexOf("async function handleFeedback("),
      popupSource.indexOf("\nasync function saveAcceptedMessage("),
    );
    const feedback = runInNewContext(`(${source})`, context) as (
      type: string,
      reason?: string,
    ) => Promise<void>;
    return { context, feedback, send, reasonPicker, control };
  }

  it.each(["accept", "reject"])(
    "keeps the draft and retries a failed %s",
    async (type) => {
      const { context, feedback, send, reasonPicker, control } = setup();
      send.mockResolvedValueOnce({ success: false });
      await expect(feedback(type, "too_generic")).rejects.toThrow(
        "Please retry",
      );
      expect(context.currentOutput).toBe(draft);
      expect(reasonPicker.classList.add).not.toHaveBeenCalled();
      expect(context.saveAcceptedMessage).not.toHaveBeenCalled();
      expect(context.showTemporaryFeedback).not.toHaveBeenCalled();
      expect(context.generateMessage).not.toHaveBeenCalled();
      expect(control.disabled).toBe(false);

      await feedback(type, "too_generic");
      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1][0].payload).toEqual(
        send.mock.calls[0][0].payload,
      );
      expect(send.mock.calls[1][0].payload.evalMetadata).toEqual(
        draft.evalMetadata,
      );
      expect(context.saveAcceptedMessage).toHaveBeenCalledTimes(
        type === "accept" ? 1 : 0,
      );
      expect(context.generateMessage).toHaveBeenCalledTimes(
        type === "reject" ? 1 : 0,
      );
    },
  );

  it("waits for acknowledgement and ignores overlapping clicks", async () => {
    const { context, feedback, send, control } = setup();
    let acknowledge!: (value: { success: boolean }) => void;
    send.mockReturnValue(
      new Promise((resolve) => {
        acknowledge = resolve;
      }),
    );
    const first = feedback("accept");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    await feedback("accept");
    expect(send).toHaveBeenCalledTimes(1);
    expect(control.disabled).toBe(true);
    expect(context.saveAcceptedMessage).not.toHaveBeenCalled();
    expect(context.showTemporaryFeedback).not.toHaveBeenCalled();
    acknowledge({ success: true });
    await first;
    expect(context.saveAcceptedMessage).toHaveBeenCalledTimes(1);
    expect(context.showTemporaryFeedback).toHaveBeenCalledTimes(1);
    expect(control.disabled).toBe(false);
  });

  it("blocks manual generation while feedback is awaiting acknowledgement", async () => {
    const source = popupSource.slice(
      popupSource.indexOf("async function generateMessage()"),
      popupSource.indexOf("\nfunction displayOutput("),
    );
    const getElementById = vi.fn();
    await runInNewContext(`(${source})()`, {
      feedbackInFlight: true,
      document: { getElementById },
    });
    expect(getElementById).not.toHaveBeenCalled();
  });

  it("discards completion side effects when another draft replaces the reviewed draft", async () => {
    const { context, feedback, send } = setup();
    send.mockImplementation(async () => {
      context.currentOutput = { ...draft, body: "A different draft" };
      return { success: true };
    });
    await feedback("accept");
    expect(context.saveAcceptedMessage).not.toHaveBeenCalled();
    expect(context.showTemporaryFeedback).not.toHaveBeenCalled();
  });

  it("reports the reviewed category and avoids regenerating in a different category", async () => {
    const { context, feedback, send } = setup();
    const getElement = context.document.getElementById;
    context.document.getElementById = (id) =>
      id === "category" ? { value: "cold_email" } : getElement(id);

    await feedback("reject", "too_generic");

    expect(send.mock.calls[0][0].payload.category).toBe(draft.category);
    expect(context.generateMessage).not.toHaveBeenCalled();
    expect(context.showTemporaryFeedback).toHaveBeenCalledTimes(1);
  });

  it.each(["jdInput", "intent", "emailMode", "profile"])(
    "leaves regeneration to the user if %s changes while saving feedback",
    async (field) => {
      const { context, feedback, send } = setup();
      const input = { value: "original" };
      const getElement = context.document.getElementById;
      context.document.getElementById = (id) =>
        id === field ? input : getElement(id);
      send.mockImplementation(async () => {
        if (field === "profile")
          context.currentProfile = { name: "Different recipient" };
        else input.value = "changed";
        return { success: true };
      });
      await feedback("reject", "too_generic");
      expect(context.generateMessage).not.toHaveBeenCalled();
      expect(context.showTemporaryFeedback).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps the original profile on an approved example if the recipient changes", async () => {
    const { context, feedback, send } = setup();
    const profile = context.currentProfile;
    send.mockImplementation(async () => {
      context.currentProfile = { name: "Different recipient" };
      return { success: true };
    });

    await feedback("accept");

    expect(context.saveAcceptedMessage.mock.calls[0][0]).toBe(profile);
  });

  it("directs conflicts to manual generation", async () => {
    const { context, feedback, send } = setup();
    send.mockResolvedValue({
      success: false,
      code: "FEEDBACK_ALREADY_RECORDED",
    });
    await expect(feedback("reject")).rejects.toThrow("Use Generate");
    expect(context.generateMessage).not.toHaveBeenCalled();
  });
});

it.each([
  { profileConsent: false, profileCleared: false },
  { profileConsent: true, profileCleared: true },
])(
  "stops outreach dispatch during consent withdrawal (%o)",
  async ({ profileConsent, profileCleared }) => {
    const source = popupSource.slice(
      popupSource.indexOf("async function generateMessage()"),
      popupSource.indexOf("\nfunction displayOutput("),
    );
    const sendBackgroundMessage = vi
      .fn()
      .mockRejectedValue(new Error("Unexpected dispatch"));
    const context = {
      feedbackInFlight: false,
      popupAuthenticated: true,
      currentUserId: "user-1",
      currentProfile: { name: "Original recipient" },
      YC_APPLICATION_CATEGORY: "yc_application",
      PROFILE_EXTRACTION_CONSENT_KEY: "profileExtractionConsent",
      document: { getElementById: () => ({ value: "linkedin_connection" }) },
      validateGenerationInput: () => ({ valid: true }),
      createOperationId: () => "11111111-1111-4111-8111-111111111111",
      setGeneratingState: vi.fn(),
      setGenerationPhase: vi.fn(),
      chrome: {
        storage: {
          local: {
            get: async () => {
              if (profileCleared)
                Object.assign(context, { currentProfile: null });
              return { accepted: [], profileExtractionConsent: profileConsent };
            },
          },
        },
      },
      filterOwnedAccepted,
      buildGeneratePayload: () => ({}),
      sendBackgroundMessage,
      log: { info: vi.fn(), warn: vi.fn() },
      isAuthError: () => false,
      showError: vi.fn(),
    };

    await runInNewContext(`(${source})()`, context);

    expect(sendBackgroundMessage).not.toHaveBeenCalled();
    expect(context.setGeneratingState).toHaveBeenLastCalledWith(false);
  },
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
        isValidOperationId,
        parseGenerationResponse,
        popupAuthenticated: true,
        feedbackInFlight: false,
        YC_APPLICATION_CATEGORY: "yc_application",
        PROFILE_EXTRACTION_CONSENT_KEY: "profileExtractionConsent",
        document: { getElementById: () => ({ value: "yc_application" }) },
        currentProfile: { name: "Original recipient" },
        currentUserId: "user-1",
        validateGenerationInput: () => ({ valid: true }),
        setGeneratingState: vi.fn(),
        setGenerationPhase: vi.fn(),
        chrome: {
          storage: {
            local: {
              get: async (key: string) => {
                time += 5;
                if (key !== "aletheia_auth")
                  sandbox.currentProfile = { name: "Different recipient" };
                return key === "aletheia_auth"
                  ? { aletheia_auth: { user: { id: "user-1" } } }
                  : { accepted: [] };
              },
            },
          },
        },
        buildGeneratePayload: vi.fn((_profile: unknown) => ({})),
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
      expect(sandbox.buildGeneratePayload.mock.calls[0][0]).toEqual({
        name: "Original recipient",
      });
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
