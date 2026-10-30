import { describe, expect, it } from "vitest";
import { renderColdEmail } from "@/modules/outreach/application/render-cold-email";
import { renderLinkedinConnection } from "@/modules/outreach/application/render-linkedin-connection";
import { sanitizeYcApplicationOutput } from "@/modules/application-answer/application/sanitize-yc-application-output";
import { validateYcApplicationOutput } from "@/modules/application-answer/application/validate-yc-application-output";
import type { YcGroundingContext } from "@/modules/application-answer/domain/yc-grounding.types";

const id = "evidence:synthetic";
const fact =
  'I built robust Node.js v20.2 workflows — an AI-first prototype using --dry-run and --name="two  spaces".\n\nI tested the service with operators, reviewed the results, documented the limitations, and supported the team through release work so that changes could be evaluated against user needs and the actual behavior of the system.';
const claim = {
  text: fact,
  kind: "action" as const,
  source_id: id,
  supporting_excerpt: fact,
  sourceIds: [id],
};
const context: YcGroundingContext = {
  question: "Describe your work?",
  jobDescription: "Build Node.js services.",
  sources: [
    { id, type: "evidence", label: "Workflow", content: fact, priority: 1 },
  ],
  atomicSources: [{ id, kind: "action", scope: "candidate", content: fact }],
  excludedClaims: [],
  readiness: { ready: true, missingFields: [], recommendedFields: [] },
  metadata: {
    profileFieldCount: 0,
    confirmedEvidenceCount: 1,
    resumeSource: "none",
  },
};

describe("ALE-47 observable finalization contract", () => {
  it("keeps source-backed style and technical text intact through YC sanitation and final validation", async () => {
    const original = { body: fact, claims: [claim] };
    const before = structuredClone(original);
    const result = await sanitizeYcApplicationOutput(original);
    expect(result.output.body).toBe(fact);
    expect(result.output.claims).toEqual(original.claims);
    expect(original).toEqual(before);
    expect(
      validateYcApplicationOutput({ output: result.output, context }).body,
    ).toBe(fact);
  });
  it("rejects sensitive output rather than manufacturing a redacted claim", async () => {
    const text = "I handled incident 123-45-6789.";
    await expect(
      sanitizeYcApplicationOutput({
        body: text,
        claims: [{ ...claim, text, supporting_excerpt: text }],
      }),
    ).rejects.toThrow();
  });
  it("retains quoted command argument spaces in a complete connection note", () => {
    const text = 'I built a CLI using --name="two  spaces".';
    const result = renderLinkedinConnection({
      draft: {
        target_observation: "Hi there,",
        candidate_relevance: { text, source_ids: [id] },
        cta: "Open to connecting?",
      },
      sources: [
        { id, type: "evidence", label: "CLI", content: text, priority: 1 },
      ],
    });
    expect(result.body).toBe(`Hi there, ${text} Open to connecting?`);
  });
  it("keeps the whole email CTA and signature for the final limit gate to accept or reject", () => {
    const cta =
      "Would you be open to a brief chat about your team's priorities?";
    const result = renderColdEmail({
      draft: {
        subject_line: "Workflow",
        greeting: "there",
        target_opening: "Your workflow interests me.",
        candidate_positioning: "I build tools.",
        proof_points: [
          { text: "experience ".repeat(180).trim(), source_ids: [id] },
        ],
        value_statement: "I would like to learn more.",
        cta,
      },
      identity: {
        fullName: "Synthetic",
        linkedinUrl: "https://example.test/profile",
      },
      mode: "initial_outreach",
    });
    expect(result.body).toContain(cta);
    expect(
      result.body.endsWith("Best,\nSynthetic\nhttps://example.test/profile"),
    ).toBe(true);
    expect(result.wordCount).toBeGreaterThan(185);
  });
});
