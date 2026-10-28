import { z } from "zod";
import type { CandidateGroundingSource } from "@/modules/candidate-context/domain/candidate-context.types";
import type { OutreachGroundingContext } from "./outreach-grounding.types";
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
  readonly reasonCodes: string[];
  readonly publicMessage: string;
  constructor(diagnostics?: OutreachGroundingContext["targetDiagnostics"]) {
    super("No complete target fact is available");
    this.name = "LinkedinGroundingUnavailableError";
    this.reasonCodes = [];
    if (diagnostics?.injectionReasons.length)
      this.reasonCodes.push("TARGET_INJECTION_DETECTED");
    if (diagnostics?.overlength) this.reasonCodes.push("TARGET_FACT_TOO_LONG");
    if (diagnostics?.excluded) this.reasonCodes.push("TARGET_FACT_EXCLUDED");
    if (diagnostics?.budgetRejected)
      this.reasonCodes.push("TARGET_SOURCE_BUDGET");
    if (diagnostics?.pageControls)
      this.reasonCodes.push("TARGET_PAGE_CONTROLS");
    if (!this.reasonCodes.length)
      this.reasonCodes.push("NO_ELIGIBLE_TARGET_FACT");
    this.publicMessage = diagnostics?.injectionReasons.length
      ? "The selected profile contains instruction-like or encoded text that cannot be used safely. Try another profile. No draft was generated."
      : [
          "No complete, usable target fact is available.",
          diagnostics?.overlength
            ? "Passages exceed the space available in a 300-character note."
            : "",
          diagnostics?.excluded
            ? "Passages match your saved excluded topics."
            : "",
          diagnostics?.pageControls
            ? "Page controls and section labels cannot be used as facts."
            : "",
          diagnostics?.budgetRejected
            ? "The context selection limit was reached."
            : "",
          "Add a short, complete factual sentence about the target in the optional Job Description field; excluded topics remain blocked.",
        ]
          .filter(Boolean)
          .join(" ");
  }
}

const CTAS = NEUTRAL_FRAMING.filter((text) => text.endsWith("?"));
const MIN_CTA_CHARACTERS = Math.min(...CTAS.map((text) => text.length));

export function linkedinTargetFits(source: AtomicSource): boolean {
  return (
    source.scope === "target" &&
    allowedClaimTexts(source).at(-1)!.length + 1 + MIN_CTA_CHARACTERS <=
      LINKEDIN_CONNECTION_MAX_CHARACTERS
  );
}
const selectionSchema = z
  .object({
    target_source_id: z.string().min(1).max(200),
    candidate_source_id: z.string().min(1).max(200).nullable(),
    cta: z.enum(CTAS),
  })
  .strict();

/** The model selects sources; factual wording and ledger ownership stay server-side. */
export function buildLinkedinSelectionTool(
  sources: readonly AtomicSource[],
  diagnostics?: OutreachGroundingContext["targetDiagnostics"],
) {
  const targets = sources.filter(linkedinTargetFits).map((source) => source.id);
  const candidates = sources
    .filter((s) => s.scope === "candidate")
    .map((s) => s.id);
  if (!targets.length) throw new LinkedinGroundingUnavailableError(diagnostics);
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
