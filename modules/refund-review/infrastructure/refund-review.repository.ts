import { createStatelessServiceClient } from "@/lib/supabase/server";
import {
  failureSchema,
  refundDetailSchema,
  refundListSchema,
  type GenerationFailure,
} from "../domain/refund-review";
import type { Json } from "@/lib/database/types";

const DATABASE_TIMEOUT_MS = 3000;
export async function captureFailure(
  failure: GenerationFailure,
): Promise<void> {
  const value = failureSchema.parse(failure);
  const { error } = await createStatelessServiceClient()
    .rpc("capture_generation_failure", { p_failure: value })
    .abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));
  if (error) throw new Error("REFUND_CAPTURE_FAILED");
}
export async function listRefundCases(query: Record<string, Json | undefined>) {
  const { data, error } = await createStatelessServiceClient()
    .rpc("list_refund_cases", { p_query: query })
    .abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));
  if (error) throw new Error("REFUND_READ_FAILED");
  return refundListSchema.parse(data);
}
export async function getRefundCase(id: string) {
  const { data, error } = await createStatelessServiceClient()
    .rpc("get_refund_case", { p_id: id })
    .abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));
  if (error) throw new Error("REFUND_READ_FAILED");
  return data === null ? null : refundDetailSchema.parse(data);
}
export async function reviewRefundCase(
  id: string,
  actor: string,
  action: string,
  note: string,
  actionId: string,
) {
  const { data, error } = await createStatelessServiceClient()
    .rpc("review_refund_case", {
      p_id: id,
      p_actor: actor,
      p_action: action,
      p_note: note,
      p_action_id: actionId,
    })
    .abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));
  if (error) throw new Error("REFUND_REVIEW_FAILED");
  return refundDetailSchema.parse(data);
}
export async function executeReviewedRefund(id: string) {
  const { data, error } = await createStatelessServiceClient()
    .rpc("execute_reviewed_refund", { p_id: id })
    .abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));
  if (error) throw new Error("REFUND_EXECUTION_PENDING");
  return refundDetailSchema.parse(data);
}
