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
import { containsExcludedClaim } from "../domain/excluded-claims";

const MAX_SOURCES = 48;
const MAX_TOTAL_CHARS = 8_000;

/** NFKC can create role markup; escape after it, consistently across projections. */
export function normalizeAtomicSourceText(value: string): string {
  return normalizeClaimText(escapeForXmlTag(normalizeClaimText(value)));
}

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
    const content = normalizeAtomicSourceText(raw);
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
export function buildAtomicTargetSources(
  input: {
    profile?: string;
    jobDescription?: string;
    conversation?: string;
  },
  excludedClaims: readonly string[] = [],
  fitsOutput: (_source: AtomicSource) => boolean = () => true,
  channel?: "linkedin_connection",
) {
  const result: AtomicSource[] = [];
  const diagnostics = {
    examined: 0,
    excluded: 0,
    overlength: 0,
    budgetRejected: 0,
    pageControls: 0,
    accepted: 0,
  };
  let remaining = 4_000;
  // Reserve the bounded target pool for the user's explicit job context first.
  const entries = Object.entries(input);
  if (channel === "linkedin_connection") {
    entries.sort(
      ([a], [b]) =>
        Number(b === "jobDescription") - Number(a === "jobDescription"),
    );
  }
  for (const [name, raw] of entries) {
    if (!raw) continue;
    raw
      .replace(/\r\n?/gu, "\n")
      .split(/\n\s*\n/u)
      .forEach((paragraph, index) => {
        const content = normalizeAtomicSourceText(paragraph);
        if (!content) return;
        diagnostics.examined += 1;
        // Reject control-only blocks; never remove lines from a mixed fact.
        if (
          name === "profile" &&
          paragraph
            .split("\n")
            .filter((line) => line.trim())
            .every((line) =>
              /^(?:#{1,6}\s*)?(?:connect|follow|message|more|show (?:all|more|less)|about|experience|education|skills|activity|recommendations|contact info)$/iu.test(
                line.trim(),
              ),
            )
        ) {
          diagnostics.pageControls += 1;
          return;
        }
        if (containsExcludedClaim(content, excludedClaims)) {
          diagnostics.excluded += 1;
          return;
        }
        const source: AtomicSource = {
          id: `target.${name}.${index}`,
          scope: "target",
          kind: "target_observation",
          content,
          ...(channel === "linkedin_connection" && name === "profile"
            ? { rewrite: "linkedin_profile_interest" as const }
            : {}),
          ...(channel === "linkedin_connection" && name === "jobDescription"
            ? { rewrite: "linkedin_job_interest" as const }
            : {}),
        };
        if (content.length > MAX_SUPPORTING_EXCERPT || !fitsOutput(source)) {
          diagnostics.overlength += 1;
          return;
        }
        if (content.length > remaining || result.length >= 16) {
          diagnostics.budgetRejected += 1;
          return;
        }
        result.push(source);
        diagnostics.accepted += 1;
        remaining -= content.length;
      });
  }
  return { sources: result, diagnostics };
}
