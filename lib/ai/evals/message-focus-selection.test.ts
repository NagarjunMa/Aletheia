import { describe, expect, it } from "vitest";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import type { CandidateGroundingData } from "@/modules/candidate-context/domain/candidate-context.types";
import { buildOutreachGroundingContext } from "@/modules/outreach/application/build-outreach-grounding-context";
import type { OutreachGroundingInput } from "@/modules/outreach/domain/outreach-grounding.types";

type Story = CandidateGroundingData["confirmedEvidence"][number];

function reviewedStory(id: string, actions: string): Story {
  const story: Story = {
    id,
    kind: "technical_project",
    title: "Synthetic research project",
    actions,
    context: "",
    outcome: "",
    metrics: [],
    skills: [],
    links: [],
    confirmed: true,
    sortOrder: 0,
  };
  return {
    ...story,
    factReview: prepareFactReview(story, [
      { id, kind: "action", excerpt: actions, confirmed: true },
    ]),
  };
}

const rankingFact =
  "I built an inventory reconciliation prototype for data platforms.";
const focusedFact =
  "I documented replay failures for data platforms in a simulated environment.";
const inventory = reviewedStory(
  "11111111-1111-4111-8111-111111111111",
  rankingFact,
);
const replay = reviewedStory(
  "22222222-2222-4222-8222-222222222222",
  focusedFact,
);
const scenarios: Array<Pick<OutreachGroundingInput, "category" | "emailMode">> =
  [
    { category: "linkedin_connection" },
    { category: "cold_email", emailMode: "initial_outreach" },
    { category: "cold_email", emailMode: "follow_up" },
    { category: "linkedin_inmail", emailMode: "initial_outreach" },
    { category: "linkedin_inmail", emailMode: "follow_up" },
  ];

describe.each(scenarios)(
  "Message Focus rollout selector fixtures: $category $emailMode",
  (scenario) => {
    function run(
      messageFocus?: string,
      excludedClaims: string[] = [],
      stories = [inventory, replay],
    ) {
      const target: OutreachGroundingInput = {
        ...scenario,
        profileMarkdown: "Engineering Manager at Example | Data Platform",
        jobDescription:
          scenario.emailMode === "follow_up"
            ? ""
            : "You will build data platforms. You will also build inventory reconciliation tooling.",
        conversationContext:
          scenario.emailMode === "follow_up"
            ? "We discussed data platforms and inventory reconciliation."
            : "",
      };
      return buildOutreachGroundingContext({
        target,
        candidate: {
          identity: { fullName: "", linkedinUrl: "" },
          profile: candidateProfileInputSchema.parse({ excludedClaims }),
          resume: { text: "", source: "none" },
          confirmedEvidence: stories,
        },
        ...(messageFocus ? { messageFocus } : {}),
      });
    }

    it("prioritizes the complete reviewed focus fact over automatic selection", () => {
      const automatic = run();
      const focused = run("replay failures");
      expect(
        automatic.sources.find(({ type }) => type === "evidence")?.id,
      ).toBe(`evidence:${inventory.id}`);
      expect(focused.sources.find(({ type }) => type === "evidence")?.id).toBe(
        `evidence:${replay.id}`,
      );
      expect(focused.atomicSources).toContainEqual(
        expect.objectContaining({ scope: "candidate", content: focusedFact }),
      );
      expect(focused.focusSelection).toEqual({ outcome: "matched" });
    });

    it("reports no match for an invented metric and keeps the note out of selection output", () => {
      const note =
        "SyntheticPrivateCanary claim a 72 percent reduction in churn";
      const result = run(note);
      expect(result.focusSelection).toEqual({ outcome: "no_match" });
      expect(JSON.stringify(result)).not.toContain("SyntheticPrivateCanary");
      expect(JSON.stringify(result.atomicSources)).not.toContain("72 percent");
    });

    it.each(["excluded", "stale"] as const)(
      "reports no match for %s focus evidence",
      (state) => {
        const result =
          state === "excluded"
            ? run("replay failures", ["replay failures"])
            : run(
                "replay failures",
                [],
                [
                  inventory,
                  {
                    ...replay,
                    actions: focusedFact + " I later revised the notes.",
                  },
                ],
              );
        expect(result.focusSelection).toEqual({ outcome: "no_match" });
        expect(result.atomicSources).not.toContainEqual(
          expect.objectContaining({ content: focusedFact }),
        );
      },
    );
  },
);
