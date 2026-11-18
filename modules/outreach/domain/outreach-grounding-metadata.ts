import { z } from "zod";
import {
  CANDIDATE_SOURCE_KINDS,
  type CandidateSourceKind,
} from "@/modules/candidate-context/domain/candidate-context.types";
import {
  OUTREACH_FALLBACK_REASONS,
  OUTREACH_GROUNDING_LEVELS,
  type OutreachGroundingMetadata,
} from "./outreach-grounding.types";

function classify(kinds: readonly CandidateSourceKind[]) {
  if (kinds.includes("evidence")) return "verified_evidence";
  if (kinds.includes("profile")) return "profile_grounded";
  if (kinds.includes("resume")) return "resume_fallback";
  return "target_only";
}

const FALLBACK_BY_LEVEL = {
  verified_evidence: "none",
  profile_grounded: "no_confirmed_evidence",
  resume_fallback: "no_profile_context",
  target_only: "no_resume_context",
} as const;

export function summarizeOutreachGrounding(
  sourceKinds: readonly CandidateSourceKind[],
  injectionSafeMode: boolean,
  candidateContextAvailable = false,
): OutreachGroundingMetadata {
  const groundingLevel = classify(sourceKinds);
  return {
    groundingLevel,
    fallbackReason: injectionSafeMode
      ? "target_injection_detected"
      : groundingLevel === "target_only" && candidateContextAvailable
        ? "candidate_context_not_used"
        : FALLBACK_BY_LEVEL[groundingLevel],
    selectedSourceCount: sourceKinds.length,
    selectedEvidenceCount: sourceKinds.filter((kind) => kind === "evidence")
      .length,
    selectedSourceKinds: [...new Set(sourceKinds)],
    injectionSafeMode,
  };
}

export const outreachGroundingMetadataSchema = z
  .object({
    groundingLevel: z.enum(OUTREACH_GROUNDING_LEVELS),
    fallbackReason: z.enum(OUTREACH_FALLBACK_REASONS),
    selectedSourceCount: z.number().int().min(0).max(64),
    selectedEvidenceCount: z.number().int().min(0).max(64),
    selectedSourceKinds: z.array(z.enum(CANDIDATE_SOURCE_KINDS)).max(3),
    injectionSafeMode: z.boolean(),
    provenanceValidated: z.literal(true).optional(),
  })
  .strict()
  .refine((summary) => {
    // Cached drafts from older servers report the prepared pool.
    if (!summary.provenanceValidated) return true;
    const {
      selectedSourceKinds: kinds,
      selectedSourceCount: count,
      selectedEvidenceCount: evidence,
    } = summary;
    const nonEvidenceKinds = kinds.filter((kind) => kind !== "evidence");
    const nonEvidenceCount = count - evidence;
    const hasEvidence = evidence > 0;
    const hasNonEvidence = nonEvidenceCount > 0;
    const reportsNonEvidence = nonEvidenceKinds.length > 0;
    const level = classify(kinds);
    const fallback =
      level === "target_only" &&
      summary.fallbackReason === "candidate_context_not_used"
        ? "candidate_context_not_used"
        : FALLBACK_BY_LEVEL[level];
    return (
      new Set(kinds).size === kinds.length &&
      kinds.includes("evidence") === hasEvidence &&
      reportsNonEvidence === hasNonEvidence &&
      nonEvidenceCount >= nonEvidenceKinds.length &&
      summary.groundingLevel === level &&
      summary.fallbackReason ===
        (summary.injectionSafeMode ? "target_injection_detected" : fallback)
    );
  }, "Inconsistent final-draft grounding summary");
