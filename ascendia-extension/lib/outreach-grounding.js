const OUTREACH_CATEGORIES = [
  "linkedin_connection",
  "linkedin_inmail",
  "cold_email",
];
const SOURCE_KINDS = ["evidence", "profile", "resume"];
const SUMMARY_FIELDS = [
  "groundingLevel",
  "fallbackReason",
  "selectedSourceCount",
  "selectedEvidenceCount",
  "selectedSourceKinds",
  "injectionSafeMode",
  "provenanceValidated",
];

const boundedCount = (value) =>
  Number.isInteger(value) && value >= 0 && value <= 64;

/** Keep legacy email parsing shared with final-summary eligibility. */
export function readLegacyOutreachDraft(output) {
  if (
    (output.category === "cold_email" ||
      output.category === "linkedin_inmail") &&
    typeof output.body === "string"
  ) {
    try {
      let jsonString = output.body.trim();
      if (jsonString.startsWith("```json")) {
        jsonString = jsonString
          .replace(/^```json\s*/, "")
          .replace(/\s*```$/, "");
      } else if (jsonString.startsWith("```")) {
        jsonString = jsonString.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      if (jsonString.startsWith("{") || jsonString.startsWith('"')) {
        const parsed = JSON.parse(jsonString);
        if (parsed.subject_line || parsed.body) {
          return {
            subject_line: parsed.subject_line || output.subject_line,
            body: parsed.body || output.body,
          };
        }
      }
    } catch {
      // JSON parse failed — keep original body.
    }
  }
  return null;
}

/** Only marked ALE-27 summaries describe the delivered draft. */
export function readOutreachGrounding(
  response,
  expectedCategory = response?.category,
) {
  const metadata = response?.evalMetadata;
  const value = metadata?.grounding;
  if (
    response?.success !== true ||
    typeof response.body !== "string" ||
    !response.body.trim() ||
    readLegacyOutreachDraft(response) !== null ||
    response?.category !== expectedCategory ||
    (metadata?.category !== undefined && metadata.category !== expectedCategory) ||
    !OUTREACH_CATEGORIES.includes(expectedCategory) ||
    !value ||
    typeof value !== "object" ||
    Object.keys(value).length !== SUMMARY_FIELDS.length ||
    !SUMMARY_FIELDS.every((field) => Object.hasOwn(value, field)) ||
    value.provenanceValidated !== true ||
    typeof value.injectionSafeMode !== "boolean"
  )
    return null;

  const {
    groundingLevel,
    fallbackReason,
    selectedSourceCount,
    selectedEvidenceCount,
    selectedSourceKinds,
    injectionSafeMode,
  } = value;
  if (
    !boundedCount(selectedSourceCount) ||
    !boundedCount(selectedEvidenceCount) ||
    !Array.isArray(selectedSourceKinds) ||
    selectedSourceKinds.length > SOURCE_KINDS.length
  )
    return null;
  const kinds = new Set(selectedSourceKinds);
  if (
    kinds.size !== selectedSourceKinds.length ||
    [...kinds].some((kind) => !SOURCE_KINDS.includes(kind))
  )
    return null;

  const hasEvidence = kinds.has("evidence");
  const otherKinds = kinds.size - Number(hasEvidence);
  const otherSources = selectedSourceCount - selectedEvidenceCount;
  if (
    hasEvidence !== selectedEvidenceCount > 0 ||
    otherSources < otherKinds ||
    otherSources > 0 !== otherKinds > 0
  )
    return null;

  let level = "target_only";
  let reasons = ["no_resume_context", "candidate_context_not_used"];
  if (hasEvidence) {
    level = "verified_evidence";
    reasons = ["none"];
  } else if (kinds.has("profile")) {
    level = "profile_grounded";
    reasons = ["no_confirmed_evidence"];
  } else if (kinds.has("resume")) {
    level = "resume_fallback";
    reasons = ["no_profile_context"];
  }
  if (injectionSafeMode) reasons = ["target_injection_detected"];
  if (groundingLevel !== level || !reasons.includes(fallbackReason))
    return null;

  return {
    groundingLevel,
    fallbackReason,
    selectedSourceCount,
    selectedEvidenceCount,
    selectedSourceKinds: [...kinds],
    injectionSafeMode,
    provenanceValidated: true,
  };
}

/** Drop an invalid summary before the worker bridge or the draft cache can copy it. */
export function sanitizeOutreachGrounding(response, expectedCategory) {
  const metadata = response?.evalMetadata;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !Object.hasOwn(metadata, "grounding")
  )
    return response;

  const grounding = readOutreachGrounding(response, expectedCategory);
  const safeMetadata = { ...metadata };
  delete safeMetadata.grounding;
  if (grounding) safeMetadata.grounding = grounding;
  const sanitized = { ...response };
  if (Object.keys(safeMetadata).length) sanitized.evalMetadata = safeMetadata;
  else delete sanitized.evalMetadata;
  return sanitized;
}
