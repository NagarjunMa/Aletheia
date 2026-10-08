import type {
  CandidateGroundingData,
  CandidateGroundingSource,
} from "@/modules/candidate-context/domain/candidate-context.types";
import { escapeForXmlTag } from "@/lib/ai/prompts/linkedin-connection";
import { readFactReview } from "@/lib/candidate-profile/fact-review";
import {
  MAX_SUPPORTING_EXCERPT,
  type AtomicSource,
  type ClaimKind,
} from "../domain/atomic-claim";
import { normalizeClaimText } from "./validate-atomic-claims";

const MAX_SOURCES = 48;
const MAX_TOTAL_CHARS = 8_000;

/** Only owner-reviewed individual assertions can become candidate claims. */
export function buildAtomicCandidateSources(
  candidate: CandidateGroundingData,
  selected: readonly CandidateGroundingSource[],
): AtomicSource[] {
  const result: AtomicSource[] = [];
  let remaining = MAX_TOTAL_CHARS;
  const add = (
    source: CandidateGroundingSource,
    key: string,
    kind: ClaimKind,
    raw: string,
    rewrite?: "current_role",
  ) => {
    const content = normalizeClaimText(escapeForXmlTag(raw));
    if (
      !content ||
      content.length > MAX_SUPPORTING_EXCERPT ||
      content.length > remaining ||
      result.length >= MAX_SOURCES
    )
      return;
    // Selection/exclusion/budget already happened. Never cite a field omitted by it.
    if (!normalizeClaimText(source.content).includes(content)) return;
    result.push({
      id: `${source.id}.${key}`,
      rootId: source.id,
      scope: "candidate",
      kind,
      content,
      ...(rewrite ? { rewrite } : {}),
    });
    remaining -= content.length;
  };
  for (const source of selected) {
    if (source.type === "evidence") {
      const evidence = candidate.confirmedEvidence.find(
        (entry) => entry.confirmed && source.id === `evidence:${entry.id}`,
      );
      if (!evidence) continue;
      for (const fact of readFactReview(evidence, evidence.factReview)) {
        add(source, `fact.${fact.id}`, fact.kind, fact.excerpt);
      }
    }
  }
  return result;
}

/** Stable request-local IDs. Target facts never enter the candidate namespace. */
export function buildAtomicTargetSources(input: {
  profile?: string;
  jobDescription?: string;
  conversation?: string;
}): AtomicSource[] {
  const result: AtomicSource[] = [];
  let remaining = 4_000;
  for (const [name, raw] of Object.entries(input)) {
    if (!raw) continue;
    raw
      .replace(/\r\n?/gu, "\n")
      .split(/\n\s*\n/u)
      .forEach((paragraph, index) => {
        const content = normalizeClaimText(escapeForXmlTag(paragraph));
        if (
          !content ||
          content.length > MAX_SUPPORTING_EXCERPT ||
          content.length > remaining ||
          result.length >= 16
        )
          return;
        result.push({
          id: `target.${name}.${index}`,
          scope: "target",
          kind: "target_observation",
          content,
        });
        remaining -= content.length;
      });
  }
  return result;
}
