import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { createLogger, createRequestLogger, startTimedStage } from "./logger";
import {
  createCorrelationId,
  isValidCorrelationId,
  sanitizeLogFields,
} from "./logging-core";

describe("createLogger", () => {
  it("returns an object with standard log methods", () => {
    const log = createLogger("test-module");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("does not throw when calling log methods", () => {
    const log = createLogger("test-module");
    expect(() => log.info("test message")).not.toThrow();
    expect(() => log.warn({ key: "value" }, "test warn")).not.toThrow();
    expect(() =>
      log.error(new Error("test error"), "error occurred"),
    ).not.toThrow();
  });

  it("creates independent child loggers for different modules", () => {
    const logA = createLogger("module-a");
    const logB = createLogger("module-b");
    expect(logA).not.toBe(logB);
  });
});

describe("createRequestLogger", () => {
  function makeReq(
    opts: {
      method?: string;
      url?: string;
      origin?: string | null;
      requestId?: string | null;
      operationId?: string | null;
    } = {},
  ) {
    return {
      method: opts.method ?? "GET",
      url: opts.url ?? "http://localhost/api/test",
      headers: {
        get: (name: string) => {
          if (name === "origin") return opts.origin ?? null;
          if (name === "x-request-id") return opts.requestId ?? null;
          if (name === "x-aletheia-operation-id")
            return opts.operationId ?? null;
          return null;
        },
      },
    };
  }

  it("returns an object with standard log methods", () => {
    const log = createRequestLogger("test-module", makeReq());
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  it("does not throw when calling log methods", () => {
    const log = createRequestLogger(
      "test-module",
      makeReq({ method: "POST", url: "http://localhost/api/generate" }),
    );
    expect(() => log.info("request received")).not.toThrow();
  });

  it("accepts extra bindings without throwing", () => {
    const log = createRequestLogger("test-module", makeReq(), {
      userId: "abc-123",
      requestId: "req-456",
    });
    expect(() => log.info("with extra bindings")).not.toThrow();
  });

  it("handles null origin without throwing", () => {
    const log = createRequestLogger("test-module", makeReq({ origin: null }));
    expect(() => log.info("null origin")).not.toThrow();
  });

  it("replaces invalid correlation identifiers rather than logging them", () => {
    const replacement = createCorrelationId("spoofed\nidentifier", randomUUID);
    expect(isValidCorrelationId(replacement)).toBe(true);
    expect(replacement).not.toContain("spoofed");
  });

  it("retains valid operation identifiers", () => {
    const id = randomUUID();
    expect(createCorrelationId(id.toUpperCase(), randomUUID)).toBe(id);
  });

  it("drops credentials and user content recursively", () => {
    expect(
      sanitizeLogFields({
        authorization: "Bearer secret",
        nested: {
          refresh_token: "refresh-secret",
          profileMarkdown: "private profile",
          safeCount: 2,
        },
        status: 401,
      }),
    ).toEqual({ nested: { safeCount: 2 }, status: 401 });
  });

  it("drops raw error values regardless of their field name", () => {
    expect(
      sanitizeLogFields({
        err: "private upstream failure",
        error: new Error("private database failure"),
        errorCode: "DATABASE_QUERY_FAILED",
      }),
    ).toEqual({ errorCode: "DATABASE_QUERY_FAILED" });
  });

  it("bounds strings and removes log-injection control characters", () => {
    const value = `safe\n${"x".repeat(200)}`;
    expect(sanitizeLogFields({ label: value }).label).toHaveLength(160);
    expect(sanitizeLogFields({ label: value }).label).not.toContain("\n");
  });

  it("emits start and terminal stage events without throwing", () => {
    const complete = startTimedStage(
      createLogger("test-module"),
      "validation",
      {
        category: "cold_email",
      },
    );
    expect(() => complete("success", { status: 200 })).not.toThrow();
  });
});
