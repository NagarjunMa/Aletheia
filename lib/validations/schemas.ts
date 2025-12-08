// Zod Validation Schemas for Ascendia
// Created: December 7, 2024
// Purpose: Comprehensive validation schemas for all application data

import { z } from 'zod'

// =============================================================================
// USER PROFILE SCHEMAS
// =============================================================================

export const profileUpdateSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  avatar_url: z.string().url('Invalid URL').optional().nullable(),
  preferences: z.record(z.any()).optional(),
})

export const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.string().default('en'),
  notifications: z.boolean().default(true),
  auto_save: z.boolean().default(true),
  default_category: z.string().default('general'),
  writing_style: z.enum(['formal', 'casual', 'academic', 'creative']).default('casual'),
  cpl_target: z.number().min(1).max(100).default(75),
  ai_suggestions: z.boolean().default(true),
  privacy_mode: z.boolean().default(false),
})

// =============================================================================
// CONVERSATION SCHEMAS
// =============================================================================

export const createConversationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  category: z.string().min(1, 'Category is required').max(50, 'Category too long'),
  initial_input: z.string().min(1, 'Initial input is required').max(10000, 'Input too long'),
  context_notes: z.string().max(1000, 'Context notes too long').optional(),
})

export const updateConversationSchema = z.object({
  id: z.string().uuid('Invalid conversation ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  category: z.string().min(1, 'Category is required').max(50, 'Category too long').optional(),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
  context_notes: z.string().max(1000, 'Context notes too long').optional(),
})

// =============================================================================
// USER INPUT SCHEMAS
// =============================================================================

export const userInputSchema = z.object({
  conversation_id: z.string().uuid('Invalid conversation ID'),
  input_text: z.string().min(1, 'Input text is required').max(10000, 'Input too long'),
  input_type: z.enum(['text', 'voice', 'file']).default('text'),
  context_data: z.record(z.any()).optional(),
  processing_preferences: z.object({
    grammar_only: z.boolean().default(false),
    preserve_style: z.boolean().default(true),
    target_cpl: z.number().min(1).max(100).optional(),
    tone_adjustment: z.enum(['none', 'formal', 'casual', 'professional']).default('none'),
    length_preference: z.enum(['maintain', 'expand', 'condense']).default('maintain'),
  }).optional(),
})

export const bulkInputSchema = z.object({
  conversation_id: z.string().uuid('Invalid conversation ID'),
  inputs: z.array(z.object({
    input_text: z.string().min(1, 'Input text is required').max(10000, 'Input too long'),
    input_type: z.enum(['text', 'voice', 'file']).default('text'),
    context_data: z.record(z.any()).optional(),
  })).min(1, 'At least one input is required').max(10, 'Too many inputs at once'),
})

// =============================================================================
// DRAFT GENERATION SCHEMAS
// =============================================================================

export const generateDraftSchema = z.object({
  input_id: z.string().uuid('Invalid input ID'),
  draft_type: z.enum(['grammar_fix', 'adaptive_polish']).default('adaptive_polish'),
  processing_options: z.object({
    preserve_tone: z.boolean().default(true),
    preserve_length: z.boolean().default(true),
    target_audience: z.string().max(100, 'Target audience too long').optional(),
    style_guide: z.string().max(500, 'Style guide too long').optional(),
    custom_instructions: z.string().max(500, 'Instructions too long').optional(),
  }).optional(),
})

export const draftFeedbackSchema = z.object({
  draft_id: z.string().uuid('Invalid draft ID'),
  rating: z.number().min(1).max(5),
  feedback_text: z.string().max(1000, 'Feedback too long').optional(),
  improvement_areas: z.array(z.enum([
    'grammar',
    'clarity',
    'tone',
    'style',
    'length',
    'accuracy',
    'flow'
  ])).optional(),
  would_use_again: z.boolean().default(true),
})

// =============================================================================
// AI PROCESSING SCHEMAS
// =============================================================================

export const aiProcessingSchema = z.object({
  text: z.string().min(1, 'Text is required').max(10000, 'Text too long'),
  processing_type: z.enum(['grammar_fix', 'adaptive_polish', 'cpl_analysis']),
  user_preferences: z.object({
    writing_style: z.enum(['formal', 'casual', 'academic', 'creative']).optional(),
    target_cpl: z.number().min(1).max(100).optional(),
    preserve_tone: z.boolean().default(true),
    preserve_length: z.boolean().default(true),
  }).optional(),
  context: z.object({
    conversation_id: z.string().uuid().optional(),
    previous_drafts: z.array(z.string()).optional(),
    user_feedback: z.string().optional(),
  }).optional(),
})

export const cplAnalysisSchema = z.object({
  text: z.string().min(1, 'Text is required').max(10000, 'Text too long'),
  analysis_type: z.enum(['quick', 'detailed']).default('quick'),
  compare_to_user_baseline: z.boolean().default(true),
})

// =============================================================================
// SEARCH AND FILTERING SCHEMAS
// =============================================================================

export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(200, 'Query too long'),
  filters: z.object({
    category: z.string().optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    cpl_min: z.number().min(1).max(100).optional(),
    cpl_max: z.number().min(1).max(100).optional(),
    draft_type: z.enum(['grammar_fix', 'adaptive_polish']).optional(),
    rating_min: z.number().min(1).max(5).optional(),
  }).optional(),
  sort: z.object({
    field: z.enum(['created_at', 'updated_at', 'cpl_score', 'rating']).default('updated_at'),
    direction: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
  pagination: z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
  }).optional(),
})

// =============================================================================
// FILE UPLOAD SCHEMAS
// =============================================================================

export const fileUploadSchema = z.object({
  file_name: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  file_type: z.string().min(1, 'File type is required'),
  file_size: z.number().min(1).max(10 * 1024 * 1024), // 10MB max
  content: z.string().min(1, 'File content is required'),
})

export const batchFileUploadSchema = z.object({
  files: z.array(fileUploadSchema).min(1, 'At least one file is required').max(5, 'Too many files'),
  conversation_id: z.string().uuid('Invalid conversation ID').optional(),
})

// =============================================================================
// ANALYTICS AND FEEDBACK SCHEMAS
// =============================================================================

export const analyticsEventSchema = z.object({
  event_type: z.enum([
    'page_view',
    'user_action',
    'feature_usage',
    'error_encountered',
    'performance_metric'
  ]),
  event_name: z.string().min(1, 'Event name is required').max(100, 'Event name too long'),
  properties: z.record(z.any()).optional(),
  user_id: z.string().uuid().optional(),
  session_id: z.string().optional(),
  timestamp: z.string().datetime().optional(),
})

export const userFeedbackSchema = z.object({
  feedback_type: z.enum(['bug_report', 'feature_request', 'general_feedback', 'user_experience']),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(10, 'Please provide more details').max(2000, 'Description too long'),
  category: z.string().max(50, 'Category too long').optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  attachments: z.array(z.string().url()).optional(),
  contact_email: z.string().email('Invalid email').optional(),
})

// =============================================================================
// API RESPONSE SCHEMAS
// =============================================================================

export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  metadata: z.object({
    timestamp: z.string().datetime(),
    request_id: z.string(),
    processing_time_ms: z.number().optional(),
  }).optional(),
})

// =============================================================================
// PAGINATION AND SORTING SCHEMAS
// =============================================================================

export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  total: z.number().min(0).optional(),
  total_pages: z.number().min(0).optional(),
})

export const sortingSchema = z.object({
  field: z.string().min(1, 'Sort field is required'),
  direction: z.enum(['asc', 'desc']).default('desc'),
})

// =============================================================================
// EXPORT SCHEMAS
// =============================================================================

export const exportDataSchema = z.object({
  data_types: z.array(z.enum([
    'conversations',
    'user_inputs',
    'generated_drafts',
    'user_feedback',
    'analytics'
  ])).min(1, 'At least one data type is required'),
  date_range: z.object({
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
  }).optional(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
  include_metadata: z.boolean().default(true),
})

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Helper function to validate UUID
export const uuidSchema = z.string().uuid('Invalid UUID format')

// Helper function to validate text content
export const textContentSchema = (minLength = 1, maxLength = 1000) =>
  z.string().min(minLength, `Text must be at least ${minLength} characters`)
    .max(maxLength, `Text must not exceed ${maxLength} characters`)

// Helper function to validate email
export const emailSchema = z.string().email('Invalid email address')

// Helper function to validate URLs
export const urlSchema = z.string().url('Invalid URL format')

// Helper function to validate dates
export const dateSchema = z.string().datetime('Invalid date format')

// Common error messages
export const ERROR_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_UUID: 'Invalid ID format',
  TEXT_TOO_SHORT: 'Text is too short',
  TEXT_TOO_LONG: 'Text is too long',
  INVALID_URL: 'Please enter a valid URL',
  INVALID_DATE: 'Please enter a valid date',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  SERVER_ERROR: 'An internal server error occurred',
} as const

// Type exports for use in components
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>
export type UserPreferences = z.infer<typeof preferencesSchema>
export type CreateConversation = z.infer<typeof createConversationSchema>
export type UpdateConversation = z.infer<typeof updateConversationSchema>
export type UserInput = z.infer<typeof userInputSchema>
export type GenerateDraft = z.infer<typeof generateDraftSchema>
export type DraftFeedback = z.infer<typeof draftFeedbackSchema>
export type AIProcessing = z.infer<typeof aiProcessingSchema>
export type Search = z.infer<typeof searchSchema>
export type FileUpload = z.infer<typeof fileUploadSchema>
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>
export type UserFeedback = z.infer<typeof userFeedbackSchema>
export type ApiResponse = z.infer<typeof apiResponseSchema>
export type ExportData = z.infer<typeof exportDataSchema>