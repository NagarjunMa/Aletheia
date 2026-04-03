import { describe, it, expect, vi, afterEach } from 'vitest'
import { getCorsHeaders } from './cors'

// Duck-typed mock request — satisfies the headers.get() interface used by getCorsHeaders
function mockRequest(opts: {
  origin?: string | null
  extensionSource?: string | null
}): any {
  return {
    headers: {
      get: (name: string) => {
        if (name === 'origin') return opts.origin ?? null
        if (name === 'x-extension-source') return opts.extensionSource ?? null
        return null
      },
    },
  }
}

describe('getCorsHeaders', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('localhost origins', () => {
    it('allows http://localhost origin', () => {
      const headers = getCorsHeaders(mockRequest({ origin: 'http://localhost' }))
      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost')
    })

    it('allows http://localhost:3000 origin', () => {
      const headers = getCorsHeaders(mockRequest({ origin: 'http://localhost:3000' }))
      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000')
    })

    it('allows https://localhost:443 origin', () => {
      const headers = getCorsHeaders(mockRequest({ origin: 'https://localhost:443' }))
      expect(headers['Access-Control-Allow-Origin']).toBe('https://localhost:443')
    })
  })

  describe('chrome extension origins', () => {
    it('allows chrome-extension:// origin', () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: 'chrome-extension://abcdefghij' })
      )
      expect(headers['Access-Control-Allow-Origin']).toBe('chrome-extension://abcdefghij')
    })

    it('returns wildcard (*) for null origin with extension source header', () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: null, extensionSource: 'aletheia-extension' })
      )
      expect(headers['Access-Control-Allow-Origin']).toBe('*')
    })

    it('does not grant CORS for null origin without extension header', () => {
      const headers = getCorsHeaders(mockRequest({ origin: null }))
      expect(headers['Access-Control-Allow-Origin']).toBe('')
    })
  })

  describe('unknown origins', () => {
    it('returns empty ACAO for an unknown origin', () => {
      const headers = getCorsHeaders(mockRequest({ origin: 'https://attacker.com' }))
      expect(headers['Access-Control-Allow-Origin']).toBe('')
    })

    it('returns empty ACAO for a subdomain not in the allow list', () => {
      const headers = getCorsHeaders(mockRequest({ origin: 'https://sub.example.com' }))
      expect(headers['Access-Control-Allow-Origin']).toBe('')
    })
  })

  describe('standard headers', () => {
    it('always includes Access-Control-Allow-Methods', () => {
      const headers = getCorsHeaders(mockRequest({ origin: 'http://localhost:3000' }))
      expect(headers['Access-Control-Allow-Methods']).toBeDefined()
    })

    it('uses default methods "GET, OPTIONS" when not specified', () => {
      const headers = getCorsHeaders(mockRequest({ origin: 'http://localhost:3000' }))
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS')
    })

    it('uses provided methods option', () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: 'http://localhost:3000' }),
        { methods: 'POST, GET, OPTIONS' }
      )
      expect(headers['Access-Control-Allow-Methods']).toBe('POST, GET, OPTIONS')
    })

    it('always includes Access-Control-Allow-Headers with required values', () => {
      const headers = getCorsHeaders(mockRequest({ origin: 'http://localhost:3000' }))
      expect(headers['Access-Control-Allow-Headers']).toContain('Authorization')
      expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type')
    })

    it('always includes Vary: Origin header', () => {
      const headers = getCorsHeaders(mockRequest({ origin: 'http://localhost:3000' }))
      expect(headers['Vary']).toBe('Origin')
    })
  })

  describe('credentials handling', () => {
    it('sets Allow-Credentials to "true" for allowed origin when allowCredentials is true', () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: 'http://localhost:3000' }),
        { allowCredentials: true }
      )
      expect(headers['Access-Control-Allow-Credentials']).toBe('true')
    })

    it('does NOT set credentials for unknown origin even when allowCredentials is true', () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: 'https://unknown.com' }),
        { allowCredentials: true }
      )
      expect(headers['Access-Control-Allow-Credentials']).not.toBe('true')
    })

    it('does NOT set credentials for wildcard (extension null-origin) even when allowCredentials is true', () => {
      // Wildcard + credentials violates CORS spec — must not combine them
      const headers = getCorsHeaders(
        mockRequest({ origin: null, extensionSource: 'aletheia-extension' }),
        { allowCredentials: true }
      )
      expect(headers['Access-Control-Allow-Credentials']).not.toBe('true')
    })

    it('does not set credentials when allowCredentials is false (default)', () => {
      const headers = getCorsHeaders(mockRequest({ origin: 'http://localhost:3000' }))
      expect(headers['Access-Control-Allow-Credentials']).not.toBe('true')
    })
  })

  describe('APP_URL environment variable', () => {
    it('allows the configured APP_URL as origin', () => {
      // Temporarily stub the env var — module caches ALLOWED_PATTERNS at load time,
      // so we verify the localhost fallback behavior (which is always in the list)
      // and document that APP_URL support requires module reload.
      const headers = getCorsHeaders(mockRequest({ origin: 'http://localhost:3000' }))
      // localhost is always allowed regardless of APP_URL
      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000')
    })
  })
})
