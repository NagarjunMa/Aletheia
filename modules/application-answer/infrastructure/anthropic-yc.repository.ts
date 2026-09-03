import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import { CLAUDE_MODEL } from "@/modules/outreach/infrastructure/anthropic.repository";

const YC_APPLICATION_TOOL_NAME = "return_yc_application_answer";
const log = createLogger("yc-anthropic-repository");

export const ycApplicationTool = {
  name: YC_APPLICATION_TOOL_NAME,
  description:
    "Return a grounded YC startup application answer and a server-validated claim ledger.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      body: {
        type: "string",
        minLength: 1,
        maxLength: 3_000,
        description: "The final 50 to 150 word application answer.",
      },
      claims: {
        type: "array",
        minItems: 1,
        maxItems: 30,
        description:
          "Substantive candidate claims copied verbatim from body with supporting source IDs.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
              minLength: 1,
              maxLength: 1_000,
            },
            source_ids: {
              type: "array",
              minItems: 1,
              maxItems: 10,
              uniqueItems: true,
              items: { type: "string", minLength: 1, maxLength: 200 },
            },
          },
          required: ["text", "source_ids"],
        },
      },
    },
    required: ["body", "claims"],
  },
} as const;

const ycApplicationToolInputSchema = z
  .object({
    body: z.string().trim().min(1).max(3_000),
    claims: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(1_000),
            source_ids: z
              .array(z.string().trim().min(1).max(200))
              .min(1)
              .max(10)
              .refine(
                (sourceIds) => new Set(sourceIds).size === sourceIds.length,
                {
                  message: "source_ids must be unique",
                },
              ),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

export type YcApplicationToolOutput = {
  body: string;
  claims: Array<{ text: string; sourceIds: string[] }>;
};

export class YcApplicationStructuredOutputError extends Error {
  constructor() {
    super("Claude returned an invalid YC application tool result");
    this.name = "YcApplicationStructuredOutputError";
  }
}

export function getYcApplicationToolInput(
  response: Anthropic.Messages.Message,
): YcApplicationToolOutput {
  try {
    const toolBlock = response.content.find(
      (block) =>
        block.type === "tool_use" &&
        block.name === YC_APPLICATION_TOOL_NAME &&
        typeof block.input === "object" &&
        block.input !== null,
    );

    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new YcApplicationStructuredOutputError();
    }

    const parsed = ycApplicationToolInputSchema.parse(toolBlock.input);
    return {
      body: parsed.body,
      claims: parsed.claims.map((claim) => ({
        text: claim.text,
        sourceIds: claim.source_ids,
      })),
    };
  } catch {
    throw new YcApplicationStructuredOutputError();
  }
}

export async function createYcApplicationMessage(input: {
  anthropic: Pick<Anthropic, "messages">;
  systemPrompt: string;
  userPrompt: string;
}) {
  return input.anthropic.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: 1_000,
      temperature: 0.3,
      system: input.systemPrompt,
      messages: [{ role: "user", content: input.userPrompt }],
      tools: [ycApplicationTool],
      tool_choice: { type: "tool", name: YC_APPLICATION_TOOL_NAME },
    },
    { timeout: 30_000 },
  );
}

/** Creates the SDK client lazily so builds and non-generation requests do not
 * require an Anthropic key. */
export async function createYcApplicationDraft(input: {
  systemPrompt: string;
  userPrompt: string;
  logger?: SafeLogger;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const complete = startTimedStage(
    input.logger ?? log,
    "model.yc_application_generate",
    { model: CLAUDE_MODEL },
  );
  try {
    const response = await createYcApplicationMessage({
      anthropic: new Anthropic({ apiKey }),
      ...input,
    });
    complete("success", {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    return response;
  } catch (error) {
    complete("failure", { errorCode: "MODEL_REQUEST_FAILED" });
    throw error;
  }
}
