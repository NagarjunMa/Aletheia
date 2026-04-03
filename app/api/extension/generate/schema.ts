import { z } from 'zod'

export const generateRequestSchema = z.object({
  profile: z.object({
    name: z.string(),
    headline: z.string().nullish(),
    location: z.string().nullish(),
    about: z.string().nullish(),
    experiences: z.array(z.object({
      title: z.string(),
      company: z.string().nullish()
    })).nullish(),
    recentPosts: z.array(z.string()).nullish(),
    skills: z.array(z.string()).nullish(),
    profileUrl: z.string().url()
  }),
  resume: z.string().nullish().default(''),
  jd: z.string().nullish().default(''),
  category: z.enum(['linkedin_connection', 'cold_email', 'linkedin_inmail']),
  intent: z.enum(['networking', 'referral', 'mentorship', 'job_inquiry']).nullish().default('networking'),
  acceptedExamples: z.array(z.string()).nullish().default([])
})
