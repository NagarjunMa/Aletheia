import {
  APPLICATION_ANSWER_MAX_CHARACTERS,
  APPLICATION_ANSWER_MIN_WORDS,
  countOutputUnits,
} from "@/lib/ai/output-constraints";
import {
  APPLICATION_ANSWER_COURTESY,
  NEUTRAL_FRAMING,
  normalizeClaimText,
  type AtomicClaim,
} from "@/modules/grounding/domain/atomic-claim";

export const APPLICATION_ANSWER_MIN_CLAIM_WORDS =
  APPLICATION_ANSWER_MIN_WORDS -
  countOutputUnits(APPLICATION_ANSWER_COURTESY, "words");

/** Ignore ordering, approved wording variants and duplicate source records. */
export function ycClaimSignature(
  claims: readonly { supporting_excerpt?: string }[],
): string {
  return JSON.stringify(
    [
      ...new Set(
        claims.map(({ supporting_excerpt }) =>
          normalizeClaimText(supporting_excerpt ?? "").replace(/\s+/gu, " "),
        ),
      ),
    ].sort(),
  );
}

function claimBoundary(
  text: string,
  remaining: string,
  candidates: readonly string[],
): string {
  // A competing longer claim can consume this boundary only if it matches the
  // start of the actual remaining draft, including the proposed whitespace.
  const suffixes = candidates.flatMap((candidate) =>
    candidate.length > text.length && candidate.startsWith(text)
      ? [candidate.slice(text.length)]
      : [],
  );
  const overlaps = (boundary: string) => {
    const rest = boundary + remaining;
    return suffixes.some(
      (suffix) =>
        rest.startsWith(suffix) &&
        (rest.length === suffix.length ||
          /\s/u.test(rest[suffix.length] ?? "")),
    );
  };
  const compact = ["\n", " ", "\t", "\u2028", "\u2029"].find(
    (boundary) => !overlaps(boundary),
  );
  if (compact !== undefined) return compact;

  let boundary = "\n";
  while (overlaps(boundary)) {
    const nextLine = boundary + "\n";
    boundary = overlaps(nextLine) ? boundary + " " : nextLine;
  }
  return boundary;
}

export function renderYcAnswer(claims: readonly AtomicClaim[]): string {
  const texts = claims.map(({ text }) => normalizeClaimText(text));
  const candidates = [...texts, ...NEUTRAL_FRAMING];
  const render = (ending: string) =>
    texts.reduceRight(
      (remaining, text) =>
        remaining
          ? text + claimBoundary(text, remaining, candidates) + remaining
          : text,
      ending,
    );
  const words = countOutputUnits(texts.join(" "), "words");
  if (
    words >= APPLICATION_ANSWER_MIN_CLAIM_WORDS &&
    words < APPLICATION_ANSWER_MIN_WORDS
  ) {
    const withCourtesy = render(APPLICATION_ANSWER_COURTESY);
    if (withCourtesy.length <= APPLICATION_ANSWER_MAX_CHARACTERS)
      return withCourtesy;
  }
  return render("");
}
