import { isValidCorrelationId } from "@/lib/logging-core";
import { qualityMetadataSchema } from "./generation-quality";
/** Client echoes are reports, never trusted server attestations or free-form telemetry. */
export function projectFeedbackMetadata(
  input: unknown,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if (isValidCorrelationId(record.generationId))
    result.generationId = record.generationId;
  if (
    typeof record.promptVersion === "string" &&
    /^(?:yc-)?\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(record.promptVersion)
  )
    result.promptVersion = record.promptVersion;
  if (
    typeof record.model === "string" &&
    /^claude-(?:[0-9]-[0-9]-)?(?:sonnet|haiku|opus)(?:-[0-9]{1,8}){1,3}$/u.test(
      record.model,
    )
  )
    result.model = record.model;
  for (const key of [
    "generationTimeMs",
    "inputTokens",
    "outputTokens",
    "profileFieldCount",
    "confirmedEvidenceCount",
  ])
    if (
      typeof record[key] === "number" &&
      Number.isSafeInteger(record[key]) &&
      record[key] >= 0 &&
      record[key] <= 1e9
    )
      result[key] = record[key];
  for (const key of [
    "hasPrimaryResume",
    "injectionTriggered",
    "safeCandidateSummaryUsed",
    "groundingValidationPassed",
    "hasCandidateRelevance",
  ])
    if (typeof record[key] === "boolean") result[key] = record[key];
  const quality = qualityMetadataSchema.safeParse(record.quality);
  if (quality.success) result.quality = quality.data;
  return result;
}
