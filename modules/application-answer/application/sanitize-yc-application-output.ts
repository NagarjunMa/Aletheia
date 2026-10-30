import { inspectGroundedText } from "@/lib/ai/sanitizer";
import { prepareGroundedText } from "@/modules/grounding/application/finalize-grounded-output";
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

/**
 * Evidence is immutable. Prepare only nonsemantic public text and inspect safety; final grounding
 * still verifies immutable evidence against the exact returned answer.
 */
export async function sanitizeYcApplicationOutput(
  input: YcApplicationToolOutput,
): Promise<SanitizedYcApplicationOutput> {
  const body = prepareGroundedText(input.body);
  if (!body || body.length > YC_APPLICATION_BODY_MAX_CHARS) {
    throw new YcApplicationOutputSanitizationError(
      "Generated answer exceeded or failed the sanitization limit",
    );
  }
  let fingerprintPatterns: string[];
  try {
    ({ fingerprintPatterns } = inspectGroundedText(body, "general"));
  } catch {
    throw new YcApplicationOutputSanitizationError(
      "Generated answer failed output sanitization",
    );
  }
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
