import { afterEach, expect, it, vi } from "vitest";
vi.mock(
  "@/modules/refund-review/infrastructure/refund-review.repository",
  () => ({ captureFailure: vi.fn() }),
);
import {
  createFailureContext,
  recordFailedGeneration,
} from "./capture-generation-failure";
const context = {
  ...createFailureContext(),
  userId: "22222222-2222-4222-8222-222222222222",
  category: "cold_email" as const,
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("does not queue rejected requests, successes or anonymous failures", async () => {
  vi.stubEnv("REFUND_REVIEW_ENABLED", "true");
  const capture = vi.fn();
  for (const status of [200, 400, 401, 402, 403, 422, 429])
    await recordFailedGeneration(context, status, "GENERATION_FAILED", capture);
  await recordFailedGeneration(
    createFailureContext(),
    500,
    "GENERATION_FAILED",
    capture,
  );
  expect(capture).not.toHaveBeenCalled();
});
it("is opt-in and does not alter the response on persistence or validation failure", async () => {
  const capture = vi.fn().mockRejectedValue(new Error("PRIVATE"));
  vi.stubEnv("REFUND_REVIEW_ENABLED", "false");
  await recordFailedGeneration(context, 500, "GENERATION_FAILED", capture);
  expect(capture).not.toHaveBeenCalled();
  vi.stubEnv("REFUND_REVIEW_ENABLED", "true");
  await expect(
    recordFailedGeneration(context, 500, "PRIVATE_ERROR", capture),
  ).resolves.toBeUndefined();
  expect(capture).toHaveBeenCalledWith({
    ...context,
    code: "GENERATION_FAILED",
  });
  await expect(
    recordFailedGeneration(
      { ...context, userId: "bad" },
      500,
      "GENERATION_FAILED",
      capture,
    ),
  ).resolves.toBeUndefined();
});
it("bounds capture and creates distinct server attempt IDs", async () => {
  vi.stubEnv("REFUND_REVIEW_ENABLED", "true");
  vi.useFakeTimers();
  const work = recordFailedGeneration(
    context,
    504,
    "MODEL_TIMEOUT",
    () => new Promise(() => {}),
  );
  await vi.advanceTimersByTimeAsync(3500);
  await expect(work).resolves.toBeUndefined();
  expect(createFailureContext().attemptId).not.toBe(
    createFailureContext().attemptId,
  );
});
it("captures provider rate limits after generation starts, not local quota rejections", async () => {
  vi.stubEnv("REFUND_REVIEW_ENABLED", "true");
  const capture = vi.fn().mockResolvedValue(undefined);
  await recordFailedGeneration(context, 429, "MODEL_REQUEST_FAILED", capture);
  expect(capture).toHaveBeenCalledTimes(1);
});
