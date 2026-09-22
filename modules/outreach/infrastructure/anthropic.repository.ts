import Anthropic from "@anthropic-ai/sdk";
import { observeAnthropicAttempts } from "@/lib/provider-attempt-timing";
import { z } from "zod";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import {
  resolveOutputConstraint,
  type OutputConstraint,
} from "@/lib/ai/output-constraints";
import type { EmailMode } from "@/lib/ai/email-formatter";
import {
  coldEmailDraftSchema,
  type ColdEmailDraft,
  LINKEDIN_CONNECTION_COMPONENT_MAX_CHARACTERS,
  linkedinConnectionDraftSchema,
  type LinkedinConnectionDraft,
} from "../domain/outreach-draft.types";

export const CLAUDE_MODEL = "claude-sonnet-4-6";
export const OUTREACH_GENERATION_SETTINGS = {
  temperature: 0.8,
  maxOutputUnits: 600,
} as const;
const log = createLogger("outreach-anthropic-repository");

const EMAIL_DRAFT_TOOL_NAME = "return_email_draft";
const COLD_EMAIL_DRAFT_TOOL_NAME = "return_cold_email_composition";
const LINKEDIN_CONNECTION_DRAFT_TOOL_NAME =
  "return_linkedin_connection_composition";

function describeConstraint(constraint: OutputConstraint): string {
  return `${constraint.minimum}-${constraint.maximum} ${constraint.unit}`;
}

export function buildEmailDraftTool(
  category: "linkedin_inmail",
  emailMode: EmailMode,
) {
  const constraint = resolveOutputConstraint({ category, emailMode });
  return {
    name: EMAIL_DRAFT_TOOL_NAME,
    description: `Return the final ${category} draft as structured fields. The body must contain ${describeConstraint(constraint)} for ${emailMode}. Preserve intentional paragraph breaks.`,
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
            "Declared body word count. The server recalculates the final count after sanitization and remains authoritative.",
          minimum: constraint.minimum,
          maximum: constraint.maximum,
        },
      },
      required: ["subject_line", "body", "word_count"],
    },
  } as const;
}

export const emailDraftTool = buildEmailDraftTool(
  "linkedin_inmail",
  "initial_outreach",
);

export function buildColdEmailDraftTool(emailMode: EmailMode) {
  const constraint = resolveOutputConstraint({
    category: "cold_email",
    emailMode,
  });
  return {
    name: COLD_EMAIL_DRAFT_TOOL_NAME,
    description: `Return semantic cold-email sections and source IDs for every candidate proof. The server-rendered final body uses a ${describeConstraint(constraint)} limit for ${emailMode}. Do not provide a final signature.`,
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
}

export const coldEmailDraftTool = buildColdEmailDraftTool("initial_outreach");

export function buildLinkedinConnectionDraftTool() {
  const constraint = resolveOutputConstraint({
    category: "linkedin_connection",
  });
  return {
    name: LINKEDIN_CONNECTION_DRAFT_TOOL_NAME,
    description: `Return a LinkedIn connection-note composition that renders to at most ${constraint.maximum} ${constraint.unit}. Use candidate_relevance only when directly supported by one selected candidate source; otherwise return null.`,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        target_observation: {
          type: "string",
          minLength: 1,
          maxLength:
            LINKEDIN_CONNECTION_COMPONENT_MAX_CHARACTERS.targetObservation,
        },
        candidate_relevance: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                text: {
                  type: "string",
                  minLength: 1,
                  maxLength:
                    LINKEDIN_CONNECTION_COMPONENT_MAX_CHARACTERS.candidateRelevance,
                },
                source_ids: {
                  type: "array",
                  minItems: 1,
                  maxItems: 1,
                  items: { type: "string", minLength: 1, maxLength: 120 },
                },
              },
              required: ["text", "source_ids"],
            },
          ],
        },
        cta: {
          type: "string",
          minLength: 1,
          maxLength: LINKEDIN_CONNECTION_COMPONENT_MAX_CHARACTERS.cta,
        },
        character_count: {
          type: "integer",
          description:
            "Declared character count for the rendered note, including spaces between sections. The server recalculates and validates it.",
          minimum: constraint.minimum,
          maximum: constraint.maximum,
        },
      },
      required: [
        "target_observation",
        "candidate_relevance",
        "cta",
        "character_count",
      ],
    },
  } as const;
}

export const linkedinConnectionDraftTool = buildLinkedinConnectionDraftTool();

const emailDraftToolInputSchema = z
  .object({
    subject_line: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(5000),
    word_count: z.number().int().min(1).max(250),
  })
  .strict();

function getAnthropic(logger: SafeLogger) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  const client = new Anthropic({ apiKey });
  observeAnthropicAttempts(client, logger);
  return client;
}

export async function createOutreachDraftMessage(input: {
  systemPrompt: string;
  userPrompt: string;
  category: "linkedin_connection" | "cold_email" | "linkedin_inmail";
  emailMode: EmailMode;
  logger?: SafeLogger;
}) {
  const stageLogger = input.logger ?? log;
  const complete = startTimedStage(stageLogger, "model.outreach_generate", {
    model: CLAUDE_MODEL,
  });
  const tool =
    input.category === "cold_email"
      ? buildColdEmailDraftTool(input.emailMode)
      : input.category === "linkedin_connection"
        ? buildLinkedinConnectionDraftTool()
        : buildEmailDraftTool("linkedin_inmail", input.emailMode);
  const toolName = tool.name;
  try {
    const client = getAnthropic(stageLogger);
    const response = await client.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: OUTREACH_GENERATION_SETTINGS.maxOutputUnits,
        temperature: OUTREACH_GENERATION_SETTINGS.temperature,
        system: input.systemPrompt,
        messages: [{ role: "user", content: input.userPrompt }],
        tools: [tool],
        tool_choice: {
          type: "tool" as const,
          name: toolName,
        },
      },
      { timeout: 30_000 },
    );
    complete("success", {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    return response;
  } catch (error) {
    complete("failure", {
      errorCode: isAnthropicTimeoutError(error)
        ? "MODEL_TIMEOUT"
        : "MODEL_REQUEST_FAILED",
    });
    throw error;
  }
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

export function getLinkedinConnectionDraftToolInput(
  response: Anthropic.Messages.Message,
): LinkedinConnectionDraft {
  const toolBlock = response.content.find(
    (block) =>
      block.type === "tool_use" &&
      block.name === LINKEDIN_CONNECTION_DRAFT_TOOL_NAME &&
      typeof block.input === "object" &&
      block.input !== null,
  );
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(
      "Claude did not return the required LinkedIn connection composition tool",
    );
  }
  return linkedinConnectionDraftSchema.parse(toolBlock.input);
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

export function isAnthropicAbortError(error: unknown) {
  return (
    typeof Anthropic.APIUserAbortError === "function" &&
    error instanceof Anthropic.APIUserAbortError
  );
}

export function getAnthropicApiErrorStatus(error: unknown): number | null {
  return error instanceof Anthropic.APIError ? (error.status ?? null) : null;
}
