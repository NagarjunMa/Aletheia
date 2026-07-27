import { z } from "zod";

export const CANDIDATE_EVIDENCE_KINDS = [
  "achievement",
  "technical_project",
  "ambiguity",
  "speed_to_production",
  "leadership",
  "cross_functional",
  "ai_usage",
  "production_scale",
] as const;

export const RELOCATION_PREFERENCES = ["yes", "no", "open"] as const;

export const TARGET_COMPANY_STAGES = [
  "pre_seed",
  "seed",
  "series_a_b",
  "growth",
  "any",
] as const;

const trimmedList = (itemMax: number, listMax: number) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(listMax).default([]);

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === "" || z.string().url().safeParse(value).success,
    {
      message: "Enter a complete URL beginning with https://",
    },
  )
  .default("");

export const candidateProfileInputSchema = z
  .object({
    currentRole: z.string().trim().max(160).default(""),
    currentResponsibilities: z.string().trim().max(3000).default(""),
    startupMotivation: z.string().trim().max(2000).default(""),
    careerGoals: z.string().trim().max(2000).default(""),
    targetRoles: trimmedList(120, 10),
    targetCompanyStages: z
      .array(z.enum(TARGET_COMPANY_STAGES))
      .max(5)
      .default([]),
    targetIndustries: trimmedList(120, 10),
    githubUrl: optionalUrl,
    linkedinUrl: optionalUrl,
    portfolioUrl: optionalUrl,
    location: z.string().trim().max(160).default(""),
    workAuthorization: z.string().trim().max(500).default(""),
    relocationPreference: z.enum(RELOCATION_PREFERENCES).default("open"),
    availability: z.string().trim().max(500).default(""),
    excludedClaims: trimmedList(300, 20),
  })
  .strict();

export const candidateEvidenceInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.enum(CANDIDATE_EVIDENCE_KINDS),
    title: z.string().trim().min(2).max(160),
    context: z.string().trim().max(1000).default(""),
    actions: z.string().trim().min(12).max(2000),
    outcome: z.string().trim().max(1200).default(""),
    metrics: trimmedList(240, 8),
    skills: trimmedList(120, 20),
    links: z
      .array(optionalUrl.refine((value) => value !== ""))
      .max(5)
      .default([]),
    confirmed: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(99).default(0),
  })
  .strict();

export type CandidateProfileInput = z.infer<typeof candidateProfileInputSchema>;
export type CandidateEvidenceInput = z.infer<
  typeof candidateEvidenceInputSchema
>;
export type CandidateEvidenceKind = (typeof CANDIDATE_EVIDENCE_KINDS)[number];

export type ApplicationProfileReadiness = {
  ready: boolean;
  completionPercent: number;
  missingRequired: string[];
  recommendedNext: string[];
};

export function getApplicationProfileReadiness(input: {
  profile: CandidateProfileInput;
  evidence: CandidateEvidenceInput[];
  hasPrimaryResume: boolean;
}): ApplicationProfileReadiness {
  const { profile, evidence, hasPrimaryResume } = input;
  const confirmedEvidence = evidence.filter((entry) => entry.confirmed);
  const hasBackground = hasPrimaryResume || Boolean(profile.currentRole);
  const hasEvidence = confirmedEvidence.length >= 2;
  const hasKind = (kind: CandidateEvidenceKind) =>
    confirmedEvidence.some((entry) => entry.kind === kind);

  const missingRequired: string[] = [];
  if (!hasBackground) {
    missingRequired.push("Add your current role or a primary resume");
  }
  if (!hasEvidence) {
    missingRequired.push("Add at least two confirmed evidence stories");
  }

  const recommendedNext: string[] = [];
  if (!profile.currentResponsibilities) {
    recommendedNext.push("Describe your current responsibilities");
  }
  if (!hasKind("technical_project")) {
    recommendedNext.push("Add your most technically difficult project");
  }
  if (!profile.startupMotivation) {
    recommendedNext.push("Explain why early-stage companies interest you");
  }
  if (!hasKind("ai_usage")) {
    recommendedNext.push("Describe how you use AI tools in your work");
  }

  let score = 0;
  if (hasBackground) score += 20;
  if (profile.currentResponsibilities) score += 10;
  if (hasEvidence) score += 25;
  if (hasKind("technical_project")) score += 10;
  if (profile.startupMotivation) score += 10;
  if (hasKind("ai_usage")) score += 10;
  if (profile.careerGoals || profile.targetRoles.length > 0) score += 5;
  if (profile.githubUrl || profile.linkedinUrl || profile.portfolioUrl)
    score += 5;
  if (profile.location || profile.workAuthorization || profile.availability)
    score += 5;

  return {
    ready: missingRequired.length === 0,
    completionPercent: Math.min(score, 100),
    missingRequired,
    recommendedNext,
  };
}
