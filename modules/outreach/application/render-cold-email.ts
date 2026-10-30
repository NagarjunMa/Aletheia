import { countWords } from "@/app/api/extension/generate/utils";
import { prepareGroundedText } from "@/modules/grounding/application/finalize-grounded-output";
import type { CandidateIdentity } from "@/modules/candidate-context/domain/candidate-context.types";
import { type EmailMode } from "@/lib/ai/email-formatter";
import type { ColdEmailDraft } from "../domain/outreach-draft.types";

function normalizeSection(value: string): string {
  return prepareGroundedText(value);
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
  const body = [...blocks, signature].filter(Boolean).join("\n\n");
  return {
    subject: normalizeSection(input.draft.subject_line),
    body,
    wordCount: countWords(body),
    identityIncluded: Boolean(input.identity.fullName),
  };
}
