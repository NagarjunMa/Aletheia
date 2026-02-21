import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin')
  const isExtension = request.headers.get('x-extension-source') === 'ascendia-extension'

  const allowedPatterns = [
    /^chrome-extension:\/\//,
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/.*\.vercel\.app$/,
  ]

  const isAllowed = origin && allowedPatterns.some(p => p.test(origin))

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (isExtension ? '*' : ''),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Extension-Source',
    'Access-Control-Allow-Credentials': isAllowed ? 'true' : '',
    'Vary': 'Origin',
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request),
  })
}

export async function GET(request: NextRequest) {
  console.log('[EXT-SESSION] GET /api/extension/session — origin:', request.headers.get('origin'))
  const corsHeaders = getCorsHeaders(request)

  if (!corsHeaders['Access-Control-Allow-Origin']) {
    console.log('[EXT-SESSION] ✗ Origin not allowed')
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403, headers: corsHeaders }
    )
  }

  try {
    // Log all cookies for debugging (names only, not values)
    const cookieNames = request.cookies.getAll().map(c => c.name)
    console.log('[EXT-SESSION] Cookies present:', cookieNames.join(', ') || '(none)')

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set() { },
          remove() { },
        },
      }
    )

    // Use getUser() instead of getSession() — validates token server-side
    const { data: { user }, error } = await supabase.auth.getUser()
    console.log('[EXT-SESSION] getUser:', user ? `✓ ${user.email}` : `✗ ${error?.message || 'no user'}`)

    if (error || !user) {
      console.log('[EXT-SESSION] → 401 Not authenticated')
      return NextResponse.json(
        { error: 'Not authenticated. Please log in to the Ascendia web app first.' },
        { status: 401, headers: corsHeaders }
      )
    }

    // After validating the user, get the session for tokens
    const { data: { session } } = await supabase.auth.getSession()
    console.log('[EXT-SESSION] getSession:', session ? `✓ expires_at=${session.expires_at}` : '✗ no session')

    if (!session) {
      console.log('[EXT-SESSION] → 401 Session expired')
      return NextResponse.json(
        { error: 'Session expired. Please log in again.' },
        { status: 401, headers: corsHeaders }
      )
    }

    console.log('[EXT-SESSION] → 200 OK, returning session for', user.email)
    return NextResponse.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
      },
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }, {
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('[EXT-SESSION] ✗ Internal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
