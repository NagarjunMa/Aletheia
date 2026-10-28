import {
  atomicClaimsSchema,
  normalizeClaimText,
  allowedClaimTexts,
  MAX_SUPPORTING_EXCERPT,
  NEUTRAL_FRAMING,
  type AtomicSource,
  type ClaimScope,
} from "../domain/atomic-claim";
import { containsExcludedClaim } from "../domain/excluded-claims";

export class AtomicClaimValidationError extends Error {
  public readonly code:
    | "CLAIM_SCHEMA"
    | "CLAIM_SOURCE"
    | "CLAIM_SUPPORT"
    | "CLAIM_REWRITE"
    | "CLAIM_EXCLUDED"
    | "CLAIM_COVERAGE";
  constructor(code: AtomicClaimValidationError["code"]) {
    super("Generated claims could not be verified");
    this.code = code;
    this.name = "AtomicClaimValidationError";
  }
}

export { normalizeClaimText, allowedClaimTexts } from "../domain/atomic-claim";

export function validateAtomicOutput(input: {
  claims: unknown;
  sources: readonly AtomicSource[];
  excludedClaims: readonly string[];
  fields: readonly { text: string; scope: ClaimScope | "either" }[];
}): void {
  const parsed = atomicClaimsSchema.safeParse(input.claims);
  if (!parsed.success) throw new AtomicClaimValidationError("CLAIM_SCHEMA");
  const claims = parsed.data;
  if (
    input.sources.length > 64 ||
    input.fields.length > 20 ||
    input.fields.some((field) => field.text.length > 10_000)
  ) {
    throw new AtomicClaimValidationError("CLAIM_SCHEMA");
  }
  const sources = new Map(input.sources.map((source) => [source.id, source]));
  if (sources.size !== input.sources.length)
    throw new AtomicClaimValidationError("CLAIM_SOURCE");
  const excluded = input.excludedClaims.map(normalizeClaimText).filter(Boolean);
  // Add normalized topic matching without relaxing existing substring denials.
  const isExcluded = (text: string) =>
    containsExcludedClaim(text, input.excludedClaims) ||
    excluded.some((value) => text.includes(value));
  const verified = claims.map((claim) => {
    const source = sources.get(claim.source_id);
    if (!source || source.kind !== claim.kind)
      throw new AtomicClaimValidationError("CLAIM_SOURCE");
    const excerpt = normalizeClaimText(claim.supporting_excerpt);
    // Equality with a complete source unit prevents substring cherry-picking.
    if (
      source.content.length > MAX_SUPPORTING_EXCERPT ||
      excerpt !== normalizeClaimText(source.content)
    )
      throw new AtomicClaimValidationError("CLAIM_SUPPORT");
    const text = normalizeClaimText(claim.text);
    if (!allowedClaimTexts(source).includes(text))
      throw new AtomicClaimValidationError("CLAIM_REWRITE");
    if (isExcluded(text) || isExcluded(excerpt)) {
      throw new AtomicClaimValidationError("CLAIM_EXCLUDED");
    }
    return { text, scope: source.scope };
  });
  const used = new Set<number>();
  for (const field of input.fields) {
    const text = normalizeClaimText(field.text);
    if (isExcluded(text))
      throw new AtomicClaimValidationError("CLAIM_EXCLUDED");
    const candidates = [
      ...verified.flatMap((claim, index) =>
        field.scope === "either" || field.scope === claim.scope
          ? [{ text: claim.text, index }]
          : [],
      ),
      ...NEUTRAL_FRAMING.map((text) => ({
        text: normalizeClaimText(text),
        index: -1,
      })),
    ].sort((a, b) => b.text.length - a.text.length);
    let remaining = text;
    while (remaining) {
      const match = candidates.find(
        (candidate) =>
          remaining === candidate.text ||
          remaining.startsWith(`${candidate.text} `),
      );
      if (!match) throw new AtomicClaimValidationError("CLAIM_COVERAGE");
      if (match.index >= 0) used.add(match.index);
      remaining = remaining.slice(match.text.length).trimStart();
    }
  }
  if (used.size !== claims.length)
    throw new AtomicClaimValidationError("CLAIM_COVERAGE");
}
