import type {
  CandidateGroundingSource,
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
  question: string;
  questions?: Array<{
    questionId: string;
    question: string;
    sourceIds: string[];
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
