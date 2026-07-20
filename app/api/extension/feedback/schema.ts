import { z } from "zod";
import { EMAIL_MODES } from "@/lib/ai/email-formatter";

export const evalMetadataSchema = z
  .object({
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

export const feedbackSchema = z.object({
  message: z.string().min(1).max(10000),
  approved: z.boolean(),
  category: z.enum(["linkedin_connection", "cold_email", "linkedin_inmail"]),
  subjectLine: z.string().optional(),
  rejectionReason: z
    .enum(["too_formal", "too_generic", "wrong_tone"])
    .optional(),
  evalMetadata: evalMetadataSchema.optional(),
});
