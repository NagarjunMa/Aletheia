import type {
  CandidateGroundingSource,
  CandidateResumeSource,
} from "@/modules/candidate-context/domain/candidate-context.types";

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
  jobDescription: string;
  sources: YcGroundingSource[];
  excludedClaims: string[];
  readiness: YcGroundingReadiness;
  metadata: {
    profileFieldCount: number;
    confirmedEvidenceCount: number;
    resumeSource: CandidateResumeSource;
  };
};
