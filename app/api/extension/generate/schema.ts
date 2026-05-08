import { z } from "zod";

export const generateRequestSchema = z.object({
  profileMarkdown: z.string().trim().min(10).max(10000),
  profileUrl: z.string().url().max(2048),
  resume: z.string().max(50000).nullish().default(""),
  jd: z.string().max(20000).nullish().default(""),
  category: z.enum(["linkedin_connection", "cold_email", "linkedin_inmail"]),
  intent: z
    .enum(["networking", "referral", "mentorship", "job_inquiry"])
    .nullish()
    .default("networking"),
  acceptedExamples: z.array(z.string().max(5000)).max(5).nullish().default([]),
});
