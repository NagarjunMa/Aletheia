import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import {
  mapCandidateEvidenceRow,
  mapCandidateProfileRow,
} from "@/lib/candidate-profile/service";
import type { Database, Tables } from "@/lib/database/types";
import { createBearerUserClient } from "@/lib/supabase/bearer-user-client";
import type {
  CandidateContextCaller,
  CandidateGroundingData,
} from "../domain/candidate-context.types";

const PROFILE_FIELDS =
  "user_id,current_role,current_responsibilities,startup_motivation,career_goals,target_roles,target_company_stages,target_industries,github_url,linkedin_url,portfolio_url,location,work_authorization,relocation_preference,availability,excluded_claims,schema_version,created_at,updated_at" as const;

const EVIDENCE_FIELDS =
  "id,user_id,kind,title,context,actions,outcome,metrics,skills,links,confirmed_at,sort_order,created_at,updated_at" as const;
const log = createLogger("candidate-context-repository");

export class CandidateContextRepositoryError extends Error {
  constructor() {
    super("Could not load candidate grounding context");
    this.name = "CandidateContextRepositoryError";
  }
}

export type CandidateContextRepositoryDependencies = {
  createCallerClient?: (_accessToken: string) => SupabaseClient<Database>;
  logger?: SafeLogger;
};

/**
 * Loads private candidate data using the verified caller's JWT. RLS remains
 * the authorization boundary; explicit ownership and confirmation filters are
 * preserved as defense in depth.
 */
export async function loadCandidateGroundingData(
  caller: CandidateContextCaller,
  dependencies: CandidateContextRepositoryDependencies = {},
): Promise<CandidateGroundingData> {
  const complete = startTimedStage(
    dependencies.logger ?? log,
    "repository.candidate_context_load",
    { userId: caller.userId },
  );
  let supabase: SupabaseClient<Database>;

  try {
    supabase = (dependencies.createCallerClient ?? createBearerUserClient)(
      caller.accessToken,
    );
  } catch {
    complete("failure", { errorCode: "CANDIDATE_CONTEXT_CLIENT_FAILED" });
    throw new CandidateContextRepositoryError();
  }

  const { userId } = caller;
  const [profileResult, evidenceResult, resumeResult, legacyProfileResult] =
    await Promise.all([
      supabase
        .from("candidate_profiles")
        .select(PROFILE_FIELDS)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("candidate_evidence")
        .select(EVIDENCE_FIELDS)
        .eq("user_id", userId)
        .not("confirmed_at", "is", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("user_resumes")
        .select("parsed_text")
        .eq("user_id", userId)
        .eq("is_primary", true)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("resume,full_name")
        .eq("id", userId)
        .maybeSingle(),
    ]);

  if (
    profileResult.error ||
    evidenceResult.error ||
    resumeResult.error ||
    legacyProfileResult.error
  ) {
    complete("failure", { errorCode: "CANDIDATE_CONTEXT_QUERY_FAILED" });
    throw new CandidateContextRepositoryError();
  }

  try {
    const profile = mapCandidateProfileRow(
      profileResult.data as Tables<"candidate_profiles"> | null,
    );
    const confirmedEvidence = (
      (evidenceResult.data ?? []) as Tables<"candidate_evidence">[]
    )
      .filter((row) => row.user_id === userId && Boolean(row.confirmed_at))
      .map(mapCandidateEvidenceRow);
    const primaryResume = resumeResult.data?.parsed_text?.trim() ?? "";
    const legacyResume = legacyProfileResult.data?.resume?.trim() ?? "";
    const resume = primaryResume
      ? { text: primaryResume, source: "user_resumes" as const }
      : legacyResume
        ? { text: legacyResume, source: "profiles" as const }
        : { text: "", source: "none" as const };

    const result = {
      identity: {
        fullName: legacyProfileResult.data?.full_name?.trim() ?? "",
        linkedinUrl: profile.linkedinUrl,
      },
      profile,
      confirmedEvidence,
      resume,
    };
    complete("success", {
      evidenceCount: confirmedEvidence.length,
      resumeSource: result.resume.source,
    });
    return result;
  } catch {
    complete("failure", { errorCode: "CANDIDATE_CONTEXT_MAPPING_FAILED" });
    throw new CandidateContextRepositoryError();
  }
}
