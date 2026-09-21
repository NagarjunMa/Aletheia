import { randomUUID } from "node:crypto";
import { createLogger } from "@/lib/logger";
import { failureSchema, type GenerationFailure } from "../domain/refund-review";
import { captureFailure } from "../infrastructure/refund-review.repository";

/** Server-created per attempt; no request header can choose the deduplication key. */
export type FailureContext = {
  attemptId: string;
  userId?: string;
  category?: GenerationFailure["category"];
  debitId: string | null;
  debitUncertain: boolean;
};
export function createFailureContext(): FailureContext {
  return { attemptId: randomUUID(), debitId: null, debitUncertain: false };
}
export async function recordFailedGeneration(
  context: FailureContext,
  status: number,
  code: unknown,
  capture = captureFailure,
): Promise<void> {
  if (
    process.env.REFUND_REVIEW_ENABLED !== "true" ||
    (status < 500 && !(status >= 400 && code === "MODEL_REQUEST_FAILED")) ||
    !context.userId ||
    !context.category
  )
    return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const failure = failureSchema.parse({
      ...context,
      code: failureSchema.shape.code.safeParse(code).success
        ? code
        : "GENERATION_FAILED",
    });
    // Enforce a wall-clock bound even when an adapter ignores AbortSignal.
    await Promise.race([
      capture(failure),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Capture deadline")), 3500);
      }),
    ]);
  } catch {
    try {
      createLogger("refund-review").error(
        {
          errorCode: "REFUND_CAPTURE_FAILED",
          requestId: context.attemptId,
          userId: context.userId,
          reservationId: context.debitId,
        },
        "Failure queue capture requires reconciliation",
      );
    } catch {
      /* Logging must not replace the generation response. */
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}
