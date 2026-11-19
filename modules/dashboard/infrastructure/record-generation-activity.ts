import type { SafeLogger } from "@/lib/logger";
import { createStatelessServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const activitySchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    category: z.enum([
      "linkedin_connection",
      "linkedin_inmail",
      "cold_email",
      "yc_application",
    ]),
    status: z.number().int().min(200).max(599),
    requested_answers: z.number().int().min(1).max(5),
    successful_outputs: z.number().int().min(0).max(5),
    provider_attempts: z.number().int().min(0).max(1000).nullable(),
  })
  .strict()
  .refine(
    (row) => row.category === "yc_application" || row.requested_answers === 1,
  );
type ActivityRow = z.infer<typeof activitySchema>;
type WriteActivity = (_row: ActivityRow) => PromiseLike<{ error: unknown }>;
const WRITE_DEADLINE_MS = 750;

function writeActivity(row: ActivityRow) {
  return createStatelessServiceClient()
    .from("dashboard_generation_activity")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true })
    .abortSignal(AbortSignal.timeout(WRITE_DEADLINE_MS));
}

export type GenerationActivityContext = {
  userId?: string;
  category?:
    "linkedin_connection" | "linkedin_inmail" | "cold_email" | "yc_application";
  answerCount: number;
  providerAttempts: number | null;
};

export async function recordGenerationActivity(
  context: GenerationActivityContext,
  generationId: string,
  status: number,
  log: SafeLogger,
  write: WriteActivity = writeActivity,
): Promise<void> {
  if (!context.userId || !context.category) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const row = activitySchema.parse({
      id: generationId,
      user_id: context.userId,
      category: context.category,
      status,
      requested_answers: context.answerCount,
      successful_outputs: status < 400 ? context.answerCount : 0,
      provider_attempts: context.providerAttempts,
    });
    const result = await Promise.race([
      write(row),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Activity deadline")),
          WRITE_DEADLINE_MS,
        );
      }),
    ]);
    if (result.error) throw new Error("Activity persistence failed");
  } catch {
    try {
      log.warn(
        { errorCode: "DASHBOARD_ACTIVITY_WRITE_FAILED" },
        "Activity history may be incomplete",
      );
    } catch {
      /* Analytics never replace the generation result. */
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}
