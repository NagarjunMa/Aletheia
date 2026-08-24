import type {
  CandidateIdentity,
  CandidateGroundingSource,
  CandidateSourceKind,
} from "@/modules/candidate-context/domain/candidate-context.types";

export const OUTREACH_GROUNDING_CATEGORIES = [
  "linkedin_connection",
  "cold_email",
  "linkedin_inmail",
] as const;

export type OutreachGroundingCategory =
  (typeof OUTREACH_GROUNDING_CATEGORIES)[number];

export const OUTREACH_GROUNDING_LEVELS = [
  "verified_evidence",
  "profile_grounded",
  "resume_fallback",
  "target_only",
] as const;

export type OutreachGroundingLevel = (typeof OUTREACH_GROUNDING_LEVELS)[number];

export const OUTREACH_FALLBACK_REASONS = [
  "none",
  "no_confirmed_evidence",
  "no_profile_context",
  "no_resume_context",
  "target_injection_detected",
] as const;

export type OutreachFallbackReason = (typeof OUTREACH_FALLBACK_REASONS)[number];

export type OutreachGroundingBudget = {
  maxEvidence: number;
  maxSourceChars: number;
  maxTotalChars: number;
};

export const OUTREACH_GROUNDING_BUDGETS: Record<
  OutreachGroundingCategory,
  OutreachGroundingBudget
> = {
  linkedin_connection: {
    maxEvidence: 1,
    maxSourceChars: 1_800,
    maxTotalChars: 4_000,
  },
  linkedin_inmail: {
    maxEvidence: 1,
    maxSourceChars: 2_400,
    maxTotalChars: 6_000,
  },
  cold_email: {
    maxEvidence: 2,
    maxSourceChars: 2_400,
    maxTotalChars: 8_000,
  },
};

/** Inputs to the pure selector; every string is untrusted. */
export type OutreachGroundingInput = {
  category: OutreachGroundingCategory;
  profileMarkdown: string;
  jobDescription: string;
  conversationContext: string;
};

/**
 * Content-free metadata which is safe to attach to internal telemetry. It is
 * deliberately distinct from CandidateGroundingSource and contains neither
 * source IDs, user IDs, URLs, nor source content.
 */
export type OutreachGroundingMetadata = {
  groundingLevel: OutreachGroundingLevel;
  fallbackReason: OutreachFallbackReason;
  selectedSourceCount: number;
  selectedEvidenceCount: number;
  selectedSourceKinds: CandidateSourceKind[];
  injectionSafeMode: boolean;
};

export type OutreachGroundingContext = {
  /** Server-only; never return this field in the public generation response. */
  identity: CandidateIdentity;
  sources: CandidateGroundingSource[];
  metadata: OutreachGroundingMetadata;
};

export class OutreachGroundingUnavailableError extends Error {
  constructor() {
    super("Candidate context is temporarily unavailable");
    this.name = "OutreachGroundingUnavailableError";
  }
}
