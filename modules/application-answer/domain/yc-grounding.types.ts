import type { CandidateProfileInput } from "@/lib/candidate-profile/schema";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";

export type CandidateResumeSource = "user_resumes" | "profiles" | "none";

export type CandidateGroundingData = {
  profile: CandidateProfileInput;
  confirmedEvidence: CandidateEvidenceRecord[];
  resume: {
    text: string;
    source: CandidateResumeSource;
  };
};

export type YcGroundingSource = {
  id: string;
  type: "evidence" | "profile" | "resume";
  label: string;
  content: string;
  /** Lower numbers are more authoritative. */
  priority: 1 | 2 | 3;
};

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
