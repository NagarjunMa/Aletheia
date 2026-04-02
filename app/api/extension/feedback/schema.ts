import { z } from 'zod'

export const feedbackSchema = z.object({
  message: z.string().min(1).max(10000),
  approved: z.boolean(),
  category: z.enum(['linkedin_connection', 'cold_email', 'linkedin_inmail']),
  subjectLine: z.string().optional(),
  rejectionReason: z.enum(['too_formal', 'too_generic', 'wrong_tone']).optional(),
})
