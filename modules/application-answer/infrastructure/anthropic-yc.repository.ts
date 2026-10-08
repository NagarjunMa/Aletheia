import {
  atomicClaimsSchema,
  atomicClaimsToolSchema,
  type AtomicClaim,
} from "@/modules/grounding/domain/atomic-claim";
import Anthropic from "@anthropic-ai/sdk";
import { observeAnthropicAttempts } from "@/lib/provider-attempt-timing";
import { z } from "zod";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import { CLAUDE_MODEL } from "@/modules/outreach/infrastructure/anthropic.repository";
import {
  APPLICATION_ANSWER_MAX_WORDS,
  APPLICATION_ANSWER_MIN_WORDS,
} from "@/lib/ai/output-constraints";

export const YC_GENERATION_SETTINGS = {
  temperature: 0.3,
  maxOutputUnits: 1000,
} as const;
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
        description: `The final ${APPLICATION_ANSWER_MIN_WORDS} to ${APPLICATION_ANSWER_MAX_WORDS} word application answer.`,
      },
      word_count: {
        type: "integer",
        minimum: APPLICATION_ANSWER_MIN_WORDS,
        maximum: APPLICATION_ANSWER_MAX_WORDS,
        description:
          "Declared body word count. The server recalculates and validates the final body independently.",
      },
      claims: { ...atomicClaimsToolSchema, minItems: 1 },
    },
    required: ["body", "word_count", "claims"],
  },
} as const;

const ycApplicationToolInputSchema = z
  .object({
    body: z.string().trim().min(1).max(3_000),
    word_count: z
      .number()
      .int()
      .min(APPLICATION_ANSWER_MIN_WORDS)
      .max(APPLICATION_ANSWER_MAX_WORDS),
    claims: atomicClaimsSchema.refine(
      (claims) => claims.length > 0,
      "Claims required",
    ),
  })
  .strict();

// Separate tool contracts keep the installed single-question clients unchanged.
export const applicationBatchTool = {
  name: "return_application_answers",
  description:
    "Return one grounded answer and claim ledger for every supplied question ID.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answers: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          ...ycApplicationTool.input_schema,
          properties: {
            questionId: {
              type: "string",
              enum: ["q1", "q2", "q3", "q4", "q5"],
            },
            ...ycApplicationTool.input_schema.properties,
          },
          required: ["questionId", "body", "word_count", "claims"],
        },
      },
    },
    required: ["answers"],
  },
} as const;

/** Initial engineering budget includes answer text, evidence ledger and JSON.
 * Calibrate against complete valid batches; it is not a latency guarantee. */
export function getApplicationOutputBudget(questionCount?: number): number {
  if (questionCount === undefined) return YC_GENERATION_SETTINGS.maxOutputUnits;
  if (
    !Number.isInteger(questionCount) ||
    questionCount < 1 ||
    questionCount > 5
  ) {
    throw new RangeError("Invalid application question count");
  }
  return Math.min(8_000, 500 + questionCount * 1_500);
}

export function getApplicationBatchToolInput(
  response: Anthropic.Messages.Message,
) {
  try {
    if (response.stop_reason !== "tool_use")
      throw new YcApplicationStructuredOutputError();
    const blocks = response.content.filter(
      (block) => block.type === "tool_use",
    );
    const block = blocks[0];
    if (
      blocks.length !== 1 ||
      !block ||
      block.type !== "tool_use" ||
      block.name !== applicationBatchTool.name
    ) {
      throw new YcApplicationStructuredOutputError();
    }
    const parsed = z
      .object({
        answers: z
          .array(
            ycApplicationToolInputSchema.extend({
              questionId: z.string().regex(/^q[1-5]$/u),
            }),
          )
          .min(1)
          .max(5),
      })
      .strict()
      .parse(block.input);
    return parsed.answers.map((answer) => ({
      questionId: answer.questionId,
      body: answer.body,
      claims: answer.claims.map((claim) => ({
        ...claim,
        sourceIds: [claim.source_id],
      })),
    }));
  } catch {
    throw new YcApplicationStructuredOutputError();
  }
}

export type YcApplicationToolOutput = {
  body: string;
  claims: Array<
    { text: string; sourceIds: string[] } & Partial<Omit<AtomicClaim, "text">>
  >;
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
        ...claim,
        sourceIds: [claim.source_id],
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
  questionCount?: number;
}) {
  return input.anthropic.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: getApplicationOutputBudget(input.questionCount),
      temperature: YC_GENERATION_SETTINGS.temperature,
      system: input.systemPrompt,
      messages: [{ role: "user", content: input.userPrompt }],
      tools: [
        input.questionCount === undefined
          ? ycApplicationTool
          : applicationBatchTool,
      ],
      tool_choice: {
        type: "tool",
        name:
          input.questionCount === undefined
            ? YC_APPLICATION_TOOL_NAME
            : applicationBatchTool.name,
      },
    },
    { timeout: 30_000 },
  );
}

/** Creates the SDK client lazily so builds and non-generation requests do not
 * require an Anthropic key. */
export async function createYcApplicationDraft(input: {
  systemPrompt: string;
  userPrompt: string;
  questionCount?: number;
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
    const client = new Anthropic({ apiKey });
    observeAnthropicAttempts(client, input.logger ?? log);
    const response = await createYcApplicationMessage({
      anthropic: client,
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
