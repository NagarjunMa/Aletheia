import {
  qualityMetadataSchema,
  QUALITY_REASONS,
} from "@/lib/ai/generation-quality";
import {
  OUTREACH_GROUNDING_LEVELS,
  OUTREACH_FALLBACK_REASONS,
} from "@/modules/outreach/domain/outreach-grounding.types";
import { z } from "zod";
import { EMAIL_MODES } from "@/lib/ai/email-formatter";

const legacyEvalMetadataSchema = z
  .object({
    generationId: z.string().uuid().optional(),
    quality: qualityMetadataSchema.optional(),
    grounding: z
      .object({
        groundingLevel: z.enum(OUTREACH_GROUNDING_LEVELS),
        fallbackReason: z.enum(OUTREACH_FALLBACK_REASONS),
        selectedSourceCount: z.number().int().min(0).max(64),
        selectedEvidenceCount: z.number().int().min(0).max(64),
        selectedSourceKinds: z
          .array(z.enum(["evidence", "profile", "resume"]))
          .max(3),
        injectionSafeMode: z.boolean(),
      })
      .strict()
      .optional(),
    hasCandidateRelevance: z.boolean().optional(),
    identityIncluded: z.boolean().optional(),
    promptVersion: z.string().max(20),
    model: z.string().max(50),
    temperature: z.number(),
    category: z.enum(["linkedin_connection", "cold_email", "linkedin_inmail"]),
    intent: z.string().max(50),
    emailMode: z.enum(EMAIL_MODES).optional(),
    generationTimeMs: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    resumeSource: z
      .enum(["user_resumes", "profiles", "legacy_payload", "none"])
      .optional(),
    hasPrimaryResume: z.boolean().optional(),
    injectionTriggered: z.boolean().optional(),
    safeCandidateSummaryUsed: z.boolean().optional(),
  })
  .strict();

const ycApplicationEvalMetadataSchema = z
  .object({
    generationId: z.string().uuid(),
    quality: qualityMetadataSchema.optional(),
    promptVersion: z.string().max(100),
    model: z.string().max(200),
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

export const evalMetadataSchema = z.discriminatedUnion("category", [
  legacyEvalMetadataSchema,
  ycApplicationEvalMetadataSchema,
]);

const legacyFeedbackSchema = z
  .object({
    message: z.string().min(1).max(10000),
    approved: z.boolean(),
    category: z.enum([
      "linkedin_connection",
      "cold_email",
      "linkedin_inmail",
      "yc_application",
    ]),
    subjectLine: z.string().max(160).optional(),
    rejectionReason: z.enum(QUALITY_REASONS).optional(),
    evalMetadata: evalMetadataSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.evalMetadata && value.evalMetadata.category !== value.category) {
      context.addIssue({
        code: "custom",
        path: ["evalMetadata", "category"],
        message: "Eval metadata category must match feedback category",
      });
    }
  });

export const qualityFeedbackSchema = z
  .object({
    format: z.literal("quality_summary"),
    category: z.enum([
      "linkedin_connection",
      "cold_email",
      "linkedin_inmail",
      "yc_application",
    ]),
    generationId: z.string().uuid(),
    approved: z.boolean(),
    qualityReason: z.enum(QUALITY_REASONS).optional(),
    evalMetadata: evalMetadataSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.approved && value.qualityReason)
      context.addIssue({
        code: "custom",
        message: "Approval must not contain a rejection reason",
      });
    if (
      value.evalMetadata &&
      (value.evalMetadata.category !== value.category ||
        value.evalMetadata.generationId !== value.generationId)
    )
      context.addIssue({
        code: "custom",
        message: "Generation identifiers and category must match",
      });
  });

export const applicationFeedbackSchema = z
  .object({
    format: z.literal("application_summary"),
    category: z.literal("yc_application"),
    approved: z.boolean(),
    generationId: z.string().uuid(),
    issueCategory: z
      .enum([
        "unsupported_claim",
        "missed_question",
        "wrong_tone",
        "too_generic",
        "formatting",
        "other",
      ])
      .optional(),
    summary: z.string().trim().min(1).max(500).optional(),
    evalMetadata: ycApplicationEvalMetadataSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.approved && (!value.issueCategory || !value.summary)) {
      context.addIssue({
        code: "custom",
        message: "Describe the reported issue",
      });
    }
    if (value.approved && (value.issueCategory || value.summary)) {
      context.addIssue({
        code: "custom",
        message: "Approval must not contain an issue report",
      });
    }
    if (
      value.evalMetadata &&
      value.evalMetadata.generationId !== value.generationId
    ) {
      context.addIssue({
        code: "custom",
        message: "Generation identifiers must match",
      });
    }
  });

// Explicit routing prevents malformed new reports falling back to legacy field stripping.
export const feedbackSchema = z.unknown().transform((value, context) => {
  const schema =
    value && typeof value === "object" && "format" in value
      ? "format" in value && value.format === "quality_summary"
        ? qualityFeedbackSchema
        : applicationFeedbackSchema
      : legacyFeedbackSchema;
  const result = schema.safeParse(value);
  if (!result.success) {
    for (const issue of result.error.issues) context.addIssue({ ...issue });
    return z.NEVER;
  }
  return result.data;
});
