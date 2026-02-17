import { z } from 'zod'
import { INPUT_LIMITS } from '@/lib/security/input-sanitizer'

// Chat message schema
export const chatMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(INPUT_LIMITS.CHAT_MESSAGE, `Message must be under ${INPUT_LIMITS.CHAT_MESSAGE} characters`),
  conversationId: z.string().uuid('Invalid conversation ID'),
  useWebSearch: z.boolean().optional()
})

// User input schema
export const userInputSchema = z.object({
  raw_text: z.string()
    .min(1, 'Input is required')
    .max(INPUT_LIMITS.USER_INPUT, `Input must be under ${INPUT_LIMITS.USER_INPUT} characters`),
  conversation_id: z.string().uuid('Invalid conversation ID'),
  category: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational']).optional()
})

// Resume schema
export const resumeSchema = z.object({
  content: z.string()
    .min(100, 'Resume seems too short (minimum 100 characters)')
    .max(INPUT_LIMITS.RESUME, `Resume must be under ${INPUT_LIMITS.RESUME} characters`)
})

// Job description schema
export const jobDescriptionSchema = z.object({
  content: z.string()
    .min(50, 'Job description seems too short (minimum 50 characters)')
    .max(INPUT_LIMITS.JOB_DESCRIPTION, `Job description must be under ${INPUT_LIMITS.JOB_DESCRIPTION} characters`)
})

// Profile data schema (for Chrome extension)
export const profileDataSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be under 100 characters'),
  headline: z.string()
    .max(INPUT_LIMITS.PROFILE_DATA, `Headline must be under ${INPUT_LIMITS.PROFILE_DATA} characters`)
    .optional(),
  location: z.string()
    .max(200, 'Location must be under 200 characters')
    .optional(),
  about: z.string()
    .max(INPUT_LIMITS.PROFILE_DATA, `About section must be under ${INPUT_LIMITS.PROFILE_DATA} characters`)
    .optional(),
  experiences: z.array(z.object({
    title: z.string().max(200, 'Job title too long'),
    company: z.string().max(200, 'Company name too long').optional()
  })).optional(),
  recentPosts: z.array(z.string().max(500, 'Post content too long')).optional(),
  skills: z.array(z.string().max(100, 'Skill name too long')).optional(),
  profileUrl: z.string().url('Invalid profile URL')
})

// Draft generation schema
export const draftGenerationSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(INPUT_LIMITS.USER_INPUT, `Prompt must be under ${INPUT_LIMITS.USER_INPUT} characters`),
  category: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational']),
  conversation_id: z.string().uuid('Invalid conversation ID')
})

// Extension generate schema (updated with proper limits)
export const extensionGenerateSchema = z.object({
  profile: profileDataSchema,
  resume: z.string()
    .max(INPUT_LIMITS.RESUME, `Resume must be under ${INPUT_LIMITS.RESUME} characters`)
    .optional()
    .default(''),
  jd: z.string()
    .max(INPUT_LIMITS.JOB_DESCRIPTION, `Job description must be under ${INPUT_LIMITS.JOB_DESCRIPTION} characters`)
    .optional()
    .default(''),
  category: z.enum(['linkedin_connection', 'cold_email', 'linkedin_inmail']),
  intent: z.enum(['networking', 'referral', 'mentorship', 'job_inquiry'])
    .optional()
    .default('networking'),
  acceptedExamples: z.array(z.string().max(1000, 'Example too long'))
    .optional()
    .default([])
})

// Feedback schema
export const feedbackSchema = z.object({
  draft_id: z.string().uuid('Invalid draft ID'),
  is_accepted: z.boolean(),
  user_feedback: z.string()
    .max(INPUT_LIMITS.CHAT_MESSAGE, `Feedback must be under ${INPUT_LIMITS.CHAT_MESSAGE} characters`)
    .optional(),
  user_edits: z.string()
    .max(INPUT_LIMITS.USER_INPUT, `Edits must be under ${INPUT_LIMITS.USER_INPUT} characters`)
    .optional()
})

// Conversation schema
export const conversationSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be under 200 characters'),
  category: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational'])
    .default('conversational')
})

// Type exports for TypeScript usage
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type UserInput = z.infer<typeof userInputSchema>
export type Resume = z.infer<typeof resumeSchema>
export type JobDescription = z.infer<typeof jobDescriptionSchema>
export type ProfileData = z.infer<typeof profileDataSchema>
export type DraftGeneration = z.infer<typeof draftGenerationSchema>
export type ExtensionGenerate = z.infer<typeof extensionGenerateSchema>
export type Feedback = z.infer<typeof feedbackSchema>
export type Conversation = z.infer<typeof conversationSchema>