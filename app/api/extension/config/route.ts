import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { getCorsHeaders } from '@/lib/cors'

const log = createLogger('extension-config')

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request, { methods: 'GET, OPTIONS' }),
  })
}

export async function GET(request: NextRequest) {
  log.info({ origin: request.headers.get('origin') }, 'GET /api/extension/config')
  return NextResponse.json({
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }, {
    headers: getCorsHeaders(request, { methods: 'GET, OPTIONS' }),
  })
}
