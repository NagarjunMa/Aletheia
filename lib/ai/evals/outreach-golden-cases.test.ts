import { describe, expect, it } from "vitest";
import { proseFixture } from "@/__tests__/helpers/prose-fixture";
import { countOutputUnits } from "@/lib/ai/output-constraints";
import type { AtomicSource } from "@/modules/grounding/domain/atomic-claim";
import { validateAtomicOutput } from "@/modules/grounding/application/validate-atomic-claims";
import { buildProseCompositions } from "@/modules/outreach/application/prose-compositions";
import { coldEmailDraftSchema } from "@/modules/outreach/domain/outreach-draft.types";
import { buildLinkedinCompositions } from "@/modules/outreach/domain/linkedin-grounded-selection";
import type { DiscourseSample } from "./discourse-quality";
import { evaluateOutreachDiscourse } from "./outreach-discourse-quality";

const longConversation =
  "The fictional Birchbank infrastructure team described a classroom exercise where students reviewed a synthetic queue, compared the practice alerts with written expectations, recorded which notifications were useful during a simulated incident, and discussed why they would need different checks before they could use the same method for a real service.";

function inmailFollowUp(conversationText: string): DiscourseSample {
  const { context } = proseFixture("linkedin_inmail", "follow_up");
  const action = context.atomicSources!.find(
    (source) => source.kind === "action",
  )!;
  const conversation: AtomicSource = {
    id: "target.conversation.synthetic",
    scope: "target",
    kind: "target_observation",
    content: conversationText,
  };
  context.atomicSources = [action, conversation];
  const [draft] = buildProseCompositions({
    category: "linkedin_inmail",
    emailMode: "follow_up",
    context,
  });
  return {
    id: "synthetic-inmail-follow-up-without-fitting-target",
    category: "linkedin_inmail",
    emailMode: "follow_up",
    body: draft!.body,
    subject: draft!.subject,
    claims: draft!.claims,
    sources: context.atomicSources,
    excludedClaims: [],
    targetRequired: false,
  };
}

describe("ALE-29 synthetic outreach cases", () => {
  it("accepts concise initial email without an identity and rejects a fabricated signature", () => {
    const { context, action } = proseFixture("cold_email", "initial_outreach");
    context.identity = { fullName: "", linkedinUrl: "" };
    context.atomicSources = context.atomicSources!.filter(
      (source) => source.scope === "target" || source.content === action,
    );
    const [draft] = buildProseCompositions({
      category: "cold_email",
      emailMode: "initial_outreach",
      context,
    });
    const sample: DiscourseSample = {
      id: "synthetic-email-initial-without-identity",
      category: "cold_email",
      emailMode: "initial_outreach",
      body: draft!.body,
      subject: draft!.subject,
      claims: draft!.claims,
      sources: context.atomicSources,
      excludedClaims: [],
      identity: context.identity,
      targetRequired: false,
    };
    const result = evaluateOutreachDiscourse(sample);
    expect(result.violations).toEqual([]);
    expect(result.bodyWords).toBeLessThan(120);
    expect(result.candidateReferenceCount).toBe(1);
    expect(sample.body).not.toContain("Best,");
    expect(
      evaluateOutreachDiscourse({
        ...sample,
        body: sample.body + "\n\nBest,\nFictional Candidate",
      }).violations,
    ).toContain("factual_coverage");
  });

  it("rejects a third proof point even when the supporting facts are valid", () => {
    const { context, coldDraft } = proseFixture(
      "cold_email",
      "initial_outreach",
    );
    const extra = [
      "I wrote a synthetic on-call checklist.",
      "I documented how to replay a fabricated queue incident.",
    ].map((content, index): AtomicSource => ({
      id: `synthetic-extra-proof-${index + 1}`,
      scope: "candidate",
      kind: "action",
      content,
    }));
    const proof = extra.map((source) => ({
      text: source.content,
      source_ids: [source.id],
    }));
    const claims = [
      ...coldDraft.claims,
      ...extra.map((source) => ({
        text: source.content,
        source_id: source.id,
        kind: source.kind,
        supporting_excerpt: source.content,
      })),
    ];
    expect(() =>
      validateAtomicOutput({
        claims,
        sources: [...context.atomicSources!, ...extra],
        excludedClaims: [],
        fields: [
          {
            text: claims.map((claim) => claim.text).join(" "),
            scope: "either",
          },
        ],
      }),
    ).not.toThrow();
    expect(
      coldEmailDraftSchema.safeParse({
        ...coldDraft,
        proof_points: [...coldDraft.proof_points, proof[0]],
        claims: claims.slice(0, -1),
      }).success,
    ).toBe(true);
    const result = coldEmailDraftSchema.safeParse({
      ...coldDraft,
      proof_points: [...coldDraft.proof_points, ...proof],
      claims,
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ code: "too_big", path: ["proof_points"] }),
    ]);
  });

  it.each([
    [200, "my"],
    [201, "the"],
  ] as const)(
    "enforces the Basic note limit for a %i-character mentorship ask",
    (length, article) => {
      const source: AtomicSource = {
        id: "synthetic-queue-action",
        rootId: "synthetic-queue-work",
        scope: "candidate",
        kind: "action",
        content: `I built a local monitor for a fictional queue, checked the alerts against simulated failures, and documented the conditions where ${article} alerts stayed quiet.`,
      };
      const ask = "May I ask you a question? Thank you.";
      const options = buildLinkedinCompositions(
        [source],
        "mentorship",
        false,
        undefined,
        200,
      );
      const extended = buildLinkedinCompositions([source], "mentorship").find(
        (option) => option.body.endsWith(ask),
      );
      expect(extended?.body).toHaveLength(length);
      expect(options.length).toBeGreaterThan(0);
      expect(options.every(({ body }) => body.length <= 200)).toBe(true);
      expect(options.some(({ body }) => body.endsWith(ask))).toBe(
        length === 200,
      );
      for (const option of options) {
        expect(option.body).toContain(source.content);
        expect(
          evaluateOutreachDiscourse({
            id: "synthetic-basic-mentorship-note",
            category: "linkedin_connection",
            emailMode: "initial_outreach",
            body: option.body,
            claims: option.draft.claims ?? [],
            sources: [source],
            excludedClaims: [],
            targetRequired: false,
          }).violations,
        ).toEqual([]);
      }
    },
  );

  it("uses reviewed proof when the complete conversation fact cannot fit an InMail follow-up", () => {
    const sample = inmailFollowUp(longConversation);
    const result = evaluateOutreachDiscourse(sample);
    expect(result.violations).toEqual([]);
    expect(result.candidateReferenceCount).toBe(1);
    expect(result.targetReferenceCount).toBe(0);
    expect(sample.body).not.toContain("Birchbank");
    expect(
      result.bodyWords + countOutputUnits(longConversation, "words"),
    ).toBeGreaterThan(90);
    const short = inmailFollowUp(
      "The fictional Birchbank recruiter asked how the queue alerts were reviewed.",
    );
    const fitting = evaluateOutreachDiscourse({
      ...short,
      targetRequired: true,
    });
    expect(fitting.violations).toEqual([]);
    expect(fitting.targetReferenceCount).toBe(1);
  });

  it.each([
    ["metric", "I reduced queue delays by 37%."],
    ["technology", "I operated Kubernetes clusters."],
    ["employer", "I worked for Birchbank Systems."],
    ["project", "I shipped the Lantern Queue platform."],
  ])("rejects an unsupported %s in the InMail subject", (_kind, subject) => {
    const result = evaluateOutreachDiscourse({
      ...inmailFollowUp(longConversation),
      subject,
    });
    expect(result.violations).toContain("factual_coverage");
    expect(result.factualCoverage).toBe(false);
  });
});
