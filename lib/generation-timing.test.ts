import { describe, expect, it, vi } from "vitest";
import { createGenerationTiming } from "./generation-timing";
import { sanitizeLogFields } from "./logging-core";

describe("generation timing", () => {
  it("preserves a safe failure cause through refund and ignores arbitrary or late codes", () => {
    const timing = createGenerationTiming(() => 0);
    timing.enter("model");
    timing.failure("MODEL_TIMEOUT");
    timing.failure("PRIVATE" as never);
    timing.enter("refund");
    expect(timing.finish(504)).toMatchObject({
      errorCode: "MODEL_TIMEOUT",
      failedStage: "model",
    });
    timing.failure("MODEL_ABORTED");
    expect(timing.finish(504).errorCode).toBe("MODEL_TIMEOUT");
    const success = createGenerationTiming(() => 0);
    success.failure("MODEL_TIMEOUT");
    expect(success.finish(200).errorCode).toBeUndefined();
    expect(createGenerationTiming(() => 0).finish(500).errorCode).toBe(
      "GENERATION_FAILED",
    );
  });
  it("records only bounded configuration and extended numeric usage", () => {
    const timing = createGenerationTiming(() => 0);
    timing.config({
      temperature: 0.3,
      maxOutputUnits: 1000,
      billingMode: "metered",
      intent: "referral",
      stopReason: "tool_use",
    });
    timing.config({ mode: "PRIVATE", secret: "PRIVATE" } as never);
    timing.metrics({
      cacheReadUnits: 50,
      cacheWriteUnits: 0,
      resultChars: 300,
      claimCount: 2,
    });
    const result = timing.finish(200);
    expect(result.config).toEqual({
      temperature: 0.3,
      maxOutputUnits: 1000,
      billingMode: "metered",
      intent: "referral",
      stopReason: "tool_use",
    });
    expect(sanitizeLogFields(result)).toEqual(result);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("keeps overlapping requests independent", () => {
    let time = 0;
    const first = createGenerationTiming(() => time);
    time = 5;
    const second = createGenerationTiming(() => time);
    first.category("yc_application");
    second.category("cold_email");
    first.enter("model");
    second.enter("billing");
    time = 15;
    expect(first.finish(200)).toMatchObject({
      category: "yc_application",
      durationMs: 15,
      stages: { model: 10, billing: null },
    });
    expect(second.finish(402)).toMatchObject({
      category: "cold_email",
      durationMs: 10,
      stages: { billing: 10, model: null },
    });
  });
  it("freezes terminal measurements and remembers the failed stage before refunds", () => {
    let time = 0;
    const timing = createGenerationTiming(() => time);
    timing.enter("model");
    time = 30000;
    timing.enter("refund");
    time += 10;
    timing.enter("refund");
    const result = timing.finish(504);
    timing.metrics({ inputUnits: 100 });
    timing.category("cold_email");
    timing.enter("model");
    time += 999;
    expect(timing.finish(200)).toEqual(result);
    expect(result).toMatchObject({
      failedStage: "model",
      durationMs: 30010,
      stages: { model: 30000, refund: 10 },
    });
  });
  it("partitions elapsed time, accumulates repeated stages, and distinguishes unvisited stages", () => {
    let time = 0;
    const timing = createGenerationTiming(() => time);
    time = 5;
    timing.enter("groundingLoad");
    time = 25;
    timing.enter("groundingBuild");
    time = 28;
    timing.enter("groundingLoad");
    time = 35;
    const summary = timing.finish(200);
    expect(summary.durationMs).toBe(35);
    expect(summary.stages).toMatchObject({
      authDispatch: 5,
      groundingLoad: 27,
      groundingBuild: 3,
      model: null,
    });
    expect(
      Object.values(summary.stages).reduce<number>(
        (sum, value) => sum + (value ?? 0),
        0,
      ),
    ).toBe(35);
    expect(timing.finish(500)).toEqual(summary);
  });

  it("uses allow-listed numeric metadata and survives the mandatory log redactor", () => {
    const timing = createGenerationTiming(() => 0);
    timing.category("yc_application");
    timing.metrics({
      inputChars: 16000,
      sourceChars: 8000,
      inputUnits: 4000,
      outputUnits: 600,
    });
    // Runtime callers cannot smuggle strings, source IDs or arbitrary fields.
    timing.metrics({
      inputChars: "PRIVATE",
      body: "PRIVATE",
      sourceIds: ["PRIVATE"],
    } as never);
    timing.category("PRIVATE" as never);
    timing.enter("PRIVATE" as never);
    const result = timing.finish(502);
    expect(result.category).toBe("yc_application");
    expect(result.metrics).toEqual({
      inputChars: 16000,
      sourceChars: 8000,
      inputUnits: 4000,
      outputUnits: 600,
    });
    expect(sanitizeLogFields(result)).toEqual(result);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(result.outcome).toBe("failure");
  });

  it("bounds bad clocks and numbers without producing negative, infinite or fractional durations", () => {
    const now = vi
      .fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(90)
      .mockReturnValueOnce(NaN)
      .mockReturnValue(110.6);
    const timing = createGenerationTiming(now);
    timing.enter("billing");
    timing.enter("model");
    timing.metrics({ inputChars: Infinity, sourceChars: -1, inputUnits: 3.8 });
    const result = timing.finish(504);
    expect(result.durationMs).toBe(11);
    expect(result.stages.model).toBe(11);
    expect(result.metrics).toEqual({ inputUnits: 4 });
  });
});
