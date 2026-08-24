import { describe, expect, it } from "vitest";
import type { ColdEmailDraft } from "../domain/outreach-draft.types";
import { renderColdEmail } from "./render-cold-email";

const draft: ColdEmailDraft = {
  subject_line: "AI engineering interest",
  greeting: "Megan",
  target_opening: "Your work on practical AI tooling stood out.",
  candidate_positioning: "I build production systems for engineering teams.",
  proof_points: [
    {
      text: "Built an LLM-assisted developer review workflow.",
      source_ids: ["evidence:1"],
    },
  ],
  value_statement: "That experience maps well to a product-focused AI team.",
  cta: "Would you be open to a brief chat?",
};

describe("renderColdEmail", () => {
  it("renders deterministic sections with a verified signature", () => {
    const result = renderColdEmail({
      draft,
      identity: {
        fullName: "Candidate Name",
        linkedinUrl: "https://linkedin.com/in/candidate",
      },
      mode: "initial_outreach",
    });
    expect(result.body).toContain("Hi Megan,");
    expect(result.body).toContain("A quick look at my background:");
    expect(result.body).toContain(
      "Best,\nCandidate Name\nhttps://linkedin.com/in/candidate",
    );
    expect(result.identityIncluded).toBe(true);
  });

  it("omits an unverified signature instead of inventing one", () => {
    const result = renderColdEmail({
      draft,
      identity: { fullName: "", linkedinUrl: "" },
      mode: "follow_up",
    });
    expect(result.body).not.toContain("Best,");
    expect(result.identityIncluded).toBe(false);
  });

  it("renders the synthetic Nordnet regression without an inventory or orphaned technology line", () => {
    const result = renderColdEmail({
      draft: {
        subject_line: "Reliable AI-assisted developer workflows",
        greeting: "Morgan",
        target_opening:
          "Your Engineering Productivity team’s focus on reliable AI-assisted development caught my attention.",
        candidate_positioning:
          "I build backend systems that help engineering teams ship safely.",
        proof_points: [
          {
            text: "AI Workflow: Built an internal developer-review workflow that retrieves service ownership guidance and verifies proposed changes before they reach engineers.",
            source_ids: ["evidence:ai-workflow"],
          },
          {
            text: "Operational Fit: Added evaluation checks and rollout monitoring so the team could measure failure patterns and improve the workflow.",
            source_ids: ["evidence:operational-fit"],
          },
        ],
        value_statement:
          "That experience maps well to a team making AI assistance dependable for developers.",
        cta: "Would you be open to a brief chat about the problems your team is prioritizing?",
      },
      identity: {
        fullName: "Avery Morgan",
        linkedinUrl: "https://linkedin.com/in/avery-morgan",
      },
      mode: "initial_outreach",
    });

    expect(result.body).toContain("AI Workflow:");
    expect(result.body).toContain("Operational Fit:");
    expect(result.body).not.toMatch(/^AWS[.!?]?$/m);
    expect(result.body).toContain(
      "Best,\nAvery Morgan\nhttps://linkedin.com/in/avery-morgan",
    );
  });
});
