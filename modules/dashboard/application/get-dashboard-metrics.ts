import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { getCandidateApplicationProfile } from "@/lib/candidate-profile/service";
import { listUserResumes } from "@/lib/resumes/service";
import { getDailyLimit } from "@/modules/outreach/infrastructure/extension-generate.repository";
import {
  dashboardAggregateSchema,
  profileProgress,
  type DashboardMetrics,
} from "../domain/dashboard-metrics";

export async function getDashboardMetrics(
  db: SupabaseClient<Database>,
  userId: string,
  days = 30,
): Promise<DashboardMetrics> {
  const [aggregate, application, resumes] = await Promise.all([
    db
      .rpc("get_dashboard_metrics", { p_days: days })
      .abortSignal(AbortSignal.timeout(3000)),
    getCandidateApplicationProfile(db, userId),
    listUserResumes(db, userId),
  ]);
  if (aggregate.error) throw new Error("Dashboard data unavailable");
  const result = dashboardAggregateSchema.parse(aggregate.data);
  const limit = getDailyLimit();
  return {
    ...result,
    quota: {
      ...result.quota,
      limit,
      remaining: Math.max(0, limit - result.quota.used),
    },
    profile: profileProgress(
      application,
      resumes.some((resume) => resume.is_primary),
    ),
  };
}
