import { z } from "zod";
import type { CandidateGroundingSource } from "@/modules/candidate-context/domain/candidate-context.types";
import {
  NEUTRAL_FRAMING,
  allowedClaimTexts,
  type AtomicSource,
} from "@/modules/grounding/domain/atomic-claim";
import {
  linkedinConnectionDraftSchema,
  LINKEDIN_CONNECTION_MAX_CHARACTERS,
} from "./outreach-draft.types";

export class LinkedinGroundingUnavailableError extends Error {
  constructor() {
    super("No complete target fact is available");
    this.name = "LinkedinGroundingUnavailableError";
  }
}

const CTAS = NEUTRAL_FRAMING.filter((text) => text.endsWith("?"));
const MIN_CTA_CHARACTERS = Math.min(...CTAS.map((text) => text.length));
const selectionSchema = z
  .object({
    target_source_id: z.string().min(1).max(200),
    candidate_source_id: z.string().min(1).max(200).nullable(),
    cta: z.enum(CTAS),
  })
  .strict();

/** The model selects sources; factual wording and ledger ownership stay server-side. */
export function buildLinkedinSelectionTool(sources: readonly AtomicSource[]) {
  const targets = sources
    .filter(
      (source) =>
        source.scope === "target" &&
        allowedClaimTexts(source).at(-1)!.length + 1 + MIN_CTA_CHARACTERS <=
          LINKEDIN_CONNECTION_MAX_CHARACTERS,
    )
    .map((source) => source.id);
  const candidates = sources
    .filter((s) => s.scope === "candidate")
    .map((s) => s.id);
  if (!targets.length) throw new LinkedinGroundingUnavailableError();
  return {
    name: "return_linkedin_connection_composition",
    description:
      "Select one target source, optionally one candidate source, and an approved CTA. The server copies complete approved wording, constructs claims and enforces 300 characters. Never write or paraphrase facts. Prefer short sources; use null candidate when no complete pair fits.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        target_source_id: { type: "string", enum: targets },
        candidate_source_id: candidates.length
          ? { anyOf: [{ type: "string", enum: candidates }, { type: "null" }] }
          : { type: "null" },
        cta: { type: "string", enum: CTAS },
      },
      required: ["target_source_id", "candidate_source_id", "cta"],
    },
  } as const;
}

export function resolveLinkedinSelection(
  input: unknown,
  sources: readonly AtomicSource[],
  candidateSources: CandidateGroundingSource[],
) {
  const choice = selectionSchema.parse(input);
  const selected = (id: string, scope: "target" | "candidate") => {
    const matches = sources.filter(
      (source) => source.id === id && source.scope === scope,
    );
    if (matches.length !== 1)
      throw new Error("Invalid selected grounding source");
    return matches[0]!;
  };
  const target = selected(choice.target_source_id, "target");
  const candidate =
    choice.candidate_source_id === null
      ? null
      : selected(choice.candidate_source_id, "candidate");
  const root = candidate ? candidate.rootId : undefined;
  if (
    candidate &&
    (!root || !candidateSources.some((source) => source.id === root))
  )
    throw new Error("Invalid candidate grounding root");
  const claim = (source: AtomicSource) => ({
    text: allowedClaimTexts(source).at(-1)!,
    kind: source.kind,
    source_id: source.id,
    supporting_excerpt: source.content,
  });
  const targetClaim = claim(target);
  const candidateClaim = candidate ? claim(candidate) : null;
  const draft = linkedinConnectionDraftSchema.parse({
    target_observation: targetClaim.text,
    candidate_relevance: candidateClaim
      ? { text: candidateClaim.text, source_ids: [root] }
      : null,
    cta: choice.cta,
    claims: [targetClaim, ...(candidateClaim ? [candidateClaim] : [])],
  });
  return draft;
}
