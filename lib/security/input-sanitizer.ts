import DOMPurify from 'isomorphic-dompurify'
import { logPromptInjection, logInputLengthViolation, generateCorrelationId, ViolationType } from './violations-logger'
import type { NextRequest } from 'next/server'

// Input length limits
export const INPUT_LIMITS = {
  RESUME: 10_000,        // 10K characters
  JOB_DESCRIPTION: 5_000, // 5K characters
  PROFILE_DATA: 3_000,    // 3K characters
  CHAT_MESSAGE: 2_000,    // 2K characters
  USER_INPUT: 5_000       // General user input
} as const

/**
 * Sanitize user input - strip HTML tags and dangerous content
 */
export function sanitizeInput(input: string): string {
  if (!input) return ''

  // Strip HTML tags completely (no HTML allowed in user input)
  const stripped = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],        // No HTML tags allowed
    ALLOWED_ATTR: [],        // No attributes
    KEEP_CONTENT: true       // Keep text content
  })

  // Remove zero-width characters (potential steganography)
  const cleaned = stripped.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')

  // Normalize whitespace
  return cleaned.replace(/\s+/g, ' ').trim()
}

/**
 * Validate input length with security logging
 */
export async function validateInputLength(
  input: string,
  maxLength: number,
  fieldName: string,
  options?: {
    userId?: string
    request?: NextRequest
    correlationId?: string
  }
): Promise<{ valid: boolean; error?: string }> {
  if (!input) {
    return { valid: false, error: `${fieldName} is required` }
  }

  if (input.length > maxLength) {
    // Log length violation
    if (options?.userId || options?.request) {
      await logInputLengthViolation({
        userId: options.userId,
        fieldName,
        actualLength: input.length,
        maxLength,
        correlationId: options.correlationId || generateCorrelationId()
      }, options.request)
    }

    return {
      valid: false,
      error: `${fieldName} exceeds maximum length of ${maxLength} characters (current: ${input.length})`
    }
  }

  return { valid: true }
}

/**
 * Combined sanitization and validation with security logging
 */
export async function sanitizeAndValidate(
  input: string,
  maxLength: number,
  fieldName: string,
  options?: {
    userId?: string
    request?: NextRequest
    correlationId?: string
  }
): Promise<{ valid: boolean; sanitized?: string; error?: string }> {
  // Sanitize first
  const sanitized = sanitizeInput(input)

  // Then validate length
  const validation = await validateInputLength(sanitized, maxLength, fieldName, options)

  if (!validation.valid) {
    return { valid: false, error: validation.error }
  }

  return { valid: true, sanitized }
}

/**
 * Detect basic prompt injection patterns with security logging
 */
export async function detectPromptInjection(
  input: string,
  options?: {
    userId?: string
    fieldName?: string
    request?: NextRequest
    correlationId?: string
  }
): Promise<{
  detected: boolean
  pattern?: string
}> {
  const dangerousPatterns = [
    // System prompt manipulation
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|commands)/gi,
    /disregard\s+(previous|prior|above)\s+(instructions|prompts)/gi,

    // Role manipulation
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /\[INST\]/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,

    // Prompt injection markers
    /new\s+instructions\s*:/gi,
    /override\s+(previous|prior)\s+rules/gi,
    /you\s+are\s+now\s+a\s+different/gi,

    // Jailbreak attempts
    /DAN\s+mode/gi,
    /developer\s+mode/gi,
    /jailbreak/gi,

    // Additional patterns
    /forget\s+(everything|all)\s+(above|before|previous)/gi,
    /pretend\s+to\s+be/gi,
    /roleplay\s+as/gi
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      // Log the prompt injection attempt
      if (options?.userId || options?.request) {
        await logPromptInjection({
          userId: options.userId,
          fieldName: options.fieldName || 'unknown',
          pattern: pattern.source,
          correlationId: options.correlationId || generateCorrelationId()
        }, options.request)
      }

      return {
        detected: true,
        pattern: pattern.source
      }
    }
  }

  return { detected: false }
}

/**
 * Complete input security check with comprehensive logging
 */
export async function secureInput(
  input: string,
  maxLength: number,
  fieldName: string,
  checkInjection: boolean = true,
  options?: {
    userId?: string
    request?: NextRequest
    correlationId?: string
  }
): Promise<{
  valid: boolean
  sanitized?: string
  error?: string
  securityViolation?: string
}> {
  const correlationId = options?.correlationId || generateCorrelationId()

  // Step 1: Sanitize and validate length
  const result = await sanitizeAndValidate(input, maxLength, fieldName, {
    ...options,
    correlationId
  })

  if (!result.valid) {
    return result
  }

  // Step 2: Check for prompt injection (if enabled)
  if (checkInjection) {
    const injection = await detectPromptInjection(result.sanitized!, {
      ...options,
      fieldName,
      correlationId
    })

    if (injection.detected) {
      return {
        valid: false,
        error: 'Input contains potentially malicious content',
        securityViolation: `Prompt injection detected: ${injection.pattern}`
      }
    }
  }

  return result
}