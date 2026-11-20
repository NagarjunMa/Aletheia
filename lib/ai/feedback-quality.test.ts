import { expect, it } from "vitest";
import { EMAIL_MODES } from "./email-formatter";
import { projectFeedbackMetadata } from "./feedback-quality";
import {
  QUALITY_SOURCE_KINDS,
  qualityMetadataSchema,
} from "./generation-quality";
import { sanitizeLogFields } from "@/lib/logging-core";
it("bounds worst-case projected receipts and operational observations without storing text", () => {
  const quality = qualityMetadataSchema.parse({
    version: 1,
    archetype: "concise_direct",
    selectedSourceCount: 64,
    selectedSourceKinds: [...QUALITY_SOURCE_KINDS],
    groundingPassed: true,
    finalizationPatternCount: 256,
  });
  const metadata = projectFeedbackMetadata({
    generationId: "33333333-3333-4333-8333-333333333333",
    promptVersion: "yc-999.999.999",
    model: "claude-9-9-sonnet-99999999-99999999-99999999",
    generationTimeMs: 1e9,
    inputTokens: 1e9,
    outputTokens: 1e9,
    profileFieldCount: 1e9,
    confirmedEvidenceCount: 1e9,
    hasPrimaryResume: true,
    injectionTriggered: true,
    safeCandidateSummaryUsed: true,
    groundingValidationPassed: true,
    hasCandidateRelevance: true,
    quality,
    body: "PRIVATE_BODY_CANARY",
    sourceIds: ["PRIVATE_SOURCE_CANARY"],
  });
  const receipt = {
    id: metadata.generationId,
    user_id: "11111111-1111-4111-8111-111111111111",
    feedback_type: "rejected",
    rating: 1,
    comment: null,
    metadata: {
      ...metadata,
      category: "linkedin_connection",
      quality_reason: "weak_target_relevance",
      quality_version: 1,
      report_status: "user_reported",
      metrics_trust: "client_reported_unverified",
      feedback_format: "identified_outreach",
      extension_version: "65535.65535.65535.65535",
      extension_api_version: "1",
      message_length: 10000,
      has_subject: true,
      legacy_extension_client: false,
    },
  };
  const event = sanitizeLogFields({
    event: "generation.quality",
    generationId: metadata.generationId,
    category: "linkedin_connection",
    templateVersion: metadata.promptVersion,
    model: metadata.model,
    outcome: "success",
    status: 200,
    durationMs: 1e9,
    inputUnits: 1e9,
    outputUnits: 1e9,
    groundingPassed: true,
    prepared: {
      selectedSourceCount: 64,
      selectedSourceKinds: [...QUALITY_SOURCE_KINDS],
    },
    quality,
  });
  expect(Buffer.byteLength(JSON.stringify(receipt))).toBeLessThan(4096);
  expect(Buffer.byteLength(JSON.stringify(event))).toBeLessThan(2048);
  expect(JSON.stringify(receipt)).not.toMatch(
    /PRIVATE|sourceIds|source_id|rp1\./u,
  );
  expect(event).toMatchObject({ inputUnits: 1e9, outputUnits: 1e9, quality });
});
it("drops unknown versions, non-model text, invalid UUIDs and out-of-range counts", () => {
  expect(
    projectFeedbackMetadata({
      generationId: "-".repeat(36),
      promptVersion: "PRIVATE_PROMPT",
      model: "claude-PRIVATE_MODEL",
      inputTokens: 1e12,
      outputTokens: -1,
      claims: ["PRIVATE"],
    }),
  ).toEqual({});
});

it("persists only consistent final-draft grounding summaries", () => {
  const grounding = {
    groundingLevel: "verified_evidence",
    fallbackReason: "none",
    selectedSourceCount: 1,
    selectedEvidenceCount: 1,
    selectedSourceKinds: ["evidence"],
    injectionSafeMode: false,
  };
  expect(projectFeedbackMetadata({ grounding })).toEqual({});
  const finalGrounding = { ...grounding, provenanceValidated: true };
  expect(projectFeedbackMetadata({ grounding: finalGrounding })).toEqual({
    grounding: finalGrounding,
  });
  expect(
    projectFeedbackMetadata({
      grounding: { ...finalGrounding, selectedEvidenceCount: 2 },
    }),
  ).toEqual({});
  expect(
    projectFeedbackMetadata({
      grounding: { ...finalGrounding, sourceId: "PRIVATE_SOURCE" },
    }),
  ).toEqual({});
});

it.each(EMAIL_MODES)(
  "preserves the already-supported email mode %s in private metadata",
  (emailMode) => {
    expect(projectFeedbackMetadata({ emailMode })).toEqual({ emailMode });
  },
);
it.each([undefined, null, "PRIVATE_MODE_CANARY", { body: "PRIVATE_CANARY" }])(
  "does not guess or store an invalid email mode %j",
  (emailMode) => {
    expect(projectFeedbackMetadata({ emailMode })).toEqual({});
  },
);
