import { describe, expect, it } from "vitest";
import {
  collectReviewedEvidence,
  ReviewedContextTooLargeError,
  reviewedDraftPrompt,
  validateReviewedDraft,
} from "./reviewed-draft";
import {
  candidateEvidenceInputSchema,
  candidateProfileInputSchema,
} from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";

const reviewed = {
  id: "fact",
  rootId: "evidence:project",
  scope: "candidate" as const,
  kind: "action" as const,
  title: "Agent review",
  content:
    "I built a record of automated AI agent decisions in order to trace approvals, in order to identify recurring errors, and in order to document recommendations from a prototype.",
};
const target =
  "Hiring! Founding AI Engineer.\n\nWe’re building tools that red team autonomous AI agents.";
const impact =
  "What is the impact you're most proud of having driven through something you built?";

describe("ALE-80 reviewed drafts", () => {
  it("preserves the complete original context and question in the structured payload", () => {
    const prompt = reviewedDraftPrompt({
      category: "yc_application",
      jobDescription: target + "\n\n#ai",
      questions: [{ id: "q1", question: impact }],
      maximum: 150,
      facts: [reviewed],
    });
    expect(JSON.parse(prompt.userPrompt).facts).toEqual([reviewed]);
    expect(JSON.parse(prompt.userPrompt)).toMatchObject({
      jobDescription: target,
      postHashtags: ["#ai"],
      questions: [{ id: "q1", question: impact }],
      facts: [{ id: "fact", title: "Agent review", content: reviewed.content }],
    });
  });

  it("uses a concise statement with its own review approval", () => {
    const text =
      "I built a record of automated AI agent decisions to trace approvals, to identify recurring errors, and to document recommendations from a prototype.";
    const concise = { ...reviewed, id: "concise", content: text };
    const item = {
      id: "q1",
      body: "Hi there, " + text + " Open to a brief chat? Thank you.",
      claims: [{ id: concise.id, text }],
    };
    const constraint = {
      category: "linkedin_connection",
      minimum: 1,
      maximum: 200,
      unit: "characters",
    } as const;
    const result = validateReviewedDraft({
      item,
      facts: [reviewed, concise],
      excludedClaims: [],
      constraint,
    });
    expect(result.body.length).toBeLessThanOrEqual(200);
    expect(result.claims[0]).toMatchObject({
      source_id: concise.id,
      supporting_excerpt: concise.content,
    });
    expect(() =>
      validateReviewedDraft({
        item: { ...item, claims: [{ id: reviewed.id, text }] },
        facts: [reviewed, concise],
        excludedClaims: [],
        constraint,
      }),
    ).toThrow();
  });

  it.each([
    "I built an audit trail for AI agent decisions. I did not deploy it.",
    "I built an audit trail for AI agent decisions. I only built a prototype.",
    "I built an audit trail for AI agent decisions. I documented that the team actually owned the audit trail.",
    "I built an audit trail for AI agent decisions. I documented that my coworker built it and I observed the work.",
    "I built an audit trail for AI agent decisions. I also documented that my coworker built it and I observed the work.",
  ])("rejects dropping qualification from %s", (content) => {
    const text = "I built an audit trail for AI agent decisions.";
    expect(() =>
      validateReviewedDraft({
        item: { id: "q1", body: text, claims: [{ id: "fact", text }] },
        facts: [{ ...reviewed, content }],
        excludedClaims: [],
        constraint: {
          category: "linkedin_connection",
          minimum: 1,
          maximum: 200,
          unit: "characters",
        },
      }),
    ).toThrow();
  });

  it("rejects invented claims even with a current approved ID", () => {
    const text = "I led red teaming for ten deployed agents.";
    expect(() =>
      validateReviewedDraft({
        item: { id: "q1", body: text, claims: [{ id: "fact", text }] },
        facts: [reviewed],
        excludedClaims: [],
        constraint: {
          category: "linkedin_connection",
          minimum: 1,
          maximum: 200,
          unit: "characters",
        },
      }),
    ).toThrow();
  });
});

it("includes all complete current facts within the budget and rejects overflow before selection", () => {
  const reviewedStories = Array.from({ length: 49 }, (_, index) => {
    const id = `ae800000-2222-4222-8222-${String(index).padStart(12, "0")}`;
    const story = {
      ...candidateEvidenceInputSchema.parse({
        title: `System ${index}`,
        kind: "technical_project",
        actions: `I built a review screen for system ${index}.`,
        confirmed: true,
      }),
      id,
      sortOrder: index,
    };
    return {
      ...story,
      factReview: prepareFactReview(story, [
        {
          id,
          kind: "action",
          excerpt: story.actions,
          confirmed: true,
        },
      ]),
    };
  });
  const candidate = {
    identity: { fullName: "", linkedinUrl: "" },
    profile: candidateProfileInputSchema.parse({}),
    resume: { text: "PRIVATE_RAW_RESUME", source: "user_resumes" as const },
    confirmedEvidence: reviewedStories,
  };
  expect(() => collectReviewedEvidence(candidate)).toThrow(
    ReviewedContextTooLargeError,
  );
  const selectedIds = reviewedStories.slice(0, 2).map(({ id }) => id);
  const pool = collectReviewedEvidence(candidate, selectedIds);
  expect(pool.facts.map(({ title }) => title)).toEqual([
    "System 0",
    "System 1",
  ]);
  expect(JSON.stringify(pool)).not.toContain("PRIVATE_RAW_RESUME");
});

it("excludes stale reviews even if the record remains confirmed", () => {
  const record = {
    ...candidateEvidenceInputSchema.parse({
      title: "Help desk queue",
      kind: "technical_project",
      actions: "I built a prototype review queue.",
      confirmed: true,
    }),
    id: "ae800000-2222-4222-8222-222222222221",
    sortOrder: 0,
  };
  const factReview = prepareFactReview(record, [
    {
      id: "ae800000-2222-4222-8222-222222222222",
      kind: "action",
      excerpt: record.actions,
      confirmed: true,
    },
  ]);
  const candidate = {
    identity: { fullName: "", linkedinUrl: "" },
    profile: candidateProfileInputSchema.parse({}),
    resume: { text: "", source: "none" as const },
    confirmedEvidence: [
      {
        ...record,
        actions: "I evaluated somebody else's prototype.",
        factReview,
      },
    ],
  };
  expect(collectReviewedEvidence(candidate).facts).toEqual([]);
});

it("rejects an uncited candidate assertion in the displayed body", () => {
  const text = "I built an audit trail for AI agent decisions.";
  expect(() =>
    validateReviewedDraft({
      item: {
        id: "q1",
        body: text + " I led red teaming for ten deployments.",
        claims: [{ id: "fact", text }],
      },
      facts: [reviewed],
      excludedClaims: [],
      constraint: {
        category: "linkedin_connection",
        minimum: 1,
        maximum: 200,
        unit: "characters",
      },
    }),
  ).toThrow();
});

it("rejects a result from another project after a multi-paragraph claim", () => {
  const action = "I built the intake tool.\n\nI added an audit log.";
  const metric = "I measured a 50% improvement with it.";
  const facts = [
    { ...reviewed, content: action },
    {
      ...reviewed,
      id: "metric",
      rootId: "evidence:other",
      kind: "metric" as const,
      content: metric,
    },
  ];
  expect(() =>
    validateReviewedDraft({
      item: {
        id: "q1",
        body: action + " " + metric + " Open to connecting?",
        claims: [
          { id: "fact", text: action },
          { id: "metric", text: metric },
        ],
      },
      facts,
      excludedClaims: [],
      constraint: {
        category: "linkedin_connection",
        minimum: 1,
        maximum: 200,
        unit: "characters",
      },
    }),
  ).toThrow();
});

it("rejects repeating a single fact to fill an answer’s word limit", () => {
  const text = "I built a small queue for requests.";
  expect(() =>
    validateReviewedDraft({
      item: {
        id: "q1",
        body: Array(8).fill(text).join(" "),
        claims: [{ id: "fact", text }],
      },
      facts: [{ ...reviewed, content: text }],
      excludedClaims: [],
      constraint: {
        category: "yc_application",
        minimum: 50,
        maximum: 150,
        unit: "words",
      },
    }),
  ).toThrow();
});

it("preserves punctuation inside an approved literal label", () => {
  const original = "I wrote the label “Hold — Manual Review”.";
  const text = "I wrote the label “Hold, Manual Review”.";
  expect(() =>
    validateReviewedDraft({
      item: {
        id: "q1",
        body: text + " Open to connecting?",
        claims: [{ id: "fact", text }],
      },
      facts: [{ ...reviewed, content: original }],
      excludedClaims: [],
      constraint: {
        category: "linkedin_connection",
        minimum: 1,
        maximum: 200,
        unit: "characters",
      },
    }),
  ).toThrow();
});

it("requires the outreach note to end with an invitation", () => {
  const content = "I moved review requests to a single queue.";
  const input = {
    facts: [{ ...reviewed, content }],
    excludedClaims: [],
    constraint: {
      category: "linkedin_connection",
      minimum: 1,
      maximum: 200,
      unit: "characters",
    } as const,
  };
  const item = {
    id: "q1",
    body: content,
    claims: [{ id: "fact", text: content }],
  };
  expect(() => validateReviewedDraft({ ...input, item })).toThrow();
  expect(
    validateReviewedDraft({
      ...input,
      item: { ...item, body: content + "\n\nOpen to connecting?\nThank you." },
    }).body,
  ).toContain("Open to connecting?");
});

it("rejects an ambiguous result that begins a separate project paragraph", () => {
  const action = "I built the intake tool.";
  const metric = "I cut its review time by half.";
  const facts = [
    { ...reviewed, content: action },
    {
      ...reviewed,
      id: "metric",
      rootId: "evidence:other",
      kind: "metric" as const,
      content: metric,
    },
  ];
  expect(() =>
    validateReviewedDraft({
      item: {
        id: "q1",
        body: action + "\n\n" + metric + "\n\nOpen to connecting?",
        claims: [
          { id: "fact", text: action },
          { id: "metric", text: metric },
        ],
      },
      facts,
      excludedClaims: [],
      constraint: {
        category: "linkedin_connection",
        minimum: 1,
        maximum: 200,
        unit: "characters",
      },
    }),
  ).toThrow();
});

it("rejects dropping an allegedly additive separate assertion", () => {
  const opening = "I built the production intake service.";
  const content = opening + " I also documented my fictional claim.";
  expect(() =>
    validateReviewedDraft({
      item: {
        id: "q1",
        body: opening + " Open to connecting?",
        claims: [{ id: "fact", text: opening }],
      },
      facts: [{ ...reviewed, content }],
      excludedClaims: [],
      constraint: {
        category: "linkedin_connection",
        minimum: 1,
        maximum: 200,
        unit: "characters",
      },
    }),
  ).toThrow();
});

it("requires an invitation outside the cited factual statement", () => {
  const text =
    "I wrote this prompt for an access test: Would you be open to a brief chat?";
  const input = {
    facts: [{ ...reviewed, content: text }],
    excludedClaims: [],
    constraint: {
      category: "linkedin_connection",
      minimum: 1,
      maximum: 200,
      unit: "characters",
    } as const,
  };
  const item = { id: "q1", body: text, claims: [{ id: "fact", text }] };
  expect(() => validateReviewedDraft({ ...input, item })).toThrow();
  expect(
    validateReviewedDraft({
      ...input,
      item: { ...item, body: text + " Open to connecting?" },
    }).body,
  ).toContain("Open to connecting?");
});

it("allows separate project paragraphs when both approved statements name their project", () => {
  const action = "I built the Alpha Intake tool.";
  const second = "I added the Beta Audit trail.";
  const facts = [
    { ...reviewed, content: action, title: "Alpha Intake" },
    {
      ...reviewed,
      id: "second",
      rootId: "evidence:other",
      content: second,
      title: "Beta Audit",
    },
  ];
  const body = action + "\n\n" + second + "\n\nOpen to connecting?";
  expect(
    validateReviewedDraft({
      item: {
        id: "q1",
        body,
        claims: [
          { id: "fact", text: action },
          { id: "second", text: second },
        ],
      },
      facts,
      excludedClaims: [],
      constraint: {
        category: "linkedin_connection",
        minimum: 1,
        maximum: 200,
        unit: "characters",
      },
    }).body,
  ).toBe(body);
});

it("does not shorten a phrase inside an unquoted named value", () => {
  const content =
    "I replaced Process in order to review with a different scheduler value.";
  const text = "I replaced Process to review with a different scheduler value.";
  expect(() =>
    validateReviewedDraft({
      item: {
        id: "q1",
        body: text + " Open to connecting?",
        claims: [{ id: "fact", text }],
      },
      facts: [{ ...reviewed, content }],
      excludedClaims: [],
      constraint: {
        category: "linkedin_connection",
        minimum: 1,
        maximum: 200,
        unit: "characters",
      },
    }),
  ).toThrow();
});

it("does not use an overlapping project name as an attribution", () => {
  const first = "I built Apollo Billing.";
  const second = "I maintained Apollo Billing.";
  const facts = [
    { ...reviewed, title: "Apollo", content: first },
    {
      ...reviewed,
      id: "second",
      title: "Apollo Billing",
      rootId: "evidence:billing",
      content: second,
    },
  ];
  expect(() =>
    validateReviewedDraft({
      item: {
        id: "q1",
        body: first + "\n\n" + second + "\n\nOpen to connecting?",
        claims: [
          { id: "fact", text: first },
          { id: "second", text: second },
        ],
      },
      facts,
      excludedClaims: [],
      constraint: {
        category: "linkedin_connection",
        minimum: 1,
        maximum: 200,
        unit: "characters",
      },
    }),
  ).toThrow();
});

describe("ALE-80 final grounding corrections", () => {
  const constraint = {
    category: "linkedin_connection",
    minimum: 1,
    maximum: 200,
    unit: "characters",
  } as const;
  const clearApollo = {
    ...reviewed,
    title: "Apollo",
    content: "I built Apollo.",
  };
  const billing = {
    ...reviewed,
    id: "billing",
    rootId: "evidence:billing",
    title: "Apollo Billing",
    content: "I maintained Apollo Billing.",
  };
  const beta = {
    ...reviewed,
    id: "beta",
    rootId: "evidence:beta",
    title: "Beta Audit",
    content: "I built Beta Audit.",
  };

  it.each([
    [
      "I switched from Process in order to review to Batch Review.",
      "I switched from Process to review to Batch Review.",
    ],
    [
      "I tested Wait in order to review and Push in order to queue, two workflow steps.",
      "I tested Wait to review and Push to queue, two workflow steps.",
    ],
    [
      "I configured Mode Ⅳ in the prototype.",
      "I configured Mode IV in the prototype.",
    ],
  ])("rejects altered literal wording in %s", (content, text) => {
    const facts = [{ ...reviewed, content }];
    const item = {
      id: "q1",
      body: content + " Open to connecting?",
      claims: [{ id: "fact", text: content }],
    };
    expect(
      validateReviewedDraft({ item, facts, constraint, excludedClaims: [] })
        .body,
    ).toBe(item.body);
    expect(() =>
      validateReviewedDraft({
        item: {
          ...item,
          body: text + " Open to connecting?",
          claims: [{ id: "fact", text }],
        },
        facts,
        constraint,
        excludedClaims: [],
      }),
    ).toThrow();
    expect(() =>
      validateReviewedDraft({
        item: { ...item, body: text + " Open to connecting?" },
        facts,
        constraint,
        excludedClaims: [],
      }),
    ).toThrow();
  });

  it.each(["Apollo Billing", "Apollo BILLING", "Apollo-Billing"])(
    "rejects a claim that names %s under Apollo even when the longer title is uncited",
    (name) => {
      const wrong = { ...clearApollo, content: `I built ${name}.` };
      const facts = [wrong, billing, beta];
      for (const cited of [[wrong], [wrong, beta]]) {
        expect(() =>
          validateReviewedDraft({
            item: {
              id: "q1",
              body:
                cited.map(({ content }) => content).join("\n\n") +
                " Open to connecting?",
              claims: cited.map(({ id, content }) => ({ id, text: content })),
            },
            facts,
            constraint,
            excludedClaims: [],
          }),
        ).toThrow();
      }
    },
  );

  it("accepts separately named overlapping projects across case and separators", () => {
    const core = { ...clearApollo, content: "I built APOLLO." };
    const longer = { ...billing, content: "I maintained apollo‑billing." };
    const body =
      core.content + "\n\n" + longer.content + " Open to connecting?";
    expect(
      validateReviewedDraft({
        item: {
          id: "q1",
          body,
          claims: [core, longer].map(({ id, content }) => ({
            id,
            text: content,
          })),
        },
        facts: [core, longer, beta],
        constraint,
        excludedClaims: [],
      }).body,
    ).toBe(body);
  });

  it.each([
    "Apollo Billing-based",
    "Apollo-Billing-backed",
    "Apollo BILLING–specific",
  ])("rejects attribution to Apollo when a modifier names %s", (name) => {
    const wrong = {
      ...clearApollo,
      id: "wrong",
      content: `I built ${name} tooling.`,
    };
    for (const cited of [[wrong], [clearApollo, wrong, billing]]) {
      const proof =
        cited.length === 1
          ? wrong.content
          : clearApollo.content +
            " " +
            wrong.content +
            "\n\n" +
            billing.content;
      expect(() =>
        validateReviewedDraft({
          item: {
            id: "q1",
            body: proof + " Open to connecting?",
            claims: cited.map(({ id, content }) => ({ id, text: content })),
          },
          facts: [clearApollo, wrong, billing],
          constraint,
          excludedClaims: [],
        }),
      ).toThrow();
    }
  });

  it("recognizes an approved lead with a project-based modifier", () => {
    const longer = {
      ...billing,
      content: "I maintained Apollo Billing-based tooling.",
    };
    const body =
      clearApollo.content + "\n\n" + longer.content + " Open to connecting?";
    expect(
      validateReviewedDraft({
        item: {
          id: "q1",
          body,
          claims: [clearApollo, longer].map(({ id, content }) => ({
            id,
            text: content,
          })),
        },
        facts: [clearApollo, longer, beta],
        constraint,
        excludedClaims: [],
      }).body,
    ).toBe(body);
  });

  it("keeps compatibility-insensitive deny checks for verbatim wording", () => {
    const content = "I tested ＡpolloClient for prototype review.";
    expect(() =>
      validateReviewedDraft({
        item: {
          id: "q1",
          body: content + " Open to connecting?",
          claims: [{ id: "fact", text: content }],
        },
        facts: [{ ...reviewed, content }],
        constraint,
        excludedClaims: ["Apollo"],
      }),
    ).toThrow(expect.objectContaining({ code: "CLAIM_EXCLUDED" }));
  });

  it("rejects a later foreign project claim after a valid lead in the same paragraph", () => {
    const result = {
      ...clearApollo,
      id: "result",
      content: "I cut Apollo Billing reconciliation time by 50%.",
    };
    expect(() =>
      validateReviewedDraft({
        item: {
          id: "q1",
          body:
            clearApollo.content +
            " " +
            result.content +
            "\n\n" +
            billing.content +
            " Open to connecting?",
          claims: [clearApollo, result, billing].map(({ id, content }) => ({
            id,
            text: content,
          })),
        },
        facts: [clearApollo, result, billing],
        constraint,
        excludedClaims: [],
      }),
    ).toThrow();
  });

  it("checks an unselected reviewed project without sending its facts to the model", () => {
    const candidate = {
      identity: { fullName: "", linkedinUrl: "" },
      profile: candidateProfileInputSchema.parse({}),
      resume: { text: "", source: "none" as const },
      confirmedEvidence: [
        {
          id: "00000001-2222-4222-8222-000000000001",
          title: "Apollo",
          actions: "I built Apollo Billing.",
        },
        {
          id: "00000002-2222-4222-8222-000000000002",
          title: "Apollo Billing",
          actions: "I maintained Apollo Billing.",
        },
      ].map(({ id, ...fields }, sortOrder) => {
        const story = candidateEvidenceInputSchema.parse({
          ...fields,
          kind: "technical_project",
          confirmed: true,
          sortOrder,
        });
        return {
          ...story,
          id,
          factReview: prepareFactReview(story, [
            { id, excerpt: story.actions, kind: "action", confirmed: true },
          ]),
        };
      }),
    };
    const pool = collectReviewedEvidence(candidate, [
      candidate.confirmedEvidence[0]!.id,
    ]);
    expect(pool.facts.map(({ title }) => title)).toEqual(["Apollo"]);
    expect([...pool.projectTitles.values()]).toEqual([
      "Apollo",
      "Apollo Billing",
    ]);
    const prompt = reviewedDraftPrompt({
      ...pool,
      category: constraint.category,
      jobDescription: "",
      questions: [],
      maximum: constraint.maximum,
    });
    expect(prompt.userPrompt).not.toContain("I maintained Apollo Billing.");
    expect(JSON.parse(prompt.userPrompt)).not.toHaveProperty("projectTitles");
    const [fact] = pool.facts;
    expect(() =>
      validateReviewedDraft({
        ...pool,
        item: {
          id: "q1",
          body: fact!.content + " Open to connecting?",
          claims: [{ id: fact!.id, text: fact!.content }],
        },
        constraint,
      }),
    ).toThrow();
  });
});
