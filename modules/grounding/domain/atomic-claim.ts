import { z } from "zod";

export const CLAIM_KINDS = [
  "role",
  "company",
  "technology",
  "action",
  "outcome",
  "metric",
  "preference",
  "target_observation",
  "cta_rationale",
] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];
export type ClaimScope = "candidate" | "target";

// Raw limits precede normalization. Aggregate work is bounded as well as each
// value; these are safety ceilings, not a promise that a model fills every cap.
export const MAX_ATOMIC_CLAIMS = 12;
export const MAX_CLAIM_TEXT = 700;
export const MAX_SUPPORTING_EXCERPT = 600;
export const MAX_LEDGER_CHARS = 6_000;
const bounded = (max: number) => z.string().max(max).trim().min(1);
export const atomicClaimSchema = z
  .object({
    text: bounded(MAX_CLAIM_TEXT),
    kind: z.enum(CLAIM_KINDS),
    source_id: bounded(200),
    supporting_excerpt: bounded(MAX_SUPPORTING_EXCERPT),
  })
  .strict();
export const atomicClaimsSchema = z
  .array(atomicClaimSchema)
  .max(MAX_ATOMIC_CLAIMS)
  .refine(
    (claims) =>
      claims.reduce(
        (sum, claim) =>
          sum +
          claim.text.length +
          claim.supporting_excerpt.length +
          claim.source_id.length,
        0,
      ) <= MAX_LEDGER_CHARS,
    "Claim ledger exceeds its aggregate limit",
  );
export type AtomicClaim = z.infer<typeof atomicClaimSchema>;

/** Private, server-built complete fact unit. Never accept this from a model. */
export type AtomicSource = {
  id: string;
  /** Original selected source, used for per-question eligibility. */
  rootId?: string;
  scope: ClaimScope;
  kind: ClaimKind;
  content: string;
  /** Server-assigned wording policy; never accepted from model input. */
  rewrite?:
    "current_role" | "linkedin_profile_interest" | "linkedin_job_interest";
};

export const atomicClaimsToolSchema = {
  type: "array",
  maxItems: MAX_ATOMIC_CLAIMS,
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string", minLength: 1, maxLength: MAX_CLAIM_TEXT },
      kind: { type: "string", enum: CLAIM_KINDS },
      source_id: { type: "string", minLength: 1, maxLength: 200 },
      supporting_excerpt: {
        type: "string",
        minLength: 1,
        maxLength: MAX_SUPPORTING_EXCERPT,
      },
    },
    required: ["text", "kind", "source_id", "supporting_excerpt"],
  },
} as const;

/** Whole phrases only. Never strip arbitrary "non-factual" words from text. */
export const NEUTRAL_FRAMING = [
  "Open to connecting?",
  "Would you be open to a brief conversation?",
  "Open to a brief chat?",
  "Would you be open to a brief chat?",
  "Would you be open to discussing the role?",
  "May I ask you a question?",
  "I'd welcome a conversation.",
  "Thank you for considering my application.",
  "Professional introduction",
  "A brief introduction",
  "Following up",
  "Hi there,",
  "Hello,",
  "Best,",
  "Thanks,",
  "A quick look at my background:",
] as const;

/** Inner whitespace can be part of a literal value; only encoding and outer trim are equivalent. */
export function normalizeClaimText(value: string): string {
  return value.normalize("NFKC").replace(/\r\n?/gu, "\n").trim();
}

// Only named fields may move out of a headline suffix; free text can qualify
// the role (for example, "Retired since 2020") and must remain in place.
const LINKEDIN_SPECIALTIES = new Set([
  "Applied AI",
  "Artificial Intelligence",
  "Machine Learning",
  "Data Platform",
  "Data Science",
  "Software Engineering",
  "Infrastructure",
  "Reliability",
  "Developer Tools",
  "AI Evaluation",
]);

/** Finite source-owned rewrites, shared by prompt examples and validation. */
export function allowedClaimTexts(source: AtomicSource): string[] {
  const excerpt = normalizeClaimText(source.content);
  const quoted =
    source.scope === "target"
      ? `The supplied context says: "${excerpt}"`
      : `My background includes: "${excerpt}"`;
  const forms = [quoted];
  // Already explicit first-person candidate assertions need no actor inference.
  if (source.scope === "candidate" && /^I\s/u.test(excerpt))
    forms.push(excerpt);
  if (
    source.scope === "candidate" &&
    source.kind === "role" &&
    source.rewrite === "current_role"
  ) {
    forms.push(`My current role is ${excerpt}.`);
  }
  if (source.scope === "target" && source.kind === "target_observation") {
    // Only the closed named-field grammar may treat line wrapping as formatting.
    // Unknown/quoted literal context still uses the complete exact excerpt.
    const structuredExcerpt = excerpt.replace(/\s+/gu, " ");
    if (source.rewrite === "linkedin_profile_interest") {
      // A complete headline can change grammar without claiming the specialty
      // belongs to the role. Ambiguous/qualified narratives keep the full quote.
      const headline =
        /^(Engineering Manager|Software Engineer|Applied AI Engineer|Research Engineer|Research Scientist|Product Manager|Data Scientist|Director of Engineering|Head of Engineering) at ([\p{L}\p{N}][\p{L}\p{N} &+/-]{0,79}) \| ([\p{L}\p{N}][\p{L}\p{N} &+/-]{0,79})$/u.exec(
          structuredExcerpt,
        );
      const qualified =
        /\b(?:not|no|never|former|formerly|previously|ex|aspiring|seeking|hiring|until|only|unless|except|without|simulation)\b/iu.test(
          structuredExcerpt,
        );
      return [
        headline &&
        !qualified &&
        headline[3]!
          .split(" & ")
          .every((part) => LINKEDIN_SPECIALTIES.has(part))
          ? `I'm interested in ${headline[3]} and your ${headline[1]} role at ${headline[2]}.`
          : `I'd like to connect about your profile: "${excerpt}"`,
      ];
    }
    if (source.rewrite === "linkedin_job_interest") {
      // Only this complete positive hiring grammar permits rearranging the roles.
      // Qualifications, negation and additional sentences retain the whole quote.
      const hiring =
        /^(The [\p{L}\p{N}&+/-]+(?: [\p{L}\p{N}&+/-]+){0,9} team at [\p{L}\p{N}&+/-]+(?: [\p{L}\p{N}&+/-]+){0,5}) is hiring ((?:[A-Z][\p{L}\p{N}+#/-]* ){0,6}(?:Engineers|Developers|Designers|Researchers))[.!]?$/u.exec(
          structuredExcerpt,
        );
      return [
        hiring
          ? `I'm interested in the openings for ${hiring[2]} with ${hiring[1]!.replace(/^The /u, "the ")}.`
          : `I'd like to connect about this context: "${excerpt}"`,
      ];
    }
  }
  return forms;
}
