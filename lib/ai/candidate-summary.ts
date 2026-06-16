const CONTACT_OR_LINK_PATTERN =
  /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\+?\d[\d().\-\s]{7,}\d|https?:\/\/\S+|\b(?:linkedin|github)\.com\/\S+/gi;

const SENSITIVE_ID_PATTERN =
  /\b(?:ssn|social security|passport|visa|green card|phone|email|address)\b[^.\n]*/gi;

const YEAR_RANGE_PATTERN =
  /\b(?:19|20)\d{2}\s*(?:-|to|–|—)\s*(?:present|(?:19|20)\d{2})\b/gi;

const COMPANY_CONTEXT_PATTERN =
  /\b(?:at|@)\s+[A-Z][A-Za-z0-9&.,' -]{1,45}(?=(?:\s|,|\.|$))/g;

const ROLE_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "backend/cloud infrastructure engineer",
    pattern:
      /\b(?:backend|api|server|distributed|cloud|infrastructure|aws|gcp|terraform|docker)\b/i,
  },
  {
    label: "backend/ML engineer",
    pattern:
      /\b(?:machine learning|ml|rag|llm|ai|model|ocr|mistral|bedrock)\b/i,
  },
  {
    label: "full-stack engineer",
    pattern: /\b(?:react|next\.?js|typescript|frontend|full[-\s]?stack)\b/i,
  },
  {
    label: "software engineer",
    pattern: /\b(?:software engineer|engineer|developer)\b/i,
  },
];

const DOMAIN_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "backend systems",
    pattern:
      /\b(?:backend|api|fastapi|node\.?js|distributed|microservices?|server)\b/i,
  },
  {
    label: "cloud infrastructure",
    pattern:
      /\b(?:aws|gcp|cloud|cloudwatch|terraform|docker|kubernetes|ci\/cd|cicd)\b/i,
  },
  {
    label: "infrastructure automation",
    pattern:
      /\b(?:automation|deployment|terraform|scripts?|onboarding|provisioning|monitoring|alerting)\b/i,
  },
  {
    label: "AI/RAG systems",
    pattern:
      /\b(?:ai|rag|llm|bedrock|mistral|model|ocr|machine learning|ml)\b/i,
  },
  {
    label: "data and document processing",
    pattern:
      /\b(?:postgres|postgresql|database|ocr|documents?|digitization|data)\b/i,
  },
  {
    label: "full-stack delivery",
    pattern:
      /\b(?:react|typescript|javascript|frontend|full[-\s]?stack|product)\b/i,
  },
];

const SKILL_SIGNALS = [
  "Python",
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Node.js",
  "FastAPI",
  "AWS",
  "GCP",
  "Terraform",
  "Docker",
  "PostgreSQL",
  "CloudWatch",
  "RAG",
  "LLM",
  "OCR",
  "Mistral",
  "Bedrock",
] as const;

function normalizeResumeForSummary(resume: string): string {
  return resume
    .replace(CONTACT_OR_LINK_PATTERN, " ")
    .replace(SENSITIVE_ID_PATTERN, " ")
    .replace(YEAR_RANGE_PATTERN, " ")
    .replace(COMPANY_CONTEXT_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatchingLabel(
  text: string,
  signals: Array<{ label: string; pattern: RegExp }>,
  fallback = "",
): string {
  return signals.find(({ pattern }) => pattern.test(text))?.label ?? fallback;
}

function matchingLabels(
  text: string,
  signals: Array<{ label: string; pattern: RegExp }>,
  limit: number,
): string[] {
  return signals
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label)
    .slice(0, limit);
}

function matchingSkills(text: string, limit: number): string[] {
  return SKILL_SIGNALS.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped.replace("\\.", "\\.?")}\\b`, "i").test(
      text,
    );
  }).slice(0, limit);
}

function extractYears(text: string): string {
  const match = text.match(/\b(\d{1,2}\+?)\s+years?\b/i);
  return match ? `${match[1]} years of experience` : "";
}

export function deriveSafeCandidateSummary(resume: string): string {
  const normalized = normalizeResumeForSummary(resume);
  if (!normalized) return "";

  const role = firstMatchingLabel(
    normalized,
    ROLE_SIGNALS,
    "software engineer",
  );
  const years = extractYears(normalized);
  const domains = matchingLabels(normalized, DOMAIN_SIGNALS, 4);
  const skills = matchingSkills(normalized, 8);

  if (!role && !domains.length && !skills.length) return "";

  const parts = [
    `High-level candidate summary: ${years ? `${role} with ${years}` : role}.`,
  ];

  if (domains.length) {
    parts.push(`Domains: ${domains.join(", ")}.`);
  }

  if (skills.length) {
    parts.push(`Relevant tools/skills: ${skills.join(", ")}.`);
  }

  parts.push(
    "Use this summary only as broad candidate context; do not reveal or imply access to the raw resume.",
  );

  return parts.join(" ");
}
