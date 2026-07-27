import type {
  CandidateEvidenceKind,
  CandidateProfileInput,
} from "@/lib/candidate-profile/schema";

export type ProfileCategoryOption = {
  id: "current_work" | "direction" | "proof_links" | "logistics" | "boundaries";
  label: string;
  description: string;
  saveLabel: string;
  fields: readonly (keyof CandidateProfileInput)[];
};

export const PROFILE_CATEGORY_OPTIONS = [
  {
    id: "current_work",
    label: "Current work",
    description: "Your current scope, ownership, and responsibilities.",
    saveLabel: "Save current work",
    fields: ["currentRole", "currentResponsibilities"],
  },
  {
    id: "direction",
    label: "Career direction",
    description: "The roles, stages, industries, and goals you are targeting.",
    saveLabel: "Save career direction",
    fields: [
      "startupMotivation",
      "careerGoals",
      "targetRoles",
      "targetCompanyStages",
      "targetIndustries",
    ],
  },
  {
    id: "proof_links",
    label: "Proof links",
    description: "Public profiles and work a reviewer can verify.",
    saveLabel: "Save proof links",
    fields: ["githubUrl", "linkedinUrl", "portfolioUrl"],
  },
  {
    id: "logistics",
    label: "Application logistics",
    description: "Location, work authorization, relocation, and availability.",
    saveLabel: "Save logistics",
    fields: [
      "location",
      "workAuthorization",
      "relocationPreference",
      "availability",
    ],
  },
  {
    id: "boundaries",
    label: "Claims and boundaries",
    description: "Topics or claims the generator must never imply.",
    saveLabel: "Save boundaries",
    fields: ["excludedClaims"],
  },
] as const satisfies readonly ProfileCategoryOption[];

export type EvidenceKindOption = {
  value: CandidateEvidenceKind;
  label: string;
  prompt: string;
};

export const EVIDENCE_KIND_OPTIONS: EvidenceKindOption[] = [
  {
    value: "achievement",
    label: "Measurable achievement",
    prompt: "A strong result with a measurable outcome.",
  },
  {
    value: "technical_project",
    label: "Technical project",
    prompt: "Your most technically difficult project and what you owned.",
  },
  {
    value: "ambiguity",
    label: "Ambiguity or constraints",
    prompt: "How you made progress with limited resources or unclear inputs.",
  },
  {
    value: "speed_to_production",
    label: "Idea to production",
    prompt: "How you moved quickly from an idea to a production result.",
  },
  {
    value: "leadership",
    label: "Ownership or leadership",
    prompt: "A time you took ownership, led a decision, or unblocked others.",
  },
  {
    value: "cross_functional",
    label: "Cross-functional work",
    prompt: "How you worked across product, engineering, or business teams.",
  },
  {
    value: "ai_usage",
    label: "AI in daily work",
    prompt: "How you use AI tools in everyday work and verify the output.",
  },
  {
    value: "production_scale",
    label: "Production scale",
    prompt: "What you shipped end to end and how it operated at real scale.",
  },
];

export function parseListInput(value: string, maxItems = 20): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value.split(/[\n,]/)) {
    const normalized = item.trim();
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
    if (result.length === maxItems) break;
  }

  return result;
}

export function formatListInput(values: string[]): string {
  return values.join("\n");
}
