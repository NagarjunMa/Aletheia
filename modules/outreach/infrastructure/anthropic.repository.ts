import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  coldEmailDraftSchema,
  type ColdEmailDraft,
} from "../domain/outreach-draft.types";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

const EMAIL_DRAFT_TOOL_NAME = "return_email_draft";
const COLD_EMAIL_DRAFT_TOOL_NAME = "return_cold_email_composition";

export const emailDraftTool = {
  name: EMAIL_DRAFT_TOOL_NAME,
  description:
    "Return the final outreach draft as structured fields. Use the body field for the complete message text with paragraph breaks preserved.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      subject_line: {
        type: "string",
        description:
          "The final subject line. Must follow the approved subject templates from the system instructions.",
        minLength: 1,
        maxLength: 160,
      },
      body: {
        type: "string",
        description:
          "The final email or InMail body. Preserve intentional paragraph breaks and proof-point lines.",
        minLength: 1,
        maxLength: 5000,
      },
      word_count: {
        type: "integer",
        description:
          "Approximate word count for the body. The server recalculates the final count after sanitization.",
        minimum: 1,
        maximum: 250,
      },
    },
    required: ["subject_line", "body", "word_count"],
  },
} as const;

export const coldEmailDraftTool = {
  name: COLD_EMAIL_DRAFT_TOOL_NAME,
  description:
    "Return semantic cold-email sections and source IDs for every candidate proof. Do not provide a final signature.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      subject_line: { type: "string", minLength: 1, maxLength: 160 },
      greeting: { type: "string", minLength: 1, maxLength: 80 },
      target_opening: { type: "string", minLength: 1, maxLength: 500 },
      candidate_positioning: { type: "string", minLength: 1, maxLength: 500 },
      proof_points: {
        type: "array",
        maxItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string", minLength: 1, maxLength: 420 },
            source_ids: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string", minLength: 1, maxLength: 120 },
            },
          },
          required: ["text", "source_ids"],
        },
      },
      value_statement: { type: "string", minLength: 1, maxLength: 500 },
      cta: { type: "string", minLength: 1, maxLength: 300 },
    },
    required: [
      "subject_line",
      "greeting",
      "target_opening",
      "candidate_positioning",
      "proof_points",
      "value_statement",
      "cta",
    ],
  },
} as const;

const emailDraftToolInputSchema = z
  .object({
    subject_line: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(5000),
    word_count: z.number().int().min(1).max(250),
  })
  .strict();

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey });
}

export async function createOutreachDraftMessage(input: {
  systemPrompt: string;
  userPrompt: string;
  useEmailDraftTool: boolean;
  useStructuredColdEmailTool?: boolean;
}) {
  return getAnthropic().messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: 600,
      temperature: 0.8,
      system: input.systemPrompt,
      messages: [{ role: "user", content: input.userPrompt }],
      ...(input.useEmailDraftTool
        ? {
            tools: [
              input.useStructuredColdEmailTool
                ? coldEmailDraftTool
                : emailDraftTool,
            ],
            tool_choice: {
              type: "tool" as const,
              name: input.useStructuredColdEmailTool
                ? COLD_EMAIL_DRAFT_TOOL_NAME
                : EMAIL_DRAFT_TOOL_NAME,
            },
          }
        : {}),
    },
    { timeout: 30_000 },
  );
}

export function getColdEmailDraftToolInput(
  response: Anthropic.Messages.Message,
): ColdEmailDraft {
  const toolBlock = response.content.find(
    (block) =>
      block.type === "tool_use" &&
      block.name === COLD_EMAIL_DRAFT_TOOL_NAME &&
      typeof block.input === "object" &&
      block.input !== null,
  );
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(
      "Claude did not return the required cold email composition tool",
    );
  }
  return coldEmailDraftSchema.parse(toolBlock.input);
}

export function getEmailDraftToolInput(response: Anthropic.Messages.Message) {
  const toolBlock = response.content.find(
    (block) =>
      block.type === "tool_use" &&
      block.name === EMAIL_DRAFT_TOOL_NAME &&
      typeof block.input === "object" &&
      block.input !== null,
  );

  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Claude did not return the required email draft tool");
  }

  return emailDraftToolInputSchema.parse(toolBlock.input);
}

export function isAnthropicTimeoutError(error: unknown) {
  return error instanceof Anthropic.APIConnectionTimeoutError;
}

export function getAnthropicApiErrorStatus(error: unknown): number | null {
  return error instanceof Anthropic.APIError ? (error.status ?? null) : null;
}
