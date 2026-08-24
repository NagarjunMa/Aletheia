import type { CandidateGroundingSource } from "@/modules/candidate-context/domain/candidate-context.types";
import type { ColdEmailDraft } from "../domain/outreach-draft.types";

export class OutreachDraftValidationError extends Error {
  constructor() {
    super("Generated draft could not be verified against selected sources");
    this.name = "OutreachDraftValidationError";
  }
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "you",
  "your",
]);

function tokens(value: string): string[] {
  return (
    value
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .match(/[\p{L}\p{N}+#.]{2,}/gu)
      ?.filter((token) => !STOP_WORDS.has(token)) ?? []
  );
}

/** Validates only selected source references and plausible source overlap. */
export function validateOutreachDraft(input: {
  draft: ColdEmailDraft;
  sources: CandidateGroundingSource[];
}): ColdEmailDraft {
  const byId = new Map(input.sources.map((source) => [source.id, source]));
  for (const proof of input.draft.proof_points) {
    const supporting = proof.source_ids.map((id) => byId.get(id));
    if (supporting.some((source) => !source)) {
      throw new OutreachDraftValidationError();
    }
    const sourceTokens = new Set(
      supporting.flatMap((source) => tokens(source!.content)),
    );
    const claimTokens = tokens(proof.text);
    const overlap = claimTokens.filter((token) => sourceTokens.has(token));
    if (claimTokens.length > 0 && overlap.length === 0) {
      throw new OutreachDraftValidationError();
    }
  }
  return input.draft;
}
