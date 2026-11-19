import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DIAGNOSTIC_BUFFER_KEY,
  DIAGNOSTIC_EVENT_TTL_MS,
  MAX_DIAGNOSTIC_EVENTS,
  appendDiagnosticEvent,
  buildDiagnosticEvent,
  createOperationId,
  isValidOperationId,
  redactFields,
} from "./logger-core.js";
import {
  createExtensionLogger,
  flushExtensionDiagnostics,
  startExtensionTimedStage,
} from "./logger.js";

describe("extension diagnostic logger core", () => {
  afterEach(async () => {
    await chrome.storage.session.clear();
    vi.restoreAllMocks();
  });

  it("replaces an invalid operation identifier", () => {
    const operationId = createOperationId(
      "spoofed\nidentifier",
      () => "123e4567-e89b-42d3-a456-426614174000",
    );
    expect(isValidOperationId(operationId)).toBe(true);
  });

  it("drops credentials and personal content recursively", () => {
    expect(
      redactFields({
        authorization: "Bearer secret",
        nested: {
          refresh_token: "refresh",
          profileMarkdown: "private",
          count: 2,
        },
      }),
    ).toEqual({ nested: { count: 2 } });
  });

  it("builds a bounded structured event with a valid operation ID", () => {
    const event = buildDiagnosticEvent({
      module: "popup",
      event: "generation.start",
      operationId: "123e4567-e89b-42d3-a456-426614174000",
      fields: { category: "cold_email" },
      now: 0,
    });
    expect(event).toMatchObject({ module: "popup", event: "generation.start" });
    expect(event.operationId).toBe("123e4567-e89b-42d3-a456-426614174000");
  });

  it("expires old events and caps the local diagnostic buffer", () => {
    const now = Date.now();
    const old = {
      time: new Date(now - DIAGNOSTIC_EVENT_TTL_MS - 1).toISOString(),
    };
    const recent = Array.from(
      { length: MAX_DIAGNOSTIC_EVENTS + 5 },
      (_, index) => ({
        time: new Date(now).toISOString(),
        index,
      }),
    );
    const result = appendDiagnosticEvent(
      [old, ...recent],
      { time: new Date(now).toISOString() },
      now,
    );
    expect(result).toHaveLength(MAX_DIAGNOSTIC_EVENTS);
    expect(result.some((entry) => entry === old)).toBe(false);
  });

  it("retains back-to-back events written to the local diagnostic buffer", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createExtensionLogger("popup");

    logger.info("generation.start", { category: "cold_email" });
    logger.info("generation.complete", {
      category: "cold_email",
      outcome: "success",
    });
    await flushExtensionDiagnostics();

    const { [DIAGNOSTIC_BUFFER_KEY]: events } =
      await chrome.storage.session.get(DIAGNOSTIC_BUFFER_KEY);
    expect(events).toHaveLength(2);
    expect(events.map((entry) => entry.event)).toEqual([
      "generation.start",
      "generation.complete",
    ]);
  });

  it("emits a redacted terminal event for a timed extension stage", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createExtensionLogger("service-worker");
    const complete = startExtensionTimedStage(logger, "auth.session", {
      operationId: "123e4567-e89b-42d3-a456-426614174000",
    });

    complete("failure", { errorCode: "SESSION_UNAVAILABLE", status: 401 });
    await flushExtensionDiagnostics();

    const { [DIAGNOSTIC_BUFFER_KEY]: events } =
      await chrome.storage.session.get(DIAGNOSTIC_BUFFER_KEY);
    expect(events.at(-1)).toMatchObject({
      event: "stage.complete",
      stage: "auth.session",
      outcome: "failure",
      errorCode: "SESSION_UNAVAILABLE",
      status: 401,
    });
  });

  it.each([
    ["popup", "generation.complete", "GROUNDING_PROFILE_INCOMPLETE", 422],
    ["popup", "generation.complete", "INSUFFICIENT_GROUNDING", 422],
    [
      "service-worker",
      "api.request.complete",
      "GROUNDING_PROFILE_INCOMPLETE",
      422,
    ],
    ["service-worker", "api.request.complete", "INSUFFICIENT_GROUNDING", 422],
    [
      "service-worker",
      "runtime.message.complete",
      "INSUFFICIENT_GROUNDING",
      422,
    ],
    ["popup", "generation.complete", "AUTH_ACCOUNT_CHANGED", 409],
    ["service-worker", "runtime.message.complete", "AUTH_ACCOUNT_CHANGED", 409],
    [
      "service-worker",
      "api.request.complete",
      "AUTH_ACCOUNT_CHANGED",
      undefined,
    ],
    [
      "service-worker",
      "auth.interactive.complete",
      "AUTH_ACCOUNT_CHANGED",
      undefined,
    ],
  ])(
    "keeps handled %s %s %s (%s) informational and diagnosable",
    async (module, event, errorCode, status) => {
      const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const entry = createExtensionLogger(module).warn(event, {
        operationId: "123e4567-e89b-42d3-a456-426614174000",
        requestId: "123e4567-e89b-42d3-a456-426614174001",
        outcome: "failure",
        durationMs: 1480,
        errorCode,
        status,
        authorization: "Bearer private-credential",
        questions: "private-question",
      });
      await flushExtensionDiagnostics();

      expect(entry).toMatchObject({
        level: "info",
        module,
        event,
        errorCode,
        outcome: "failure",
        durationMs: 1480,
        operationId: "123e4567-e89b-42d3-a456-426614174000",
        requestId: "123e4567-e89b-42d3-a456-426614174001",
        ...(status === undefined ? {} : { status }),
      });
      expect(info).toHaveBeenCalledWith(JSON.stringify(entry));
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(JSON.stringify(entry)).not.toContain("private-");
      const stored = await chrome.storage.session.get(DIAGNOSTIC_BUFFER_KEY);
      expect(stored[DIAGNOSTIC_BUFFER_KEY]).toEqual([entry]);
    },
  );

  it.each([
    ["UNKNOWN_FAILURE", 422, "generation.complete", "failure", "warn"],
    [
      "GROUNDING_PROFILE_INCOMPLETE",
      500,
      "generation.complete",
      "failure",
      "warn",
    ],
    [
      "INSUFFICIENT_GROUNDING",
      undefined,
      "generation.complete",
      "failure",
      "warn",
    ],
    ["AUTH_ACCOUNT_CHANGED", 401, "generation.complete", "failure", "warn"],
    ["AUTH_ACCOUNT_CHANGED", 503, "api.request.complete", "failure", "warn"],
    [
      "AUTH_ACCOUNT_CHANGED",
      409,
      "runtime.unhandled_rejection",
      "failure",
      "warn",
    ],
    ["AUTH_ACCOUNT_CHANGED", 409, "generation.complete", "success", "warn"],
    ["AUTH_ACCOUNT_CHANGED", 409, "generation.complete", "failure", "error"],
    [
      "API_REQUEST_FAILED",
      undefined,
      "api.request.complete",
      "failure",
      "warn",
    ],
    ["YC_TOOL_SCHEMA", 502, "generation.complete", "failure", "warn"],
    [
      " GROUNDING_PROFILE_INCOMPLETE ",
      422,
      "generation.complete",
      "failure",
      "warn",
    ],
    ["INSUFFICIENT_GROUNDING\n", 422, "generation.complete", "failure", "warn"],
    [
      "AUTH_ACCOUNT_CHANGED\n",
      409,
      "runtime.message.complete",
      "failure",
      "warn",
    ],
    ["AUTH_ACCOUNT_CHANGED", 409, "generation.complete ", "failure", "warn"],
    ["AUTH_ACCOUNT_CHANGED", 409, "generation.complete", " failure ", "warn"],
  ] as const)(
    "retains %s (%s, %s, %s) at %s",
    (errorCode, status, event, outcome, level) => {
      const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const entry = createExtensionLogger("popup", { persist: false })[level](
        event,
        {
          errorCode,
          status,
          outcome,
        },
      );
      expect(entry.level).toBe(level);
      expect(level === "error" ? error : warn).toHaveBeenCalledWith(
        JSON.stringify(entry),
      );
      expect(info).not.toHaveBeenCalled();
    },
  );

  it("cannot disguise an unhandled error through diagnostic field overrides", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const entry = createExtensionLogger("service-worker", {
      persist: false,
    }).error("runtime.unhandled_rejection", {
      level: "warn",
      event: "generation.complete",
      module: "popup",
      outcome: "failure",
      errorCode: "AUTH_ACCOUNT_CHANGED",
      status: 409,
    });
    expect(entry).toMatchObject({
      level: "error",
      event: "runtime.unhandled_rejection",
      module: "service-worker",
    });
    expect(error).toHaveBeenCalledWith(JSON.stringify(entry));
    expect(info).not.toHaveBeenCalled();
  });
});
