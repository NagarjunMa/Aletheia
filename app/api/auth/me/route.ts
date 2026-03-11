import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'
import { getCorsHeaders } from '@/lib/cors'

const log = createLogger('auth-me')

const DAILY_LIMIT = 30

// Supabase clients for token-based auth and rate limit queries
const supabaseAuth = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const supabaseService = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Usage query ───

async function getUsage(userId: string): Promise<{ count: number; limit: number; reset_time: number }> {
  const now = new Date()
  const windowStartCutoff = new Date(now.getTime() - 86400000)

  const { data, error } = await supabaseService
    .from('extension_rate_limits')
    .select('request_count, window_start')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return { count: 0, limit: DAILY_LIMIT, reset_time: now.getTime() + 86400000 }
  }

  const windowStart = new Date(data.window_start)

  if (windowStart < windowStartCutoff) {
    // Window expired — usage is effectively 0
    return { count: 0, limit: DAILY_LIMIT, reset_time: now.getTime() + 86400000 }
  }

  const resetTime = windowStart.getTime() + 86400000
  return { count: data.request_count, limit: DAILY_LIMIT, reset_time: resetTime }
}

// ─── GET handler ───

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, { allowCredentials: true, methods: 'GET, OPTIONS' })

  try {
    let userId: string | null = null
    let email: string | null = null
    let fullName: string | null = null

    // Method 1: Bearer token auth
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7)
      const { data: { user }, error } = await supabaseAuth.auth.getUser(accessToken)

      if (!error && user) {
        userId = user.id
        email = user.email || null
        fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || null
      }
    }

    // Method 2: Cookie-based session (fallback)
    if (!userId) {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (!error && user) {
        userId = user.id
        email = user.email || null
        fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || null
      }
    }

    if (!userId) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401, headers: corsHeaders }
      )
    }

    const usage = await getUsage(userId)

    return NextResponse.json({
      authenticated: true,
      user: {
        id: userId,
        email,
        full_name: fullName,
      },
      usage,
    }, { headers: corsHeaders })

  } catch (error) {
    log.error({ err: error }, '/api/auth/me error')
    return NextResponse.json(
      { authenticated: false },
      { status: 500, headers: corsHeaders }
    )
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(request, { allowCredentials: true, methods: 'GET, OPTIONS' }),
      'Access-Control-Max-Age': '86400',
    },
  })
}
