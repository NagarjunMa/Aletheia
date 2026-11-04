import { z } from "zod";
import {
  CLAIM_KINDS,
  type AtomicSource,
} from "@/modules/grounding/domain/atomic-claim";
export const QUALITY_REASONS = [
  "too_generic",
  "too_formal",
  "too_repetitive",
  "weak_target_relevance",
  "unsupported_feeling",
  "wrong_ask",
  "wrong_tone",
] as const;
export const QUALITY_ARCHETYPES = [
  "legacy",
  "mixed",
  "target_led",
  "evidence_led",
  "outcome_led",
  "target_only",
  "concise_direct",
] as const;
export const QUALITY_SOURCE_KINDS = CLAIM_KINDS;
export const qualityMetadataSchema = z
  .object({
    version: z.literal(1),
    archetype: z.enum(QUALITY_ARCHETYPES),
    selectedSourceCount: z.number().int().min(0).max(64),
    selectedSourceKinds: z.array(z.enum(QUALITY_SOURCE_KINDS)).max(9),
    groundingPassed: z.literal(true),
    finalizationPatternCount: z.number().int().min(0).max(256),
  })
  .strict();
export type QualityMetadata = z.infer<typeof qualityMetadataSchema>;
export function sourceQualitySummary(sources: readonly AtomicSource[]) {
  const kinds = new Set(sources.map((s) => s.kind));
  return {
    selectedSourceCount: new Set(sources.map((s) => s.id)).size,
    selectedSourceKinds: QUALITY_SOURCE_KINDS.filter((k) => kinds.has(k)),
  };
}
export function buildQualityMetadata(input: {
  claims: readonly { source_id?: string }[];
  sources: readonly AtomicSource[];
  archetypes?: readonly string[];
  patternCount: number;
}): QualityMetadata {
  const ids = new Set(input.claims.map((c) => c.source_id));
  const selected = input.sources.filter((s) => ids.has(s.id));
  const archetypes = [
    ...new Set(
      input.archetypes?.filter((a) =>
        (QUALITY_ARCHETYPES as readonly string[]).includes(a),
      ) ?? [],
    ),
  ];
  return qualityMetadataSchema.parse({
    version: 1,
    archetype: archetypes.length > 1 ? "mixed" : (archetypes[0] ?? "legacy"),
    ...sourceQualitySummary(selected),
    groundingPassed: true,
    finalizationPatternCount: input.patternCount,
  });
}
export type GenerationQualityHooks = {
  generationId: string;
  onPrepared?: (_sources: readonly AtomicSource[]) => void;
  onValidated?: (_quality: QualityMetadata) => void;
  onRejected?: () => void;
};
