import { describe, expect, it } from "vitest";
import {
  evaluateGeneration,
  renderReport,
  summarize,
  validateManifest,
} from "./generation-evaluation";

const manifest = {
  start: "2026-09-10T00:00:00Z",
  end: "2026-09-10T00:01:00Z",
  environment: "test",
  deployment: "a425dfb",
  clientVersion: "1.0.15",
  complete: false,
  server: ["server.jsonl"],
  client: [],
};
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const event = (n: number, extra = {}) => ({
  event: "generation.timing",
  time: Date.parse(manifest.start) + n,
  requestId: id(n),
  operationId: id(n + 100),
  category: "yc_application",
  outcome: "success",
  durationMs: n * 10,
  stages: { model: n * 10 },
  metrics: { inputUnits: 100, outputUnits: 20 },
  ...extra,
});
const run = (events: unknown[]) =>
  evaluateGeneration(manifest, [
    {
      kind: "server",
      contents: events.map((e) => JSON.stringify(e)).join("\n"),
    },
  ]);

describe("generation evaluation", () => {
  it("measures only actual retry gaps, including zero waits and legacy first-attempt zeros", () => {
    const attempt = (n: number, gapMs: number) => ({
      ...event(1),
      event: "provider.attempt",
      attempt: n,
      gapMs,
    });
    const result = run([
      event(1),
      attempt(1, 0),
      attempt(2, 800),
      attempt(3, 0),
    ]);
    expect(result.latency.interAttemptGap).toMatchObject({
      n: 2,
      median: 400,
      max: 800,
    });
    expect(
      run([event(1), attempt(1, 0), attempt(2, 800)]).latency.interAttemptGap,
    ).toMatchObject({ n: 1, median: 800 });
    expect(run([event(1), attempt(1, 0)]).latency.interAttemptGap.n).toBe(0);
  });
  it("retains unjoined provider and query evidence without inventing terminal latency or success", () => {
    const attempt = {
      ...event(1),
      event: "provider.attempt",
      attempt: 2,
      gapMs: 800,
      outcome: "failure",
      status: 529,
    };
    const result = run([
      {
        ...event(1),
        event: "request.start",
        path: "/api/extension/generate",
        method: "POST",
      },
      attempt,
      attempt,
      { ...event(1), event: "candidate.query", stage: "context" },
      { ...attempt, requestId: "PRIVATE" },
      { ...attempt, requestId: id(2), durationMs: -1 },
    ]);
    expect(result.provider).toMatchObject({
      observedAttempts: 1,
      retriedRequests: 1,
      unmatchedAttempts: 1,
    });
    expect(result.coverage).toMatchObject({
      missingServerTerminals: 1,
      invalidProviderAttempts: 1,
      providerAttemptsMissingIds: 1,
      unmatchedQueries: 1,
    });
    expect(result.queryTimings.context?.n).toBe(1);
    expect(result.latency.server.n).toBe(0);
    expect(result.latency.providerFetchToHeaders.n).toBe(1);
    expect(result.throughput.successfulServerPerMinute).toBe(0);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("reports allowlisted failure and compensation evidence separately, preserving unknowns", () => {
    const result = run([
      event(1, { outcome: "failure", errorCode: "MODEL_TIMEOUT" }),
      event(2, { outcome: "failure", errorCode: "MODEL_ABORTED" }),
      event(3, { outcome: "failure", errorCode: "OUTPUT_VALIDATION_FAILED" }),
      event(4, { outcome: "failure", errorCode: "PRIVATE" }),
      {
        ...event(1),
        event: "provider.attempt",
        attempt: 1,
        outcome: "failure",
        errorCode: "FETCH_ABORTED",
      },
      {
        ...event(1),
        event: "stage.complete",
        stage: "repository.credit_refund",
        outcome: "failure",
        errorCode: "CREDIT_REFUND_FAILED",
      },
      {
        ...event(1),
        event: "stage.complete",
        stage: "repository.rate_limit_release",
        outcome: "success",
      },
      {
        ...event(1),
        event: "stage.complete",
        requestId: id(99),
        stage: "repository.credit_refund",
        outcome: "failure",
      },
    ]);
    expect(result.failuresByCode).toEqual({
      MODEL_TIMEOUT: 1,
      MODEL_ABORTED: 1,
      OUTPUT_VALIDATION_FAILED: 1,
      unknown: 1,
    });
    expect(result.providerFailureCodes).toEqual({ FETCH_ABORTED: 1 });
    expect(result.refunds.credit).toMatchObject({
      observed: 1,
      outcomes: { failure: 1 },
      failureCodes: { CREDIT_REFUND_FAILED: 1 },
    });
    expect(result.refunds.rateLimit).toMatchObject({
      observed: 1,
      outcomes: { success: 1 },
    });
    expect(renderReport(result)).toContain("CREDIT_REFUND_FAILED");
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("bounds provider status groups and preserves real zero retry waits", () => {
    const rows = [429, 529, 100000, 429.5].map((status, i) => ({
      ...event(i + 1),
      event: "provider.attempt",
      attempt: 2,
      gapMs: 0,
      status,
      outcome: "failure",
    }));
    const result = run(rows);
    expect(result.providerStatuses).toEqual({ 429: 1, 529: 1, unknown: 2 });
    expect(result.latency.interAttemptGap).toMatchObject({ n: 4, median: 0 });
  });
  it("computes exact median and qualified nearest-rank percentiles", () => {
    expect(summarize([1, 2, 3, 4])).toMatchObject({
      n: 4,
      median: 2.5,
      p95: null,
      min: 1,
      max: 4,
    });
    expect(
      summarize(Array.from({ length: 20 }, (_, i) => i + 1)),
    ).toMatchObject({ n: 20, p95: 19 });
    expect(summarize([])).toMatchObject({ n: 0, median: null });
  });
  it("deduplicates, excludes conflicting terminals and invalid stage partitions", () => {
    const result = run([
      event(1),
      event(1),
      event(2),
      event(2, { durationMs: 99 }),
      event(3, { stages: { model: 100 } }),
      event(4),
    ]);
    expect(result.coverage).toMatchObject({
      duplicates: 1,
      conflicts: 1,
      invalidTimings: 1,
      serverSummaries: 2,
    });
    expect(result.latency.server).toMatchObject({ n: 2, median: 25 });
    expect(result.throughput.successfulServerPerMinute).toBe(2);
    expect(result.throughput.capacityMeasured).toBe(false);
  });
  it("supports wrappers, out-of-order client events and preserves missing usage", () => {
    const result = evaluateGeneration(manifest, [
      {
        kind: "client",
        contents: JSON.stringify([
          {
            event: "generation.finished",
            timestamp: manifest.start,
            operationId: id(101),
            outcome: "success",
            durationMs: 70,
          },
          {
            event: "generation.complete",
            timestamp: manifest.start,
            operationId: id(101),
            requestId: id(1),
            outcome: "success",
            durationMs: 50,
          },
        ]),
      },
      {
        kind: "server",
        contents: JSON.stringify({
          logs: [{ message: JSON.stringify(event(1, { metrics: {} })) }],
        }),
      },
    ]);
    expect(result.coverage.matchedClientOperations).toBe(1);
    expect(result.latency.render.median).toBe(50);
    expect(result.latency.finished.median).toBe(70);
    expect(result.usage.inputUnits?.n).toBe(0);
    expect(result.throughput.deliveredPerMinute).toBe(1);
  });
  it("projects immediately and never includes arbitrary payloads or identifiers", () => {
    const result = run([
      event(1, {
        prompt: "SECRET",
        error: "SECRET",
        model: "SECRET",
        metrics: { inputUnits: 3, secret: "SECRET" },
        config: { mode: "SECRET" },
      }),
    ]);
    const serialized = JSON.stringify(result) + renderReport(result);
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain(id(1));
    expect(serialized).not.toMatch(/<script|https?:\/\//);
    result.priorities.push('<script>alert("unsafe")</script>');
    expect(renderReport(result)).not.toContain("<script>");
    expect(renderReport(result)).toContain("&lt;script&gt;");
  });
  it("counts malformed, missing timestamps and incomplete operations without inventing zeros", () => {
    const result = evaluateGeneration(manifest, [
      {
        kind: "server",
        contents:
          "not-json\n" +
          JSON.stringify(event(1, { time: undefined })) +
          "\n" +
          JSON.stringify({
            event: "request.start",
            path: "/api/extension/generate",
            method: "POST",
            time: Date.parse(manifest.start),
            requestId: id(2),
          }),
      },
    ]);
    expect(result.coverage).toMatchObject({
      malformed: 1,
      missingTime: 1,
      missingServerTerminals: 1,
    });
    expect(result.latency.server.n).toBe(0);
  });
  it("bounds bytes, records, wrapper depth and validates UTC windows", () => {
    expect(() => run(["x".repeat(20 * 1024 * 1024)])).toThrow(/limit/);
    expect(() =>
      evaluateGeneration(manifest, [
        { kind: "server", contents: JSON.stringify(Array(100001).fill({})) },
      ]),
    ).toThrow(/limit/);
    expect(() =>
      validateManifest({ ...manifest, end: manifest.start }),
    ).toThrow(/manifest/i);
    expect(() =>
      validateManifest({ ...manifest, start: "yesterday SECRET" }),
    ).toThrow("Invalid evaluation manifest.");
    const result = run([
      { logs: [{ logs: [{ logs: [{ logs: [{ logs: [event(1)] }] }] }] }] },
    ]);
    expect(result.coverage.depthExceeded).toBeGreaterThan(0);
  });
  it("excludes unrelated routes and partitions versions, client failures and observed retries", () => {
    const result = run([
      {
        event: "request.start",
        path: "/api/feedback",
        method: "POST",
        requestId: id(5),
        time: Date.parse(manifest.start),
      },
      event(1, {
        templateVersion: "yc-1.1.0",
        config: { clientVersion: "1.0.14" },
      }),
      event(2, {
        templateVersion: "yc-1.1.0",
        config: { clientVersion: "1.0.15" },
      }),
      {
        event: "provider.attempt",
        time: Date.parse(manifest.start),
        requestId: id(1),
        attempt: 2,
        durationMs: 5,
        outcome: "success",
      },
    ]);
    expect(result.throughput.observedHttpPerMinute).toBe(2);
    expect(result.cohorts).toHaveLength(2);
    expect(result.cohorts[0]?.cohort).toContain("yc-1.1.0");
    expect(result.cohorts[0]?.cohort).toContain("1.0.14");
    expect(result.provider.retriedRequests).toBe(1);
  });
  it("caps deeply nested arrays and cohort cardinality without dropping global statistics", () => {
    let nested: unknown = event(1);
    for (let i = 0; i < 50; i++) nested = [nested];
    expect(run([nested]).coverage.depthExceeded).toBeGreaterThan(0);
    const result = run(
      Array.from({ length: 300 }, (_, i) =>
        event(i + 1, { templateVersion: `1.${i}.0` }),
      ),
    );
    expect(result.cohorts.length).toBeLessThanOrEqual(128);
    expect(result.coverage.omittedCohorts).toBeGreaterThan(0);
    expect(result.latency.server.n).toBe(300);
  });
  it("groups parameter variation within cohorts and caps request rows", () => {
    const result = run(
      Array.from({ length: 1100 }, (_, i) =>
        event(i + 1, {
          metrics: { inputUnits: i, outputUnits: i },
          config: { temperature: 0.3, maxOutputUnits: 1000 },
        }),
      ),
    );
    expect(result.samples).toHaveLength(1000);
    expect(result.latency.server.n).toBe(1100);
    expect(result.cohorts[0]?.parameters.inputUnits?.varied).toBe(true);
    expect(result.cohorts[0]?.parameters.temperature?.varied).toBe(false);
  });
});
