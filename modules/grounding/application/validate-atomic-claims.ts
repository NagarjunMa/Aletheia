import {
  atomicClaimsSchema,
  MAX_SUPPORTING_EXCERPT,
  NEUTRAL_FRAMING,
  type AtomicSource,
  type ClaimScope,
} from "../domain/atomic-claim";

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

/** No case/punctuation folding; negation, actor and numeric notation survive. */
export function normalizeClaimText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

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
  return forms;
}

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
    if (
      excluded.some((value) => text.includes(value) || excerpt.includes(value))
    ) {
      throw new AtomicClaimValidationError("CLAIM_EXCLUDED");
    }
    return { text, scope: source.scope };
  });
  const used = new Set<number>();
  for (const field of input.fields) {
    const text = normalizeClaimText(field.text);
    if (excluded.some((value) => text.includes(value)))
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
