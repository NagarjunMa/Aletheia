import { describe, expect, it } from "vitest";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import type {
  CandidateGroundingData,
  CandidateGroundingSource,
} from "@/modules/candidate-context/domain/candidate-context.types";
import {
  buildAtomicCandidateSources,
  buildAtomicTargetSources,
} from "./build-atomic-sources";

const original = "I supported the launch; I did not lead it.";
const candidate: CandidateGroundingData = {
  identity: { fullName: "Test", linkedinUrl: "" },
  profile: candidateProfileInputSchema.parse({
    currentResponsibilities: original,
    currentRole: "Engineer",
  }),
  confirmedEvidence: [],
  resume: { text: original, source: "user_resumes" },
};
const selected: CandidateGroundingSource = {
  id: "profile.current_responsibilities",
  type: "profile",
  priority: 2,
  label: "Responsibilities",
  content: original,
};
describe("complete source units", () => {
  it("rejects adjacent control lines while preserving mixed factual paragraphs intact", () => {
    const mixed = "About\nI build evaluation tools.\nFollow";
    const result = buildAtomicTargetSources({
      profile: `Connect\nFollow\nMessage\nMore\n\n${mixed}`,
    });
    expect(result.sources.map((source) => source.content)).toEqual([
      "About I build evaluation tools. Follow",
    ]);
    expect(result.diagnostics.pageControls).toBe(1);
  });
  it("does not promote standalone LinkedIn controls to target facts", () => {
    const result = buildAtomicTargetSources({
      profile:
        "Connect\n\nFollow\n\nMessage\n\nAbout\n\nI build evaluation tools.",
    });
    expect(result.sources.map((source) => source.content)).toEqual([
      "I build evaluation tools.",
    ]);
  });
  it("preserves negation and qualifications inside complete passages", () => {
    const text = "I research agents. I do not build them for production.";
    const result = buildAtomicTargetSources({ profile: text });
    expect(result.sources.map((source) => source.content)).toEqual([text]);
  });
  it("reports bounded-source rejection counts without retaining text in diagnostics", () => {
    const result = buildAtomicTargetSources(
      {
        profile: [
          "Connect",
          "PRIVATE_CANARY forbidden",
          "x".repeat(601),
          ...Array(17).fill("I build tools."),
        ].join("\n\n"),
      },
      ["forbidden"],
    );
    expect(result.sources).toHaveLength(16);
    expect(result.diagnostics).toEqual({
      examined: 20,
      excluded: 1,
      overlength: 1,
      pageControls: 1,
      budgetRejected: 1,
      accepted: 16,
    });
    expect(JSON.stringify(result.diagnostics)).not.toContain("PRIVATE_CANARY");
  });
  it("never detaches an evidence action from its qualifying record", () => {
    const record = {
      id: "simulation",
      kind: "achievement" as const,
      title: "Training simulation",
      context: "All figures below are simulated, not production results.",
      actions: "I increased revenue by 50 percent.",
      outcome: "",
      metrics: [],
      skills: [],
      links: [],
      confirmed: true,
      sortOrder: 0,
    };
    const content = `Title: ${record.title}\nContext: ${record.context}\nActions: ${record.actions}`;
    const sources = buildAtomicCandidateSources(
      { ...candidate, confirmedEvidence: [record] },
      [
        {
          id: "evidence:simulation",
          type: "evidence",
          priority: 1,
          label: record.title,
          content,
        },
      ],
    );
    // Record-level confirmation cannot automatically confirm individual facts.
    expect(sources).toEqual([]);
  });
  it("does not automatically type an unreviewed free-text profile field", () => {
    expect(buildAtomicCandidateSources(candidate, [selected])).toEqual([]);
  });
  it("admits individual reviewed types without promoting the surrounding record", () => {
    const record = {
      id: "policy",
      kind: "technical_project" as const,
      title: "Policy prototype",
      context: "Training only.",
      actions: "I built a policy-grounded prototype.",
      outcome: "",
      metrics: [],
      skills: [],
      links: [],
      confirmed: true,
      sortOrder: 0,
    };
    const fact = {
      id: "11111111-1111-4111-8111-111111111111",
      kind: "action",
      excerpt: record.actions,
      confirmed: true,
    };
    const reviewed = {
      ...record,
      factReview: prepareFactReview(record, [fact]),
    };
    const sources = [
      {
        id: "evidence:policy",
        type: "evidence" as const,
        priority: 1 as const,
        label: record.title,
        content: `Title: ${record.title}\nContext: ${record.context}\nActions: ${record.actions}`,
      },
    ];
    expect(
      buildAtomicCandidateSources(
        { ...candidate, confirmedEvidence: [reviewed] },
        sources,
      ),
    ).toEqual([
      {
        id: `evidence:policy.fact.${fact.id}`,
        rootId: "evidence:policy",
        scope: "candidate",
        kind: "action",
        content: record.actions,
      },
    ]);
    expect(
      buildAtomicCandidateSources(
        {
          ...candidate,
          confirmedEvidence: [{ ...reviewed, context: "Production." }],
        },
        sources,
      ),
    ).toEqual([]);
    expect(
      buildAtomicCandidateSources(
        { ...candidate, confirmedEvidence: [reviewed] },
        [],
      ),
    ).toEqual([]);
  });
  it("does not promote a truncated field to complete evidence", () => {
    expect(
      buildAtomicCandidateSources(candidate, [
        { ...selected, content: "I supported the launch" },
      ]),
    ).toEqual([]);
  });
  it("does not use unselected candidate data", () => {
    expect(buildAtomicCandidateSources(candidate, [])).toEqual([]);
  });
  it("does not turn resume fragments into complete evidence", () => {
    expect(
      buildAtomicCandidateSources(candidate, [
        {
          ...selected,
          id: "resume.primary",
          type: "resume",
          content: "I supported the launch",
        },
      ]),
    ).toEqual([]);
  });
  it("gives target data stable IDs and a separate scope", () => {
    const input = {
      profile: "I build tools.\n\nI mentor developers.",
      jobDescription: "Build reliable services.",
    };
    const { sources } = buildAtomicTargetSources(input);
    expect(sources).toEqual(buildAtomicTargetSources(input).sources);
    expect(sources.map((source) => source.id)).toEqual([
      "target.profile.0",
      "target.profile.1",
      "target.jobDescription.0",
    ]);
    expect(sources.every((source) => source.scope === "target")).toBe(true);
  });
  it("drops oversized paragraphs rather than cutting off their qualifications", () => {
    expect(
      buildAtomicTargetSources({
        profile: `${"a".repeat(601)} not applicable.`,
      }).sources,
    ).toEqual([]);
  });
});
