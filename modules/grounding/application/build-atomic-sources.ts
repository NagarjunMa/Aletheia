import type {
  CandidateGroundingData,
  CandidateGroundingSource,
} from "@/modules/candidate-context/domain/candidate-context.types";
import { escapeForXmlTag } from "@/lib/ai/prompts/linkedin-connection";
import {
  readFactReview,
  type CandidateFact,
} from "@/lib/candidate-profile/fact-review";
import {
  linkedinDiscussionPassages,
  linkedinJobHasRetraction,
  linkedinProfileHeadlineTopics,
  linkedinProfileRetractedTopics,
  linkedinProfileTopicIsRetracted,
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

export function candidateEvidenceFactId(rootId: string, factId: string) {
  return `${rootId}.fact.${factId}`;
}

/** Only owner-reviewed individual assertions can become candidate claims. */
export function buildAtomicCandidateSources(
  candidate: CandidateGroundingData,
  selected: readonly CandidateGroundingSource[],
  preparedFacts?: ReadonlyMap<string, readonly CandidateFact[]>,
): AtomicSource[] {
  const result: AtomicSource[] = [];
  let remaining = MAX_TOTAL_CHARS;
  const add = (
    source: CandidateGroundingSource,
    id: string,
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
      id,
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
        if (
          preparedFacts &&
          !preparedFacts.get(evidence.id)?.some(({ id }) => id === fact.id)
        )
          continue;
        add(
          source,
          candidateEvidenceFactId(source.id, fact.id),
          fact.kind,
          fact.excerpt,
        );
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
  outputRejection?: (
    _source: AtomicSource,
  ) =>
    | "overlength"
    | "unsupportedWording"
    | "unsafeWording"
    | "excluded"
    | undefined,
  channel?: "linkedin_connection",
  prioritize?: (_sources: readonly AtomicSource[]) => readonly AtomicSource[],
) {
  const result: AtomicSource[] = [];
  const diagnostics = {
    examined: 0,
    excluded: 0,
    overlength: 0,
    unsupportedWording: 0,
    unsafeWording: 0,
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
    const paragraphs = raw.replace(/\r\n?/gu, "\n").split(/\n\s*\n/u);
    const retractedTopics =
      channel === "linkedin_connection" && name === "profile"
        ? linkedinProfileRetractedTopics(paragraphs.map(normalizeClaimText))
        : undefined;
    if (
      channel === "linkedin_connection" &&
      name === "jobDescription" &&
      linkedinJobHasRetraction(paragraphs.map(normalizeClaimText))
    ) {
      diagnostics.examined += paragraphs.length;
      diagnostics.unsupportedWording += paragraphs.length;
      continue;
    }
    paragraphs.forEach((paragraph, index) => {
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
      const discussion =
        channel === "linkedin_connection" &&
        (name === "profile" || name === "jobDescription")
          ? linkedinDiscussionPassages(
              content,
              name === "jobDescription",
            ).filter(
              (passage) => passage.content.length <= MAX_SUPPORTING_EXCERPT,
            )
          : [];
      const topicOnly =
        discussion.length > 1 ||
        (discussion.length > 0 &&
          (content.length > MAX_SUPPORTING_EXCERPT ||
            (name === "jobDescription" && discussion[0]?.content !== content)));
      const excerpts = topicOnly
        ? discussion.map((passage) => passage.content)
        : [content];
      for (const [part, excerpt] of excerpts.entries()) {
        const topic = discussion[part]?.topic;
        const profileTopics = topic
          ? [topic]
          : retractedTopics?.size
            ? linkedinProfileHeadlineTopics(excerpt)
            : [];
        if (
          retractedTopics?.size &&
          profileTopics.some((name) =>
            linkedinProfileTopicIsRetracted(name, retractedTopics),
          )
        ) {
          diagnostics.unsupportedWording += 1;
          continue;
        }
        const source: AtomicSource = {
          id: topicOnly
            ? `target.${name}.${index}.${part}`
            : `target.${name}.${index}`,
          scope: "target",
          kind: "target_observation",
          content: excerpt,
          ...(channel === "linkedin_connection" && name === "profile"
            ? {
                rewrite: topicOnly
                  ? "linkedin_profile_topic"
                  : "linkedin_profile_interest",
              }
            : {}),
          ...(channel === "linkedin_connection" && name === "jobDescription"
            ? {
                rewrite: topicOnly
                  ? "linkedin_job_topic"
                  : "linkedin_job_interest",
              }
            : {}),
        };
        const rejection =
          excerpt.length > MAX_SUPPORTING_EXCERPT
            ? "overlength"
            : outputRejection?.(source);
        if (rejection) diagnostics[rejection] += 1;
        else result.push(source);
      }
    });
  }
  const selected: AtomicSource[] = [];
  for (const source of prioritize ? prioritize(result) : result) {
    if (source.content.length > remaining || selected.length >= 16) {
      diagnostics.budgetRejected += 1;
      continue;
    }
    selected.push(source);
    diagnostics.accepted += 1;
    remaining -= source.content.length;
  }
  return { sources: selected, diagnostics };
}
