import { z } from "zod";
export const receiptSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    period_start: z.string().datetime({ offset: true }),
    period_end: z.string().datetime({ offset: true }),
    credits: z.number().int().positive(),
    generation_count: z.number().int().positive(),
  })
  .strict();
export type RefundReceipt = z.infer<typeof receiptSchema>;
export const receiptPeriodSchema = z
  .object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(
    (v) => Date.parse(v.end) - Date.parse(v.start) === 7 * 24 * 60 * 60 * 1000,
    "A receipt period must be seven days",
  );
