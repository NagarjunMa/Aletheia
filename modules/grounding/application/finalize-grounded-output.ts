import {
  countOutputUnits,
  EMAIL_SUBJECT_MAX_CHARACTERS,
  type OutputConstraint,
} from "@/lib/ai/output-constraints";
import { inspectGroundedText } from "@/lib/ai/sanitizer";
import type { CandidateIdentity } from "@/modules/candidate-context/domain/candidate-context.types";
import {
  normalizeClaimText,
  type AtomicSource,
  type ClaimScope,
} from "../domain/atomic-claim";
import {
  AtomicClaimValidationError,
  validateAtomicOutput,
} from "./validate-atomic-claims";

/** Outer whitespace/encoding equivalence only; quoted arguments and paragraphs stay intact. */
export function prepareGroundedText(value: string): string {
  return normalizeClaimText(value);
}

export class GroundedOutputLimitError extends Error {
  readonly code = "OUTPUT_LIMIT";
  readonly actualCount: number;
  readonly constraint: OutputConstraint;
  constructor(actualCount: number, constraint: OutputConstraint) {
    super("Generated output did not satisfy its channel limit");
    this.actualCount = actualCount;
    this.constraint = constraint;
    this.name = "GroundedOutputLimitError";
  }
}

/** Last content gate: validate displayed text, never the pre-render components alone. */
export function finalizeGroundedOutput(input: {
  body: string;
  bodyConstraint: OutputConstraint;
  requiredEnding?: string;
  subject?: string;
  claims: unknown;
  sources: readonly AtomicSource[];
  excludedClaims: readonly string[];
  platform: "linkedin" | "email" | "general";
  scopedFields?: readonly { text: string; scope: ClaimScope | "either" }[];
  /** Caller-scoped server identity, allowed only for the exact rendered terminal block. */
  trustedIdentity?: CandidateIdentity;
}): void {
  inspectGroundedText(input.body, input.platform);
  if (input.subject !== undefined)
    inspectGroundedText(input.subject, input.platform);
  let body = input.body;
  if (input.trustedIdentity?.fullName) {
    const signature = [
      "Best,",
      input.trustedIdentity.fullName,
      input.trustedIdentity.linkedinUrl,
    ]
      .filter(Boolean)
      .join("\n");
    const terminal = `\n\n${signature}`;
    if (!body.endsWith(terminal))
      throw new AtomicClaimValidationError("CLAIM_COVERAGE");
    body = body.slice(0, -terminal.length);
  }
  if (input.requiredEnding && !body.endsWith(input.requiredEnding))
    throw new AtomicClaimValidationError("CLAIM_COVERAGE");
  validateAtomicOutput({
    claims: input.claims,
    sources: input.sources,
    excludedClaims: input.excludedClaims,
    fields: [
      ...(input.subject !== undefined
        ? [{ text: input.subject, scope: "either" as const }]
        : []),
      { text: body, scope: "either" },
    ],
  });
  if (input.scopedFields) {
    validateAtomicOutput({
      claims: input.claims,
      sources: input.sources,
      excludedClaims: input.excludedClaims,
      fields: input.scopedFields,
    });
  }
  const actualCount = countOutputUnits(input.body, input.bodyConstraint.unit);
  if (
    actualCount < input.bodyConstraint.minimum ||
    actualCount > input.bodyConstraint.maximum
  )
    throw new GroundedOutputLimitError(actualCount, input.bodyConstraint);
  if (
    input.subject !== undefined &&
    (!input.subject.length ||
      input.subject.length > EMAIL_SUBJECT_MAX_CHARACTERS)
  )
    throw new GroundedOutputLimitError(input.subject.length, {
      category: input.bodyConstraint.category,
      unit: "characters",
      minimum: 1,
      maximum: EMAIL_SUBJECT_MAX_CHARACTERS,
    });
}
