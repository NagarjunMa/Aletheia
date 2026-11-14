import type {
  CandidateGroundingSource,
  EvidenceSelectionDiagnostics,
  CandidateResumeSource,
} from "@/modules/candidate-context/domain/candidate-context.types";
import type { AtomicSource } from "@/modules/grounding/domain/atomic-claim";

export type {
  CandidateGroundingData,
  CandidateResumeSource,
} from "@/modules/candidate-context/domain/candidate-context.types";

/** YC-specific alias retained to preserve the existing public module boundary. */
export type YcGroundingSource = CandidateGroundingSource;

export type YcGroundingReadiness = {
  ready: boolean;
  missingFields: Array<"current_role_or_resume" | "confirmed_evidence">;
  recommendedFields: string[];
};

export type YcGroundingContext = {
  /** Server-only roots that must be used in the result. */
  requiredEvidenceRoots?: readonly string[];
  /** Strongest reviewed fact IDs in the current answer scope. */
  leadingFactIds?: readonly string[];
  /** Private per-question outcomes, separate from public metadata. */
  selectionDiagnostics?: EvidenceSelectionDiagnostics[];
  question: string;
  questions?: Array<{
    questionId: string;
    question: string;
    sourceIds: string[];
    /** Exact reviewed fact IDs for multi-question answers. */
    reviewedFactIds?: readonly string[];
    leadingFactIds?: readonly string[];
    /** Ordinal of the first identical input question, before prompt escaping. */
    questionGroup?: number;
  }>;
  jobDescription: string;
  sources: YcGroundingSource[];
  atomicSources?: AtomicSource[];
  excludedClaims: string[];
  readiness: YcGroundingReadiness;
  metadata: {
    profileFieldCount: number;
    confirmedEvidenceCount: number;
    resumeSource: CandidateResumeSource;
  };
};

export function applicationQuestionSources(
  sources: readonly AtomicSource[],
  question: NonNullable<YcGroundingContext["questions"]>[number],
): AtomicSource[] {
  if (question.reviewedFactIds) {
    const allowed = new Set(question.reviewedFactIds);
    return sources.filter((source) => allowed.has(source.id));
  }
  return sources.filter(
    (source) =>
      source.scope === "target" ||
      question.sourceIds.includes(source.rootId ?? source.id),
  );
}
