import { describe, expect, it, vi } from "vitest";
import { CLAUDE_MODEL } from "@/modules/outreach/infrastructure/anthropic.repository";
import {
  createYcApplicationMessage,
  getYcApplicationToolInput,
  YcApplicationStructuredOutputError,
  ycApplicationTool,
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
  it("parses the required structured body and claim ledger", () => {
    expect(
      getYcApplicationToolInput(
        response({
          body: "I build and operate customer-facing TypeScript services.",
          word_count: 50,
          claims: [
            {
              text: "I build and operate customer-facing TypeScript services.",
              source_ids: ["evidence:11111111-1111-4111-8111-111111111111"],
            },
          ],
        }),
      ),
    ).toEqual({
      body: "I build and operate customer-facing TypeScript services.",
      claims: [
        {
          text: "I build and operate customer-facing TypeScript services.",
          sourceIds: ["evidence:11111111-1111-4111-8111-111111111111"],
        },
      ],
    });
  });

  it.each([
    ["missing tool", { content: [] }],
    [
      "wrong tool",
      response({ body: "Body", claims: [] }, "return_email_draft"),
    ],
    ["missing claims", response({ body: "Body" })],
    [
      "missing source references",
      response({
        body: "Body",
        word_count: 50,
        claims: [{ text: "Claim", source_ids: [] }],
      }),
    ],
    [
      "unknown fields",
      response({
        body: "Body",
        word_count: 50,
        claims: [{ text: "Claim", source_ids: ["profile.current_role"] }],
        explanation: "Hidden chain of thought",
      }),
    ],
  ])("rejects %s", (_, value) => {
    expect(() => getYcApplicationToolInput(value as never)).toThrow(
      YcApplicationStructuredOutputError,
    );
  });

  it.each([49, 151])("rejects declared word count %i", (wordCount) => {
    expect(() =>
      getYcApplicationToolInput(
        response({
          body: "A valid-looking answer body.",
          word_count: wordCount,
          claims: [
            {
              text: "A valid-looking answer body.",
              source_ids: ["profile.current_role"],
            },
          ],
        }),
      ),
    ).toThrow(YcApplicationStructuredOutputError);
  });
});

describe("createYcApplicationMessage", () => {
  it("publishes the application word constraint in the tool schema", () => {
    expect(ycApplicationTool.input_schema.properties.word_count).toMatchObject({
      minimum: 50,
      maximum: 150,
    });
    expect(ycApplicationTool.input_schema.required).toContain("word_count");
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
      { timeout: 30_000 },
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
      { timeout: 30000 },
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
