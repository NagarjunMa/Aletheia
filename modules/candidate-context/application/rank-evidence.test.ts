import { describe, expect, it } from "vitest";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";
import { createEvidenceRanker } from "./rank-evidence";

function story(
  id: string,
  fields: Partial<CandidateEvidenceRecord> = {},
): CandidateEvidenceRecord {
  return {
    id,
    kind: "technical_project",
    title: "",
    context: "",
    actions: "",
    outcome: "",
    metrics: [],
    skills: [],
    links: [],
    confirmed: true,
    sortOrder: 0,
    ...fields,
  };
}
const ids = (
  entries: CandidateEvidenceRecord[],
  primary: string,
  secondary = "",
) =>
  createEvidenceRanker(entries)({ primary, secondary }).evidence.map(
    (entry) => entry.id,
  );

describe("createEvidenceRanker", () => {
  it("counts each term once and prefers supported contributions over labels/context", () => {
    const entries = [
      story("labels", { title: "policy ".repeat(100) }),
      story("context", { context: "policy ".repeat(200) }),
      story("contribution", { actions: "policy" }),
    ];
    expect(ids(entries, "policy ".repeat(100))).toEqual([
      "contribution",
      "labels",
    ]);
    expect(ids(entries, "policy")).toEqual(["contribution", "labels"]);
    expect(
      ids(
        [
          story("repeat", {
            title: "policy",
            actions: "policy",
            outcome: "policy",
          }),
          story("one", { actions: "policy", sortOrder: -1 }),
        ],
        "policy",
      ),
    ).toEqual(["one", "repeat"]);
  });
  it("reports context-only matches as weak rather than relevant proof", () => {
    const result = createEvidenceRanker([story("weak", { context: "policy" })])(
      { primary: "policy" },
    );
    expect(result.evidence).toEqual([]);
    expect(result.diagnostics).toEqual({
      outcome: "weak_match",
      consideredCount: 1,
      matchedCount: 0,
    });
  });
  it("does not turn weak context-only domain overlap into fit through generic method actions", () => {
    const result = createEvidenceRanker([
      story("weak-ai", {
        context: "Policy documentation",
        actions: "I built AI agents for coding questions.",
      }),
    ])({ primary: "Build AI agents for policy documentation." });
    expect(result.evidence).toEqual([]);
    expect(result.diagnostics.outcome).toBe("weak_match");
  });
  it("does not promote non-AI agent actions using AI mentioned only in background context", () => {
    const result = createEvidenceRanker([
      story("estate", {
        title: "Real estate agent",
        actions: "I worked as a real estate agent.",
        context: "AI and LLM experiments.",
      }),
    ])({ primary: "Build AI agents." });
    expect(result.evidence).toEqual([]);
    expect(result.diagnostics.outcome).toBe("weak_match");
  });
  it("uses the secondary for a generic question and never to override a specific question", () => {
    const entries = [
      story("mentor", { actions: "Mentored colleagues" }),
      story("policy", { actions: "Policy documentation" }),
    ];
    expect(
      ids(
        entries,
        "Why are you a strong candidate for this role?",
        "policy documentation",
      ),
    ).toEqual(["policy"]);
    expect(
      ids(
        entries,
        "Describe your mentoring experience",
        "policy documentation ".repeat(100),
      ),
    ).toEqual(["mentor"]);
    expect(ids(entries, "quantum chemistry", "policy documentation")).toEqual(
      [],
    );
  });
  it.each([
    "What are your most impressive accomplishments?",
    "What have you accomplished that you are most proud of?",
    "Tell us about your previous experience.",
  ])("uses job context for the generic question: %s", (question) => {
    expect(
      ids(
        [story("policy", { actions: "Policy documentation" })],
        question,
        "policy documentation",
      ),
    ).toEqual(["policy"]);
  });
  it("breaks a primary tie using the secondary domain before its generic AI methods", () => {
    const entries = [
      story("method", { actions: "Policy", skills: ["LLM"] }),
      story("domain", { actions: "Policy", title: "Documentation" }),
    ];
    expect(ids(entries, "policy", "LLM documentation")).toEqual([
      "domain",
      "method",
    ]);
    expect(ids(entries, "LLM", "policy documentation")).toEqual(["method"]);
  });
  it("uses AI kind only for equally relevant real AI work, never as proof of fit", () => {
    const entries = [
      story("kind-only", { kind: "ai_usage", actions: "Documentation" }),
      story("project", { actions: "AI", sortOrder: -1 }),
      story("ai", { actions: "AI", kind: "ai_usage" }),
    ];
    expect(ids(entries, "Build artificial intelligence tools")).toEqual([
      "ai",
      "project",
    ]);
    expect(ids(entries, "Build AI tools for policy documentation")).toEqual([
      "kind-only",
    ]);
    expect(
      ids(
        [story("generic-ai", { kind: "ai_usage", actions: "AI" })],
        "Build AI policy tools",
      ),
    ).toEqual([]);
  });
  it("does not infer AI from a non-AI agent or reward an AI label without matching AI content", () => {
    expect(
      ids(
        [story("estate", { actions: "Worked as a real estate agent." })],
        "AI",
      ),
    ).toEqual([]);
    expect(
      ids(
        [
          story("kind", {
            kind: "ai_usage",
            actions: "Policy documentation",
            sortOrder: 2,
          }),
          story("project", { actions: "Policy documentation", sortOrder: 1 }),
        ],
        "AI policy documentation",
      ),
    ).toEqual(["project", "kind"]);
  });
  it("normalizes only matching text and respects exact technology tokens", () => {
    const entries = [
      story("csharp", { skills: ["C#"] }),
      story("cpp", { skills: ["C++"] }),
      story("node", { actions: "Node.js" }),
      story("typescript", { actions: "TypeScript" }),
      story("unicode", { actions: "Ｄｏｃｓ and policies" }),
    ];
    const snapshot = structuredClone(entries);
    expect(ids(entries, "C++")).toEqual(["cpp"]);
    expect(ids(entries, "C#")).toEqual(["csharp"]);
    expect(ids(entries, "Node.js.")).toEqual(["node"]);
    expect(ids(entries, "JavaScript")).toEqual([]);
    expect(ids(entries, "documentation policy")).toEqual(["unicode"]);
    expect(entries).toEqual(snapshot);
    expect(
      ids([story("constructor", { actions: "constructor" })], "constructor"),
    ).toEqual(["constructor"]);
  });
  it("ignores unconfirmed records and uses sort order then ID independently of input order", () => {
    const entries = [
      story("z", { actions: "Policy", sortOrder: 2 }),
      story("a", { actions: "Policy", sortOrder: 2 }),
      story("first", { actions: "Policy", sortOrder: 1 }),
      story("unconfirmed", { actions: "Policy", confirmed: false }),
    ];
    expect(ids(entries, "policy")).toEqual(["first", "a", "z"]);
    expect(ids([...entries].reverse(), "policy")).toEqual(["first", "a", "z"]);
  });
  it("reuses a request's pool across questions without leaking selections or other users' pools", () => {
    const rank = createEvidenceRanker([
      story("policy", { actions: "Policy documentation" }),
      story("mentor", { actions: "Mentoring colleagues" }),
    ]);
    const first = rank({ primary: "policy" });
    expect(
      rank({ primary: "mentoring" }).evidence.map((entry) => entry.id),
    ).toEqual(["mentor"]);
    expect(rank({ primary: "policy" })).toEqual(first);
    expect(createEvidenceRanker([])({ primary: "policy" }).evidence).toEqual(
      [],
    );
  });
  it("distinguishes no evidence from no match and returns no arbitrary fallback", () => {
    expect(
      createEvidenceRanker([])({ primary: "policy" }).diagnostics.outcome,
    ).toBe("no_evidence");
    expect(
      createEvidenceRanker([story("irrelevant", { actions: "Chemistry" })])({
        primary: "policy",
      }).diagnostics.outcome,
    ).toBe("no_match");
    expect(ids([story("any", { actions: "Chemistry" })], "")).toEqual([]);
  });
});
