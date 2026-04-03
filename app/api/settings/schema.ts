import { z } from 'zod'

export const settingsSchema = z.object({
  formality_level: z.enum(['casual', 'neutral', 'formal']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  share_analytics: z.boolean().optional(),
  reset_style: z.boolean().optional(),
})
