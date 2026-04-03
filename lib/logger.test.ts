import { describe, it, expect } from "vitest";
import { createLogger, createRequestLogger } from "./logger";

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
    opts: { method?: string; url?: string; origin?: string | null } = {},
  ) {
    return {
      method: opts.method ?? "GET",
      url: opts.url ?? "http://localhost/api/test",
      headers: {
        get: (name: string) =>
          name === "origin" ? (opts.origin ?? null) : null,
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
});
