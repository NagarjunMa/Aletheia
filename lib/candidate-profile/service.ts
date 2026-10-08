import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database/types";
import type { CandidateFactReview } from "./fact-review";
import { readFactReview, evidenceReviewSource } from "./fact-review";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import {
  candidateProfileInputSchema,
  type CandidateEvidenceInput,
  type CandidateProfileInput,
} from "./schema";

export type CandidateEvidenceRecord = CandidateEvidenceInput & {
  id: string;
  updatedAt?: string;
  factReview?: CandidateFactReview;
};

export type CandidateApplicationProfile = {
  profile: CandidateProfileInput;
  evidence: CandidateEvidenceRecord[];
};

const PROFILE_FIELDS =
  "user_id,current_role,current_responsibilities,startup_motivation,career_goals,target_roles,target_company_stages,target_industries,github_url,linkedin_url,portfolio_url,location,work_authorization,relocation_preference,availability,excluded_claims,schema_version,created_at,updated_at" as const;

const EVIDENCE_FIELDS =
  "id,user_id,kind,title,context,actions,outcome,metrics,skills,links,confirmed_at,sort_order,created_at,updated_at,fact_review" as const;
const log = createLogger("candidate-profile-service");

export function mapCandidateProfileRow(
  row: Tables<"candidate_profiles"> | null,
): CandidateProfileInput {
  if (!row) return candidateProfileInputSchema.parse({});

  return candidateProfileInputSchema.parse({
    currentRole: row.current_role,
    currentResponsibilities: row.current_responsibilities,
    startupMotivation: row.startup_motivation,
    careerGoals: row.career_goals,
    targetRoles: row.target_roles,
    targetCompanyStages: row.target_company_stages,
    targetIndustries: row.target_industries,
    githubUrl: row.github_url,
    linkedinUrl: row.linkedin_url,
    portfolioUrl: row.portfolio_url,
    location: row.location,
    workAuthorization: row.work_authorization,
    relocationPreference: row.relocation_preference,
    availability: row.availability,
    excludedClaims: row.excluded_claims,
  });
}

export function mapCandidateEvidenceRow(
  row: Tables<"candidate_evidence">,
): CandidateEvidenceRecord {
  const evidence: CandidateEvidenceRecord = {
    id: row.id,
    kind: row.kind as CandidateEvidenceRecord["kind"],
    title: row.title,
    context: row.context,
    actions: row.actions,
    outcome: row.outcome,
    metrics: row.metrics,
    skills: row.skills,
    links: row.links,
    confirmed: Boolean(row.confirmed_at),
    sortOrder: row.sort_order,
  };
  const facts = readFactReview(evidence, row.fact_review);
  return {
    ...evidence,
    updatedAt: row.updated_at,
    factReview: { version: 1, source: evidenceReviewSource(evidence), facts },
  };
}

export async function getCandidateApplicationProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  logger: SafeLogger = log,
): Promise<CandidateApplicationProfile> {
  const complete = startTimedStage(
    logger,
    "repository.candidate_profile_read",
    {
      userId,
    },
  );
  const [profileResult, evidenceResult] = await Promise.all([
    supabase
      .from("candidate_profiles")
      .select(PROFILE_FIELDS)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("candidate_evidence")
      .select(EVIDENCE_FIELDS)
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (profileResult.error || evidenceResult.error) {
    complete("failure", { errorCode: "CANDIDATE_PROFILE_READ_FAILED" });
    throw new Error("Could not load application profile");
  }

  const result = {
    profile: mapCandidateProfileRow(
      profileResult.data as Tables<"candidate_profiles"> | null,
    ),
    evidence: (
      (evidenceResult.data ?? []) as Tables<"candidate_evidence">[]
    ).map(mapCandidateEvidenceRow),
  };
  complete("success", { evidenceCount: result.evidence.length });
  return result;
}
