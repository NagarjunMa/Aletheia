import { z } from "zod";
import { GENERATION_FAILURE_CODES } from "@/lib/generation-timing";

export const refundCategorySchema = z.enum([
  "yc_application",
  "linkedin_connection",
  "cold_email",
  "linkedin_inmail",
]);
export const failureSchema = z
  .object({
    attemptId: z.string().uuid(),
    userId: z.string().uuid(),
    category: refundCategorySchema,
    debitId: z.string().uuid().nullable(),
    debitUncertain: z.boolean().default(false),
    code: z.enum(GENERATION_FAILURE_CODES),
  })
  .strict();
export type GenerationFailure = z.infer<typeof failureSchema>;
export const reviewActionSchema = z
  .object({
    action: z.enum(["approve", "reject", "comment"]),
    note: z.string().trim().min(1).max(1000),
  })
  .strict();
export const refundCaseSchema = z.object({
  id: z.string().uuid(),
  attempt_id: z.string().uuid(),
  user_id: z.string().uuid(),
  debit_id: z.string().uuid().nullable(),
  category: refundCategorySchema,
  failure_code: z.string(),
  created_at: z.string(),
  decision: z.enum(["pending", "approved", "rejected"]),
  credit_status: z.enum(["uncharged", "pending", "credited", "unknown"]),
  amount: z.number().int().nonnegative(),
});
export type RefundCase = z.infer<typeof refundCaseSchema>;
export const reviewEventSchema = z.object({
  id: z.string().uuid(),
  actor_id: z.string().uuid(),
  action: z.enum(["approve", "reject", "comment"]),
  note: z.string(),
  created_at: z.string(),
});
export const refundDetailSchema = z.object({
  case: refundCaseSchema,
  events: z.array(reviewEventSchema),
  hasMoreEvents: z.boolean(),
});
export const refundListSchema = z.object({
  items: z.array(refundCaseSchema),
  hasMore: z.boolean(),
});
export const refundQuerySchema = z
  .object({
    userId: z.string().uuid().optional(),
    category: refundCategorySchema.optional(),
    status: z
      .enum([
        "pending",
        "approved",
        "rejected",
        "credited",
        "uncharged",
        "unknown",
      ])
      .optional(),
    since: z.string().datetime().optional(),
    until: z.string().datetime().optional(),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict()
  .refine(
    (v) => !v.since || !v.until || v.since < v.until,
    "Invalid date range",
  );
