import { describe, expect, it } from "vitest";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";
import type { CandidateGroundingData } from "../domain/candidate-context.types";
import { buildOutreachGroundingContext } from "@/modules/outreach/application/build-outreach-grounding-context";
import { buildYcGroundingContext } from "@/modules/application-answer/application/build-yc-grounding-context";

const generic = story("generic", {
  kind: "ai_usage",
  title: "AI assistant",
  actions: "I built an LLM assistant for coding questions.",
  skills: ["LLM"],
});
const policy = story("policy", {
  title: "Policy-grounded documentation agents",
  actions:
    "I built and evaluated agents that ground answers in policy documentation.",
  skills: ["evaluation", "documentation"],
});
const jd =
  "Build AI agents grounded in policy documentation and evaluate their answers.";

function story(
  id: string,
  overrides: Partial<CandidateEvidenceRecord> = {},
): CandidateEvidenceRecord {
  const entry: CandidateEvidenceRecord = {
    id,
    kind: "technical_project",
    title: "A personal project",
    context: "",
    actions: "I built a personal prototype.",
    outcome: "",
    metrics: [],
    skills: [],
    links: [],
    confirmed: true,
    sortOrder: 0,
    ...overrides,
  };
  return {
    ...entry,
    factReview: prepareFactReview(entry, [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "action",
        excerpt: entry.actions,
        confirmed: true,
      },
    ]),
  };
}
function candidate(entries: CandidateEvidenceRecord[]): CandidateGroundingData {
  return {
    identity: { fullName: "Synthetic", linkedinUrl: "" },
    profile: candidateProfileInputSchema.parse({ currentRole: "Engineer" }),
    confirmedEvidence: entries,
    resume: { text: "", source: "none" },
  };
}
const ids = (context: { sources: { id: string; type: string }[] }) =>
  context.sources.filter((s) => s.type === "evidence").map((s) => s.id);
function outreach(
  entries: CandidateEvidenceRecord[],
  category: "linkedin_connection" | "cold_email" | "linkedin_inmail",
  jobDescription = jd,
) {
  return buildOutreachGroundingContext({
    candidate: candidate(entries),
    target: {
      category,
      profileMarkdown: "Engineering Manager working on AI.",
      jobDescription,
      conversationContext: "",
    },
  });
}

describe("ALE-54 actual selector contract", () => {
  it.each(["linkedin_connection", "cold_email", "linkedin_inmail"] as const)(
    "prefers supported policy/documentation work over a generic AI category for %s",
    (category) => {
      expect(ids(outreach([generic, policy], category))[0]).toBe(
        "evidence:policy",
      );
    },
  );
  it.each(["linkedin_connection", "cold_email", "linkedin_inmail"] as const)(
    "does not double-count the AI family ahead of specific policy labels for %s",
    (category) => {
      const labelledPolicy = story("labelled-policy", {
        title: "Policy documentation",
        actions: "I created a searchable corpus and citation renderer.",
      });
      expect(
        ids(
          outreach(
            [generic, labelledPolicy],
            category,
            "Build LLM policy documentation tools.",
          ),
        )[0],
      ).toBe("evidence:labelled-policy");
    },
  );
  it("prefers specific policy labels over generic LLM actions for YC", () => {
    const labelledPolicy = story("labelled-policy", {
      title: "Policy documentation",
      actions: "I created a searchable corpus and citation renderer.",
    });
    const result = buildYcGroundingContext({
      candidate: candidate([generic, labelledPolicy]),
      question: "Why this role?",
      jobDescription: "Build LLM policy documentation tools.",
    });
    expect(ids(result)[0]).toBe("evidence:labelled-policy");
  });
  it("keeps a broad past-tense AI question answerable with reviewed AI evidence", () => {
    const ai = story("ai", {
      kind: "ai_usage",
      title: "AI assistant",
      actions: "I built an AI assistant.",
    });
    const result = buildYcGroundingContext({
      candidate: candidate([ai]),
      question: "How have you used AI?",
      jobDescription: "Build AI tools.",
    });
    expect(ids(result)).toEqual(["evidence:ai"]);
    expect(result.readiness.ready).toBe(true);
  });
  describe.each([
    "Build AI agents for policy documentation.",
    "Build LLM RAG ML agents grounded in policy documentation.",
  ])("prioritizes the requested domain: %s", (jobDescription) => {
    it.each([
      "linkedin_connection",
      "cold_email",
      "linkedin_inmail",
      "yc_application",
    ] as const)("selects the policy project for %s", (category) => {
      const entries = [
        story("generic-methods", {
          kind: "ai_usage",
          title: "AI assistant",
          actions:
            "I built AI agents using LLM, RAG and ML for coding questions.",
        }),
        story("specific-policy", {
          title: "Policy documentation",
          actions: "I created a searchable corpus and citation renderer.",
        }),
      ];
      const result =
        category === "yc_application"
          ? buildYcGroundingContext({
              candidate: candidate(entries),
              question: "Why this role?",
              jobDescription,
            })
          : outreach(entries, category, jobDescription);
      expect(ids(result)[0]).toBe("evidence:specific-policy");
    });
  });
  it.each(["LLM", "ML", "RAG", "AI agents"])(
    "does not qualify generic %s work for a specific policy topic",
    (method) => {
      const result = buildYcGroundingContext({
        candidate: candidate([
          story("generic-only", {
            kind: "ai_usage",
            title: `${method} assistant`,
            actions: `I built ${method} for coding questions.`,
          }),
        ]),
        question: "Why this role?",
        jobDescription: `Build ${method} for policy documentation.`,
      });
      expect(ids(result)).toEqual([]);
      expect(result.readiness.ready).toBe(false);
    },
  );
  it.each(["Why are you a good fit for this job?", "Why this job?"])(
    "uses the JD for generic job framing: %s",
    (question) => {
      const result = buildYcGroundingContext({
        candidate: candidate([
          story("specific-policy", {
            title: "Policy documentation",
            actions: "I created a searchable corpus and citation renderer.",
          }),
        ]),
        question,
        jobDescription: "Build policy documentation tools.",
      });
      expect(ids(result)).toEqual(["evidence:specific-policy"]);
      expect(result.readiness.ready).toBe(true);
    },
  );
  it("leaves cold-email capacity unused rather than filling it with unrelated generic methods", () => {
    const entries = [
      generic,
      story("specific-policy", {
        title: "Policy documentation",
        actions: "I created a searchable corpus and citation renderer.",
      }),
    ];
    expect(
      ids(
        outreach(
          entries,
          "cold_email",
          "Build LLM policy documentation tools.",
        ),
      ),
    ).toEqual(["evidence:specific-policy"]);
  });
  it.each(["AI", "LLM", "ML", "RAG"])(
    "does not qualify non-AI agent work for an explicit %s-agent target",
    (method) => {
      const result = buildYcGroundingContext({
        candidate: candidate([
          story("estate", {
            title: "Real estate agent",
            actions: "I worked as a real estate agent.",
          }),
        ]),
        question: "Why this role?",
        jobDescription: `Build ${method} agents.`,
      });
      expect(ids(result)).toEqual([]);
      expect(result.readiness.ready).toBe(false);
    },
  );
  it.each(["linkedin_connection", "cold_email", "linkedin_inmail"] as const)(
    "uses background fallback instead of unrelated agent work for %s",
    (category) => {
      const result = outreach(
        [
          story("estate", {
            title: "Real estate agent",
            actions: "I worked as a real estate agent.",
          }),
        ],
        category,
        "Build AI agents.",
      );
      expect(ids(result)).toEqual([]);
      expect(result.metadata.groundingLevel).toBe("profile_grounded");
    },
  );
  it.each([
    {
      title: "Real estate agent",
      actions: "I worked as a real estate agent.",
      jobDescription: "Real estate agent.",
    },
    {
      title: "AI agent",
      actions: "I built an AI agent.",
      jobDescription: "Build AI agents.",
    },
  ])(
    "preserves actual $title eligibility",
    ({ title, actions, jobDescription }) => {
      const result = buildYcGroundingContext({
        candidate: candidate([story("relevant", { title, actions })]),
        question: "Why this role?",
        jobDescription,
      });
      expect(ids(result)).toEqual(["evidence:relevant"]);
      expect(result.readiness.ready).toBe(true);
    },
  );
  it("does not invent a YC relevance fallback from arbitrary unrelated stories", () => {
    const result = buildYcGroundingContext({
      candidate: candidate([generic, policy]),
      question: "Why this role?",
      jobDescription:
        "Quantum chemistry research studying molecular spectroscopy.",
    });
    expect(ids(result)).toEqual([]);
    expect(result.readiness).toMatchObject({
      ready: false,
      missingFields: ["confirmed_evidence"],
    });
  });
  it("uses outreach's explicit background fallback when evidence is unrelated", () => {
    const result = outreach(
      [generic, policy],
      "cold_email",
      "Quantum chemistry research studying molecular spectroscopy.",
    );
    expect(ids(result)).toEqual([]);
    expect(result.metadata.groundingLevel).toBe("profile_grounded");
  });
  it("does not let a long JD outweigh a specific application question", () => {
    const mentor = story("mentor", {
      title: "Mentoring engineers",
      actions: "I mentored colleagues through technical decisions.",
    });
    const result = buildYcGroundingContext({
      candidate: candidate([policy, mentor]),
      question: "Describe your mentoring experience.",
      jobDescription: jd.repeat(10),
    });
    expect(ids(result)[0]).toBe("evidence:mentor");
  });
  it("recognizes evals/docs/policies aliases without a category bonus", () => {
    expect(
      ids(
        outreach(
          [generic, policy],
          "linkedin_connection",
          "Work on evals for agents using policies and docs.",
        ),
      ),
    ).toEqual(["evidence:policy"]);
  });
  it("does not allow excluded or unconfirmed evidence to win", () => {
    const data = candidate([generic, { ...policy, confirmed: false }]);
    data.profile = candidateProfileInputSchema.parse({
      excludedClaims: ["coding questions"],
    });
    const result = buildOutreachGroundingContext({
      candidate: data,
      target: {
        category: "cold_email",
        profileMarkdown: "Engineering Manager working on AI.",
        jobDescription: jd,
        conversationContext: "",
      },
    });
    expect(ids(result)).toEqual([]);
  });
});
