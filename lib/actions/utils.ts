// Server Actions Utilities
// Created: December 7, 2024
// Purpose: Helper functions and utilities for server actions

import { z } from 'zod'
import type { Database } from '@/lib/database/types'
import { ERROR_MESSAGES } from '@/lib/validations/schemas'

// Common response types
export interface ServerActionResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  metadata?: {
    timestamp: string
    request_id?: string
    processing_time_ms?: number
  }
}

// Response builder function
export function createResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  message?: string
): ServerActionResponse<T> {
  return {
    success,
    data,
    error,
    message,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  }
}

// Success response helper
export function successResponse<T>(data?: T, message?: string): ServerActionResponse<T> {
  return createResponse(true, data, undefined, message)
}

// Error response helper
export function errorResponse(error: string): ServerActionResponse {
  return createResponse(false, undefined, error)
}

// Validation error response helper
export function validationErrorResponse(validationResult: z.SafeParseError<any>): ServerActionResponse {
  const firstError = validationResult.error.issues[0]
  return errorResponse(firstError.message)
}

// Handle form data parsing with validation
export function parseFormData<T>(
  formData: FormData,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const rawData: any = {}

    // Convert FormData to object
    for (const [key, value] of formData.entries()) {
      if (key.endsWith('[]')) {
        // Handle array fields
        const arrayKey = key.slice(0, -2)
        if (!rawData[arrayKey]) {
          rawData[arrayKey] = []
        }
        rawData[arrayKey].push(value)
      } else if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        // Try to parse JSON fields
        try {
          rawData[key] = JSON.parse(value)
        } catch {
          rawData[key] = value
        }
      } else {
        rawData[key] = value
      }
    }

    const result = schema.safeParse(rawData)
    if (!result.success) {
      return { success: false, error: result.error.issues[0].message }
    }

    return { success: true, data: result.data }
  } catch (error) {
    return { success: false, error: 'Invalid form data' }
  }
}

// Handle JSON parsing with validation
export function parseJSON<T>(
  jsonString: string,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(jsonString)
    const result = schema.safeParse(parsed)

    if (!result.success) {
      return { success: false, error: result.error.issues[0].message }
    }

    return { success: true, data: result.data }
  } catch (error) {
    return { success: false, error: 'Invalid JSON format' }
  }
}

// Database error handler
export function handleDatabaseError(error: any): string {
  // PostgreSQL error codes
  switch (error.code) {
    case '23505': // unique_violation
      return 'A record with this information already exists'
    case '23503': // foreign_key_violation
      return 'Referenced record not found'
    case '23502': // not_null_violation
      return 'Required field is missing'
    case '42501': // insufficient_privilege
      return 'Insufficient permissions'
    default:
      console.error('Database error:', error)
      return 'A database error occurred'
  }
}

// Rate limiting check (placeholder for actual rate limiting implementation)
export async function checkRateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  // This would integrate with a rate limiting service like Upstash or Redis
  // For now, just return allowed
  return { allowed: true, remaining: limit - 1 }
}

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Basic XSS protection
    .slice(0, 10000) // Limit length
}

// File validation
export function validateFile(
  file: File,
  maxSize: number = 10 * 1024 * 1024, // 10MB
  allowedTypes: string[] = ['text/plain', 'application/json', 'text/csv']
): { valid: true } | { valid: false; error: string } {
  if (file.size > maxSize) {
    return { valid: false, error: 'File size too large' }
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' }
  }

  return { valid: true }
}

// Generate unique ID
export function generateId(): string {
  return crypto.randomUUID()
}

// Format date for database
export function formatDate(date: Date): string {
  return date.toISOString()
}

// Calculate text metrics
export function calculateTextMetrics(text: string) {
  const words = text.split(/\s+/).filter(word => word.length > 0)
  const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0)
  const paragraphs = text.split(/\n\s*\n/).filter(paragraph => paragraph.trim().length > 0)

  return {
    characters: text.length,
    words: words.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    avgWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
    avgCharsPerWord: words.length > 0 ? text.length / words.length : 0,
  }
}

// Pagination helpers
export function calculatePagination(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit)
  const offset = (page - 1) * limit
  const hasNext = page < totalPages
  const hasPrev = page > 1

  return {
    page,
    limit,
    total,
    totalPages,
    offset,
    hasNext,
    hasPrev,
  }
}

// Search query builder
export function buildSearchQuery(
  query: string,
  fields: string[]
): string {
  const searchTerms = query
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)
    .slice(0, 10) // Limit search terms

  if (searchTerms.length === 0) {
    return ''
  }

  // Build OR query for multiple fields
  const conditions = fields.map(field =>
    searchTerms.map(term => `${field}.ilike.%${term}%`).join(',')
  )

  return conditions.map(condition => `(${condition})`).join(',')
}

// Async retry utility
export async function retryAsync<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
    }
  }
  throw new Error('Max retries reached')
}

// Performance monitoring
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  actionName: string
) {
  return async (...args: T): Promise<R> => {
    const start = performance.now()

    try {
      const result = await fn(...args)
      const duration = performance.now() - start

      // Log performance metrics
      console.log(`Action ${actionName} completed in ${duration.toFixed(2)}ms`)

      return result
    } catch (error) {
      const duration = performance.now() - start
      console.error(`Action ${actionName} failed after ${duration.toFixed(2)}ms:`, error)
      throw error
    }
  }
}

// Request context for server actions
export interface ActionContext {
  userId?: string
  sessionId?: string
  userAgent?: string
  ipAddress?: string
  requestId: string
}

// Create action context
export function createActionContext(): ActionContext {
  return {
    requestId: generateId(),
  }
}

// Type guards
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Data transformation helpers
export function transformDatabaseRow<T>(row: any): T {
  // Convert snake_case to camelCase if needed
  const transformed: any = {}

  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    transformed[camelKey] = value
  }

  return transformed as T
}

// Batch processing utility
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10,
  delayMs: number = 100
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)

    // Delay between batches to avoid overwhelming the system
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}

// Error logging utility
export function logError(error: any, context: string, additionalInfo?: Record<string, any>) {
  const errorInfo = {
    error: error.message || error,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    ...additionalInfo,
  }

  console.error('Server Action Error:', errorInfo)

  // In production, you might want to send this to an error tracking service
  // like Sentry, LogRocket, or similar
}

// Constants
export const ACTION_TIMEOUTS = {
  DEFAULT: 30000, // 30 seconds
  FILE_UPLOAD: 120000, // 2 minutes
  AI_PROCESSING: 300000, // 5 minutes
  BULK_OPERATIONS: 600000, // 10 minutes
} as const

export const RATE_LIMITS = {
  STANDARD: { requests: 100, windowMs: 60000 }, // 100 requests per minute
  AI_PROCESSING: { requests: 10, windowMs: 60000 }, // 10 AI requests per minute
  BULK_OPERATIONS: { requests: 5, windowMs: 300000 }, // 5 bulk operations per 5 minutes
} as const