import { validateAtomicOutput } from "@/modules/grounding/application/validate-atomic-claims";
import {
  YC_APPLICATION_MAX_WORDS,
  YC_APPLICATION_MIN_WORDS,
} from "@/app/api/extension/generate/schema";
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
  return value
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .trim();
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
  if (
    body.length > 3000 ||
    wordCount < YC_APPLICATION_MIN_WORDS ||
    wordCount > YC_APPLICATION_MAX_WORDS
  ) {
    throw new YcApplicationOutputValidationError(
      `Answer must contain ${YC_APPLICATION_MIN_WORDS} to ${YC_APPLICATION_MAX_WORDS} words`,
    );
  }

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

  validateAtomicOutput({
    claims: input.output.claims.map(({ sourceIds: _ids, ...claim }) => claim),
    sources: input.context.atomicSources ?? [],
    excludedClaims: input.context.excludedClaims,
    fields: [{ text: body, scope: "either" }],
  });

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
