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
import { createExtensionLogger, flushExtensionDiagnostics } from "./logger.js";

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
});
