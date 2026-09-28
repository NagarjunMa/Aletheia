import type { CandidateGroundingSource } from "@/modules/candidate-context/domain/candidate-context.types";
import {
  LINKEDIN_CONNECTION_MAX_CHARACTERS,
  type LinkedinConnectionDraft,
} from "../domain/outreach-draft.types";

export class LinkedinConnectionValidationError extends Error {
  public readonly code: LinkedinConnectionValidationCode;
  public readonly safeMetadata: LinkedinConnectionValidationMetadata;

  constructor(
    _code: LinkedinConnectionValidationCode,
    _safeMetadata: LinkedinConnectionValidationMetadata = {},
  ) {
    super("Generated LinkedIn connection note could not be verified");
    this.name = "LinkedinConnectionValidationError";
    this.code = _code;
    this.safeMetadata = _safeMetadata;
  }
}

export interface LinkedinConnectionValidationMetadata {
  actualCharacterCount?: number;
  maximumCharacterCount?: number;
  invalidFields?: string[];
  validationCodes?: string[];
}

export type LinkedinConnectionValidationCode =
  | "CONNECTION_OVER_LIMIT"
  | "CONNECTION_UNKNOWN_SOURCE"
  | "CONNECTION_SOURCE_OVERLAP_FAILED"
  | "CONNECTION_EMPTY_SECTION"
  | "CONNECTION_CTA_INVALIDATED"
  | "CONNECTION_TOOL_OUTPUT_INVALID";

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

function normalize(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function tokens(value: string): string[] {
  return (
    value
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .match(/[\p{L}\p{N}+#.]{2,}/gu)
      ?.filter((token) => !STOP_WORDS.has(token)) ?? []
  );
}

function validateRelevance(
  draft: LinkedinConnectionDraft,
  sources: CandidateGroundingSource[],
): void {
  if (!draft.candidate_relevance) return;
  const byId = new Map(sources.map((source) => [source.id, source]));
  const supporting = draft.candidate_relevance.source_ids.map((id) =>
    byId.get(id),
  );
  if (supporting.some((source) => !source)) {
    throw new LinkedinConnectionValidationError("CONNECTION_UNKNOWN_SOURCE");
  }
  const sourceTokens = new Set(
    supporting.flatMap((source) => tokens(source!.content)),
  );
  const claimTokens = tokens(draft.candidate_relevance.text);
  if (
    claimTokens.length > 0 &&
    !claimTokens.some((token) => sourceTokens.has(token))
  ) {
    throw new LinkedinConnectionValidationError(
      "CONNECTION_SOURCE_OVERLAP_FAILED",
    );
  }
}

/** Validates provenance and deterministically composes a complete note. */
export function renderLinkedinConnection(input: {
  draft: LinkedinConnectionDraft;
  sources: CandidateGroundingSource[];
}): { body: string; characterCount: number; hasCandidateRelevance: boolean } {
  validateRelevance(input.draft, input.sources);
  const observation = normalize(input.draft.target_observation);
  const relevance = input.draft.candidate_relevance
    ? normalize(input.draft.candidate_relevance.text)
    : "";
  const cta = normalize(input.draft.cta);
  if (!observation || !cta || (input.draft.candidate_relevance && !relevance)) {
    throw new LinkedinConnectionValidationError("CONNECTION_EMPTY_SECTION");
  }
  const body = [observation, relevance, cta].filter(Boolean).join(" ");
  if (body.length > LINKEDIN_CONNECTION_MAX_CHARACTERS) {
    throw new LinkedinConnectionValidationError("CONNECTION_OVER_LIMIT", {
      actualCharacterCount: body.length,
      maximumCharacterCount: LINKEDIN_CONNECTION_MAX_CHARACTERS,
    });
  }
  if (!body.endsWith(cta)) {
    throw new LinkedinConnectionValidationError("CONNECTION_CTA_INVALIDATED");
  }
  return {
    body,
    characterCount: body.length,
    hasCandidateRelevance: Boolean(input.draft.candidate_relevance),
  };
}
