import { describe, expect, it } from "vitest";
import { EMAIL_MODES } from "@/lib/ai/email-formatter";
import { resolveOutputConstraint } from "@/lib/ai/output-constraints";
import {
  buildColdEmailDraftTool,
  buildEmailDraftTool,
  buildLinkedinConnectionDraftTool,
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
    character_count: 118,
  };
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

  it("forces the bounded provenance-aware connection contract", () => {
    expect(linkedinConnectionDraftTool.name).toBe(
      "return_linkedin_connection_composition",
    );
    expect(
      getLinkedinConnectionDraftToolInput(connectionMessage(connection)),
    ).toEqual({
      target_observation: connection.target_observation,
      candidate_relevance: connection.candidate_relevance,
      cta: connection.cta,
    });
  });

  it("ignores only a legacy character count", () => {
    const { character_count: _count, ...withoutCount } = connection;
    for (const input of [
      withoutCount,
      { ...connection, character_count: 1 },
      { ...connection, character_count: 245 },
      { ...connection, character_count: 231 },
      { ...connection, character_count: "not-a-count" },
    ]) {
      expect(
        getLinkedinConnectionDraftToolInput(connectionMessage(input)),
      ).toEqual(withoutCount);
    }
    expect(() =>
      getLinkedinConnectionDraftToolInput(
        connectionMessage({ ...withoutCount, body: "unexpected" }),
      ),
    ).toThrow();
  });

  it("shares the final budget across raw sections without fixed allocations", () => {
    const tool = buildLinkedinConnectionDraftTool();
    expect(tool.input_schema.properties.target_observation.maxLength).toBe(300);
    expect(
      tool.input_schema.properties.candidate_relevance.anyOf[1].properties.text
        .maxLength,
    ).toBe(300);
    expect(tool.input_schema.properties.cta.maxLength).toBe(300);
    expect(tool.input_schema.properties).not.toHaveProperty("character_count");
    expect(tool.input_schema.required).not.toContain("character_count");
  });

  it("builds the email tool from the requested mode policy", () => {
    const followUp = buildEmailDraftTool("linkedin_inmail", "follow_up");
    const initial = buildEmailDraftTool("linkedin_inmail", "initial_outreach");
    expect(followUp.input_schema.properties.word_count).toMatchObject({
      minimum: 30,
      maximum: 90,
    });
    expect(initial.input_schema.properties.word_count).toMatchObject({
      minimum: 80,
      maximum: 120,
    });
  });

  it.each(EMAIL_MODES)(
    "publishes the %s InMail word policy in its completed-response schema",
    (emailMode) => {
      const constraint = resolveOutputConstraint({
        category: "linkedin_inmail",
        emailMode,
      });
      expect(
        buildEmailDraftTool("linkedin_inmail", emailMode).input_schema
          .properties.word_count,
      ).toMatchObject({
        minimum: constraint.minimum,
        maximum: constraint.maximum,
      });
    },
  );

  it.each(EMAIL_MODES)(
    "publishes the %s cold-email word policy in the composition tool",
    (emailMode) => {
      const constraint = resolveOutputConstraint({
        category: "cold_email",
        emailMode,
      });
      expect(buildColdEmailDraftTool(emailMode).description).toContain(
        `${constraint.minimum}-${constraint.maximum} words`,
      );
    },
  );

  it("allows only an explicit null relevance for target-only fallback", () => {
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

  it.each([
    { target_observation: undefined },
    { target_observation: " " },
    { cta: 42 },
    { cta: " " },
    { cta: "x".repeat(301) },
    { cta: ` ${"x".repeat(300)} ` },
    { candidate_relevance: undefined },
    { candidate_relevance: { text: "workflow", source_ids: [] } },
    { candidate_relevance: { text: "workflow", source_ids: ["a", "b"] } },
    {
      candidate_relevance: { text: "workflow", source_ids: ["x".repeat(121)] },
    },
    { candidate_relevance: { text: "x".repeat(301), source_ids: ["a"] } },
    {
      candidate_relevance: {
        text: "workflow",
        source_ids: ["a"],
        extra: "unexpected",
      },
    },
  ])("retains bounded strict structure for malformed input", (override) => {
    expect(() =>
      getLinkedinConnectionDraftToolInput(
        connectionMessage({ ...connection, ...override }),
      ),
    ).toThrow();
  });

  it("rejects over-budget components and malformed compositions", () => {
    expect(() =>
      getLinkedinConnectionDraftToolInput(
        connectionMessage({
          ...connection,
          target_observation: "x".repeat(301),
        }),
      ),
    ).toThrow();
    expect(() =>
      getLinkedinConnectionDraftToolInput(
        connectionMessage({ ...connection, cta: undefined }),
      ),
    ).toThrow();
  });

  it.each([
    {
      target_observation: "x".repeat(97),
      candidate_relevance: null,
      cta: "Open to a brief chat?",
    },
    {
      target_observation: "Work stood out.",
      candidate_relevance: null,
      cta: "c".repeat(100),
    },
    {
      target_observation: "Work stood out.",
      candidate_relevance: {
        text: "workflow ".repeat(15).trim(),
        source_ids: ["evidence:1"],
      },
      cta: "Chat?",
    },
  ])(
    "accepts bounded compositions exceeding former section limits",
    (input) => {
      expect(
        getLinkedinConnectionDraftToolInput(connectionMessage(input)),
      ).toEqual(input);
    },
  );
});
