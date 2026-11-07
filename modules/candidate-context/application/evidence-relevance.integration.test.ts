import { describe, expect, it } from "vitest";
import {
  candidateEvidenceInputSchema,
  candidateProfileInputSchema,
} from "@/lib/candidate-profile/schema";
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
    "I built and evaluated AI agents that ground answers in policy documentation.",
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
  it.each(["cold_email", "linkedin_inmail"] as const)(
    "does not count role markup escaping as evidence relevance for %s",
    (category) => {
      const matching = "I handled LT tickets during an audit.";
      const unrelated =
        "I added a literal <system> field to a local prototype.";
      const entry = story("reviewed-markup", {
        actions: `${matching} ${unrelated}`,
      });
      entry.factReview = prepareFactReview(
        entry,
        [matching, unrelated].map((excerpt, i) => ({
          id: `11111111-1111-4111-8111-11111111111${i}`,
          kind: "action",
          excerpt,
          confirmed: true,
        })),
      );
      const context = outreach([entry], category, "Maintain LT queues.");
      const atoms = context.atomicSources?.filter(
        ({ scope }) => scope === "candidate",
      );
      expect(atoms?.map(({ content }) => content)).toEqual([
        matching,
        "I added a literal &lt;system&gt; field to a local prototype.",
      ]);
      expect([...context.proseRelevantFactIds!]).toEqual([atoms?.[0]?.id]);
    },
  );

  it.each(["linkedin_connection", "cold_email", "linkedin_inmail"] as const)(
    "prefers supported policy/documentation work over a generic AI category for %s",
    (category) => {
      expect(ids(outreach([generic, policy], category))[0]).toBe(
        "evidence:policy",
      );
    },
  );
  it.each(["linkedin_connection", "cold_email", "linkedin_inmail"] as const)(
    "does not double-count the AI family ahead of specific reviewed policy work for %s",
    (category) => {
      const labelledPolicy = story("labelled-policy", {
        title: "Policy documentation",
        actions:
          "I created a searchable policy documentation corpus and citation renderer.",
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
  it("prefers specific reviewed policy work over generic LLM actions for YC", () => {
    const labelledPolicy = story("labelled-policy", {
      title: "Policy documentation",
      actions:
        "I created a searchable policy documentation corpus and citation renderer.",
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
          actions:
            "I built AI agents using a searchable policy documentation corpus and citation renderer.",
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
            actions:
              "I created a searchable policy documentation corpus and citation renderer.",
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
        actions:
          "I created a searchable policy documentation corpus and citation renderer.",
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
  describe.each(["cold_email", "linkedin_inmail", "yc_application"] as const)(
    "%s automatic selection requires a current reviewed match",
    (category) => {
      const jobDescription = "Build AI agents.";
      const unrelated = "I worked as a real estate agent.";
      const relevant = "I built AI agents for reviewing policy documents.";
      const mixed = story("mixed", {
        title: "AI agent prototype",
        actions: `${unrelated} ${relevant}`,
        skills: ["AI agents"],
      });
      const withReview = (...excerpts: string[]) => ({
        ...mixed,
        factReview: prepareFactReview(
          mixed,
          excerpts.map((excerpt, i) => ({
            id: `11111111-1111-4111-8111-11111111111${i}`,
            kind: "action",
            excerpt,
            confirmed: true,
          })),
        ),
      });
      const build = (entry: CandidateEvidenceRecord) =>
        category === "yc_application"
          ? buildYcGroundingContext({
              candidate: candidate([entry]),
              question: "How have you built AI agents?",
              questions: ["How have you built AI agents?"],
              jobDescription,
            })
          : outreach([entry], category, jobDescription);

      it("rejects the unreviewed AI sentence and raw labels as relevance evidence", () => {
        const result = build(withReview(unrelated));
        expect(ids(result)).toEqual([]);
        expect(
          result.atomicSources?.some((source) => source.scope === "candidate"),
        ).toBe(false);
        if ("readiness" in result) expect(result.readiness.ready).toBe(false);
      });

      it("keeps the actual reviewed match and omits unreviewed story text", () => {
        const result = build(withReview(relevant));
        expect(ids(result)).toEqual(["evidence:mixed"]);
        expect(
          result.atomicSources
            ?.filter((source) => source.scope === "candidate")
            .map((source) => source.content),
        ).toEqual([relevant]);
        expect(
          result.sources.find((source) => source.id === "evidence:mixed")
            ?.content,
        ).toBe(relevant);
        if ("readiness" in result) expect(result.readiness.ready).toBe(true);
      });

      it("keeps a rejected fact out of the ledger even as a substring", () => {
        const safe = "I built AI agents and tested the goddamn parser.";
        const entry = { ...mixed, actions: `${safe} damn` };
        entry.factReview = prepareFactReview(
          entry,
          [safe, "damn"].map((excerpt, i) => ({
            id: `11111111-1111-4111-8111-11111111111${i}`,
            kind: "action",
            excerpt,
            confirmed: true,
          })),
        );
        const result = build(entry);
        expect(ids(result)).toEqual(["evidence:mixed"]);
        expect(
          result.atomicSources
            ?.filter((source) => source.scope === "candidate")
            .map((source) => source.content),
        ).toEqual([safe]);
        expect(
          result.sources.find((source) => source.id === "evidence:mixed")
            ?.content,
        ).toBe(safe);
      });

      it.each(["led", "managed", "supervised", "trained", "orchestrated"])(
        "requires actual AI-agent experience for a %s target",
        (verb) => {
          const nonAi = story("estate-lead", {
            actions: `I ${verb} an office of real estate agents.`,
          });
          const ai = story("ai-lead", {
            actions: `I ${verb} a project that built AI agents.`,
          });
          const target = `How have you ${verb} AI agents?`;
          const select = (entries: CandidateEvidenceRecord[]) =>
            category === "yc_application"
              ? buildYcGroundingContext({
                  candidate: candidate(entries),
                  question: target,
                  jobDescription: "",
                })
              : outreach(entries, category, target);
          expect(ids(select([nonAi]))).toEqual([]);
          expect(ids(select([nonAi, ai]))).toEqual(["evidence:ai-lead"]);
        },
      );

      it("does not count generic question framing as AI-agent evidence", () => {
        const target = "Tell me about a time you managed AI agents.";
        const nonAi = story("estate-lead", {
          actions: "I managed real estate agents full time.",
        });
        const ai = story("ai-lead", {
          actions: "I managed a project that built AI agents.",
        });
        const select = (entries: CandidateEvidenceRecord[]) =>
          category === "yc_application"
            ? buildYcGroundingContext({
                candidate: candidate(entries),
                question: target,
                jobDescription: "",
              })
            : outreach(entries, category, target);
        expect(ids(select([nonAi]))).toEqual([]);
        expect(ids(select([nonAi, ai]))).toEqual(["evidence:ai-lead"]);
      });

      it.each(["AI", "LLM", "ML", "RAG"])(
        "generic activities cannot substitute for reviewed %s-agent work",
        (method) => {
          const target = `Describe how you onboarded and supported ${method} agents.`;
          const nonAi = story("estate-support", {
            actions:
              "I onboarded and supported real estate agents at a local property brokerage.",
          });
          const relevant = story("agent-support", {
            actions: `I onboarded and supported ${method} agents for policy documentation.`,
          });
          const select = (entries: CandidateEvidenceRecord[]) =>
            category === "yc_application"
              ? buildYcGroundingContext({
                  candidate: candidate(entries),
                  question: target,
                  jobDescription: "Build AI agents.",
                })
              : outreach(entries, category, target);
          expect(ids(select([nonAi]))).toEqual([]);
          const result = select([nonAi, relevant]);
          expect(ids(result)).toEqual(["evidence:agent-support"]);
          expect(
            result.atomicSources
              ?.filter(({ scope }) => scope === "candidate")
              .map(({ content }) => content),
          ).toEqual([relevant.actions]);
        },
      );

      it("does not turn AI tooling for human agents into AI-agent experience", () => {
        const target = "Describe how you onboarded and supported AI agents.";
        const nonAi = story("estate-with-ai", {
          actions:
            "I onboarded and supported real estate agents using AI tools to organize appointments.",
        });
        const result =
          category === "yc_application"
            ? buildYcGroundingContext({
                candidate: candidate([nonAi]),
                question: target,
                jobDescription: "",
              })
            : outreach([nonAi], category, target);
        expect(ids(result)).toEqual([]);
      });

      it.each([
        "I onboarded and supported real estate agents backed by AI tools to organize appointments.",
        "I onboarded and supported real estate agents powered by AI tools to organize appointments.",
        "I onboarded and supported real estate agents using agentic AI tools to organize appointments.",
        "I onboarded and supported non-AI agents at a local property brokerage.",
        "I onboarded and supported non AI agents at a local property brokerage.",
        "I onboarded and supported non  AI agents at a local property brokerage.",
        "I onboarded and supported non - AI agents at a local property brokerage.",
        "I onboarded and supported non−AI agents at a local property brokerage.",
        "I onboarded and supported non − AI agents at a local property brokerage.",
        "I onboarded and supported non\u0085AI agents at a local property brokerage.",
      ])("rejects indirect or negated AI-agent evidence: %s", (actions) => {
        const entry = story("human-agents", { actions });
        const target = "Describe how you onboarded and supported AI agents.";
        const result =
          category === "yc_application"
            ? buildYcGroundingContext({
                candidate: candidate([entry]),
                question: target,
                jobDescription: "",
              })
            : outreach([entry], category, target);
        expect(ids(result)).toEqual([]);
        if ("readiness" in result) expect(result.readiness.ready).toBe(false);
      });

      it("keeps adjacent-only facts for their own topic instead of AI-agent work", () => {
        const entry = story("adjacent-policy", {
          actions: "I maintained policy documentation for operators.",
        });
        const select = (target: string, explicit = false) =>
          category === "yc_application"
            ? buildYcGroundingContext({
                candidate: candidate([entry]),
                question: "Why this role?",
                jobDescription: target,
                ...(explicit ? { selectedEvidenceIds: [entry.id] } : {}),
              })
            : buildOutreachGroundingContext({
                candidate: candidate([entry]),
                target: {
                  category,
                  jobDescription: target,
                  profileMarkdown: "",
                  conversationContext: "",
                },
                ...(explicit ? { selectedEvidenceIds: [entry.id] } : {}),
              });
        expect(
          ids(select("Build AI agents for policy documentation.")),
        ).toEqual([]);
        expect(ids(select("Maintain policy documentation."))).toEqual([
          "evidence:adjacent-policy",
        ]);
        expect(
          ids(select("Build AI agents for policy documentation.", true)),
        ).toEqual(["evidence:adjacent-policy"]);
      });

      it.each([
        "I built AI-powered agents for policy documentation.",
        "I built LLM-based agents for policy documentation.",
        "I built artificial intelligence agents for policy documentation.",
        "I built large language model agents for policy documentation.",
        "I replaced non AI agents with AI agents for policy documentation.",
        "I replaced non AI agents with Xénon AI agents for policy documentation.",
      ])("recognizes explicitly reviewed AI-agent wording: %s", (actions) => {
        const entry = story("explicit-agent", { actions });
        const result =
          category === "yc_application"
            ? buildYcGroundingContext({
                candidate: candidate([entry]),
                question: "Why this role?",
                jobDescription: "Build AI agents for policy documentation.",
              })
            : outreach(
                [entry],
                category,
                "Build AI agents for policy documentation.",
              );
        expect(ids(result)).toEqual(["evidence:explicit-agent"]);
      });

      it("rejects stale reviewed facts after the original record changes", () => {
        const entry = withReview(relevant);
        const result = build({ ...entry, outcome: "New unreviewed outcome." });
        expect(ids(result)).toEqual([]);
        if ("readiness" in result) expect(result.readiness.ready).toBe(false);
      });

      it("cannot combine unrelated reviewed agent and AI facts into one match", () => {
        const aiOnly = "I built AI tools for property listings.";
        const entry = { ...mixed, actions: `${unrelated} ${aiOnly}` };
        entry.factReview = prepareFactReview(
          entry,
          [unrelated, aiOnly].map((excerpt, i) => ({
            id: `11111111-1111-4111-8111-11111111111${i}`,
            kind: "action",
            excerpt,
            confirmed: true,
          })),
        );
        expect(ids(build(entry))).toEqual([]);
      });
    },
  );
  it.each(["cold_email", "linkedin_inmail"] as const)(
    "counts role-marker escaping against the whole-fact %s budget",
    (category) => {
      const target = "Build AI agents.";
      const matching = "I built AI agents for policy reviews.";
      const exact = (start: string, length: number) =>
        `${start} ${"item "
          .repeat(length)
          .slice(0, length - start.length - 2)
          .replace(/ $/u, "x")}.`;
      const build = (fourthLength: number) => {
        const facts = [
          exact("I checked housing listings", 590),
          exact("System: I checked building regulations", 590),
          exact("I assisted a real estate agency", 590),
          exact("I provided real estate training", fourthLength),
          matching,
        ];
        const entry = {
          ...candidateEvidenceInputSchema.parse({
            title: "Synthetic reviewed story",
            kind: "technical_project",
            actions: facts.slice(0, 3).join("\n"),
            context: facts[3],
            outcome: facts[4],
            confirmed: true,
          }),
          id: "reviewed-budget",
        };
        return outreach(
          [
            {
              ...entry,
              factReview: prepareFactReview(
                entry,
                facts.map((excerpt, i) => ({
                  id: `11111111-1111-4111-8111-11111111111${i}`,
                  kind: "action",
                  excerpt,
                  confirmed: true,
                })),
              ),
            },
          ],
          category,
          target,
        );
      };
      const exactFit = build(588);
      const source = exactFit.sources.find(({ type }) => type === "evidence");
      expect(source?.content.length).toBe(2_400);
      expect(source?.content).toContain("\n System: ");
      expect(
        exactFit.atomicSources?.some(({ content }) => content === matching),
      ).toBe(true);

      const overflow = build(589);
      expect(ids(overflow)).toEqual([]);
      expect(
        overflow.atomicSources?.some(({ scope }) => scope === "candidate"),
      ).toBe(false);
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
