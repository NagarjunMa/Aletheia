import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import { securityValidator, type SecurityValidationResult } from './enhanced-validation'

// Security validation schemas
export const userInputSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(5000, 'Content must be less than 5000 characters')
    .refine(
      async (content, ctx) => {
        // Multi-layer security validation
        const basicCheck = !containsDangerousPatterns(content)
        if (!basicCheck) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Content contains basic dangerous patterns'
          })
          return false
        }

        // Enhanced security validation
        try {
          const result = await securityValidator.validateContent(content)
          if (!result.isValid) {
            const violationSummary = result.violations
              .map(v => `${v.type}: ${v.description}`)
              .join('; ')

            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Security validation failed: ${violationSummary}`,
              params: {
                violations: result.violations,
                riskLevel: result.riskLevel,
                confidence: result.confidence
              }
            })
            return false
          }
          return true
        } catch (error) {
          // Fail securely - if validation fails, reject content
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Security validation error - content rejected as precaution'
          })
          return false
        }
      },
      'Enhanced security validation failed'
    ),
  type: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational']),
  category: z.string().optional(),
  userId: z.string().uuid().optional() // For enhanced security context
})

export const userProfileSchema = z.object({
  full_name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
  email: z
    .string()
    .email('Invalid email address')
    .max(254, 'Email is too long'),
  preferences: z
    .string()
    .optional()
    .refine(
      (prefs) => {
        if (!prefs) return true
        try {
          JSON.parse(prefs)
          return true
        } catch {
          return false
        }
      },
      'Preferences must be valid JSON'
    )
})

export const conversationSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be less than 100 characters'),
  category: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational']),
  context: z.record(z.any()).optional()
})

// Dangerous pattern detection
const dangerousPatterns = [
  // Prompt injection patterns
  /ignore\s+previous\s+instructions/i,
  /disregard\s+previous\s+instructions/i,
  /forget\s+everything\s+above/i,
  /system\s*:\s*/i,
  /assistant\s*:\s*/i,
  /user\s*:\s*/i,

  // Code injection patterns
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:[\s\S]*base64/i,
  /eval\s*\(/i,
  /function\s*\(/i,

  // SQL injection patterns
  /'\s*(or|and)\s*'.*?'=/i,
  /union\s+select/i,
  /drop\s+table/i,
  /delete\s+from/i,
  /insert\s+into/i,

  // Command injection patterns
  /[\|&;`]/,
  /\$\(.*?\)/,
  /`.*?`/,

  // Path traversal
  /\.\.\//,
  /\.\.\\/,

  // XML/XXE patterns
  /<!ENTITY/i,
  /<!DOCTYPE/i
]

function containsDangerousPatterns(input: string): boolean {
  return dangerousPatterns.some(pattern => pattern.test(input))
}

// Content sanitization
export class ContentSanitizer {
  private static config = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'
    ],
    ALLOWED_ATTR: ['class'],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  }

  static sanitizeHTML(input: string): string {
    if (!input) return ''

    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: this.config.ALLOWED_TAGS,
      ALLOWED_ATTR: this.config.ALLOWED_ATTR,
      FORBID_TAGS: this.config.FORBID_TAGS,
      FORBID_ATTR: this.config.FORBID_ATTR,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM: false
    })
  }

  static sanitizePlainText(input: string): string {
    if (!input) return ''

    // Remove zero-width characters and other invisible Unicode
    let cleaned = input.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim()

    // Remove control characters (except newlines and tabs)
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

    // Limit length
    if (cleaned.length > 10000) {
      cleaned = cleaned.substring(0, 10000)
    }

    return cleaned
  }

  static sanitizeJSON(input: string): object | null {
    try {
      const parsed = JSON.parse(input)

      // Recursively sanitize JSON values
      return this.sanitizeJSONValue(parsed)
    } catch {
      return null
    }
  }

  private static sanitizeJSONValue(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizePlainText(value)
    }

    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeJSONValue(item))
    }

    if (value && typeof value === 'object') {
      const sanitized: any = {}
      for (const [key, val] of Object.entries(value)) {
        const cleanKey = this.sanitizePlainText(key)
        if (cleanKey.length > 0 && cleanKey.length <= 50) {
          sanitized[cleanKey] = this.sanitizeJSONValue(val)
        }
      }
      return sanitized
    }

    return value
  }
}

// Rate limiting utilities
export class RateLimiter {
  private static cache = new Map<string, { count: number; resetTime: number }>()

  static isRateLimited(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): boolean {
    const now = Date.now()
    const entry = this.cache.get(identifier)

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      this.cache.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      })
      return false
    }

    if (entry.count >= maxRequests) {
      return true
    }

    // Increment count
    entry.count++
    return false
  }

  static getRemainingRequests(
    identifier: string,
    maxRequests: number
  ): number {
    const entry = this.cache.get(identifier)
    if (!entry) return maxRequests

    return Math.max(0, maxRequests - entry.count)
  }

  static getResetTime(identifier: string): number {
    const entry = this.cache.get(identifier)
    return entry?.resetTime || 0
  }

  // Cleanup expired entries periodically
  static cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.resetTime) {
        this.cache.delete(key)
      }
    }
  }
}

// CSRF protection
export class CSRFProtection {
  private static readonly CSRF_HEADER = 'x-csrf-token'
  private static readonly CSRF_COOKIE = 'csrf-token'

  static generateToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  static validateToken(request: Request, cookieToken: string): boolean {
    const headerToken = request.headers.get(this.CSRF_HEADER)

    if (!headerToken || !cookieToken) {
      return false
    }

    // Constant-time comparison to prevent timing attacks
    return this.constantTimeCompare(headerToken, cookieToken)
  }

  private static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }
}

// IP address validation and blocking
export class IPSecurity {
  private static blockedIPs = new Set<string>([
    // Add known malicious IPs here
  ])

  private static suspiciousRequests = new Map<string, number>()

  static isBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip)
  }

  static blockIP(ip: string): void {
    this.blockedIPs.add(ip)
    console.warn(`IP blocked: ${ip}`)
  }

  static reportSuspiciousActivity(ip: string): void {
    const current = this.suspiciousRequests.get(ip) || 0
    const newCount = current + 1

    this.suspiciousRequests.set(ip, newCount)

    // Auto-block after 10 suspicious requests
    if (newCount >= 10) {
      this.blockIP(ip)
      this.suspiciousRequests.delete(ip)
    }
  }

  static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ]

    return privateRanges.some(range => range.test(ip))
  }
}

// Security headers validation
export class SecurityHeaders {
  static validateHeaders(headers: Headers): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    // Check for required security headers
    const requiredHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'strict-transport-security'
    ]

    for (const header of requiredHeaders) {
      if (!headers.has(header)) {
        issues.push(`Missing security header: ${header}`)
      }
    }

    // Validate Content-Security-Policy
    const csp = headers.get('content-security-policy')
    if (!csp) {
      issues.push('Missing Content-Security-Policy header')
    } else if (csp.includes('unsafe-eval') || csp.includes('unsafe-inline')) {
      issues.push('Content-Security-Policy contains unsafe directives')
    }

    // Check for information disclosure headers
    const sensitiveHeaders = ['server', 'x-powered-by']
    for (const header of sensitiveHeaders) {
      if (headers.has(header)) {
        issues.push(`Information disclosure header present: ${header}`)
      }
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }
}

// Enhanced comprehensive security validator
export class SecurityValidator {
  static async validateRequest(request: {
    body: any
    headers: Headers
    ip?: string
    method: string
    url: string
    userId?: string
  }): Promise<{
    valid: boolean
    errors: string[]
    securityResult?: SecurityValidationResult
    sanitizedBody?: any
  }> {
    const errors: string[] = []
    let securityResult: SecurityValidationResult | undefined
    let sanitizedBody = request.body

    // Validate IP
    if (request.ip && IPSecurity.isBlocked(request.ip)) {
      errors.push('Request from blocked IP address')
    }

    // Validate headers
    const headerValidation = SecurityHeaders.validateHeaders(request.headers)
    if (!headerValidation.valid) {
      errors.push(...headerValidation.issues)
    }

    // Validate content length
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
      errors.push('Request body too large')
    }

    // Validate user agent
    const userAgent = request.headers.get('user-agent')
    if (!userAgent || userAgent.length < 10) {
      errors.push('Invalid or missing user agent')
    }

    // Check for common attack patterns in URL
    if (containsDangerousPatterns(request.url)) {
      errors.push('URL contains dangerous patterns')
    }

    // Enhanced validation for request body
    if (request.body) {
      if (typeof request.body === 'string') {
        // Basic pattern check
        if (containsDangerousPatterns(request.body)) {
          errors.push('Request body contains dangerous patterns')
        }

        // Enhanced security validation
        try {
          securityResult = await securityValidator.validateContent(request.body, request.userId)

          if (!securityResult.isValid) {
            errors.push(`Enhanced security validation failed: ${securityResult.violations.length} violations detected`)

            // Use sanitized content if available
            if (securityResult.sanitizedContent) {
              sanitizedBody = securityResult.sanitizedContent
            }

            // Log security violation for monitoring
            if (request.ip) {
              IPSecurity.reportSuspiciousActivity(request.ip)
            }
          }
        } catch (error) {
          errors.push('Enhanced security validation error')
          console.error('Security validation error:', error)
        }
      } else if (typeof request.body === 'object') {
        // Validate JSON body recursively
        try {
          const bodyString = JSON.stringify(request.body)
          securityResult = await securityValidator.validateContent(bodyString, request.userId)

          if (!securityResult.isValid) {
            errors.push('Request body contains security violations')

            if (request.ip) {
              IPSecurity.reportSuspiciousActivity(request.ip)
            }
          }
        } catch (error) {
          errors.push('Failed to validate request body')
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      securityResult,
      sanitizedBody
    }
  }

  /**
   * Quick validation for API routes
   */
  static async validateUserInput(content: string, userId?: string): Promise<{
    isValid: boolean
    sanitized: string
    violations: string[]
    riskLevel: string
  }> {
    try {
      // Basic validation first
      if (containsDangerousPatterns(content)) {
        return {
          isValid: false,
          sanitized: ContentSanitizer.sanitizePlainText(content),
          violations: ['Basic dangerous patterns detected'],
          riskLevel: 'high'
        }
      }

      // Enhanced validation
      const result = await securityValidator.validateContent(content, userId)

      return {
        isValid: result.isValid,
        sanitized: result.isValid ? content : (result.sanitizedContent || ContentSanitizer.sanitizePlainText(content)),
        violations: result.violations.map(v => `${v.type}: ${v.description}`),
        riskLevel: result.riskLevel
      }
    } catch (error) {
      console.error('Security validation error:', error)
      return {
        isValid: false,
        sanitized: ContentSanitizer.sanitizePlainText(content),
        violations: ['Security validation failed'],
        riskLevel: 'critical'
      }
    }
  }
}

// Export validation functions for use in API routes
export {
  dangerousPatterns,
  containsDangerousPatterns
}