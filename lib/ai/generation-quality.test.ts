import { it, expect } from "vitest";
import {
  buildQualityMetadata,
  qualityMetadataSchema,
} from "./generation-quality";
import { sanitizeLogFields } from "@/lib/logging-core";
it("projects only coarse current-source quality, never exact identifiers or text", () => {
  const result = buildQualityMetadata({
    claims: [{ source_id: "PRIVATE_SOURCE_CANARY" }],
    sources: [
      {
        id: "PRIVATE_SOURCE_CANARY",
        scope: "candidate",
        kind: "action",
        content: "PRIVATE_CONTENT_CANARY",
      },
    ],
    archetypes: ["evidence_led"],
    patternCount: 2,
  });
  expect(result).toEqual({
    version: 1,
    archetype: "evidence_led",
    selectedSourceCount: 1,
    selectedSourceKinds: ["action"],
    groundingPassed: true,
    finalizationPatternCount: 2,
  });
  expect(JSON.stringify(sanitizeLogFields({ quality: result }))).not.toMatch(
    /PRIVATE|source_id|rp1\./,
  );
});
it("keeps mixed batches one observation and rejects private extra fields", () => {
  const result = buildQualityMetadata({
    claims: [],
    sources: [],
    archetypes: ["evidence_led", "outcome_led"],
    patternCount: 0,
  });
  expect(result.archetype).toBe("mixed");
  for (const field of [
    "body",
    "sourceIds",
    "supporting_excerpt",
    "planReference",
    "profile",
    "prompt",
  ])
    expect(
      qualityMetadataSchema.safeParse({ ...result, [field]: "PRIVATE_CANARY" })
        .success,
    ).toBe(false);
});
