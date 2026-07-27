import { describe, expect, it } from "vitest";
import {
  CANDIDATE_EVIDENCE_KINDS,
  candidateEvidenceInputSchema,
  candidateProfileInputSchema,
  getApplicationProfileReadiness,
} from "./schema";

describe("candidate profile schemas", () => {
  it("normalizes a valid candidate profile without inventing missing values", () => {
    const result = candidateProfileInputSchema.parse({
      currentRole: "  Senior Software Engineer  ",
      currentResponsibilities: " Own platform delivery. ",
      startupMotivation: " Build useful products with small teams. ",
      careerGoals: "Lead end-to-end AI product work.",
      targetRoles: ["  Founding Engineer ", "Backend Engineer"],
      targetCompanyStages: ["seed", "series_a_b"],
      targetIndustries: ["AI infrastructure"],
      githubUrl: "https://github.com/example",
      linkedinUrl: "",
      portfolioUrl: "https://example.com",
      location: "New York, NY",
      workAuthorization: "Authorized to work in the United States",
      relocationPreference: "open",
      availability: "Four weeks after accepting an offer",
      excludedClaims: ["  Do not claim I managed a team.  "],
    });

    expect(result.currentRole).toBe("Senior Software Engineer");
    expect(result.targetRoles).toEqual([
      "Founding Engineer",
      "Backend Engineer",
    ]);
    expect(result.linkedinUrl).toBe("");
    expect(result.excludedClaims).toEqual(["Do not claim I managed a team."]);
  });

  it("rejects malformed URLs and oversized repeatable fields", () => {
    expect(() =>
      candidateProfileInputSchema.parse({
        githubUrl: "github dot com/example",
      }),
    ).toThrow();

    expect(() =>
      candidateProfileInputSchema.parse({
        targetRoles: Array.from({ length: 11 }, (_, index) => `Role ${index}`),
      }),
    ).toThrow();
  });

  it.each(CANDIDATE_EVIDENCE_KINDS)("accepts grounded %s evidence", (kind) => {
    const result = candidateEvidenceInputSchema.parse({
      kind,
      title: "  Reduced deployment risk  ",
      context: "A manual release process was slowing the team.",
      actions: "Built and rolled out a tested deployment workflow.",
      outcome: "Releases became repeatable and easier to audit.",
      metrics: ["Reduced release preparation from hours to minutes"],
      skills: ["CI/CD", "Cross-functional delivery"],
      links: ["https://github.com/example/project"],
      confirmed: true,
      sortOrder: 2,
    });

    expect(result.title).toBe("Reduced deployment risk");
    expect(result.kind).toBe(kind);
    expect(result.confirmed).toBe(true);
  });

  it("requires an evidence title and a concrete action", () => {
    const result = candidateEvidenceInputSchema.safeParse({
      kind: "achievement",
      title: " ",
      actions: "Too short",
    });

    expect(result.success).toBe(false);
  });
});

describe("getApplicationProfileReadiness", () => {
  it("is ready with a resume and two confirmed evidence entries", () => {
    const readiness = getApplicationProfileReadiness({
      profile: candidateProfileInputSchema.parse({
        startupMotivation:
          "I prefer small teams with direct product ownership.",
      }),
      evidence: [
        candidateEvidenceInputSchema.parse({
          kind: "achievement",
          title: "Shipped onboarding",
          actions: "Owned implementation from discovery through production.",
          confirmed: true,
        }),
        candidateEvidenceInputSchema.parse({
          kind: "technical_project",
          title: "Built an API platform",
          actions: "Designed, tested, and operated the service end to end.",
          confirmed: true,
        }),
      ],
      hasPrimaryResume: true,
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.completionPercent).toBeGreaterThanOrEqual(50);
    expect(readiness.missingRequired).toEqual([]);
  });

  it("reports the minimum missing evidence without blocking optional sections", () => {
    const readiness = getApplicationProfileReadiness({
      profile: candidateProfileInputSchema.parse({ currentRole: "Engineer" }),
      evidence: [
        candidateEvidenceInputSchema.parse({
          kind: "achievement",
          title: "Improved releases",
          actions: "Reworked the deployment process with the platform team.",
          confirmed: false,
        }),
      ],
      hasPrimaryResume: false,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.missingRequired).toContain(
      "Add at least two confirmed evidence stories",
    );
    expect(readiness.recommendedNext).toContain(
      "Explain why early-stage companies interest you",
    );
  });
});
