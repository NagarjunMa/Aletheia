import { proseFixture } from "@/__tests__/helpers/prose-fixture";
import { buildProseCompositions } from "../application/prose-compositions";
import { firstLinkedinOption } from "@/__tests__/helpers/linkedin-option";
import { describe, expect, it } from "vitest";
import { EMAIL_MODES } from "@/lib/ai/email-formatter";
import { resolveOutputConstraint } from "@/lib/ai/output-constraints";
import {
  buildColdEmailDraftTool,
  buildEmailDraftTool,
  buildLinkedinConnectionDraftTool,
  coldEmailDraftTool,
  getColdEmailDraftToolInput,
  getEmailDraftToolInput,
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
  claims: [],
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
  it("accepts only a current option at the live parser boundary, ignoring a legacy declared count", () => {
    const sources = [
      {
        id: "target.synthetic",
        scope: "target" as const,
        kind: "target_observation" as const,
        content: "The Policy team at Example is hiring Engineers!",
        rewrite: "linkedin_job_interest" as const,
      },
    ];
    const grounding = { atomicSources: sources, candidateSources: [] };
    const response = (input: unknown) =>
      ({
        content: [
          {
            type: "tool_use",
            name: "return_linkedin_connection_composition",
            input,
          },
        ],
      }) as never;
    const choice = firstLinkedinOption(sources);
    expect(
      getLinkedinConnectionDraftToolInput(
        response({ ...choice, character_count: 1 }),
        grounding,
      ).target_observation,
    ).toContain("Policy team at Example");
    for (const input of [
      { option_id: "stale" },
      { ...choice, body: "PRIVATE_CANARY" },
      {
        target_source_id: sources[0]!.id,
        candidate_source_id: null,
        cta: "Open to connecting?",
      },
    ]) {
      expect(() =>
        getLinkedinConnectionDraftToolInput(response(input), grounding),
      ).toThrow();
    }
  });
  const connection = {
    claims: [],
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
      claims: [],
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
        getLinkedinConnectionDraftToolInput(
          connectionMessage({ ...input, claims: [] }),
        ),
      ).toEqual({ ...input, claims: [] });
    },
  );
});

it("rejects max-token output even if the partial cold-email result looks complete", () => {
  expect(() =>
    getColdEmailDraftToolInput({
      ...(message(valid) as object),
      stop_reason: "max_tokens",
    } as never),
  ).toThrow();
});
it("rejects max-token output even if the partial InMail result looks complete", () => {
  expect(() =>
    getEmailDraftToolInput({
      stop_reason: "max_tokens",
      content: [
        {
          type: "tool_use",
          name: "return_email_draft",
          input: {
            subject_line: "A brief introduction",
            body: "Hello,",
            word_count: 1,
            claims: [],
          },
        },
      ],
    } as never),
  ).toThrow();
});

// Production parsers resolve only the current server-owned option; semantic parsing above is standalone compatibility coverage.
describe("current prose option parser boundary", () => {
  it.each(["cold_email", "linkedin_inmail"] as const)(
    "returns the immutable %s draft and rejects model-authored fields",
    (category) => {
      const fixture = proseFixture(category, "initial_outreach");
      const options = buildProseCompositions({
        category,
        emailMode: "initial_outreach",
        context: fixture.context,
      });
      const selected = options[0]!;
      const response = (input: unknown, stop_reason = "tool_use") =>
        ({
          stop_reason,
          content: [
            {
              type: "tool_use",
              name:
                category === "cold_email"
                  ? "return_cold_email_composition"
                  : "return_email_draft",
              input,
            },
          ],
        }) as never;
      const parse = (input: unknown) =>
        category === "cold_email"
          ? getColdEmailDraftToolInput(response(input), options)
          : getEmailDraftToolInput(response(input), options);
      const valid = parse({ option_id: selected.id });
      if (category === "cold_email") expect(valid).toBe(selected.coldDraft);
      else
        expect(valid).toEqual({
          subject_line: selected.subject,
          body: selected.body,
          word_count: selected.body.trim().split(/\s+/u).length,
          claims: selected.claims,
        });
      for (const invalid of [
        { option_id: "stale" },
        { option_id: selected.id, body: "PRIVATE_UNSUPPORTED_REWRITE" },
        { option_id: selected.id, claims: [] },
        { option_id: selected.id, character_count: 1 },
        {},
        category === "cold_email" ? fixture.coldDraft : fixture.inmailDraft,
      ])
        expect(() => parse(invalid)).toThrow();
      expect(() =>
        category === "cold_email"
          ? getColdEmailDraftToolInput(
              response({ option_id: selected.id }, "max_tokens"),
              options,
            )
          : getEmailDraftToolInput(
              response({ option_id: selected.id }, "max_tokens"),
              options,
            ),
      ).toThrow();
      expect(() =>
        category === "cold_email"
          ? getColdEmailDraftToolInput({ content: [] } as never, options)
          : getEmailDraftToolInput({ content: [] } as never, options),
      ).toThrow();
    },
  );
});

it("ALE49-R1-001 rejects obsolete count fields only for enabled plan selections", async () => {
  const { buildLinkedinCompositions } =
    await import("../domain/linkedin-grounded-selection");
  const { planSelection } =
    await import("@/modules/grounding/domain/rhetorical-plan");
  const sources = [
    {
      id: "target.profile.0",
      scope: "target" as const,
      kind: "target_observation" as const,
      content: "Engineering Manager at Example | AI Evaluation",
      rewrite: "linkedin_profile_interest" as const,
    },
  ];
  const o = buildLinkedinCompositions(sources, "networking", true)[0]!;
  const selected = {
    option_id: o.id,
    rhetorical_plan: planSelection(o.rhetoricalPlan!),
  };
  const response = (input: unknown) =>
    ({
      content: [
        {
          type: "tool_use",
          name: "return_linkedin_connection_composition",
          input,
        },
      ],
    }) as never;
  const grounding = {
    atomicSources: sources,
    candidateSources: [],
    rhetoricalPlans: true,
  };
  expect(
    getLinkedinConnectionDraftToolInput(response(selected), grounding)
      .rhetoricalPlan,
  ).toEqual(o.rhetoricalPlan);
  expect(() =>
    getLinkedinConnectionDraftToolInput(
      response({ ...selected, character_count: 1 }),
      grounding,
    ),
  ).toThrow();
  const legacy = buildLinkedinCompositions(sources, "networking", false)[0]!;
  expect(() =>
    getLinkedinConnectionDraftToolInput(
      response({ option_id: legacy.id, character_count: 1 }),
      { ...grounding, rhetoricalPlans: false },
    ),
  ).not.toThrow();
});
