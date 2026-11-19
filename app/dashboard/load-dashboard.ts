import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { getCandidateApplicationProfile } from "@/lib/candidate-profile/service";
import { listUserResumes } from "@/lib/resumes/service";
import { getDashboardMetrics } from "@/modules/dashboard/application/get-dashboard-metrics";
import { createLogger } from "@/lib/logger";

const log = createLogger("dashboard");

export async function loadDashboard(
  db: SupabaseClient<Database>,
  userId: string,
) {
  const [profile, metrics, application, resumes, recent] =
    await Promise.allSettled([
      db.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      getDashboardMetrics(db, userId),
      getCandidateApplicationProfile(db, userId),
      listUserResumes(db, userId),
      db
        .from("generated_drafts")
        .select("id,content,draft_type,is_accepted,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
  if (
    [profile, metrics, application, resumes, recent].some(
      (part) => part.status === "rejected",
    ) ||
    (profile.status === "fulfilled" && profile.value.error) ||
    (recent.status === "fulfilled" && recent.value.error)
  ) {
    log.warn(
      { errorCode: "DASHBOARD_SECTION_UNAVAILABLE" },
      "A dashboard section is unavailable",
    );
  }
  return {
    profileName:
      profile.status === "fulfilled" && !profile.value.error
        ? (profile.value.data?.full_name ?? null)
        : null,
    metrics: metrics.status === "fulfilled" ? metrics.value : null,
    application: application.status === "fulfilled" ? application.value : null,
    resumes: resumes.status === "fulfilled" ? resumes.value : null,
    recent:
      recent.status === "fulfilled" && !recent.value.error
        ? (recent.value.data ?? [])
        : null,
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
