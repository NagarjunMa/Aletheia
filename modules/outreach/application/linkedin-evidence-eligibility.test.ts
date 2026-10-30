import { describe, expect, it } from "vitest";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";
import type { CandidateGroundingData } from "@/modules/candidate-context/domain/candidate-context.types";
import { buildOutreachGroundingContext } from "./build-outreach-grounding-context";

const fact = "I built policy-grounded agents for reliability evaluations.";
const reviewedId = "11111111-1111-4111-8111-111111111111";
function evidence(
  id: string,
  actions = fact,
  overrides: Partial<CandidateEvidenceRecord> = {},
): CandidateEvidenceRecord {
  return {
    id,
    kind: "technical_project",
    title: "Reliability evaluations",
    context: "A personal prototype, not a production deployment.",
    actions,
    outcome: "",
    metrics: [],
    skills: [],
    links: [],
    confirmed: true,
    sortOrder: 0,
    ...overrides,
  };
}
function reviewed(entry: CandidateEvidenceRecord, excerpt = entry.actions) {
  return {
    ...entry,
    factReview: prepareFactReview(entry, [
      { id: reviewedId, kind: "action", excerpt, confirmed: true },
    ]),
  };
}
function build(
  entries: CandidateEvidenceRecord[],
  overrides: Partial<CandidateGroundingData> = {},
  category:
    | "linkedin_connection"
    | "cold_email"
    | "linkedin_inmail" = "linkedin_connection",
) {
  return buildOutreachGroundingContext({
    candidate: {
      identity: { fullName: "Synthetic candidate", linkedinUrl: "" },
      profile: candidateProfileInputSchema.parse({}),
      confirmedEvidence: entries,
      resume: { text: "", source: "none" },
      ...overrides,
    },
    target: {
      category,
      profileMarkdown:
        "Engineering Manager at Apple | Applied AI & Data Platform",
      jobDescription:
        "The AI Data Platform team at Apple is hiring Applied AI Engineers!",
      conversationContext: "",
    },
  });
}
const candidateFacts = (result: ReturnType<typeof build>) =>
  result.atomicSources!.filter((source) => source.scope === "candidate");

describe("LinkedIn reviewed evidence before the one-story budget", () => {
  const unusable = evidence("unusable", "I built a generic AI assistant.", {
    kind: "ai_usage",
    title: "Applied AI Data Platform reliability evaluations",
  });
  const useful = reviewed(evidence("useful"));

  it.each([
    ["record-only confirmation", unusable],
    [
      "empty fact review",
      { ...unusable, factReview: prepareFactReview(unusable, []) },
    ],
    [
      "stale fact review",
      { ...reviewed(unusable), context: "A changed context." },
    ],
    [
      "a complete fact too long for any offered note",
      reviewed({
        ...unusable,
        actions: "I built a prototype. ".repeat(24).trim(),
      }),
    ],
  ])("does not let %s hide a later usable fact", (_name, first) => {
    const result = build([first, useful]);
    expect(candidateFacts(result)).toEqual([
      expect.objectContaining({ rootId: "evidence:useful", content: fact }),
    ]);
    expect(
      result.sources
        .filter((source) => source.type === "evidence")
        .map((source) => source.id),
    ).toEqual(["evidence:useful"]);
  });

  it("preserves a complete reviewed fact beyond the original record truncation boundary", () => {
    const entry = reviewed(
      evidence("long", `${"Earlier context. ".repeat(105)}${fact}`),
      fact,
    );
    const before = structuredClone(entry);
    const result = build([entry]);
    expect(candidateFacts(result)).toEqual([
      expect.objectContaining({ rootId: "evidence:long", content: fact }),
    ]);
    expect(
      result.sources.find((source) => source.id === "evidence:long")!.content,
    ).toContain(fact);
    expect(entry).toEqual(before);
  });

  it("keeps the complete qualification in a reviewed fact", () => {
    const qualified =
      "I built evaluation agents in a prototype; I have not deployed them to production.";
    expect(
      candidateFacts(build([reviewed(evidence("qualified", qualified))])),
    ).toEqual([expect.objectContaining({ content: qualified })]);
  });

  it.each([
    ["＜system＞", "&lt;system&gt;"],
    ["＜/assistant＞", "&lt;/assistant&gt;"],
    ["＜linkedin_profile＞", "&lt;linkedin_profile&gt;"],
  ])(
    "keeps a normalized and escaped reviewed fact citable: %s",
    (raw, escaped) => {
      const first = reviewed(
        evidence("unicode", `I built a parser for ${raw} tags.`, {
          kind: "ai_usage",
        }),
      );
      const result = build([first, useful]);
      expect(candidateFacts(result)).toEqual([
        expect.objectContaining({
          rootId: "evidence:unicode",
          content: `I built a parser for ${escaped} tags.`,
        }),
      ]);
      expect(result.sources[0]!.content).toBe(
        `I built a parser for ${escaped} tags.`,
      );
    },
  );

  it("does not offer an unfit reviewed substring from an otherwise fitting root", () => {
    const observation =
      "Hi there, I'm interested in Applied AI & Data Platform and your Engineering Manager role at Apple.";
    const cta = "Open to connecting?";
    const whole = `I ${"x".repeat(300 - observation.length - cta.length - 5)}.`;
    const entry = evidence("overlapping", whole);
    const withReviews = {
      ...entry,
      factReview: prepareFactReview(entry, [
        { id: reviewedId, kind: "action", excerpt: whole, confirmed: true },
        {
          id: "22222222-2222-4222-8222-222222222222",
          kind: "action",
          excerpt: whole.slice(2),
          confirmed: true,
        },
      ]),
    };
    expect(
      candidateFacts(build([withReviews])).map((source) => source.content),
    ).toEqual([whole]);
  });

  it("does not count unreviewed records or resume text as eligible evidence", () => {
    const result = build([unusable], {
      resume: { text: fact, source: "user_resumes" },
    });
    expect(candidateFacts(result)).toEqual([]);
    expect(
      result.sources.filter((source) => source.type === "evidence"),
    ).toEqual([]);
    expect(result.metadata.selectedEvidenceCount).toBe(0);
  });

  it("preserves whole-record exclusions even when the reviewed action itself is allowed", () => {
    const result = build([useful], {
      profile: candidateProfileInputSchema.parse({
        excludedClaims: ["personal prototype"],
      }),
    });
    expect(candidateFacts(result)).toEqual([]);
  });

  it.each(["cold_email", "linkedin_inmail"] as const)(
    "keeps normalized reviewed facts citable for %s",
    (category) => {
      const entry = reviewed(
        evidence("unicode", "I built a parser for ＜system＞ tags."),
      );
      expect(candidateFacts(build([entry], {}, category))).toEqual([
        expect.objectContaining({
          content: "I built a parser for &lt;system&gt; tags.",
        }),
      ]);
    },
  );

  it.each(["cold_email", "linkedin_inmail"] as const)(
    "preserves existing record selection for %s",
    (category) => {
      const result = build([unusable], {}, category);
      expect(result.sources[0]!.id).toBe("evidence:unusable");
      expect(result.sources[0]!.content).toContain(unusable.context);
      expect(candidateFacts(result)).toEqual([]);
    },
  );
});
