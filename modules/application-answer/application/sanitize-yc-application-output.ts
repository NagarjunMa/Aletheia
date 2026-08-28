import { sanitizeAIOutput } from "@/lib/ai/sanitizer";
import type { YcApplicationToolOutput } from "../infrastructure/anthropic-yc.repository";

export class YcApplicationOutputSanitizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YcApplicationOutputSanitizationError";
  }
}

export type YcApplicationSanitizationMetadata = {
  fingerprintPatternCount: number;
  fingerprintPatterns: string[];
};

export type SanitizedYcApplicationOutput = {
  output: YcApplicationToolOutput;
  metadata: YcApplicationSanitizationMetadata;
};

const YC_APPLICATION_BODY_MAX_CHARS = 3_000;
const YC_APPLICATION_CLAIM_MAX_CHARS = 1_000;

const SANITIZATION_OPTIONS = {
  maxLength: YC_APPLICATION_BODY_MAX_CHARS,
  preserveFormatting: true,
  removeProfanity: true,
  validateEncoding: true,
  detectAIFingerprints: true,
  platform: "general",
  humanize: true,
} as const;

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .trim()
    .toLocaleLowerCase("en-US");
}

function assertSanitizedContent(
  result: Awaited<ReturnType<typeof sanitizeAIOutput>>,
  field: "answer" | "claim",
  maximumLength: number,
): string {
  if (!result.success || !result.sanitizedContent.trim()) {
    throw new YcApplicationOutputSanitizationError(
      `Generated ${field} failed output sanitization`,
    );
  }

  if (
    result.warnings.includes("Content was truncated due to length limits") ||
    result.sanitizedContent.length > maximumLength
  ) {
    throw new YcApplicationOutputSanitizationError(
      `Generated ${field} exceeded the sanitization limit`,
    );
  }

  return result.sanitizedContent;
}

/**
 * Sanitizes the entire forced application-answer tool result before grounding
 * validation. Claims are rewritten independently with the exact same policy as
 * the body, then checked against the rewritten body to preserve the ledger's
 * verbatim-containment invariant.
 */
export async function sanitizeYcApplicationOutput(
  input: YcApplicationToolOutput,
): Promise<SanitizedYcApplicationOutput> {
  const [bodyResult, ...claimResults] = await Promise.all([
    sanitizeAIOutput(input.body, SANITIZATION_OPTIONS),
    ...input.claims.map((claim) =>
      sanitizeAIOutput(claim.text, SANITIZATION_OPTIONS),
    ),
  ]);

  const body = assertSanitizedContent(
    bodyResult,
    "answer",
    YC_APPLICATION_BODY_MAX_CHARS,
  );
  const claims = input.claims.map((claim, index) => ({
    ...claim,
    text: assertSanitizedContent(
      claimResults[index]!,
      "claim",
      YC_APPLICATION_CLAIM_MAX_CHARS,
    ),
  }));
  const normalizedBody = normalizeForComparison(body);

  if (
    claims.some(
      (claim) => !normalizedBody.includes(normalizeForComparison(claim.text)),
    )
  ) {
    throw new YcApplicationOutputSanitizationError(
      "Sanitized claim text must appear verbatim in the answer",
    );
  }

  const fingerprintPatterns = [bodyResult, ...claimResults]
    .flatMap((result) => result.aiFingerprints?.detectedPatterns ?? [])
    .filter((pattern, index, patterns) => patterns.indexOf(pattern) === index);

  return {
    output: { body, claims },
    metadata: {
      fingerprintPatternCount: fingerprintPatterns.length,
      fingerprintPatterns,
    },
  };
}
