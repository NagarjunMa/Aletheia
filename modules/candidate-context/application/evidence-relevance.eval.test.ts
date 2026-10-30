import { describe, expect, it } from "vitest";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";
import { createEvidenceRanker } from "./rank-evidence";

// Held-out expected choices fixed before policy calibration, using synthetic content only.
const cases = [
  {
    target: "Improve PostgreSQL reliability",
    expected: "database",
    stories: [
      ["ai", "AI assistant", "LLM support"],
      [
        "database",
        "PostgreSQL operations",
        "Operated PostgreSQL failover and improved reliability",
      ],
    ],
  },
  {
    target: "Build accessible React interfaces",
    expected: "accessibility",
    stories: [
      ["react", "React reports", "Built analytics reports"],
      [
        "accessibility",
        "Accessible interfaces",
        "Audited accessible keyboard navigation and React components",
      ],
    ],
  },
  {
    target: "Describe mentoring colleagues",
    expected: "mentoring",
    stories: [
      ["policy", "Policy agents", "Built policy documentation agents"],
      ["mentoring", "Mentoring", "Mentored colleagues through design reviews"],
    ],
  },
  {
    target: "Own recruiting interviews",
    expected: "recruiting",
    stories: [
      ["coding", "Coding tools", "Built AI developer tools"],
      [
        "recruiting",
        "Recruiting",
        "Conducted recruiting interviews and assessed candidates",
      ],
    ],
  },
  {
    target: "Design authentication security",
    expected: "security",
    stories: [
      ["ai", "AI security assistant", "Built a coding prototype"],
      [
        "security",
        "Authentication boundary",
        "Designed authentication and authorization security checks",
      ],
    ],
  },
  {
    target: "Maintain policy documentation",
    expected: "documentation",
    stories: [
      ["ai", "AI assistant", "Built LLM chat tools"],
      [
        "documentation",
        "Policy documentation",
        "Maintained policy documentation for operators",
      ],
    ],
  },
] as const;

describe("ALE-54 held-out selection matrix", () => {
  it.each(cases)(
    "selects $expected for $target",
    ({ target, expected, stories }) => {
      const entries: CandidateEvidenceRecord[] = stories.map(
        ([id, title, actions], sortOrder) => ({
          id,
          title,
          actions,
          kind: id === "ai" ? "ai_usage" : "technical_project",
          context: "",
          outcome: "",
          metrics: [],
          skills: [],
          links: [],
          sortOrder,
          confirmed: true,
        }),
      );
      expect(
        createEvidenceRanker(entries)({ primary: target }).evidence[0]?.id,
      ).toBe(expected);
      expect(
        createEvidenceRanker([...entries].reverse())({ primary: target })
          .evidence[0]?.id,
      ).toBe(expected);
    },
  );
});
