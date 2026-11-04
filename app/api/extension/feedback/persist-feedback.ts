import type { createBearerDataClient } from "@/lib/supabase/server";
/** Existing receipt PK serializes identified retries without a new table/index. */
export async function persistFeedback(
  db: ReturnType<typeof createBearerDataClient>,
  row: {
    id?: string;
    user_id: string;
    feedback_type: string;
    rating: number;
    comment: string | null;
    metadata: Record<string, unknown>;
  },
) {
  const signal = AbortSignal.timeout(10_000);
  try {
    const { error } = await db
      .from("user_feedback")
      .insert(row)
      .abortSignal(signal);
    if (!error) return { state: "inserted" as const };
    if (error.code !== "23505" || !row.id)
      return { state: "unavailable" as const };
    const existing = await db
      .from("user_feedback")
      .select("feedback_type")
      .eq("id", row.id)
      .eq("user_id", row.user_id)
      .abortSignal(signal)
      .maybeSingle();
    if (existing.error) return { state: "unavailable" as const };
    if (!existing.data || existing.data.feedback_type !== row.feedback_type)
      return { state: "conflict" as const };
    return { state: "duplicate" as const };
  } catch {
    return { state: "unavailable" as const };
  }
}
