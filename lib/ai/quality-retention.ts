import type { createStatelessServiceClient } from "@/lib/supabase/server";
export const QUALITY_RETENTION_DAYS = 90;
export const QUALITY_CLEANUP_BATCH_SIZE = 100;
export async function cleanupQualityFeedback(
  db: ReturnType<typeof createStatelessServiceClient>,
  now = Date.now(),
) {
  const cutoff = new Date(
    now - QUALITY_RETENTION_DAYS * 86400000,
  ).toISOString();
  let removed = 0;
  for (let batch = 0; batch < 5; batch++) {
    const rows = await db
      .from("user_feedback")
      .select("id")
      .eq("metadata->>quality_version", "1")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(QUALITY_CLEANUP_BATCH_SIZE)
      .abortSignal(AbortSignal.timeout(2_000));
    if (rows.error) throw new Error("Quality cleanup lookup failed");
    if (!rows.data?.length) return { removed, saturated: false };
    const ids = rows.data.map((r) => r.id);
    const result = await db
      .from("user_feedback")
      .delete({ count: "exact" })
      .in("id", ids)
      .eq("metadata->>quality_version", "1")
      .lt("created_at", cutoff)
      .abortSignal(AbortSignal.timeout(2_000));
    if (result.error) throw new Error("Quality cleanup delete failed");
    removed += result.count ?? 0;
    if (ids.length < QUALITY_CLEANUP_BATCH_SIZE)
      return { removed, saturated: false };
  }
  return { removed, saturated: true };
}
