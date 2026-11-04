import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";
import {
  evidenceFactFields,
  readFactReview,
} from "@/lib/candidate-profile/fact-review";
import { scanForInjection } from "@/lib/ai/prompts/injection-heuristic";
import {
  GroundedTextSanitizationError,
  inspectGroundedText,
  stripSurrogates,
} from "@/lib/ai/sanitizer";
import {
  allowedClaimTexts,
  MAX_SUPPORTING_EXCERPT,
  normalizeClaimText,
  type AtomicSource,
} from "@/modules/grounding/domain/atomic-claim";
import { containsExcludedClaim } from "@/modules/grounding/domain/excluded-claims";
import { normalizeAtomicSourceText } from "@/modules/grounding/application/build-atomic-sources";
import type { CandidateGroundingSource } from "../domain/candidate-context.types";

export function assertSafeSelectionText(text: string) {
  const providerText = stripSurrogates(text);
  if (
    scanForInjection(providerText).triggered ||
    (providerText !== text && scanForInjection(text).triggered)
  )
    throw new SelectedEvidenceUnavailableError();
}

export class SelectedEvidenceUnavailableError extends Error {
  constructor() {
    super("Selected evidence is unavailable");
  }
}

export function resolveSelectedEvidence(
  ids: readonly string[],
  eligible: readonly CandidateEvidenceRecord[],
  limit: number,
  excludedClaims: readonly string[],
) {
  if (ids.length > limit) throw new SelectedEvidenceUnavailableError();

  return ids.map((id) => {
    const entry = eligible.find((story) => story.id === id && story.confirmed);
    if (!entry || !readFactReview(entry, entry.factReview).length)
      throw new SelectedEvidenceUnavailableError();
    const fullStory = [...evidenceFactFields(entry), ...entry.links].join("\n");
    if (containsExcludedClaim(fullStory, excludedClaims))
      throw new SelectedEvidenceUnavailableError();
    assertSafeSelectionText(fullStory);

    return entry;
  });
}

export function includesSelectedEvidence(
  required: readonly string[],
  used: Iterable<string | undefined>,
) {
  const roots = new Set(used);
  return required.every((root) => roots.has(root));
}

type StoryPlatform = Parameters<typeof inspectGroundedText>[1];

function isSafeFact(atom: AtomicSource, platform: StoryPlatform) {
  try {
    inspectGroundedText(allowedClaimTexts(atom).at(-1)!, platform);
    return true;
  } catch (error) {
    if (error instanceof GroundedTextSanitizationError) return false;
    throw error;
  }
}

/** Budget only whole reviewed excerpts, using the same escaping as the ledger. */
export function budgetReviewedStory(
  entry: CandidateEvidenceRecord,
  platform: StoryPlatform,
  maxChars: number,
) {
  const excerpts: string[] = [];
  let remaining = maxChars;
  for (const fact of readFactReview(entry, entry.factReview)) {
    const content = normalizeAtomicSourceText(fact.excerpt);
    const size = content.length + (excerpts.length ? 1 : 0);
    if (
      !content ||
      content.length > MAX_SUPPORTING_EXCERPT ||
      size > remaining ||
      !isSafeFact(
        { id: fact.id, scope: "candidate", kind: fact.kind, content },
        platform,
      )
    )
      continue;
    excerpts.push(normalizeClaimText(fact.excerpt));
    remaining -= size;
  }
  return excerpts.join("\n");
}

/** Explicit stories provide vetted facts, never their entire saved record. */
export function prepareSelectedStoryFacts(
  sources: CandidateGroundingSource[],
  atoms: AtomicSource[],
  platform: StoryPlatform,
) {
  const factsByRoot = new Map<string, string[]>();
  const safeAtoms = atoms.filter((atom) => {
    if (!atom.rootId || !isSafeFact(atom, platform)) return false;
    const facts = factsByRoot.get(atom.rootId) ?? [];
    facts.push(atom.content);
    factsByRoot.set(atom.rootId, facts);
    return true;
  });
  return {
    sources: sources.flatMap((source) => {
      if (source.type !== "evidence") return [source];
      const facts = factsByRoot.get(source.id);
      return facts
        ? [
            {
              ...source,
              label: "Selected reviewed story",
              content: facts.join("\n"),
            },
          ]
        : [];
    }),
    safeAtoms,
  };
}
