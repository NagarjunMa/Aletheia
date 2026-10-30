import { sanitizeForLinkedIn } from "@/lib/ai/sanitizer";
import { sanitize } from "@/lib/ai/prompts/linkedin-connection";
import { describe, expect, it } from "vitest";
import { buildOutreachGroundingContext } from "./build-outreach-grounding-context";
import {
  resolveLinkedinSelection,
  buildLinkedinSelectionTool,
} from "../domain/linkedin-grounded-selection";
import { renderLinkedinConnection } from "./render-linkedin-connection";
import { allowedClaimTexts } from "@/modules/grounding/domain/atomic-claim";
import { buildAtomicTargetSources } from "@/modules/grounding/application/build-atomic-sources";
import { linkedinTargetFits } from "../domain/linkedin-grounded-selection";
import { validateAtomicOutput } from "@/modules/grounding/application/validate-atomic-claims";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";

const profile = "Engineering Manager at Apple | Applied AI & Data Platform";
const hiring =
  "The AI Data Platform team at Apple is hiring Applied AI Engineers!";
const experience =
  "I built policy-grounded agents for reliability evaluations.";
const record = {
  id: "project",
  kind: "technical_project" as const,
  title: "Agent evaluations",
  context: "Personal project",
  actions: experience,
  outcome: "",
  metrics: [],
  skills: [],
  links: [],
  confirmed: true,
  sortOrder: 0,
};
function context(jd: string, reviewed = true) {
  return buildOutreachGroundingContext({
    candidate: {
      identity: { fullName: "Synthetic", linkedinUrl: "" },
      profile: candidateProfileInputSchema.parse({}),
      confirmedEvidence: [
        {
          ...record,
          ...(reviewed
            ? {
                factReview: prepareFactReview(record, [
                  {
                    id: "11111111-1111-4111-8111-111111111111",
                    kind: "action",
                    excerpt: experience,
                    confirmed: true,
                  },
                ]),
              }
            : {}),
        },
      ],
      resume: { text: "I am a production AI expert.", source: "profiles" },
    },
    target: {
      category: "linkedin_connection",
      profileMarkdown: profile,
      jobDescription: jd,
      conversationContext: "",
    },
  });
}
function compose(jd: string, reviewed = true) {
  const grounding = context(jd, reviewed);
  const sources = grounding.atomicSources!;
  const targetIds =
    buildLinkedinSelectionTool(sources).input_schema.properties.target_source_id
      .enum;
  const draft = resolveLinkedinSelection(
    {
      target_source_id: targetIds[0],
      candidate_source_id:
        sources.find((s) => s.scope === "candidate")?.id ?? null,
      cta: "Open to connecting?",
    },
    sources,
    grounding.sources,
  );
  const rendered = renderLinkedinConnection({
    draft,
    sources: grounding.sources,
  });
  validateAtomicOutput({
    claims: draft.claims,
    sources,
    excludedClaims: [],
    fields: [{ text: rendered.body, scope: "either" }],
  });
  return { rendered, draft, sources };
}
describe("LinkedIn introductory product contract", () => {
  it("combines job interest and reviewed experience in a complete introduction", () => {
    const { rendered } = compose(hiring);
    expect(rendered.body).toBe(
      `Hi there, I'm interested in the openings for Applied AI Engineers with the AI Data Platform team at Apple. ${experience} Open to connecting?`,
    );
    expect(rendered.characterCount).toBeLessThanOrEqual(300);
    expect(rendered.body).not.toContain("The supplied context says");
  });
  it.each(["", " \n\t "])(
    "introduces the sender around the profile with blank JD %j",
    (jd) => {
      const { rendered } = compose(jd);
      expect(rendered.body).toMatch(/^Hi there, /);
      expect(rendered.body).toContain("Engineering Manager role at Apple");
      expect(rendered.body).toContain("Applied AI & Data Platform");
      expect(rendered.body).toContain(experience);
      expect(rendered.body).not.toContain("The supplied context says");
    },
  );
  it("uses a natural complete headline introduction rather than a profile citation", () => {
    const { rendered } = compose("");
    expect(rendered.body).toBe(
      `Hi there, I'm interested in Applied AI & Data Platform and your Engineering Manager role at Apple. ${experience} Open to connecting?`,
    );
  });
  it("does not invent qualifications from a resume or an unreviewed record", () => {
    const { rendered, draft } = compose(hiring, false);
    expect(draft.candidate_relevance).toBeNull();
    expect(rendered.body).toContain("I'm interested");
    expect(rendered.body).not.toMatch(/I built|expert|qualified|years/);
  });
  it.each([
    "The AI Data Platform team at Apple is not hiring Applied AI Engineers!",
    `${hiring} Only candidates with three years of experience qualify.`,
    "The AI Data Platform team at Apple is hiring Applied AI Engineers only for a training simulation.",
  ])("preserves the entire qualified passage: %s", (jd) => {
    const { draft } = compose(jd, false);
    expect(draft.target_observation).toContain(jd);
    expect(draft.target_observation).not.toContain("openings with");
  });
});

describe("introductory wording safety boundary", () => {
  it("reserves room for supplied job context even with sixteen short profile passages", () => {
    const result = buildAtomicTargetSources(
      { profile: Array(16).fill(profile).join("\n\n"), jobDescription: hiring },
      [],
      linkedinTargetFits,
      "linkedin_connection",
    );
    expect(result.sources).toHaveLength(16);
    expect(result.sources[0]!.id).toBe("target.jobDescription.0");
    expect(result.sources[0]!.content).toBe(hiring);
  });
  it.each([
    "Engineering Manager at Apple | Retired since 2020",
    "Engineering Manager at Apple | Past role",
    "Engineering Manager at Apple | 2017-2020",
    "Engineering Manager at Apple | Previously focused on Data Platform",
    "Engineering Manager at Apple | Unconfirmed appointment",
    "Engineering Manager at Apple | Fictional example",
    "Former Engineering Manager at Apple | Applied AI & Data Platform",
    "Engineering Manager at Apple | Applied AI & Data Platform | Former role",
    "Engineering Manager at Apple | Applied AI & Data Platform. Not a current role.",
    "Engineering Manager at Apple until 2020 | Applied AI & Data Platform",
    "Engineering Manager at Apple | Not Applied AI",
    "Engineering Manager at Apple | Applied AI & Data Platform only in simulation",
  ])(
    "retains qualifications instead of applying the headline rewrite: %s",
    async (text) => {
      const source = buildAtomicTargetSources(
        { profile: text },
        [],
        linkedinTargetFits,
        "linkedin_connection",
      ).sources[0]!;
      expect(allowedClaimTexts(source)).toEqual([
        `I'd like to connect about your profile: "${text}"`,
      ]);
      const draft = resolveLinkedinSelection(
        {
          target_source_id: source.id,
          candidate_source_id: null,
          cta: "Open to connecting?",
        },
        [source],
        [],
      );
      const sanitized = await sanitizeForLinkedIn(
        sanitize(draft.target_observation),
      );
      expect(sanitized.success).toBe(true);
      const rendered = renderLinkedinConnection({
        draft: { ...draft, target_observation: sanitized.sanitizedContent },
        sources: [],
      });
      expect(rendered.body).toContain(`"${text}"`);
      expect(() =>
        validateAtomicOutput({
          claims: draft.claims,
          sources: [source],
          excludedClaims: [],
          fields: [{ text: rendered.body, scope: "target" }],
        }),
      ).not.toThrow();
    },
  );
  it("keeps the original approved forms for other channels", () => {
    const source = buildAtomicTargetSources({ jobDescription: hiring })
      .sources[0]!;
    expect(allowedClaimTexts(source)).toEqual([
      `The supplied context says: "${hiring}"`,
    ]);
  });
  it("cannot turn a target job into candidate qualifications or append unsupported assertions", () => {
    const { draft, sources, rendered } = compose(hiring);
    const run = (text: string) =>
      validateAtomicOutput({
        claims: draft.claims,
        sources,
        excludedClaims: [],
        fields: [{ text, scope: "either" }],
      });
    expect(() =>
      run(rendered.body.replace("I'm interested", "I am qualified")),
    ).toThrow();
    expect(() =>
      run(rendered.body + " I have three years of experience."),
    ).toThrow();
    expect(() =>
      validateAtomicOutput({
        claims: draft.claims,
        sources,
        excludedClaims: ["reliability"],
        fields: [{ text: rendered.body, scope: "either" }],
      }),
    ).toThrow();
    expect(() =>
      validateAtomicOutput({
        claims: draft.claims,
        sources,
        excludedClaims: [],
        fields: [{ text: rendered.body, scope: "candidate" }],
      }),
    ).toThrow();
  });
  it("rejects cross-source excerpts and altered provenance after composition", () => {
    const { draft, sources, rendered } = compose(hiring);
    expect(() =>
      validateAtomicOutput({
        claims: draft.claims!.map((c) => ({
          ...c,
          supporting_excerpt: profile,
        })),
        sources,
        excludedClaims: [],
        fields: [{ text: rendered.body, scope: "either" }],
      }),
    ).toThrow();
  });
});
