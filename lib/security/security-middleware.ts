/**
 * Security Middleware - Integrated enhanced security for API routes
 *
 * Purpose: Seamlessly integrate multi-layer security validation into Next.js API routes
 * - Automatic prompt injection detection
 * - Rate limiting and IP blocking
 * - Content sanitization
 * - Security violation logging
 * - Performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { SecurityValidator, RateLimiter, IPSecurity } from './input-validation'
import { securityValidator } from './enhanced-validation'
import { createClient } from '@/lib/supabase/server'

export interface SecurityMiddlewareOptions {
  enableRateLimit?: boolean
  enableIPBlocking?: boolean
  enableEnhancedValidation?: boolean
  enableViolationLogging?: boolean
  maxRequestsPerMinute?: number
  strictMode?: boolean
  allowedPaths?: string[]
  exemptUserRoles?: string[]
}

export interface SecurityContext {
  isValid: boolean
  violations: string[]
  riskLevel: string
  sanitizedBody: any
  userAgent: string
  ipAddress: string
  requestId: string
}

/**
 * Enhanced security middleware wrapper for API routes
 */
export function withSecurity<T extends any[]>(
  handler: (
    request: NextRequest,
    context: SecurityContext,
    ...args: T
  ) => Promise<NextResponse>,
  options: SecurityMiddlewareOptions = {}
) {
  return async function securityWrappedHandler(
    request: NextRequest,
    ...args: T
  ): Promise<NextResponse> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    // Default options
    const config = {
      enableRateLimit: true,
      enableIPBlocking: true,
      enableEnhancedValidation: true,
      enableViolationLogging: true,
      maxRequestsPerMinute: 60,
      strictMode: process.env.NODE_ENV === 'production',
      allowedPaths: [],
      exemptUserRoles: ['admin', 'moderator'],
      ...options
    }

    try {
      // Extract request details
      const ipAddress = getClientIP(request)
      const userAgent = request.headers.get('user-agent') || 'unknown'
      const url = new URL(request.url)

      // Check if path is in allowed list (bypass security for certain paths)
      if (config.allowedPaths.some(path => url.pathname.startsWith(path))) {
        const basicContext: SecurityContext = {
          isValid: true,
          violations: [],
          riskLevel: 'low',
          sanitizedBody: null,
          userAgent,
          ipAddress,
          requestId
        }
        return await handler(request, basicContext, ...args)
      }

      // 1. IP Blocking Check
      if (config.enableIPBlocking && IPSecurity.isBlocked(ipAddress)) {
        return createSecurityResponse({
          status: 403,
          message: 'Access denied',
          requestId,
          logDetails: { reason: 'blocked_ip', ip: ipAddress }
        })
      }

      // 2. Rate Limiting
      if (config.enableRateLimit) {
        const rateLimitKey = `rate_limit:${ipAddress}`
        if (RateLimiter.isRateLimited(rateLimitKey, config.maxRequestsPerMinute, 60000)) {
          return createSecurityResponse({
            status: 429,
            message: 'Rate limit exceeded',
            requestId,
            logDetails: { reason: 'rate_limit', ip: ipAddress }
          })
        }
      }

      // 3. Get user context for enhanced validation
      let userId: string | undefined
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id

        // Check if user has exempt role
        if (userId && config.exemptUserRoles.length > 0) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single()

          if (profile?.role && config.exemptUserRoles.includes(profile.role)) {
            const exemptContext: SecurityContext = {
              isValid: true,
              violations: [],
              riskLevel: 'low',
              sanitizedBody: null,
              userAgent,
              ipAddress,
              requestId
            }
            return await handler(request, exemptContext, ...args)
          }
        }
      } catch {
        // Continue without user context if auth fails
      }

      // 4. Enhanced Security Validation
      let securityContext: SecurityContext

      if (config.enableEnhancedValidation) {
        const body = request.method !== 'GET' ? await extractRequestBody(request) : null

        const validationResult = await SecurityValidator.validateRequest({
          body,
          headers: request.headers,
          ip: ipAddress,
          method: request.method,
          url: request.url,
          userId
        })

        securityContext = {
          isValid: validationResult.valid,
          violations: validationResult.errors,
          riskLevel: validationResult.securityResult?.riskLevel || 'unknown',
          sanitizedBody: validationResult.sanitizedBody,
          userAgent,
          ipAddress,
          requestId
        }

        // Block request if validation fails
        if (!validationResult.valid) {
          // Log security violation
          if (config.enableViolationLogging) {
            await logSecurityViolation({
              requestId,
              userId,
              ipAddress,
              userAgent,
              violations: validationResult.errors,
              riskLevel: validationResult.securityResult?.riskLevel || 'high',
              url: url.pathname,
              method: request.method
            })
          }

          // Report suspicious activity
          if (validationResult.securityResult?.riskLevel === 'critical') {
            IPSecurity.reportSuspiciousActivity(ipAddress)
          }

          return createSecurityResponse({
            status: 400,
            message: 'Security validation failed',
            requestId,
            violations: validationResult.errors,
            logDetails: {
              reason: 'security_validation',
              riskLevel: validationResult.securityResult?.riskLevel,
              violations: validationResult.errors.length
            }
          })
        }
      } else {
        // Basic security context without enhanced validation
        securityContext = {
          isValid: true,
          violations: [],
          riskLevel: 'low',
          sanitizedBody: null,
          userAgent,
          ipAddress,
          requestId
        }
      }

      // 5. Execute original handler with security context
      const response = await handler(request, securityContext, ...args)

      // 6. Log successful request for monitoring
      if (config.enableViolationLogging) {
        const duration = Date.now() - startTime
        console.log(`✅ Security check passed: ${url.pathname} (${duration}ms)`, {
          requestId,
          method: request.method,
          status: response.status,
          duration
        })
      }

      return response

    } catch (error) {
      console.error('Security middleware error:', error)

      // Log error for investigation
      if (config.enableViolationLogging) {
        await logSecurityViolation({
          requestId,
          userId: undefined,
          ipAddress: getClientIP(request),
          userAgent: request.headers.get('user-agent') || 'unknown',
          violations: ['Middleware error: ' + (error instanceof Error ? error.message : 'Unknown error')],
          riskLevel: 'critical',
          url: new URL(request.url).pathname,
          method: request.method
        })
      }

      return createSecurityResponse({
        status: 500,
        message: 'Security processing error',
        requestId,
        logDetails: { reason: 'middleware_error', error: String(error) }
      })
    }
  }
}

/**
 * Extract request body safely
 */
async function extractRequestBody(request: NextRequest): Promise<any> {
  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      return await request.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      const body: Record<string, any> = {}
      for (const [key, value] of formData.entries()) {
        body[key] = value
      }
      return body
    } else if (contentType.includes('text/')) {
      return await request.text()
    }

    return null
  } catch {
    return null
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for real IP (considering proxies)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback to request IP (may be proxy IP)
  return '127.0.0.1' // Default for development
}

/**
 * Create standardized security response
 */
function createSecurityResponse({
  status,
  message,
  requestId,
  violations = [],
  logDetails = {}
}: {
  status: number
  message: string
  requestId: string
  violations?: string[]
  logDetails?: Record<string, any>
}): NextResponse {
  const response = {
    error: message,
    requestId,
    timestamp: new Date().toISOString()
  }

  // Include violations in development mode
  if (process.env.NODE_ENV === 'development' && violations.length > 0) {
    Object.assign(response, { violations })
  }

  console.warn(`🚨 Security block: ${status} - ${message}`, {
    requestId,
    ...logDetails
  })

  return NextResponse.json(response, { status })
}

/**
 * Log security violation to database
 */
async function logSecurityViolation({
  requestId,
  userId,
  ipAddress,
  userAgent,
  violations,
  riskLevel,
  url,
  method
}: {
  requestId: string
  userId?: string
  ipAddress: string
  userAgent: string
  violations: string[]
  riskLevel: string
  url: string
  method: string
}) {
  try {
    const supabase = createClient()

    // Hash IP for privacy compliance
    const hashedIP = await hashIP(ipAddress)

    await supabase
      .from('security_violations')
      .insert({
        request_id: requestId,
        user_id: userId,
        ip_hash: hashedIP,
        user_agent_hash: await hashUserAgent(userAgent),
        violations: violations,
        risk_level: riskLevel,
        url_path: url,
        method: method,
        created_at: new Date().toISOString()
      })

    console.log(`📝 Security violation logged: ${requestId}`)
  } catch (error) {
    console.error('Failed to log security violation:', error)
  }
}

/**
 * Privacy-compliant IP hashing
 */
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + process.env.SECURITY_SALT || 'default-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Privacy-compliant user agent hashing
 */
async function hashUserAgent(userAgent: string): Promise<string> {
  // Only hash the browser/OS part, not version numbers for analytics
  const normalized = userAgent.replace(/[0-9.]+/g, 'X')
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized + process.env.SECURITY_SALT || 'default-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Convenience function for quick input validation
 */
export async function validateInput(content: string, userId?: string): Promise<{
  isValid: boolean
  sanitized: string
  violations: string[]
}> {
  const result = await SecurityValidator.validateUserInput(content, userId)
  return {
    isValid: result.isValid,
    sanitized: result.sanitized,
    violations: result.violations
  }
}

/**
 * Usage Examples:
 *
 * // 1. API Route with security middleware
 * export const POST = withSecurity(async (request, securityContext) => {
 *   if (!securityContext.isValid) {
 *     return NextResponse.json({ error: 'Security validation failed' }, { status: 400 })
 *   }
 *
 *   const body = securityContext.sanitizedBody || await request.json()
 *   // Process request safely...
 *   return NextResponse.json({ success: true })
 * }, {
 *   enableRateLimit: true,
 *   maxRequestsPerMinute: 30,
 *   strictMode: true
 * })
 *
 * // 2. Quick input validation
 * const { isValid, sanitized, violations } = await validateInput(userInput, userId)
 * if (!isValid) {
 *   console.log('Violations:', violations)
 *   return { error: 'Content blocked', reason: violations[0] }
 * }
 */