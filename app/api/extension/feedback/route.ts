import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { analyzeStyle, mergeStylePatterns, type StylePatterns } from '@/lib/ai/style-analyzer'
import { getCorsHeaders } from '@/lib/cors'

const log = createLogger('extension-feedback')

// Supabase clients (same pattern as generate/route.ts)
const supabaseService = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const supabaseAuth = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Auth helper (duplicated from generate/route.ts) ───

async function authenticateRequest(request: NextRequest): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log.info('No Bearer token in Authorization header')
    return null
  }

  const accessToken = authHeader.slice(7)
  const { data: { user }, error } = await supabaseAuth.auth.getUser(accessToken)

  if (error || !user) {
    log.info({ err: error?.message }, 'Token validation failed')
    return null
  }

  return { userId: user.id, email: user.email || '' }
}

// ─── Request schema ───

const feedbackSchema = z.object({
  message: z.string().min(1).max(10000),
  approved: z.boolean(),
  category: z.enum(['linkedin_connection', 'cold_email', 'linkedin_inmail']),
  subjectLine: z.string().optional(),
})

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, { allowCredentials: true, methods: 'GET, POST, OPTIONS' })

  try {
    // Auth
    const authResult = await authenticateRequest(request)
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid Bearer token required' },
        { status: 401, headers: corsHeaders }
      )
    }

    // Parse
    const body = await request.json()
    const { message, approved, category, subjectLine } = feedbackSchema.parse(body)

    log.info({ userId: authResult.userId.substring(0, 8), approved, category }, 'Feedback received')

    // Return 200 immediately — style analysis runs fire-and-forget
    const response = NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    )

    // Fire-and-forget async processing
    processStyleFeedback(authResult.userId, message, approved, category, subjectLine).catch(err => {
      log.error({ err }, 'Background style processing failed')
    })

    return response
  } catch (error) {
    log.error({ err: error }, 'Feedback endpoint error')

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

// ─── Background style processing ───

async function processStyleFeedback(
  userId: string,
  message: string,
  approved: boolean,
  category: string,
  subjectLine?: string,
) {
  // Fetch existing preferences
  const { data: prefs, error: fetchErr } = await supabaseService
    .from('user_preferences')
    .select('style_patterns, approved_message_count, rejected_message_count')
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchErr) {
    log.error({ err: fetchErr }, 'Failed to fetch user_preferences')
    return
  }

  if (approved) {
    // Analyze style from approved message
    const fullText = subjectLine ? `${subjectLine}\n\n${message}` : message
    const incoming = analyzeStyle(fullText)

    const existingPatterns = (prefs?.style_patterns ?? null) as StylePatterns | null
    const merged = existingPatterns
      ? mergeStylePatterns(existingPatterns, incoming)
      : incoming

    const currentCount = (prefs?.approved_message_count ?? 0) as number

    const { error: upsertErr } = await supabaseService
      .from('user_preferences')
      .upsert({
        user_id: userId,
        style_patterns: merged as unknown as Record<string, unknown>,
        approved_message_count: currentCount + 1,
      }, { onConflict: 'user_id' })

    if (upsertErr) {
      log.error({ err: upsertErr }, 'Failed to upsert style_patterns')
    } else {
      log.info({ userId, approvedCount: currentCount + 1 }, 'Style patterns updated')
    }
  } else {
    // Rejected: just increment counter
    const currentCount = (prefs?.rejected_message_count ?? 0) as number

    const { error: upsertErr } = await supabaseService
      .from('user_preferences')
      .upsert({
        user_id: userId,
        rejected_message_count: currentCount + 1,
      }, { onConflict: 'user_id' })

    if (upsertErr) {
      log.error({ err: upsertErr }, 'Failed to increment rejected_message_count')
    }
  }
}

// ─── OPTIONS handler for CORS preflight ───

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(request, { allowCredentials: true, methods: 'GET, POST, OPTIONS' }),
      'Access-Control-Max-Age': '86400',
    },
  })
}
