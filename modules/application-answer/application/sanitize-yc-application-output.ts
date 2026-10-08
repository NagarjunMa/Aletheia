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

const SANITIZATION_OPTIONS = {
  maxLength: YC_APPLICATION_BODY_MAX_CHARS,
  preserveFormatting: true,
  removeProfanity: true,
  validateEncoding: true,
  detectAIFingerprints: true,
  platform: "general",
  humanize: true,
} as const;

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
 * Evidence is immutable. Sanitize only public text, then let final grounding
 * reject changed factual wording; never rewrite a ledger to fit changed prose.
 */
export async function sanitizeYcApplicationOutput(
  input: YcApplicationToolOutput,
): Promise<SanitizedYcApplicationOutput> {
  const bodyResult = await sanitizeAIOutput(input.body, SANITIZATION_OPTIONS);
  const body = assertSanitizedContent(
    bodyResult,
    "answer",
    YC_APPLICATION_BODY_MAX_CHARS,
  );
  const fingerprintPatterns = [
    ...new Set(bodyResult.aiFingerprints?.detectedPatterns ?? []),
  ];
  return {
    output: {
      body,
      claims: input.claims.map((claim) => ({
        ...claim,
        sourceIds: [...claim.sourceIds],
      })),
    },
    metadata: {
      fingerprintPatternCount: fingerprintPatterns.length,
      fingerprintPatterns,
    },
  };
}
