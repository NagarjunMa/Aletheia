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

const METRIC_PATTERN =
  /\b\d+(?:[.,]\d+)?(?:\s*(?:%|percent|x|k|m|million|billion))?\b/giu;

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

function extractMetrics(value: string): string[] {
  return [...value.matchAll(METRIC_PATTERN)].map((match) =>
    normalizeForComparison(match[0]),
  );
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

  // A model must not evade numeric grounding by omitting the invented metric
  // from its ledger. Source checks below then validate each covered metric.
  for (const metric of extractMetrics(body)) {
    if (
      !input.output.claims.some((claim) =>
        extractMetrics(claim.text).includes(metric),
      )
    ) {
      throw new YcApplicationOutputValidationError(
        "Answer contains an unledgered metric",
      );
    }
  }
  const sourceById = new Map(
    input.context.sources.map((source) => [source.id, source] as const),
  );
  const normalizedBody = normalizeForComparison(body);
  for (const claim of input.output.claims) {
    const normalizedClaim = normalizeForComparison(claim.text);
    if (!normalizedBody.includes(normalizedClaim)) {
      throw new YcApplicationOutputValidationError(
        "Claim text must appear verbatim in the answer",
      );
    }
    if (claim.sourceIds.length === 0) {
      throw new YcApplicationOutputValidationError(
        "Every claim must cite at least one source",
      );
    }

    const citedSources = claim.sourceIds.map((sourceId) => {
      const source = sourceById.get(sourceId);
      if (!source) {
        throw new YcApplicationOutputValidationError(
          `Claim references unknown source: ${sourceId}`,
        );
      }
      return source;
    });
    const citedContent = normalizeForComparison(
      citedSources.map((source) => source.content).join(" "),
    );
    for (const metric of extractMetrics(claim.text)) {
      if (!citedContent.includes(metric)) {
        throw new YcApplicationOutputValidationError(
          `Claim contains unsupported metric: ${metric}`,
        );
      }
    }
  }

  return {
    body,
    wordCount,
    characterCount: body.length,
    claims: input.output.claims,
  };
}
