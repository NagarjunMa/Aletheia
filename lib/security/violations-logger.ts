import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { NextRequest } from 'next/server'

// Violation types enum for type safety
export enum ViolationType {
  PROMPT_INJECTION = 'prompt_injection',
  HTML_INJECTION = 'html_injection',
  XSS_ATTEMPT = 'xss_attempt',
  INPUT_LENGTH_EXCEEDED = 'input_length_exceeded',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  INVALID_SCHEMA = 'invalid_schema',
  SUSPICIOUS_PATTERN = 'suspicious_pattern'
}

// Severity levels
export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Violation details interface
export interface ViolationDetails {
  fieldName?: string
  pattern?: string
  attemptedValue?: string
  errorMessage?: string
  expectedSchema?: string
  detectionMethod?: string
  confidence?: number
  [key: string]: any
}

// Security violation data structure
export interface SecurityViolation {
  userId?: string
  correlationId: string
  sessionId?: string
  violationType: ViolationType
  severity: Severity
  endpoint: string
  httpMethod: string
  userAgentHash?: string
  ipAddressHash?: string
  violationDetails: ViolationDetails
}

// Privacy-compliant hashing function
function hashSensitiveData(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

// Generate correlation ID for request tracking
export function generateCorrelationId(): string {
  return `sec_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// Extract request metadata safely
function extractRequestMetadata(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')

  // Determine IP address (checking various headers)
  let ipAddress = '127.0.0.1' // Default for development
  if (forwardedFor) {
    ipAddress = forwardedFor.split(',')[0].trim()
  } else if (realIP) {
    ipAddress = realIP
  } else if (cfConnectingIP) {
    ipAddress = cfConnectingIP
  }

  return {
    endpoint: new URL(request.url).pathname,
    httpMethod: request.method,
    userAgentHash: userAgent ? hashSensitiveData(userAgent) : undefined,
    ipAddressHash: ipAddress ? hashSensitiveData(ipAddress) : undefined
  }
}

// Main logging function
export async function logSecurityViolation(
  violation: Omit<SecurityViolation, 'endpoint' | 'httpMethod' | 'userAgentHash' | 'ipAddressHash'>,
  request?: NextRequest
): Promise<void> {
  try {
    const supabase = createClient()

    // Extract metadata from request if provided
    const metadata = request ? extractRequestMetadata(request) : {
      endpoint: 'unknown',
      httpMethod: 'unknown',
      userAgentHash: undefined,
      ipAddressHash: undefined
    }

    // Prepare violation data for database
    const violationData = {
      user_id: violation.userId || null,
      correlation_id: violation.correlationId,
      session_id: violation.sessionId || null,
      violation_type: violation.violationType,
      severity: violation.severity,
      endpoint: metadata.endpoint,
      http_method: metadata.httpMethod,
      user_agent_hash: metadata.userAgentHash,
      ip_address_hash: metadata.ipAddressHash,
      violation_details: violation.violationDetails
    }

    // Insert into database
    const { error } = await supabase
      .from('security_violations')
      .insert(violationData)

    if (error) {
      // Log to console if database logging fails
      console.error('Failed to log security violation to database:', error)
      console.warn('Security violation details:', {
        correlationId: violation.correlationId,
        type: violation.violationType,
        severity: violation.severity,
        endpoint: metadata.endpoint
      })
    }

  } catch (error) {
    // Fallback logging to console if everything else fails
    console.error('Security violations logging system failure:', error)
    console.warn('Attempted to log violation:', {
      correlationId: violation.correlationId,
      type: violation.violationType,
      severity: violation.severity
    })
  }
}

// Convenience function for prompt injection violations
export async function logPromptInjection(
  details: {
    userId?: string
    fieldName: string
    pattern: string
    correlationId?: string
    sessionId?: string
  },
  request?: NextRequest
): Promise<void> {
  await logSecurityViolation({
    userId: details.userId,
    correlationId: details.correlationId || generateCorrelationId(),
    sessionId: details.sessionId,
    violationType: ViolationType.PROMPT_INJECTION,
    severity: Severity.HIGH,
    violationDetails: {
      fieldName: details.fieldName,
      pattern: details.pattern,
      detectionMethod: 'pattern_matching',
      confidence: 0.9
    }
  }, request)
}

// Convenience function for input length violations
export async function logInputLengthViolation(
  details: {
    userId?: string
    fieldName: string
    actualLength: number
    maxLength: number
    correlationId?: string
    sessionId?: string
  },
  request?: NextRequest
): Promise<void> {
  await logSecurityViolation({
    userId: details.userId,
    correlationId: details.correlationId || generateCorrelationId(),
    sessionId: details.sessionId,
    violationType: ViolationType.INPUT_LENGTH_EXCEEDED,
    severity: details.actualLength > details.maxLength * 2 ? Severity.HIGH : Severity.MEDIUM,
    violationDetails: {
      fieldName: details.fieldName,
      actualLength: details.actualLength,
      maxLength: details.maxLength,
      exceededBy: details.actualLength - details.maxLength,
      detectionMethod: 'length_validation'
    }
  }, request)
}

// Convenience function for authentication failures
export async function logAuthenticationFailure(
  details: {
    userId?: string
    reason: string
    correlationId?: string
    sessionId?: string
  },
  request?: NextRequest
): Promise<void> {
  await logSecurityViolation({
    userId: details.userId,
    correlationId: details.correlationId || generateCorrelationId(),
    sessionId: details.sessionId,
    violationType: ViolationType.AUTHENTICATION_FAILURE,
    severity: Severity.HIGH,
    violationDetails: {
      reason: details.reason,
      detectionMethod: 'auth_verification'
    }
  }, request)
}

// Convenience function for rate limit violations
export async function logRateLimitViolation(
  details: {
    userId?: string
    limit: number
    windowMs: number
    correlationId?: string
    sessionId?: string
  },
  request?: NextRequest
): Promise<void> {
  await logSecurityViolation({
    userId: details.userId,
    correlationId: details.correlationId || generateCorrelationId(),
    sessionId: details.sessionId,
    violationType: ViolationType.RATE_LIMIT_EXCEEDED,
    severity: Severity.MEDIUM,
    violationDetails: {
      limit: details.limit,
      windowMs: details.windowMs,
      detectionMethod: 'rate_limiting'
    }
  }, request)
}

// Analytics helper - get violation summary (admin only)
export async function getViolationsSummary(timeframe: 'hour' | 'day' | 'week' = 'day') {
  try {
    const supabase = createClient()

    // Calculate time range
    const now = new Date()
    let startTime: Date

    switch (timeframe) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
    }

    const { data, error } = await supabase
      .from('security_violations')
      .select('violation_type, severity, detected_at')
      .gte('detected_at', startTime.toISOString())
      .order('detected_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch violations summary:', error)
      return null
    }

    // Group by type and severity
    const summary = data.reduce((acc, violation) => {
      const type = violation.violation_type
      const severity = violation.severity

      if (!acc[type]) acc[type] = { low: 0, medium: 0, high: 0, critical: 0, total: 0 }

      acc[type][severity]++
      acc[type].total++

      return acc
    }, {} as Record<string, Record<string, number>>)

    return {
      timeframe,
      totalViolations: data.length,
      byType: summary,
      generatedAt: new Date().toISOString()
    }

  } catch (error) {
    console.error('Error generating violations summary:', error)
    return null
  }
}