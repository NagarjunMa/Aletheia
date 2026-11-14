import { includesSelectedEvidence } from "@/modules/candidate-context/application/selected-evidence";
import {
  finalizeGroundedOutput,
  prepareGroundedText,
} from "@/modules/grounding/application/finalize-grounded-output";
import {
  APPLICATION_ANSWER_MAX_CHARACTERS,
  resolveOutputConstraint,
} from "@/lib/ai/output-constraints";
import type { YcApplicationToolOutput } from "../infrastructure/anthropic-yc.repository";
import type { YcGroundingContext } from "../domain/yc-grounding.types";

const FORBIDDEN_FRAMING = [
  /^(?:hi|hello|dear)\b/iu,
  /(?:^|\n)\s*(?:best|regards|sincerely|thanks),?\s*(?:\n|$)/iu,
  /\b(?:let'?s connect|connect with me|reach out|schedule (?:a )?(?:call|chat)|happy to discuss|would love to discuss|open to a (?:call|chat)|contact me)\b/iu,
  /\b(?:perfect|ideal|best) candidate\b/iu,
];

export class YcApplicationOutputValidationError extends Error {
  readonly code:
    | "YC_CONTEXT_NOT_READY"
    | "YC_FORBIDDEN_FRAMING"
    | "CLAIM_EXCLUDED"
    | "YC_LEDGER_REQUIRED"
    | "YC_SELECTED_EVIDENCE_MISSING"
    | "YC_REPEATED_ANSWER"
    | "YC_QUESTION_EVIDENCE_MISSING"
    | "YC_CHARACTER_LIMIT";
  constructor(
    message: string,
    code: YcApplicationOutputValidationError["code"],
  ) {
    super(message);
    this.code = code;
    this.name = "YcApplicationOutputValidationError";
  }
}

function normalizeText(value: string): string {
  return prepareGroundedText(value);
}

function normalizeForComparison(value: string): string {
  return normalizeText(value).toLocaleLowerCase("en-US");
}

function compactClaim(value: string): string {
  return normalizeForComparison(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function countWords(value: string): number {
  return value.length === 0 ? 0 : value.split(/\s+/u).length;
}

export function validateYcApplicationOutput(input: {
  output: YcApplicationToolOutput;
  context: YcGroundingContext;
}) {
  if (!input.context.readiness.ready) {
    throw new YcApplicationOutputValidationError(
      "Grounding context is not ready",
      "YC_CONTEXT_NOT_READY",
    );
  }

  const body = normalizeText(input.output.body);
  const wordCount = countWords(body);

  if (FORBIDDEN_FRAMING.some((pattern) => pattern.test(body))) {
    throw new YcApplicationOutputValidationError(
      "Answer contains forbidden framing",
      "YC_FORBIDDEN_FRAMING",
    );
  }

  const compactBody = compactClaim(body);
  for (const excludedClaim of input.context.excludedClaims) {
    const compactExcludedClaim = compactClaim(excludedClaim);
    if (compactExcludedClaim && compactBody.includes(compactExcludedClaim)) {
      throw new YcApplicationOutputValidationError(
        "Answer contains an excluded claim",
        "CLAIM_EXCLUDED",
      );
    }
  }

  if (input.output.claims.length === 0) {
    throw new YcApplicationOutputValidationError(
      "Answer must include a claim ledger",
      "YC_LEDGER_REQUIRED",
    );
  }

  const finalization = finalizeGroundedOutput({
    body,
    bodyConstraint: resolveOutputConstraint({ category: "yc_application" }),
    platform: "general",
    claims: input.output.claims.map(({ sourceIds: _ids, ...claim }) => claim),
    sources: input.context.atomicSources ?? [],
    excludedClaims: input.context.excludedClaims,
  });

  if (
    input.context.leadingFactIds &&
    !input.output.claims.some(
      ({ source_id }) =>
        source_id && input.context.leadingFactIds?.includes(source_id),
    )
  ) {
    throw new YcApplicationOutputValidationError(
      "Answer omits the most relevant reviewed evidence",
      "YC_QUESTION_EVIDENCE_MISSING",
    );
  }

  if (input.context.requiredEvidenceRoots) {
    const cited = new Set(input.output.claims.map((claim) => claim.source_id));
    const roots = (input.context.atomicSources ?? [])
      .filter((source) => source.scope === "candidate" && cited.has(source.id))
      .map((source) => source.rootId);
    if (!includesSelectedEvidence(input.context.requiredEvidenceRoots, roots)) {
      throw new YcApplicationOutputValidationError(
        "Answer omits selected evidence",
        "YC_SELECTED_EVIDENCE_MISSING",
      );
    }
  }

  if (body.length > APPLICATION_ANSWER_MAX_CHARACTERS) {
    throw new YcApplicationOutputValidationError(
      "Answer exceeds the character limit",
      "YC_CHARACTER_LIMIT",
    );
  }

  return {
    body,
    fingerprintPatternCount: finalization.fingerprintPatternCount,
    wordCount,
    characterCount: body.length,
    claims: input.output.claims.map((claim) => ({
      text: claim.text,
      sourceIds: [claim.source_id ?? ""],
    })),
  };
}
