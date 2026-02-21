import { NextRequest, NextResponse } from 'next/server'

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin')

  const allowedPatterns = [
    /^chrome-extension:\/\//,
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/.*\.vercel\.app$/,
  ]

  const isAllowed = origin && allowedPatterns.some(p => p.test(origin))

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
  console.log('[EXT-CONFIG] GET /api/extension/config — origin:', request.headers.get('origin'))
  return NextResponse.json({
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }, {
    headers: getCorsHeaders(request),
  })
}
