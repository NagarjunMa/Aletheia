import {
  finalizeGroundedOutput,
  prepareGroundedText,
} from "@/modules/grounding/application/finalize-grounded-output";
import { resolveOutputConstraint } from "@/lib/ai/output-constraints";
import type { YcApplicationToolOutput } from "../infrastructure/anthropic-yc.repository";
import type { YcGroundingContext } from "../domain/yc-grounding.types";

const FORBIDDEN_FRAMING = [
  /^(?:hi|hello|dear)\b/iu,
  /(?:^|\n)\s*(?:best|regards|sincerely|thanks),?\s*(?:\n|$)/iu,
  /\b(?:let'?s connect|connect with me|reach out|schedule (?:a )?(?:call|chat)|happy to discuss|would love to discuss|open to a (?:call|chat)|contact me)\b/iu,
  /\b(?:perfect|ideal|best) candidate\b/iu,
];

export class YcApplicationOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
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
    );
  }

  const body = normalizeText(input.output.body);
  const wordCount = countWords(body);

  if (FORBIDDEN_FRAMING.some((pattern) => pattern.test(body))) {
    throw new YcApplicationOutputValidationError(
      "Answer contains forbidden framing",
    );
  }

  const compactBody = compactClaim(body);
  for (const excludedClaim of input.context.excludedClaims) {
    const compactExcludedClaim = compactClaim(excludedClaim);
    if (compactExcludedClaim && compactBody.includes(compactExcludedClaim)) {
      throw new YcApplicationOutputValidationError(
        "Answer contains an excluded claim",
      );
    }
  }

  if (input.output.claims.length === 0) {
    throw new YcApplicationOutputValidationError(
      "Answer must include a claim ledger",
    );
  }

  finalizeGroundedOutput({
    body,
    bodyConstraint: resolveOutputConstraint({ category: "yc_application" }),
    platform: "general",
    claims: input.output.claims.map(({ sourceIds: _ids, ...claim }) => claim),
    sources: input.context.atomicSources ?? [],
    excludedClaims: input.context.excludedClaims,
  });

  if (body.length > 3000) {
    throw new YcApplicationOutputValidationError(
      "Answer exceeds the character limit",
    );
  }

  return {
    body,
    wordCount,
    characterCount: body.length,
    claims: input.output.claims.map((claim) => ({
      text: claim.text,
      sourceIds: [claim.source_id ?? ""],
    })),
  };
}
