import { describe, expect, it, vi } from "vitest";
import { CLAUDE_MODEL } from "@/modules/outreach/infrastructure/anthropic.repository";
import {
  createYcApplicationMessage,
  getYcApplicationToolInput,
  getApplicationBatchToolInput,
  YcApplicationStructuredOutputError,
  ycApplicationTool,
  applicationBatchTool,
} from "./anthropic-yc.repository";

function response(input: unknown, name = "return_yc_application_answer") {
  return {
    content: [
      {
        type: "tool_use",
        id: "tool-1",
        name,
        input,
      },
    ],
  } as never;
}

describe("getYcApplicationToolInput", () => {
  it("constructs the body from the required claim ledger", () => {
    expect(
      getYcApplicationToolInput(
        response({
          claims: [
            {
              text: "I build and operate customer-facing TypeScript services.",
              kind: "action",
              source_id: "evidence:11111111-1111-4111-8111-111111111111",
              supporting_excerpt:
                "I build and operate customer-facing TypeScript services.",
            },
          ],
        }),
      ),
    ).toEqual({
      body: "I build and operate customer-facing TypeScript services.",
      claims: [
        {
          text: "I build and operate customer-facing TypeScript services.",
          kind: "action",
          source_id: "evidence:11111111-1111-4111-8111-111111111111",
          supporting_excerpt:
            "I build and operate customer-facing TypeScript services.",
          sourceIds: ["evidence:11111111-1111-4111-8111-111111111111"],
        },
      ],
    });
  });

  it.each([2_900, 2_980])(
    "only adds the sparse fallback if the %i-character draft has room",
    (length) => {
      const quote = (excerpt: string) => `My background includes: "${excerpt}"`;
      const excerpts = Array.from(
        { length: 6 },
        (_, i) => `Team ${i} tested the${" ".repeat(430)}rollout.`,
      );
      const padding = length - excerpts.map(quote).join("\n").length;
      excerpts[0] = excerpts[0]!.replace(
        "rollout",
        `${" ".repeat(padding)}rollout`,
      );
      const claims = excerpts.map((excerpt, index) => ({
        text: quote(excerpt),
        kind: "action",
        source_id: `fact-${index}`,
        supporting_excerpt: excerpt,
      }));
      const rawBody = claims.map(({ text }) => text).join("\n");
      expect(rawBody).toHaveLength(length);
      expect(rawBody.split(/\s+/u)).toHaveLength(48);
      expect(getYcApplicationToolInput(response({ claims })).body).toBe(
        length === 2_900
          ? rawBody + "\nThank you for considering my application."
          : rawBody,
      );
    },
  );

  it("keeps a one-character boundary when common whitespace would merge claims", () => {
    const texts = ["A", "B", "A\nB", "A B", "A\tB"];
    const result = getYcApplicationToolInput(
      response({
        claims: texts.map((text, index) => ({
          text,
          kind: "action",
          source_id: `fact-${index}`,
          supporting_excerpt: text,
        })),
      }),
    );
    expect(result.body).toBe("A\u2028B\nA\nB\nA B\nA\tB");
  });

  it.each([
    ["missing tool", { content: [] }],
    ["wrong tool", response({ claims: [] }, "return_email_draft")],
    ["missing claims", response({})],
    [
      "missing source references",
      response({
        claims: [{ text: "Claim", source_ids: [] }],
      }),
    ],
    [
      "unknown fields",
      response({
        claims: [{ text: "Claim", source_ids: ["profile.current_role"] }],
        explanation: "Hidden chain of thought",
      }),
    ],
  ])("rejects %s", (_, value) => {
    expect(() => getYcApplicationToolInput(value as never)).toThrow(
      YcApplicationStructuredOutputError,
    );
  });

  it("rejects obsolete private tool fields even when both are well formed", () => {
    expect(() =>
      getYcApplicationToolInput(
        response({
          body: "A valid-looking answer body.",
          word_count: 50,
          claims: [
            {
              text: "A valid-looking answer body.",
              kind: "action",
              source_id: "evidence:fixture",
              supporting_excerpt: "A valid-looking answer body.",
            },
          ],
        }),
      ),
    ).toThrow(YcApplicationStructuredOutputError);
  });
});

describe("createYcApplicationMessage", () => {
  it("requests ordered claims without an independent body or declared count", () => {
    expect(ycApplicationTool.description).toContain("50 to 150 word");
    expect(ycApplicationTool.input_schema.properties).toEqual({
      claims: expect.objectContaining({ minItems: 1 }),
    });
    expect(ycApplicationTool.input_schema.required).toEqual(["claims"]);
    expect(
      applicationBatchTool.input_schema.properties.answers.items.required,
    ).toEqual(["questionId", "claims"]);
  });

  it("forces the structured YC tool through the shared model and timeout", async () => {
    const create = vi.fn().mockResolvedValue({ content: [] });

    await createYcApplicationMessage({
      anthropic: { messages: { create } } as never,
      systemPrompt: "system prompt",
      userPrompt: "user prompt",
    });

    expect(create).toHaveBeenCalledWith(
      {
        model: CLAUDE_MODEL,
        max_tokens: 1_000,
        temperature: 0.3,
        system: "system prompt",
        messages: [{ role: "user", content: "user prompt" }],
        tools: [ycApplicationTool],
        tool_choice: {
          type: "tool",
          name: "return_yc_application_answer",
        },
      },
      { timeout: 30_000, signal: expect.any(AbortSignal) },
    );
  });
});

describe("ALE-37 bounded batch tool", () => {
  it.each([
    [1, 2000],
    [2, 3500],
    [3, 5000],
    [4, 6500],
    [5, 8000],
  ])("sets the %i-question output ceiling", async (questionCount, ceiling) => {
    const create = vi.fn().mockResolvedValue({ content: [] });
    await createYcApplicationMessage({
      anthropic: { messages: { create } } as never,
      systemPrompt: "system",
      userPrompt: "user",
      questionCount,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: ceiling,
        tool_choice: { type: "tool", name: "return_application_answers" },
      }),
      { timeout: 30000, signal: expect.any(AbortSignal) },
    );
  });
  it.each([0, 6, 1.5, NaN])(
    "rejects an invalid batch count %s before a provider call",
    async (questionCount) => {
      const create = vi.fn();
      await expect(
        createYcApplicationMessage({
          anthropic: { messages: { create } } as never,
          systemPrompt: "system",
          userPrompt: "user",
          questionCount,
        }),
      ).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
    },
  );
});

it("bounds parser diagnostics and drops model-chosen field names, values and messages", () => {
  const tool = {
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        name: "return_application_answers",
        input: {
          answers: Array.from({ length: 5 }, () => ({
            questionId: "PRIVATE_ID",
            word_count: "PRIVATE_COUNT",
            body: 123,
            claims: [
              {
                text: 12,
                kind: "PRIVATE_KIND",
                source_id: null,
                supporting_excerpt: null,
                PRIVATE_KEY: "PRIVATE_VALUE",
              },
            ],
            PRIVATE_OBJECT_KEY: "PRIVATE_OBJECT_VALUE",
          })),
        },
      },
    ],
  };
  try {
    getApplicationBatchToolInput(tool as never);
    throw new Error("Parser accepted invalid output");
  } catch (error) {
    expect(error).toBeInstanceOf(YcApplicationStructuredOutputError);
    const invalid = error as YcApplicationStructuredOutputError;
    expect(invalid.code).toBe("YC_TOOL_SCHEMA");
    expect(invalid.validationDetails.length).toBeLessThanOrEqual(8);
    expect(invalid.validationDetails.length).toBeGreaterThan(0);
    expect(JSON.stringify(invalid)).not.toContain("PRIVATE");
    expect(invalid.message).toBe(
      "Claude returned an invalid YC application tool result",
    );
  }
});
