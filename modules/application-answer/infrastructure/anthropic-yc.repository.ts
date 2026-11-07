import { renderYcAnswer } from "../domain/render-yc-answer";
import type { YcPlannedOptions } from "../application/yc-rhetorical-options";
import { buildYcPlannedTool } from "./yc-planned-tool";
import {
  atomicClaimsSchema,
  atomicClaimsToolSchema,
  type AtomicClaim,
} from "@/modules/grounding/domain/atomic-claim";
import Anthropic from "@anthropic-ai/sdk";
import { GENERATION_MODEL_TIMEOUT_MS } from "@/modules/outreach/domain/generation-admission";
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
  description: `Return complete approved claims in answer order. Aim for ${APPLICATION_ANSWER_MIN_WORDS} to ${APPLICATION_ANSWER_MAX_WORDS} words of approved claims.`,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      claims: { ...atomicClaimsToolSchema, minItems: 1 },
    },
    required: ["claims"],
  },
} as const;

const ycApplicationToolInputSchema = z
  .object({
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
    "Return one ordered list of complete approved claims for every supplied question ID.",
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
          required: ["questionId", "claims"],
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
      throw new YcApplicationStructuredOutputError(
        response.stop_reason === "max_tokens"
          ? "YC_TOOL_TRUNCATED"
          : "YC_TOOL_ENVELOPE",
      );
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
      throw new YcApplicationStructuredOutputError("YC_TOOL_ENVELOPE");
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
    return parsed.answers.map(({ questionId, claims }) => ({
      questionId,
      ...renderToolAnswer(claims),
    }));
  } catch (error) {
    if (error instanceof YcApplicationStructuredOutputError) throw error;
    throw new YcApplicationStructuredOutputError(
      "YC_TOOL_SCHEMA",
      error instanceof z.ZodError ? toolValidationDetails(error) : [],
    );
  }
}

export type YcApplicationToolOutput = {
  body: string;
  claims: Array<
    { text: string; sourceIds: string[] } & Partial<Omit<AtomicClaim, "text">>
  >;
};

function renderToolAnswer(claims: AtomicClaim[]): YcApplicationToolOutput {
  return {
    body: renderYcAnswer(claims),
    claims: claims.map((claim) => ({
      ...claim,
      sourceIds: [claim.source_id],
    })),
  };
}

export type YcToolValidationCode =
  "YC_TOOL_SCHEMA" | "YC_TOOL_ENVELOPE" | "YC_TOOL_TRUNCATED" | "YC_BATCH_IDS";

type ToolValidationDetail = { field: string; code: string; itemIndex?: number };

function toolValidationDetails(error: z.ZodError): ToolValidationDetail[] {
  return error.issues.slice(0, 8).map((issue) => {
    let path = [...issue.path];
    let prefix = "";
    let itemIndex: number | undefined;
    if (path[0] === "answers" && typeof path[1] === "number") {
      prefix = "answers.item.";
      if (path[1] >= 0 && path[1] < 5) itemIndex = path[1] + 1;
      path = path.slice(2);
    }
    let field = "tool";
    if (path.length === 1 && ["questionId", "claims"].includes(String(path[0])))
      field = prefix + String(path[0]);
    if (
      path[0] === "claims" &&
      typeof path[1] === "number" &&
      path.length === 3 &&
      ["text", "kind", "source_id", "supporting_excerpt"].includes(
        String(path[2]),
      )
    )
      field = prefix + "claims.item." + String(path[2]);
    return {
      field,
      code: issue.code,
      ...(itemIndex === undefined ? {} : { itemIndex }),
    };
  });
}

export class YcApplicationStructuredOutputError extends Error {
  readonly code: YcToolValidationCode;
  readonly validationDetails: ToolValidationDetail[];
  constructor(
    code: YcToolValidationCode = "YC_TOOL_SCHEMA",
    validationDetails: ToolValidationDetail[] = [],
  ) {
    super("Claude returned an invalid YC application tool result");
    this.code = code;
    this.validationDetails = validationDetails;
    this.name = "YcApplicationStructuredOutputError";
  }
}

export function getYcApplicationToolInput(
  response: Anthropic.Messages.Message,
): YcApplicationToolOutput {
  try {
    if (response.stop_reason === "max_tokens")
      throw new YcApplicationStructuredOutputError("YC_TOOL_TRUNCATED");
    const toolBlock = response.content.find(
      (block) =>
        block.type === "tool_use" &&
        block.name === YC_APPLICATION_TOOL_NAME &&
        typeof block.input === "object" &&
        block.input !== null,
    );

    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new YcApplicationStructuredOutputError("YC_TOOL_ENVELOPE");
    }

    const parsed = ycApplicationToolInputSchema.parse(toolBlock.input);
    return renderToolAnswer(parsed.claims);
  } catch (error) {
    if (error instanceof YcApplicationStructuredOutputError) throw error;
    throw new YcApplicationStructuredOutputError(
      "YC_TOOL_SCHEMA",
      error instanceof z.ZodError ? toolValidationDetails(error) : [],
    );
  }
}

export async function createYcApplicationMessage(input: {
  anthropic: Pick<Anthropic, "messages">;
  systemPrompt: string;
  userPrompt: string;
  questionCount?: number;
  plannedOptions?: YcPlannedOptions;
}) {
  const signal = AbortSignal.timeout(GENERATION_MODEL_TIMEOUT_MS);
  try {
    return await input.anthropic.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: getApplicationOutputBudget(input.questionCount),
        temperature: YC_GENERATION_SETTINGS.temperature,
        system: input.systemPrompt,
        messages: [{ role: "user", content: input.userPrompt }],
        tools: [
          input.plannedOptions
            ? buildYcPlannedTool(
                input.plannedOptions,
                input.questionCount !== undefined,
              )
            : input.questionCount === undefined
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
      { timeout: GENERATION_MODEL_TIMEOUT_MS, signal },
    );
  } catch (error) {
    throw signal.aborted ? new Anthropic.APIConnectionTimeoutError() : error;
  }
}

/** Creates the SDK client lazily so builds and non-generation requests do not
 * require an Anthropic key. */
export async function createYcApplicationDraft(input: {
  systemPrompt: string;
  userPrompt: string;
  questionCount?: number;
  plannedOptions?: YcPlannedOptions;
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
    // Hidden SDK retries would bypass the server-owned attempt budget.
    const client = new Anthropic({ apiKey, maxRetries: 0 });
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
