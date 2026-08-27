import { describe, expect, it } from "vitest";
import {
  coldEmailDraftTool,
  getColdEmailDraftToolInput,
  getLinkedinConnectionDraftToolInput,
  linkedinConnectionDraftTool,
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

describe("LinkedIn connection Anthropic tool", () => {
  const connection = {
    target_observation: "Your developer tooling work stood out.",
    candidate_relevance: {
      text: "I built an LLM review workflow for engineers.",
      source_ids: ["evidence:1"],
    },
    cta: "Open to a brief chat?",
  };

  it("forces the bounded provenance-aware connection contract", () => {
    const connectionMessage = (input: unknown) =>
      ({
        content: [
          {
            type: "tool_use",
            name: "return_linkedin_connection_composition",
            input,
          },
        ],
      }) as never;
    expect(linkedinConnectionDraftTool.name).toBe(
      "return_linkedin_connection_composition",
    );
    expect(
      getLinkedinConnectionDraftToolInput(connectionMessage(connection)),
    ).toEqual(connection);
  });

  it("allows only an explicit null relevance for target-only fallback", () => {
    const connectionMessage = (input: unknown) =>
      ({
        content: [
          {
            type: "tool_use",
            name: "return_linkedin_connection_composition",
            input,
          },
        ],
      }) as never;
    expect(
      getLinkedinConnectionDraftToolInput(
        connectionMessage({ ...connection, candidate_relevance: null }),
      ).candidate_relevance,
    ).toBeNull();
    expect(() =>
      getLinkedinConnectionDraftToolInput(
        connectionMessage({
          ...connection,
          candidate_relevance: { text: "Unsupported", source_ids: [] },
        }),
      ),
    ).toThrow();
  });
});
