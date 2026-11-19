import { describe, expect, it, vi } from "vitest";
import { recordGenerationActivity } from "./record-generation-activity";

const id = "11111111-1111-4111-8111-111111111111";
const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => log),
};
describe("generation activity persistence", () => {
  it.each([1, 5])(
    "records one request and %i successful application answers",
    async (answerCount) => {
      const write = vi.fn(async () => ({ error: null }));
      await recordGenerationActivity(
        {
          userId: id,
          category: "yc_application",
          answerCount,
          providerAttempts: 2,
        },
        id,
        200,
        log,
        write,
      );
      expect(write).toHaveBeenCalledExactlyOnceWith({
        id,
        user_id: id,
        category: "yc_application",
        status: 200,
        requested_answers: answerCount,
        successful_outputs: answerCount,
        provider_attempts: 2,
      });
    },
  );
  it("records a failed request with zero outputs even after a fair refund", async () => {
    const write = vi.fn(async () => ({ error: null }));
    await recordGenerationActivity(
      {
        userId: id,
        category: "cold_email",
        answerCount: 1,
        providerAttempts: 1,
      },
      id,
      502,
      log,
      write,
    );
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ status: 502, successful_outputs: 0 }),
    );
  });
  it("does not persist unauthenticated or unclassified requests", async () => {
    const write = vi.fn();
    await recordGenerationActivity(
      { answerCount: 1, providerAttempts: 0 },
      id,
      401,
      log,
      write,
    );
    expect(write).not.toHaveBeenCalled();
  });
  it("does not replace a generation response when persistence fails", async () => {
    const write = vi.fn(async () => {
      throw new Error("PRIVATE_DATABASE_CANARY");
    });
    await expect(
      recordGenerationActivity(
        {
          userId: id,
          category: "cold_email",
          answerCount: 1,
          providerAttempts: null,
        },
        id,
        200,
        log,
        write,
      ),
    ).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith(
      { errorCode: "DASHBOARD_ACTIVITY_WRITE_FAILED" },
      expect.any(String),
    );
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain(
      "PRIVATE_DATABASE_CANARY",
    );
  });
  it("bounds a nonresponding adapter even if it ignores cancellation", async () => {
    vi.useFakeTimers();
    try {
      const write = vi.fn(() => new Promise<{ error: unknown }>(() => {}));
      const work = recordGenerationActivity(
        {
          userId: id,
          category: "cold_email",
          answerCount: 1,
          providerAttempts: 0,
        },
        id,
        200,
        log,
        write,
      );
      await vi.advanceTimersByTimeAsync(750);
      await expect(work).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
