import type { CandidateProfileInput } from "@/lib/candidate-profile/schema";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";

/** The origin of the resume selected from server-owned candidate data. */
export type CandidateResumeSource = "user_resumes" | "profiles" | "none";

/**
 * Private identity fields loaded only through the authenticated caller's RLS
 * client. These values must never be copied into public response metadata.
 */
export type CandidateIdentity = {
  fullName: string;
  linkedinUrl: string;
};

/** Canonical server-only aggregate used by candidate-grounded workflows. */
export type CandidateGroundingData = {
  identity: CandidateIdentity;
  profile: CandidateProfileInput;
  confirmedEvidence: CandidateEvidenceRecord[];
  resume: {
    text: string;
    source: CandidateResumeSource;
  };
};

export type CandidateContextCaller = {
  /** Verified JWT; forward only to a caller-scoped Supabase client. */
  accessToken: string;
  /** Verified auth subject; used only as an explicit ownership filter. */
  userId: string;
};

export const CANDIDATE_SOURCE_KINDS = [
  "evidence",
  "profile",
  "resume",
] as const;

export type CandidateSourceKind = (typeof CANDIDATE_SOURCE_KINDS)[number];

export type CandidateSourcePriority = 1 | 2 | 3;

/** Server-only source material allowed to cross from storage to a model. */
export type CandidateGroundingSource = {
  id: string;
  type: CandidateSourceKind;
  label: string;
  content: string;
  /** Lower numbers are more authoritative. */
  priority: CandidateSourcePriority;
};
