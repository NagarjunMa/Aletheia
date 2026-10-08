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
  /** Only structured current-role fields permit this rewrite. */
  rewrite?: "current_role";
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
