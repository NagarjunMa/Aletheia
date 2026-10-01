import { describe, expect, it } from "vitest";
import { linkedinConnectionDraftSchema } from "./outreach-draft.types";
import { connectionValidationDiagnostics } from "./linkedin-connection-diagnostics";
import { sanitizeLogFields } from "@/lib/logging-core";

describe("connection validation diagnostics", () => {
  it.each(["target_observation", "cta", "candidate_relevance.text"])(
    "reports the checked post-trim length for empty %s",
    (field) => {
      const input = {
        target_observation: field === "target_observation" ? "   " : "Work.",
        cta: field === "cta" ? "   " : "Chat?",
        candidate_relevance: {
          text: field === "candidate_relevance.text" ? "   " : "workflow",
          source_ids: ["source:1"],
        },
      };
      const result = linkedinConnectionDraftSchema.safeParse(input);
      if (result.success) throw new Error("Expected validation failure");
      expect(
        connectionValidationDiagnostics(result.error, input).validationDetails,
      ).toContainEqual({
        field,
        code: "too_small",
        actualCount: 0,
        bound: 1,
        unit: "characters",
      });
    },
  );
  it.each([
    [
      "text",
      "PRIVATE_CANARY".repeat(30),
      "candidate_relevance.text",
      420,
      300,
      "characters",
    ],
    [
      "source_ids",
      ["PRIVATE_CANARY", "PRIVATE_CANARY"],
      "candidate_relevance.source_ids",
      2,
      1,
      "items",
    ],
    [
      "source_ids",
      ["PRIVATE_CANARY".repeat(10)],
      "candidate_relevance.source_ids.item",
      140,
      120,
      "characters",
    ],
  ])(
    "distinguishes %s failures without exposing raw values",
    (key, value, field, actualCount, bound, unit) => {
      const input = {
        target_observation: "Work stood out.",
        candidate_relevance: {
          text: "workflow",
          source_ids: ["source:1"],
          [key]: value,
        },
        cta: "Chat?",
        PRIVATE_KEY_CANARY: "PRIVATE_CANARY",
      };
      const result = linkedinConnectionDraftSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected validation failure");
      const diagnostics = connectionValidationDiagnostics(result.error, input);
      const logged = sanitizeLogFields(diagnostics);
      expect(logged.validationDetails).toEqual(
        expect.arrayContaining([
          { field, code: "too_big", actualCount, bound, unit },
        ]),
      );
      expect(JSON.stringify(logged)).not.toContain("CANARY");
      expect(logged.validationDetails).toEqual(diagnostics.validationDetails);
      expect(JSON.stringify(logged).length).toBeLessThan(2000);
    },
  );

  it("bounds diagnostic output for many invalid source IDs", () => {
    const input = {
      target_observation: "Work.",
      candidate_relevance: {
        text: "workflow",
        source_ids: Array(100).fill("PRIVATE_CANARY".repeat(10)),
      },
      cta: "Chat?",
    };
    const result = linkedinConnectionDraftSchema.safeParse(input);
    if (result.success) throw new Error("Expected validation failure");
    const diagnostic = connectionValidationDiagnostics(result.error, input);
    expect(diagnostic.validationDetails).toHaveLength(8);
    expect(JSON.stringify(diagnostic)).not.toContain("CANARY");
    expect(JSON.stringify(diagnostic).length).toBeLessThan(2000);
  });
});
