import {
  countWords,
  truncateToWordLimit,
} from "@/app/api/extension/generate/utils";
import type { CandidateIdentity } from "@/modules/candidate-context/domain/candidate-context.types";
import { getEmailWordLimit, type EmailMode } from "@/lib/ai/email-formatter";
import type { ColdEmailDraft } from "../domain/outreach-draft.types";

function normalizeSection(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/** Composes the outbound body; no regex repair or model-owned identity. */
export function renderColdEmail(input: {
  draft: ColdEmailDraft;
  identity: CandidateIdentity;
  mode: EmailMode;
}): {
  subject: string;
  body: string;
  wordCount: number;
  identityIncluded: boolean;
} {
  const proof = input.draft.proof_points.map((point) =>
    normalizeSection(point.text),
  );
  const blocks = [
    `Hi ${normalizeSection(input.draft.greeting)},`,
    [
      normalizeSection(input.draft.target_opening),
      normalizeSection(input.draft.candidate_positioning),
    ].join(" "),
    proof.length ? ["A quick look at my background:", ...proof].join("\n") : "",
    `${normalizeSection(input.draft.value_statement)} ${normalizeSection(input.draft.cta)}`,
  ].filter(Boolean);
  const signature = input.identity.fullName
    ? ["Best,", input.identity.fullName, input.identity.linkedinUrl]
        .filter(Boolean)
        .join("\n")
    : "";
  const limit = getEmailWordLimit("cold_email", input.mode).max;
  const withSignature = [...blocks, signature].filter(Boolean).join("\n\n");
  const stableWordCount = countWords(
    [...blocks.slice(0, -1), signature].filter(Boolean).join(" "),
  );
  const finalSection = truncateToWordLimit(
    blocks.at(-1) ?? "",
    Math.max(1, limit - stableWordCount),
  );
  const body =
    countWords(withSignature) <= limit
      ? withSignature
      : [...blocks.slice(0, -1), finalSection, signature]
          .filter(Boolean)
          .join("\n\n");
  return {
    subject: normalizeSection(input.draft.subject_line),
    body,
    wordCount: countWords(body),
    identityIncluded: Boolean(input.identity.fullName),
  };
}
