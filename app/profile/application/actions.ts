"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createLogger, startTimedStage } from "@/lib/logger";
import {
  candidateEvidenceInputSchema,
  candidateProfileInputSchema,
  type CandidateEvidenceInput,
  type CandidateProfileInput,
} from "@/lib/candidate-profile/schema";
import type { TablesInsert } from "@/lib/database/types";
import { createClient } from "@/lib/supabase/server";
import {
  candidateFactsSchema,
  prepareFactReview,
} from "@/lib/candidate-profile/fact-review";
import {
  mapCandidateEvidenceRow,
  type CandidateEvidenceRecord,
} from "@/lib/candidate-profile/service";
import type { Tables } from "@/lib/database/types";

const log = createLogger("candidate-profile-actions");
const profileCategorySchema = z.enum([
  "current_work",
  "direction",
  "proof_links",
  "logistics",
  "boundaries",
]);

export type CandidateProfileCategory = z.infer<typeof profileCategorySchema>;

export type CandidateProfileActionResult =
  { ok: true } | { ok: false; error: string };

function validationError(message: string): CandidateProfileActionResult {
  return { ok: false, error: message };
}

function refreshCandidateProfilePages() {
  revalidatePath("/dashboard");
  revalidatePath("/profile/application");
}

export async function saveCandidateFactReview(
  input: unknown,
): Promise<
  { ok: true; evidence: CandidateEvidenceRecord } | { ok: false; error: string }
> {
  const parsed = z
    .object({
      evidenceId: z.string().max(36).uuid(),
      expectedRevision: z.string().max(64).datetime({ offset: true }),
      facts: candidateFactsSchema,
    })
    .strict()
    .safeParse(input);
  const failure = {
    ok: false as const,
    error: "Could not save reviewed facts. Reload the evidence and try again.",
  };
  if (!parsed.success) return failure;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return { ok: false, error: "Authentication required" };
  const complete = startTimedStage(log, "candidate_evidence.fact_review", {
    userId: user.id,
  });
  const { evidenceId, expectedRevision, facts } = parsed.data;
  try {
    const loaded = await supabase
      .from("candidate_evidence")
      .select("*")
      .eq("id", evidenceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (
      loaded.error ||
      !loaded.data ||
      loaded.data.user_id !== user.id ||
      loaded.data.updated_at !== expectedRevision
    ) {
      complete("failure", { errorCode: "FACT_REVIEW_STALE" });
      return failure;
    }
    const row = loaded.data as Tables<"candidate_evidence">;
    const factReview = prepareFactReview(mapCandidateEvidenceRow(row), facts);
    const result = await supabase
      .from("candidate_evidence")
      .update({ fact_review: factReview })
      .eq("id", evidenceId)
      .eq("user_id", user.id)
      .eq("updated_at", expectedRevision)
      .select("*")
      .maybeSingle();
    if (result.error || !result.data || result.data.user_id !== user.id) {
      complete("failure", { errorCode: "FACT_REVIEW_SAVE_FAILED" });
      return failure;
    }
    complete("success", { claimCount: facts.length });
    refreshCandidateProfilePages();
    return {
      ok: true,
      evidence: mapCandidateEvidenceRow(
        result.data as Tables<"candidate_evidence">,
      ),
    };
  } catch {
    complete("failure", { errorCode: "FACT_REVIEW_INVALID" });
    return failure;
  }
}

function categoryPayload(
  category: CandidateProfileCategory,
  profile: CandidateProfileInput,
): Omit<TablesInsert<"candidate_profiles">, "user_id"> {
  switch (category) {
    case "current_work":
      return {
        current_role: profile.currentRole,
        current_responsibilities: profile.currentResponsibilities,
        schema_version: 1,
      };
    case "direction":
      return {
        startup_motivation: profile.startupMotivation,
        career_goals: profile.careerGoals,
        target_roles: profile.targetRoles,
        target_company_stages: profile.targetCompanyStages,
        target_industries: profile.targetIndustries,
        schema_version: 1,
      };
    case "proof_links":
      return {
        github_url: profile.githubUrl,
        linkedin_url: profile.linkedinUrl,
        portfolio_url: profile.portfolioUrl,
        schema_version: 1,
      };
    case "logistics":
      return {
        location: profile.location,
        work_authorization: profile.workAuthorization,
        relocation_preference: profile.relocationPreference,
        availability: profile.availability,
        schema_version: 1,
      };
    case "boundaries":
      return {
        excluded_claims: profile.excludedClaims,
        schema_version: 1,
      };
  }
}

export async function saveCandidateProfileCategory(
  category: CandidateProfileCategory,
  input: CandidateProfileInput,
): Promise<CandidateProfileActionResult> {
  const parsedCategory = profileCategorySchema.safeParse(category);
  const parsedProfile = candidateProfileInputSchema.safeParse(input);
  if (!parsedCategory.success || !parsedProfile.success) {
    return validationError(
      parsedProfile.success
        ? "Invalid application profile category"
        : (parsedProfile.error.issues[0]?.message ??
            "Invalid application profile"),
    );
  }

  const supabase = await createClient();
  const completeAuth = startTimedStage(log, "candidate_profile.auth_lookup", {
    category: parsedCategory.data,
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    completeAuth("failure", { errorCode: "AUTH_REQUIRED", status: 401 });
    return validationError("Authentication required");
  }
  completeAuth("success", { userId: user.id });

  const completeWrite = startTimedStage(
    log,
    "candidate_profile.category_upsert",
    { category: parsedCategory.data, userId: user.id },
  );
  const { error } = await supabase.from("candidate_profiles").upsert(
    {
      user_id: user.id,
      ...categoryPayload(parsedCategory.data, parsedProfile.data),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    completeWrite("failure", {
      errorCode: "CANDIDATE_PROFILE_CATEGORY_UPSERT_FAILED",
    });
    log.error(
      {
        category: parsedCategory.data,
        errorCode: "CANDIDATE_PROFILE_CATEGORY_UPSERT_FAILED",
        userId: user.id.substring(0, 12),
      },
      "Candidate profile category save failed",
    );
    return validationError(
      "Could not save this profile category. Please try again.",
    );
  }

  completeWrite("success");
  refreshCandidateProfilePages();
  return { ok: true };
}

export async function saveCandidateEvidence(
  input: CandidateEvidenceInput,
): Promise<CandidateProfileActionResult> {
  const parsed = candidateEvidenceInputSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(
      parsed.error.issues[0]?.message ?? "Invalid evidence story",
    );
  }

  const supabase = await createClient();
  const completeAuth = startTimedStage(log, "candidate_evidence.auth_lookup");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    completeAuth("failure", { errorCode: "AUTH_REQUIRED", status: 401 });
    return validationError("Authentication required");
  }
  completeAuth("success", { userId: user.id });

  const evidence = parsed.data;
  const payload = {
    kind: evidence.kind,
    title: evidence.title,
    context: evidence.context,
    actions: evidence.actions,
    outcome: evidence.outcome,
    metrics: evidence.metrics,
    skills: evidence.skills,
    links: evidence.links,
    confirmed_at: evidence.confirmed ? new Date().toISOString() : null,
    sort_order: evidence.sortOrder,
  };

  const completeWrite = startTimedStage(log, "candidate_evidence.save", {
    userId: user.id,
    operation: evidence.id ? "update" : "insert",
  });
  const result = evidence.id
    ? await supabase
        .from("candidate_evidence")
        .update(payload)
        .eq("id", evidence.id)
        .eq("user_id", user.id)
    : await supabase
        .from("candidate_evidence")
        .insert({ ...payload, user_id: user.id });

  if (result.error) {
    completeWrite("failure", { errorCode: "CANDIDATE_EVIDENCE_SAVE_FAILED" });
    log.error(
      {
        errorCode: "CANDIDATE_EVIDENCE_SAVE_FAILED",
        userId: user.id.substring(0, 12),
      },
      "Candidate evidence save failed",
    );
    return validationError(
      "Could not save this evidence story. Please try again.",
    );
  }

  completeWrite("success");
  refreshCandidateProfilePages();
  return { ok: true };
}

export async function deleteCandidateEvidence(
  evidenceId: string,
): Promise<CandidateProfileActionResult> {
  const parsedId = z.string().uuid().safeParse(evidenceId);
  if (!parsedId.success) {
    return validationError("Invalid evidence story");
  }

  const supabase = await createClient();
  const completeAuth = startTimedStage(log, "candidate_evidence.auth_lookup");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    completeAuth("failure", { errorCode: "AUTH_REQUIRED", status: 401 });
    return validationError("Authentication required");
  }
  completeAuth("success", { userId: user.id });

  const completeDelete = startTimedStage(log, "candidate_evidence.delete", {
    userId: user.id,
  });
  const { error } = await supabase
    .from("candidate_evidence")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id);

  if (error) {
    completeDelete("failure", {
      errorCode: "CANDIDATE_EVIDENCE_DELETE_FAILED",
    });
    log.error(
      {
        errorCode: "CANDIDATE_EVIDENCE_DELETE_FAILED",
        userId: user.id.substring(0, 12),
      },
      "Candidate evidence delete failed",
    );
    return validationError(
      "Could not delete this evidence story. Please try again.",
    );
  }

  completeDelete("success");
  refreshCandidateProfilePages();
  return { ok: true };
}
