import { describe, expect, it } from "vitest";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import { resolveOutputConstraint } from "@/lib/ai/output-constraints";
import { buildOutreachGroundingContext } from "@/modules/outreach/application/build-outreach-grounding-context";
import { buildYcGroundingContext } from "@/modules/application-answer/application/build-yc-grounding-context";
import { resolveLinkedinSelection } from "@/modules/outreach/domain/linkedin-grounded-selection";
import { renderLinkedinConnection } from "@/modules/outreach/application/render-linkedin-connection";
import { renderColdEmail } from "@/modules/outreach/application/render-cold-email";
import { sanitizeYcApplicationOutput } from "@/modules/application-answer/application/sanitize-yc-application-output";
import { validateYcApplicationOutput } from "@/modules/application-answer/application/validate-yc-application-output";
import { finalizeGroundedOutput } from "./finalize-grounded-output";
import { validateAtomicOutput } from "./validate-atomic-claims";

const factId = "11111111-1111-4111-8111-111111111111";
function candidate(fact: string) {
  const record = {
    id: "cli",
    kind: "technical_project" as const,
    title: "CLI platform",
    context: "",
    actions: fact,
    outcome: "",
    metrics: [],
    skills: [],
    links: [],
    confirmed: true,
    sortOrder: 0,
  };
  return {
    identity: { fullName: "Synthetic", linkedinUrl: "" },
    profile: candidateProfileInputSchema.parse({ currentRole: "Engineer" }),
    resume: { text: "", source: "none" as const },
    confirmedEvidence: [
      {
        ...record,
        factReview: prepareFactReview(record, [
          { id: factId, kind: "action", excerpt: fact, confirmed: true },
        ]),
      },
    ],
  };
}
const target = {
  profileMarkdown: "I build CLI platform tools.",
  jobDescription: "CLI platform",
  conversationContext: "",
};
function claim(source: { id: string; content: string }) {
  return {
    text: source.content,
    source_id: source.id,
    kind: "action" as const,
    supporting_excerpt: source.content,
  };
}
const cases = [
  'I built a CLI using --name="two  spaces".',
  "I built a CLI using --name='two  spaces'.",
  'I built a CLI using --name="two\tspaces".',
  'I built a CLI using --name="two\nspaces".',
  'I built a CLI using --name="two  \\"quoted\\"  spaces".',
  "I built  a CLI using --dry-run.",
];
describe("ALE47-R3-1 real reviewed fact to final output", () => {
  it.each(cases)("preserves a selected complete LinkedIn fact: %j", (fact) => {
    const context = buildOutreachGroundingContext({
      candidate: candidate(fact),
      target: { ...target, category: "linkedin_connection" },
    });
    const source = context.atomicSources!.find((s) => s.scope === "candidate")!;
    const targetSource = context.atomicSources!.find(
      (s) => s.scope === "target",
    )!;
    expect(source).toBeDefined();
    const draft = resolveLinkedinSelection(
      {
        target_source_id: targetSource.id,
        candidate_source_id: source.id,
        cta: "Open to connecting?",
      },
      context.atomicSources!,
      context.sources,
    );
    const rendered = renderLinkedinConnection({
      draft,
      sources: context.sources,
    });
    expect(() =>
      finalizeGroundedOutput({
        body: rendered.body,
        platform: "linkedin",
        bodyConstraint: resolveOutputConstraint({
          category: "linkedin_connection",
        }),
        requiredEnding: draft.cta,
        claims: draft.claims,
        sources: context.atomicSources!,
        excludedClaims: [],
        scopedFields: [
          { text: draft.target_observation, scope: "target" },
          { text: draft.candidate_relevance!.text, scope: "candidate" },
          { text: draft.cta, scope: "either" },
        ],
      }),
    ).not.toThrow();
    expect(rendered.body).toContain(fact);
    expect(source.content).toBe(fact);
  });
  it.each(["cold_email", "linkedin_inmail"] as const)(
    "retains complete reviewed whitespace in actual %s preparation",
    (category) => {
      const fact = cases[0]!;
      const person = candidate(fact);
      const context = buildOutreachGroundingContext({
        candidate: person,
        target: { ...target, category },
      });
      const source = context.atomicSources!.find(
        (s) => s.scope === "candidate",
      )!;
      expect(source).toBeDefined();
      expect(source.content).toBe(fact);
      const repeated = Array(category === "cold_email" ? 6 : 8)
        .fill(fact)
        .join(" ");
      const cta = "Open to connecting?";
      const rendered =
        category === "cold_email"
          ? renderColdEmail({
              identity: person.identity,
              mode: "initial_outreach",
              draft: {
                subject_line: "A brief introduction",
                greeting: "there",
                target_opening: repeated,
                candidate_positioning: repeated,
                proof_points: [{ text: fact, source_ids: [source.rootId!] }],
                value_statement: repeated,
                cta,
              },
            })
          : {
              body: `${repeated}\n\n${repeated} ${cta}`,
              subject: "A brief introduction",
            };
      expect(() =>
        finalizeGroundedOutput({
          body: rendered.body,
          subject: rendered.subject,
          platform: category === "cold_email" ? "email" : "linkedin",
          bodyConstraint: resolveOutputConstraint({
            category,
            emailMode: "initial_outreach",
          }),
          requiredEnding: cta,
          claims: [claim(source)],
          sources: context.atomicSources!,
          excludedClaims: [],
          ...(category === "cold_email"
            ? { trustedIdentity: person.identity }
            : {}),
        }),
      ).not.toThrow();
      expect(rendered.body).toContain(fact);
    },
  );
  it("keeps reviewed whitespace through real YC preparation, sanitation and final validation", async () => {
    const fact = cases[0]!;
    const context = buildYcGroundingContext({
      candidate: candidate(fact),
      question: "Describe your CLI platform work?",
      jobDescription: "CLI platform",
    });
    expect(context.readiness.ready).toBe(true);
    const source = context.atomicSources!.find((s) => s.scope === "candidate")!;
    expect(source.content).toBe(fact);
    const body = Array(8).fill(fact).join("\n\n");
    const output = await sanitizeYcApplicationOutput({
      body,
      claims: [{ ...claim(source), sourceIds: [source.id] }],
    });
    expect(
      validateYcApplicationOutput({ context, output: output.output }).body,
    ).toBe(body);
  });
  it.each([
    {
      profileMarkdown:
        "Engineering Manager\nat Apple | Applied AI & Data Platform",
      jobDescription: "",
      expected:
        "I'm interested in Applied AI & Data Platform and your Engineering Manager role at Apple.",
    },
    {
      profileMarkdown:
        "Engineering Manager at Apple | Applied AI & Data Platform",
      jobDescription:
        "The AI Data Platform team at Apple\nis hiring Applied AI Engineers!",
      expected:
        "I'm interested in the openings for Applied AI Engineers with the AI Data Platform team at Apple.",
    },
  ])(
    "retains approved introductory grammar for wrapped structured context %#",
    ({ expected, ...wrapped }) => {
      const context = buildOutreachGroundingContext({
        candidate: candidate(cases[0]!),
        target: {
          ...wrapped,
          conversationContext: "",
          category: "linkedin_connection",
        },
      });
      const targetSource = context.atomicSources!.find(
        (s) => s.scope === "target",
      )!;
      const draft = resolveLinkedinSelection(
        {
          target_source_id: targetSource.id,
          candidate_source_id: null,
          cta: "Open to connecting?",
        },
        context.atomicSources!,
        context.sources,
      );
      const rendered = renderLinkedinConnection({
        draft,
        sources: context.sources,
      });
      expect(rendered.body).toContain(expected);
      expect(() =>
        finalizeGroundedOutput({
          body: rendered.body,
          platform: "linkedin",
          bodyConstraint: resolveOutputConstraint({
            category: "linkedin_connection",
          }),
          requiredEnding: draft.cta,
          sources: context.atomicSources!,
          claims: draft.claims,
          excludedClaims: [],
        }),
      ).not.toThrow();
    },
  );
  it.each(["profile", "jobDescription"] as const)(
    "preserves quoted literal context instead of applying named-field rewrites: %s",
    (field) => {
      const literal = 'I build CLI tools using --name="two  spaces".';
      const wrapped = {
        ...target,
        profileMarkdown: literal,
        jobDescription: field === "jobDescription" ? literal : "",
        category: "linkedin_connection" as const,
      };
      const context = buildOutreachGroundingContext({
        candidate: candidate(cases[0]!),
        target: wrapped,
      });
      const selected = context.atomicSources!.find((source) =>
        source.id.startsWith(`target.${field}.`),
      )!;
      expect(selected.content).toBe(literal);
      const draft = resolveLinkedinSelection(
        {
          target_source_id: selected.id,
          candidate_source_id: null,
          cta: "Open to connecting?",
        },
        context.atomicSources!,
        context.sources,
      );
      const rendered = renderLinkedinConnection({
        draft,
        sources: context.sources,
      });
      expect(rendered.body).toContain(literal);
      expect(() =>
        finalizeGroundedOutput({
          body: rendered.body,
          platform: "linkedin",
          bodyConstraint: resolveOutputConstraint({
            category: "linkedin_connection",
          }),
          requiredEnding: draft.cta,
          sources: context.atomicSources!,
          claims: draft.claims,
          excludedClaims: [],
        }),
      ).not.toThrow();
    },
  );
  it.each(["body", "ledger", "excerpt"] as const)(
    "rejects changed quoted whitespace in the %s",
    (field) => {
      const fact = cases[0]!;
      const changed = fact.replace("two  spaces", "two spaces");
      const source = {
        id: "candidate:cli",
        scope: "candidate" as const,
        kind: "action" as const,
        content: fact,
      };
      const ledger = claim(source);
      expect(() =>
        validateAtomicOutput({
          sources: [source],
          claims: [
            {
              ...ledger,
              ...(field === "ledger" ? { text: changed } : {}),
              ...(field === "excerpt" ? { supporting_excerpt: changed } : {}),
            },
          ],
          excludedClaims: [],
          fields: [
            { text: field === "body" ? changed : fact, scope: "candidate" },
          ],
        }),
      ).toThrow();
    },
  );
  it("accepts structural spacing between complete facts without changing their contents", () => {
    const fact = cases[0]!;
    const source = {
      id: "candidate:cli",
      scope: "candidate" as const,
      kind: "action" as const,
      content: fact,
    };
    expect(() =>
      validateAtomicOutput({
        sources: [source],
        claims: [claim(source)],
        excludedClaims: [],
        fields: [
          {
            text: `Hi there,\n\n${fact}\t\nOpen to connecting?`,
            scope: "either",
          },
        ],
      }),
    ).not.toThrow();
  });
});
