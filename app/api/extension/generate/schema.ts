import { z } from "zod";

export const generateRequestSchema = z.object({
  profileMarkdown: z.string().min(10).max(10000),
  profileUrl: z.string().url(),
  resume: z.string().nullish().default(""),
  jd: z.string().nullish().default(""),
  category: z.enum(["linkedin_connection", "cold_email", "linkedin_inmail"]),
  intent: z
    .enum(["networking", "referral", "mentorship", "job_inquiry"])
    .nullish()
    .default("networking"),
  acceptedExamples: z.array(z.string()).nullish().default([]),
});
