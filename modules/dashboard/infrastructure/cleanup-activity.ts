import type { createStatelessServiceClient } from "@/lib/supabase/server";

export async function cleanupDashboardActivity(
  db: ReturnType<typeof createStatelessServiceClient>,
) {
  const result = await db
    .rpc("cleanup_dashboard_activity")
    .abortSignal(AbortSignal.timeout(3000));
  if (result.error || typeof result.data !== "number")
    throw new Error("Activity cleanup failed");
  return { removed: result.data, saturated: result.data === 1000 };
}
