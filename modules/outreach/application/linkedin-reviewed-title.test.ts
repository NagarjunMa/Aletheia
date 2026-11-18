import { describe, expect, it } from "vitest";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import { buildOutreachGroundingContext } from "./build-outreach-grounding-context";
import { buildLinkedinCompositions } from "../domain/linkedin-grounded-selection";
import { validateAtomicOutput } from "@/modules/grounding/application/validate-atomic-claims";
import { summarizeValidatedOutreachGrounding } from "./validate-outreach-provenance";

const title =
  "Automated enterprise BIOS and device-provisioning workflows at Example";
const record = {
  id: "automation",
  kind: "achievement" as const,
  title,
  context: "The factory used manual device configuration.",
  actions: "I automated device provisioning.",
  outcome: "The setup process became faster.",
  metrics: [],
  skills: [],
  links: [],
  confirmed: true,
  sortOrder: 0,
};

function context(excerpt = title, state = "reviewed", explicit = true) {
  const entry = {
    ...record,
    title: excerpt,
    factReview: prepareFactReview(
      { ...record, title: excerpt },
      state === "unreviewed"
        ? []
        : [
            {
              id: "11111111-1111-4111-8111-111111111111",
              kind: "company" as const,
              excerpt,
              confirmed: true,
            },
          ],
    ),
    ...(state === "stale" ? { outcome: "The source changed." } : {}),
    confirmed: state !== "withdrawn",
  };
  return buildOutreachGroundingContext({
    candidate: {
      identity: { fullName: "Synthetic", linkedinUrl: "" },
      profile: candidateProfileInputSchema.parse({}),
      confirmedEvidence: [entry],
      resume: { text: "", source: "none" },
    },
    target: {
      category: "linkedin_connection",
      profileMarkdown: "Engineering Manager at Example | Infrastructure",
      jobDescription:
        "Build BIOS configuration and device-provisioning workflows.",
      conversationContext: "",
      connectionNoteLimit: 300,
    },
    ...(explicit ? { selectedEvidenceIds: [record.id] } : {}),
  });
}

describe("ALE-27 reviewed work titles", () => {
  it.each([true, false])(
    "grounds a complete quoted work title (explicit=%s)",
    (explicit) => {
      const grounding = context(title, "reviewed", explicit);
      const options = buildLinkedinCompositions(
        grounding.atomicSources!,
        "networking",
      );
      expect(options.length).toBeGreaterThan(0);
      for (const { draft, body } of options) {
        expect(body).toContain(`My background includes: "${title}"`);
        expect(body).not.toContain("I automated");
        expect(body.length).toBeLessThanOrEqual(300);
        const validated = validateAtomicOutput({
          claims: draft.claims,
          sources: grounding.atomicSources!,
          excludedClaims: [],
          fields: [{ text: body, scope: "either" }],
        });
        expect(
          summarizeValidatedOutreachGrounding(grounding, validated),
        ).toMatchObject({
          groundingLevel: "verified_evidence",
          selectedEvidenceCount: 1,
          provenanceValidated: true,
        });
      }
    },
  );

  it.each(["unreviewed", "stale", "withdrawn"])(
    "does not use a %s title",
    (state) => {
      const grounding = context(title, state, false);
      const options = buildLinkedinCompositions(
        grounding.atomicSources!,
        "networking",
      );
      expect(options.every(({ body }) => !body.includes(title))).toBe(true);
    },
  );

  it.each([
    "Enterprise BIOS and device-provisioning workflows",
    "Planning to automate BIOS configuration",
    "Learning to automate BIOS configuration",
    "Failed to automate BIOS configuration",
    "Automated BIOS configuration?",
    "Automated BIOS configuration is a future goal.",
    "Automated BIOS configuration is not something I have done.",
    "Automated BIOS configuration was performed by another team; I only observed.",
    "Automated BIOS and device-provisioning workflows are what I want to learn.",
    "Automated BIOS configuration; planned for next quarter",
    "Automated BIOS configuration — scheduled for next quarter",
    "Automated BIOS configuration: upcoming project",
    "Automated BIOS configuration: aspirational project",
  ])("does not treat an ambiguous title as completed work: %s", (excerpt) => {
    const grounding = context(excerpt, "reviewed", false);
    const options = buildLinkedinCompositions(
      grounding.atomicSources!,
      "networking",
    );
    expect(options.every(({ draft }) => !draft.candidate_relevance)).toBe(true);
  });

  it("preserves a simulation qualification in the complete reviewed title", () => {
    const qualified =
      "Automated BIOS configuration in a simulator; never deployed to production";
    const grounding = context(qualified);
    const options = buildLinkedinCompositions(
      grounding.atomicSources!,
      "networking",
    );
    expect(options.length).toBeGreaterThan(0);
    expect(options.every(({ body }) => body.includes(`"${qualified}"`))).toBe(
      true,
    );
  });
});
