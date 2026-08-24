import { describe, expect, it } from "vitest";
import {
  coldEmailDraftTool,
  getColdEmailDraftToolInput,
} from "./anthropic.repository";

const message = (input: unknown) =>
  ({
    content: [
      { type: "tool_use", name: "return_cold_email_composition", input },
    ],
  }) as never;

const valid = {
  subject_line: "AI engineering interest",
  greeting: "Megan",
  target_opening: "Your product stood out.",
  candidate_positioning: "I build practical systems.",
  proof_points: [
    { text: "Built an LLM review workflow.", source_ids: ["evidence:1"] },
  ],
  value_statement: "That maps well to the team.",
  cta: "Open to a brief chat?",
};

describe("cold email Anthropic tool", () => {
  it("forces the strict semantic composition contract", () => {
    expect(coldEmailDraftTool.name).toBe("return_cold_email_composition");
    expect(getColdEmailDraftToolInput(message(valid))).toEqual(valid);
  });

  it("rejects missing, unknown, and unsupported proof-reference fields", () => {
    expect(() =>
      getColdEmailDraftToolInput(message({ ...valid, body: "opaque body" })),
    ).toThrow();
    expect(() =>
      getColdEmailDraftToolInput(
        message({
          ...valid,
          proof_points: [{ text: "Proof", source_ids: [] }],
        }),
      ),
    ).toThrow();
  });
});
