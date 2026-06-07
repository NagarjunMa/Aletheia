const path = require('path')
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React configuration
  reactStrictMode: true,
  reactCompiler: true,
  poweredByHeader: false,
  serverExternalPackages: ['@anthropic-ai/sdk'],
  turbopack: {
    root: path.resolve(__dirname)
  },

  // Experimental features
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons'
    ]
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: [],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**'
      }
    ]
  },

  // Compiler options (let SWC handle optimizations)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },

  // Security headers
  async headers() {
    const headers = [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
          }
        ]
      },
      // Cache static assets aggressively
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      // Cache API responses appropriately
      {
        source: '/api/health',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          }
        ]
      }
    ]

    // CSP header for production static responses (proxy handles dynamic ones with nonces).
    // Static responses can't have nonces, so we use 'strict-dynamic' only.
    // Middleware-served pages get the nonce-based CSP which is stronger.
    if (process.env.NODE_ENV === 'production') {
      headers[0].headers.push({
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'strict-dynamic' https://app.posthog.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https: blob:",
          "font-src 'self' https:",
          "connect-src 'self' https://api.anthropic.com https://*.supabase.co https://app.posthog.com https://*.sentry.io",
          "media-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "upgrade-insecure-requests"
        ].join('; ')
      })
    }

    return headers
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true
      },
      {
        source: '/app',
        destination: '/dashboard',
        permanent: true
      }
    ]
  },

  // Rewrites
  async rewrites() {
    return [
      {
        source: '/healthz',
        destination: '/api/health'
      }
    ]
  },

  // Output configuration
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: './tsconfig.json'
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development'
    }
  },

  // Compression
  compress: true,

  // Generate ETags
  generateEtags: true,

  // Trailing slash
  trailingSlash: false,

  // Development indicators
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right'
  }
}

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Disable source map upload when no auth token is present
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
})
