import { NextRequest } from 'next/server'

const ALLOWED_APP_URL = process.env.NEXT_PUBLIC_APP_URL

function buildAllowedPatterns(): RegExp[] {
  const patterns: RegExp[] = [
    /^chrome-extension:\/\//,
    /^https?:\/\/localhost(:\d+)?$/,
  ]
  if (ALLOWED_APP_URL) {
    const escaped = ALLOWED_APP_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    patterns.push(new RegExp(`^${escaped}$`))
  }
  return patterns
}

const ALLOWED_PATTERNS = buildAllowedPatterns()

export function getCorsHeaders(
  request: NextRequest,
  options: { allowCredentials?: boolean; methods?: string } = {}
): Record<string, string> {
  const origin = request.headers.get('origin')
  const extensionSource = request.headers.get('x-extension-source')
  const isExtension = extensionSource === 'aletheia-extension'
  const isAllowedOrigin = origin ? ALLOWED_PATTERNS.some(p => p.test(origin)) : false
  const isAllowedNullOrigin = !origin && isExtension

  let acao = ''
  if (isAllowedOrigin && origin) acao = origin
  else if (isAllowedNullOrigin) acao = '*'

  return {
    'Access-Control-Allow-Origin': acao,
    'Access-Control-Allow-Methods': options.methods ?? 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Extension-Source',
    'Access-Control-Allow-Credentials': (options.allowCredentials && isAllowedOrigin) ? 'true' : '',
    'Vary': 'Origin',
  }
}
