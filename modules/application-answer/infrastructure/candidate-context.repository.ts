import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapCandidateEvidenceRow,
  mapCandidateProfileRow,
} from "@/lib/candidate-profile/service";
import type { Database, Tables } from "@/lib/database/types";
import { createBearerUserClient } from "@/lib/supabase/bearer-user-client";
import type { CandidateGroundingData } from "../domain/yc-grounding.types";

const PROFILE_FIELDS =
  "user_id,current_role,current_responsibilities,startup_motivation,career_goals,target_roles,target_company_stages,target_industries,github_url,linkedin_url,portfolio_url,location,work_authorization,relocation_preference,availability,excluded_claims,schema_version,created_at,updated_at" as const;

const EVIDENCE_FIELDS =
  "id,user_id,kind,title,context,actions,outcome,metrics,skills,links,confirmed_at,sort_order,created_at,updated_at" as const;

export class CandidateContextRepositoryError extends Error {
  constructor() {
    super("Could not load candidate grounding context");
    this.name = "CandidateContextRepositoryError";
  }
}

export type CandidateContextCaller = {
  accessToken: string;
  userId: string;
};

type CandidateContextRepositoryDependencies = {
  createCallerClient?: (_accessToken: string) => SupabaseClient<Database>;
};

/**
 * Loads all generation-owned candidate context through a caller-scoped client.
 * The client must carry the verified user's JWT so Postgres RLS remains the
 * authorization boundary. Draft evidence is filtered in PostgREST and again
 * before mapping as defense in depth.
 */
export async function loadCandidateGroundingData(
  caller: CandidateContextCaller,
  dependencies: CandidateContextRepositoryDependencies = {},
): Promise<CandidateGroundingData> {
  let supabase: SupabaseClient<Database>;

  try {
    supabase = (dependencies.createCallerClient ?? createBearerUserClient)(
      caller.accessToken,
    );
  } catch {
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
      supabase.from("profiles").select("resume").eq("id", userId).maybeSingle(),
    ]);

  if (
    profileResult.error ||
    evidenceResult.error ||
    resumeResult.error ||
    legacyProfileResult.error
  ) {
    throw new CandidateContextRepositoryError();
  }

  try {
    const profile = mapCandidateProfileRow(
      profileResult.data as Tables<"candidate_profiles"> | null,
    );
    const confirmedEvidence = (
      (evidenceResult.data ?? []) as Tables<"candidate_evidence">[]
    )
      .filter((row) => Boolean(row.confirmed_at))
      .map(mapCandidateEvidenceRow);

    const primaryResume = resumeResult.data?.parsed_text?.trim() ?? "";
    const legacyResume = legacyProfileResult.data?.resume?.trim() ?? "";
    const resume = primaryResume
      ? { text: primaryResume, source: "user_resumes" as const }
      : legacyResume
        ? { text: legacyResume, source: "profiles" as const }
        : { text: "", source: "none" as const };

    return { profile, confirmedEvidence, resume };
  } catch {
    throw new CandidateContextRepositoryError();
  }
}
