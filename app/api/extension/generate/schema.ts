import { z } from "zod";
import { EMAIL_MODES } from "@/lib/ai/email-formatter";
import {
  APPLICATION_ANSWER_MAX_WORDS,
  APPLICATION_ANSWER_MIN_WORDS,
} from "@/lib/ai/output-constraints";

const legacyGenerateRequestFields = {
  profileMarkdown: z.string().trim().min(10).max(10000),
  resume: z.string().max(50000).nullish().default(""),
  jd: z.string().max(20000).nullish().default(""),
  conversationContext: z.string().max(12000).nullish().default(""),
  intent: z
    .enum(["networking", "referral", "mentorship", "job_inquiry"])
    .nullish()
    .default("networking"),
  emailMode: z
    .enum(EMAIL_MODES)
    .nullish()
    .transform((value) => value ?? "initial_outreach"),
  acceptedExamples: z.array(z.string().max(5000)).max(5).nullish().default([]),
};

const legacyCategories = [
  "linkedin_connection",
  "cold_email",
  "linkedin_inmail",
] as const;

/**
 * Active production request parser. Keep this legacy-only until the YC
 * generation service and billing lifecycle are implemented together.
 */
export const generateRequestSchema = z.object({
  ...legacyGenerateRequestFields,
  category: z.enum(legacyCategories),
});

export const DEFAULT_YC_APPLICATION_QUESTION =
  "Why are you a strong candidate for this role?";
export const YC_APPLICATION_JOB_DESCRIPTION_MIN_CHARS = 80;
export const YC_APPLICATION_JOB_DESCRIPTION_MAX_CHARS = 20_000;
export const YC_APPLICATION_QUESTION_MIN_CHARS = 10;
export const YC_APPLICATION_QUESTION_MAX_CHARS = 1_000;
export const YC_APPLICATION_MIN_WORDS = APPLICATION_ANSWER_MIN_WORDS;
export const YC_APPLICATION_MAX_WORDS = APPLICATION_ANSWER_MAX_WORDS;

function normalizeYcInput(value: string): string {
  return value.normalize("NFKC").replace(/\r\n?/gu, "\n").trim();
}

function normalizedBoundedString(minimum: number, maximum: number) {
  return z
    .string()
    .transform(normalizeYcInput)
    .pipe(z.string().min(minimum).max(maximum));
}

const legacyYcApplicationRequestSchema = z
  .object({
    category: z.literal("yc_application"),
    jd: normalizedBoundedString(
      YC_APPLICATION_JOB_DESCRIPTION_MIN_CHARS,
      YC_APPLICATION_JOB_DESCRIPTION_MAX_CHARS,
    ),
    question: normalizedBoundedString(
      YC_APPLICATION_QUESTION_MIN_CHARS,
      YC_APPLICATION_QUESTION_MAX_CHARS,
    )
      .optional()
      .default(DEFAULT_YC_APPLICATION_QUESTION),
  })
  .strict();

const canonicalYcApplicationRequestSchema = z
  .object({
    category: z.literal("yc_application"),
    jd: normalizedBoundedString(80, 20_000),
    questions: z
      .array(
        normalizedBoundedString(10, 500).refine(
          (value) => !value.includes("\n"),
          "Use one line per question",
        ),
      )
      .min(1)
      .max(5),
  })
  .strict();

// Dispatch before validation so canonical errors retain their question index.
// Invalid batches must never fall back to the more permissive legacy contract.
export const ycApplicationRequestSchema = z
  .unknown()
  .transform((value, context) => {
    const schema =
      value !== null && typeof value === "object" && "questions" in value
        ? canonicalYcApplicationRequestSchema
        : legacyYcApplicationRequestSchema;
    const result = schema.safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) context.addIssue(issue);
      return z.NEVER;
    }
    return result.data;
  });

export function formatApplicationAnswers(
  answers: Array<{ question: string; body: string }>,
): string {
  if (answers.length === 1 && answers[0]) return answers[0].body;
  return answers
    .map(
      ({ question, body }) =>
        `**${question.replace(/([\\`*_{}[\]()<>#+.!|~-])/gu, "\\$1")}**\n${body}`,
    )
    .join("\n\n");
}

const applicationAnswerSchema = z
  .object({
    questionId: z.string().regex(/^q[1-5]$/u),
    question: normalizedBoundedString(10, 1000),
    body: z.string().trim().min(1).max(3000),
    word_count: z.number().int().min(50).max(150),
    character_count: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((answer, context) => {
    if (
      countWords(answer.body) !== answer.word_count ||
      answer.body.length !== answer.character_count
    ) {
      context.addIssue({
        code: "custom",
        message: "Answer counts must match body",
      });
    }
  });

const linkedinConnectionRequestContractSchema = z.object({
  ...legacyGenerateRequestFields,
  category: z.literal("linkedin_connection"),
});
const coldEmailRequestContractSchema = z.object({
  ...legacyGenerateRequestFields,
  category: z.literal("cold_email"),
});
const linkedInInmailRequestContractSchema = z.object({
  ...legacyGenerateRequestFields,
  category: z.literal("linkedin_inmail"),
});

/** Combined compatibility contract; the route dispatches by category first. */
export const generateRequestContractSchema = z.union([
  linkedinConnectionRequestContractSchema,
  coldEmailRequestContractSchema,
  linkedInInmailRequestContractSchema,
  ycApplicationRequestSchema,
]);

const ycApplicationEvalMetadataSchema = z
  .object({
    generationId: z.string().uuid(),
    promptVersion: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(200),
    category: z.literal("yc_application"),
    generationTimeMs: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    profileFieldCount: z.number().int().nonnegative(),
    confirmedEvidenceCount: z.number().int().nonnegative(),
    resumeSource: z.enum(["user_resumes", "profiles", "none"]),
    injectionTriggered: z.boolean(),
    groundingValidationPassed: z.literal(true),
  })
  .strict();

function countWords(value: string): number {
  const normalized = value.trim();
  return normalized.length === 0 ? 0 : normalized.split(/\s+/u).length;
}

export const ycApplicationPublicSuccessSchema = z
  .object({
    success: z.literal(true),
    category: z.literal("yc_application"),
    body: z.string().trim().min(1).max(22_000),
    answers: z.array(applicationAnswerSchema).min(1).max(5).optional(),
    word_count: z.number().int().min(YC_APPLICATION_MIN_WORDS).max(22_000),
    character_count: z.number().int().nonnegative(),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      })
      .strict(),
    processingTime: z.number().int().nonnegative(),
    evalMetadata: ycApplicationEvalMetadataSchema,
    billingMode: z.enum(["credits", "unlimited_developer"]),
    creditCost: z.number().int().nonnegative(),
    creditsRemaining: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.answers) {
      if (
        value.answers.some(
          (answer, index) => answer.questionId !== `q${index + 1}`,
        ) ||
        value.body !== formatApplicationAnswers(value.answers)
      ) {
        context.addIssue({
          code: "custom",
          path: ["answers"],
          message: "Answers must be ordered and match body",
        });
      }
    } else if (
      value.word_count > YC_APPLICATION_MAX_WORDS ||
      value.body.length > 3000
    ) {
      context.addIssue({
        code: "custom",
        path: ["body"],
        message: "Legacy answer exceeds bounds",
      });
    }
    if (value.word_count !== countWords(value.body)) {
      context.addIssue({
        code: "custom",
        path: ["word_count"],
        message: "word_count must match body",
      });
    }

    if (value.character_count !== value.body.length) {
      context.addIssue({
        code: "custom",
        path: ["character_count"],
        message: "character_count must match body",
      });
    }

    const expectedCost = value.billingMode === "credits" ? 4 : 0;
    if (value.creditCost !== expectedCost) {
      context.addIssue({
        code: "custom",
        path: ["creditCost"],
        message: `creditCost must be ${expectedCost} for ${value.billingMode}`,
      });
    }
  });

const ycApplicationProvenanceSchema = z
  .object({
    generationId: z.string().uuid(),
    selectedSourceIds: z
      .array(z.string().trim().min(1).max(200))
      .min(1)
      .max(40),
    claims: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(1_000),
            sourceIds: z
              .array(z.string().trim().min(1).max(200))
              .min(1)
              .max(10),
          })
          .strict(),
      )
      .max(150),
    excludedClaimCount: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, context) => {
    const selectedSourceIds = new Set(value.selectedSourceIds);
    if (selectedSourceIds.size !== value.selectedSourceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["selectedSourceIds"],
        message: "selectedSourceIds must be unique",
      });
    }

    value.claims.forEach((claim, claimIndex) => {
      claim.sourceIds.forEach((sourceId, sourceIndex) => {
        if (!selectedSourceIds.has(sourceId)) {
          context.addIssue({
            code: "custom",
            path: ["claims", claimIndex, "sourceIds", sourceIndex],
            message: "claim source must be present in selectedSourceIds",
          });
        }
      });
    });
  });

export const ycApplicationGenerationResultSchema = z
  .object({
    response: ycApplicationPublicSuccessSchema,
    provenance: ycApplicationProvenanceSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.response.evalMetadata.generationId !== value.provenance.generationId
    ) {
      context.addIssue({
        code: "custom",
        path: ["provenance", "generationId"],
        message: "provenance generationId must match response metadata",
      });
    }
  });

export const YC_APPLICATION_ERROR_CONTRACTS = {
  INVALID_REQUEST: { status: 400, billing: "none" },
  INVALID_EXTENSION_VERSION: { status: 400, billing: "none" },
  UNAUTHORIZED: { status: 401, billing: "none" },
  INSUFFICIENT_CREDITS: { status: 402, billing: "none" },
  GROUNDING_PROFILE_INCOMPLETE: { status: 422, billing: "none" },
  API_VERSION_UNSUPPORTED: { status: 426, billing: "none" },
  EXTENSION_UPDATE_REQUIRED: { status: 426, billing: "none" },
  DAILY_LIMIT_REACHED: { status: 429, billing: "none" },
  YC_OUTPUT_INVALID: { status: 502, billing: "refunded" },
  MODEL_UPSTREAM_ERROR: { status: 502, billing: "refunded" },
  MODEL_TIMEOUT: { status: 504, billing: "refunded" },
} as const;

export const ycApplicationReadinessFailureSchema = z
  .object({
    success: z.literal(false),
    error: z.literal("Candidate profile incomplete"),
    code: z.literal("GROUNDING_PROFILE_INCOMPLETE"),
    message: z.string().trim().min(1).max(500),
    missingFields: z.array(z.string().trim().min(1).max(100)).max(20),
    recommendedFields: z.array(z.string().trim().min(1).max(100)).max(20),
    applicationProfileUrl: z.string().url().max(2_048),
    billing: z.literal("none"),
  })
  .strict();

export type GenerateRequestContract = z.infer<
  typeof generateRequestContractSchema
>;
export type YcApplicationRequest = z.infer<typeof ycApplicationRequestSchema>;
export type YcApplicationPublicSuccess = z.infer<
  typeof ycApplicationPublicSuccessSchema
>;
export type YcApplicationGenerationResult = z.infer<
  typeof ycApplicationGenerationResultSchema
>;
export type YcApplicationReadinessFailure = z.infer<
  typeof ycApplicationReadinessFailureSchema
>;
