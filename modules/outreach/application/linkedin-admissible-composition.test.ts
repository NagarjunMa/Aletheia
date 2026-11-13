import { describe, expect, it } from "vitest";
import {
  buildLinkedinCompositions,
  buildLinkedinSelectionTool,
  resolveLinkedinSelection,
} from "../domain/linkedin-grounded-selection";
import { renderLinkedinConnection } from "./render-linkedin-connection";
import type { AtomicSource } from "@/modules/grounding/domain/atomic-claim";
import { validateAtomicOutput } from "@/modules/grounding/application/validate-atomic-claims";
import { buildOutreachGroundingContext } from "./build-outreach-grounding-context";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";

const target: AtomicSource = {
  id: "target.jobDescription.0",
  scope: "target",
  kind: "target_observation",
  content: "The Policy team at Example is hiring Software Engineers!",
  rewrite: "linkedin_job_interest",
};
const candidate: AtomicSource = {
  id: "evidence:one.fact.action",
  rootId: "evidence:one",
  scope: "candidate",
  kind: "action",
  content: "I built policy evaluation tools.",
};
const sources = [target, candidate];
const roots = [
  {
    id: "evidence:one",
    type: "evidence" as const,
    priority: 1 as const,
    label: "Policy",
    content: candidate.content,
  },
];

describe("ALE-46 admissible LinkedIn composition", () => {
  it("offers a later direct observability fact before filling slots with related monitoring", () => {
    const observability = {
      ...target,
      content: "The AI Observability team at Example is hiring Engineers!",
    };
    const related = ["rollouts", "releases", "deployments", "upgrades"].map(
      (activity, index) => ({
        ...candidate,
        id: `evidence:one.fact.${index}`,
        content: `I monitored production applications during ${activity}.`,
      }),
    );
    const exact = {
      ...candidate,
      content: "I built AI observability tools.",
    };
    const options = buildLinkedinCompositions(
      [observability, ...related, exact],
      "networking",
      false,
      undefined,
      200,
    );
    expect(options.length).toBeGreaterThan(0);
    expect(options.every(({ body }) => body.includes(exact.content))).toBe(
      true,
    );
  });
  it.each(
    [
      "I'm building policy evaluation tools.",
      "I’m building policy evaluation tools.",
      "I've built policy evaluation tools.",
      "I’ve built policy evaluation tools.",
      "I'd built policy evaluation tools in a prototype; I did not deploy it.",
      "I’d built policy evaluation tools in a prototype; I did not deploy it.",
    ].flatMap((fact) => [true, false].map((withJd) => ({ fact, withJd }))),
  )(
    "retains the exact reviewed contraction in every option (JD=$withJd): $fact",
    ({ fact, withJd }) => {
      const record = {
        id: "one",
        kind: "technical_project" as const,
        title: "Policy evaluation",
        context: fact,
        actions: "I wrote some code.",
        outcome: "",
        metrics: [],
        skills: [],
        links: [],
        confirmed: true,
        sortOrder: 0,
      };
      const reviewed = {
        ...record,
        factReview: prepareFactReview(record, [
          {
            id: "11111111-1111-4111-8111-111111111111",
            kind: "action",
            excerpt: fact,
            confirmed: true,
          },
        ]),
      };
      const before = structuredClone(reviewed);
      const context = buildOutreachGroundingContext({
        candidate: {
          identity: { fullName: "Synthetic", linkedinUrl: "" },
          profile: candidateProfileInputSchema.parse({}),
          resume: { text: "", source: "none" },
          confirmedEvidence: [reviewed],
        },
        target: {
          category: "linkedin_connection",
          profileMarkdown: "Engineering Manager at Example | AI Evaluation",
          jobDescription: withJd ? target.content : " \n\t ",
          conversationContext: "",
        },
      });
      const current = context.atomicSources!;
      const options =
        buildLinkedinSelectionTool(current).input_schema.properties.option_id
          .enum;
      expect(options.length).toBeGreaterThan(0);
      for (const option_id of options) {
        const draft = resolveLinkedinSelection(
          { option_id },
          current,
          context.sources,
        );
        expect(draft.candidate_relevance?.text).toBe(`Hi there, ${fact}`);
        const { body } = renderLinkedinConnection({
          draft,
          sources: context.sources,
        });
        expect(body.startsWith(`Hi there, ${fact} `)).toBe(true);
        expect(body.length).toBeLessThanOrEqual(300);
        expect(() =>
          validateAtomicOutput({
            claims: draft.claims,
            sources: current,
            excludedClaims: [],
            fields: [
              { text: body, scope: "either" },
              { text: draft.candidate_relevance!.text, scope: "candidate" },
              { text: draft.target_observation!, scope: "target" },
              { text: draft.cta, scope: "either" },
            ],
          }),
        ).not.toThrow();
      }
      expect(reviewed).toEqual(before);
    },
  );
  it.each(["unreviewed", "stale", "withdrawn"])(
    "does not promote %s context text into a candidate assertion",
    (state) => {
      const fact = "I built policy evaluation tools.";
      const record = {
        id: "one",
        kind: "technical_project" as const,
        title: "A personal project",
        context: fact,
        actions: "I wrote some code.",
        outcome: "",
        metrics: [],
        skills: [],
        links: [],
        confirmed: true,
        sortOrder: 0,
      };
      const factReview = prepareFactReview(record, [
        {
          id: "11111111-1111-4111-8111-111111111111",
          kind: "action",
          excerpt: fact,
          confirmed: true,
        },
      ]);
      const entry = {
        ...record,
        ...(state === "unreviewed" ? {} : { factReview }),
        ...(state === "stale" ? { actions: "I changed the source." } : {}),
        confirmed: state !== "withdrawn",
      };
      const context = buildOutreachGroundingContext({
        candidate: {
          identity: { fullName: "Synthetic", linkedinUrl: "" },
          profile: candidateProfileInputSchema.parse({}),
          resume: { text: "", source: "none" },
          confirmedEvidence: [entry],
        },
        target: {
          category: "linkedin_connection",
          profileMarkdown: "Engineering Manager at Example | AI Evaluation",
          jobDescription: target.content,
          conversationContext: "",
        },
      });
      expect(
        context.atomicSources?.filter((source) => source.scope === "candidate"),
      ).toEqual([]);
    },
  );
  it.each(["context", "actions", "outcome"] as const)(
    "considers a current reviewed assertion stored in %s without changing its review binding",
    (field) => {
      const fact = "I built policy evaluation tools.";
      const record = {
        id: "one",
        kind: "technical_project" as const,
        title: "A personal project",
        context: "",
        actions: "I wrote some code.",
        outcome: "",
        metrics: [],
        skills: [],
        links: [],
        confirmed: true,
        sortOrder: 0,
        [field]: fact,
      };
      const reviewed = {
        ...record,
        factReview: prepareFactReview(record, [
          {
            id: "11111111-1111-4111-8111-111111111111",
            kind: "action",
            excerpt: fact,
            confirmed: true,
          },
        ]),
      };
      const before = structuredClone(reviewed);
      const context = buildOutreachGroundingContext({
        candidate: {
          identity: { fullName: "Synthetic", linkedinUrl: "" },
          profile: candidateProfileInputSchema.parse({}),
          resume: { text: "", source: "none" },
          confirmedEvidence: [reviewed],
        },
        target: {
          category: "linkedin_connection",
          profileMarkdown: "Engineering Manager at Example | AI Evaluation",
          jobDescription: target.content,
          conversationContext: "",
        },
      });
      const current = context.atomicSources!;
      for (const option_id of buildLinkedinSelectionTool(current).input_schema
        .properties.option_id.enum) {
        const draft = resolveLinkedinSelection(
          { option_id },
          current,
          context.sources,
        );
        expect(draft.candidate_relevance?.text).toContain(fact);
      }
      expect(reviewed).toEqual(before);
    },
  );
  it.each([
    ["Documentation", "I wrote documentation for developer onboarding."],
    [
      "Security",
      "I tested security reviews in a prototype; I have not deployed it.",
    ],
    ["Customer", "I led customer onboarding for merchants."],
    ["Reliability", "I built reliability evaluation tools."],
    ["Policy", 'I built policy tooling using --name="two  spaces".'],
  ])(
    "keeps complete %s experience in every offered introduction",
    (topic, fact) => {
      const targetSource = {
        ...target,
        content: `The ${topic} team at Example is hiring Engineers!`,
      };
      const candidateSource = { ...candidate, content: fact };
      const current = [targetSource, candidateSource];
      const before = structuredClone(current);
      for (const option_id of buildLinkedinSelectionTool(current).input_schema
        .properties.option_id.enum) {
        const draft = resolveLinkedinSelection({ option_id }, current, [
          { ...roots[0]!, content: fact },
        ]);
        const { body } = renderLinkedinConnection({
          draft,
          sources: [{ ...roots[0]!, content: fact }],
        });
        expect(body.startsWith(`Hi there, ${fact} `)).toBe(true);
        expect(body).toContain(`${topic} team at Example`);
        expect(body).toMatch(/\? Thank you\.$/);
        expect(body.length).toBeLessThanOrEqual(300);
        expect(() =>
          validateAtomicOutput({
            claims: draft.claims,
            sources: current,
            excludedClaims: [],
            fields: [{ text: body, scope: "either" }],
          }),
        ).not.toThrow();
      }
      expect(current).toEqual(before);
    },
  );
  it("does not select an unrelated reviewed fact from the same root", () => {
    const other = {
      ...candidate,
      id: "evidence:one.fact.unrelated",
      content: "I built a gardening prototype.",
    };
    const current = [target, other, candidate];
    for (const option_id of buildLinkedinSelectionTool(current).input_schema
      .properties.option_id.enum) {
      const draft = resolveLinkedinSelection({ option_id }, current, roots);
      expect(draft.candidate_relevance?.text).toContain(candidate.content);
      expect(draft.candidate_relevance?.text).not.toContain(other.content);
    }
  });
  it("preserves mentorship intent and never invents a hiring relationship", () => {
    const profile = {
      ...target,
      rewrite: "linkedin_profile_interest" as const,
      content: "Engineering Manager at Example | AI Evaluation",
    };
    const fact = { ...candidate, content: "I built AI evaluation tools." };
    const current = [profile, fact];
    for (const option_id of buildLinkedinSelectionTool(
      current,
      undefined,
      "mentorship",
    ).input_schema.properties.option_id.enum) {
      const draft = resolveLinkedinSelection(
        { option_id },
        current,
        roots,
        "mentorship",
      );
      expect(draft.cta).not.toContain("role");
      expect(draft.cta.endsWith("Thank you.")).toBe(true);
    }
  });
  it.each(["former", "not", "only in a simulation"])(
    "does not drop a target qualification: %s",
    (qualification) => {
      expect(() =>
        buildLinkedinSelectionTool([
          { ...target, content: `${target.content} ${qualification}` },
        ]),
      ).toThrow();
    },
  );
  it("keeps a relevant later JD unit before the bounded target projection", () => {
    const record = {
      id: "one",
      kind: "technical_project" as const,
      title: "Policy evaluation",
      context: "Personal project",
      actions: candidate.content,
      outcome: "",
      metrics: [],
      skills: [],
      links: [],
      confirmed: true,
      sortOrder: 0,
    };
    const context = buildOutreachGroundingContext({
      candidate: {
        identity: { fullName: "Synthetic", linkedinUrl: "" },
        profile: candidateProfileInputSchema.parse({}),
        resume: { text: "", source: "none" },
        confirmedEvidence: [
          {
            ...record,
            factReview: prepareFactReview(record, [
              {
                id: "11111111-1111-4111-8111-111111111111",
                kind: "action",
                excerpt: candidate.content,
                confirmed: true,
              },
            ]),
          },
        ],
      },
      target: {
        category: "linkedin_connection",
        profileMarkdown: "Engineering Manager at Example | Data Platform",
        conversationContext: "",
        jobDescription: [
          ...Array.from(
            { length: 20 },
            (_, i) => `The Design${i} team at Example is hiring Designers!`,
          ),
          target.content,
        ].join("\n\n"),
      },
    });
    expect(
      context.atomicSources?.find((source) => source.scope === "target")
        ?.content,
    ).toBe(target.content);
    expect(
      context.atomicSources?.some((source) => source.scope === "candidate"),
    ).toBe(true);
  });
  it("rejects an independent null-candidate selection when a relevant complete pair fits", () => {
    expect(() =>
      resolveLinkedinSelection(
        {
          target_source_id: target.id,
          candidate_source_id: null,
          cta: "Open to connecting?",
        },
        sources,
        roots,
      ),
    ).toThrow();
  });
  it("rejects independently valid IDs instead of letting an overlength pair reach rendering", () => {
    expect(() =>
      resolveLinkedinSelection(
        {
          target_source_id: target.id,
          candidate_source_id: candidate.id,
          cta: "Open to connecting?",
        },
        [
          target,
          {
            ...candidate,
            content: `I built policy tools ${"with complete qualifications ".repeat(7)}.`,
          },
        ],
        roots,
      ),
    ).toThrow();
  });
  it("does not resolve a rejected Basic option as the next available CTA", () => {
    const before = buildLinkedinCompositions(
      sources,
      "networking",
      false,
      undefined,
      200,
    );
    const after = buildLinkedinCompositions(
      sources,
      "networking",
      false,
      (draft) =>
        draft.cta.startsWith("Open to connecting")
          ? undefined
          : renderLinkedinConnection({ draft, sources: roots }).body,
      200,
    );
    expect(before[0]!.draft.cta).toBe("Open to connecting? Thank you.");
    expect(after[0]!.draft.cta).toBe("Open to a brief chat? Thank you.");
    expect(() =>
      resolveLinkedinSelection(
        { option_id: before[0]!.id },
        sources,
        roots,
        "networking",
        false,
        after,
      ),
    ).toThrow();
    expect(after[0]!.id).toBe(before[1]!.id);
  });
  it("offers only complete option IDs, never independent facts or a nullable candidate", () => {
    const tool = buildLinkedinSelectionTool(sources);
    expect(Object.keys(tool.input_schema.properties)).toEqual(["option_id"]);
  });
  it("composes a courteous sender-first introduction and validates its exact displayed text", () => {
    const tool = buildLinkedinSelectionTool(sources);
    const properties = tool.input_schema.properties as Record<
      string,
      { enum?: readonly string[] }
    >;
    const id = properties.option_id?.enum?.[0];
    expect(id).toBeTypeOf("string");
    const draft = resolveLinkedinSelection({ option_id: id }, sources, roots);
    const { body } = renderLinkedinConnection({ draft, sources: roots });
    expect(body).toBe(
      "Hi there, I built policy evaluation tools. I'm interested in the openings for Software Engineers with the Policy team at Example. Open to connecting? Thank you.",
    );
    expect(body.length).toBeLessThanOrEqual(300);
    expect(() =>
      validateAtomicOutput({
        claims: draft.claims,
        sources,
        excludedClaims: [],
        fields: [{ text: body, scope: "either" }],
      }),
    ).not.toThrow();
  });
});
