import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { isValidOperationId } from "../lib/logger-core.js";
const source = readFileSync(
  new URL("./service-worker.js", import.meta.url),
  "utf8",
);
const fn = source.slice(
  source.indexOf("async function makeAPIRequest("),
  source.indexOf("\nasync function handleHealthCheck("),
);
describe("HTTP attempt diagnostics", () => {
  it.each([true, false])(
    "records each attempt with valid correlation only (%s)",
    async (validId) => {
      let time = 0,
        count = 0;
      const info = vi.fn(),
        warn = vi.fn();
      const sandbox = {
        isValidOperationId,
        CONFIG: {
          DEFAULT_API_URL: "https://example.test",
          MAX_RETRIES: 3,
          TIMEOUT: 30000,
        },
        Date: { now: () => time },
        log: { info, warn },
        AbortController,
        setTimeout: (cb: () => void, ms: number) => {
          if (ms !== 30000) {
            time += ms;
            cb();
          }
          return 1;
        },
        clearTimeout: vi.fn(),
        getAletheiaRequestHeaders: (v: unknown) => v,
        getSafeErrorCode: () => "API_REQUEST_FAILED",
        fetch: async () => {
          time += 10;
          count++;
          return {
            ok: count > 1,
            status: count > 1 ? 200 : 500,
            headers: {
              get: () =>
                validId
                  ? "11111111-1111-4111-8111-111111111111"
                  : "PRIVATE_HEADER",
            },
            json: async () => {
              time += 5;
              return count > 1 ? { success: true } : { error: "PRIVATE" };
            },
          };
        },
      };
      const result = await runInNewContext(
        `(${fn})("/api/extension/generate", {}, null, "22222222-2222-4222-8222-222222222222")`,
        sandbox,
      );
      expect(result.success).toBe(true);
      const completed = [...warn.mock.calls, ...info.mock.calls].filter(
        (c) => c[0] === "api.request.complete",
      );
      expect(completed.map((c) => c[1])).toEqual([
        expect.objectContaining({
          attempt: 1,
          durationMs: 15,
          outcome: "failure",
          requestId: validId ? result.requestId : undefined,
        }),
        expect.objectContaining({
          attempt: 2,
          durationMs: 15,
          outcome: "success",
          requestId: validId ? result.requestId : undefined,
        }),
      ]);
      expect(JSON.stringify(completed)).not.toContain("PRIVATE");
    },
  );
});
