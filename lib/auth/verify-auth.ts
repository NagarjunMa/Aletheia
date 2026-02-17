import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Verify user authentication for API routes
 * Returns user or error response
 */
export async function verifyAuth(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        authenticated: false,
        error: NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'Authentication required to access this resource'
          },
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'WWW-Authenticate': 'Bearer'
            }
          }
        )
      }
    }

    return {
      authenticated: true,
      user
    }
  } catch (error) {
    console.error('Authentication verification failed:', error)

    return {
      authenticated: false,
      error: NextResponse.json(
        {
          error: 'Authentication Failed',
          message: 'Unable to verify authentication'
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Wrapper for API routes that require authentication
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T) => {
    const auth = await verifyAuth(request)

    if (!auth.authenticated) {
      return auth.error!
    }

    return handler(request, auth.user, ...args)
  }
}

/**
 * Get client IP address for logging and rate limiting
 */
export function getClientIP(request: NextRequest): string {
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
 * Get request metadata for security logging
 */
export function getRequestMetadata(request: NextRequest) {
  return {
    ipAddress: getClientIP(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    endpoint: new URL(request.url).pathname,
    method: request.method,
    timestamp: new Date().toISOString()
  }
}