const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React configuration
  reactStrictMode: true,
  poweredByHeader: false,

  // Experimental features
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons'
    ],
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
    esmExternals: 'loose'
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

  // Enhanced Webpack configuration with dependency conflict resolution
  webpack: (config, { isServer, dev, webpack }) => {
    // SVG handling
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack']
    })

    // Fix OpenTelemetry/Sentry dependency conflicts
    config.externals = config.externals || []

    if (isServer) {
      // Server-side externals to prevent bundling issues
      config.externals.push(
        'require-in-the-middle',
        '@opentelemetry/instrumentation',
        '@opentelemetry/auto-instrumentations-node',
        'import-in-the-middle'
      )
    } else {
      // Client-side externals
      config.externals.push({
        'isomorphic-dompurify': 'isomorphic-dompurify'
      })
    }

    // Resolve fallbacks for Node.js modules in client bundle
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      process: require.resolve('process/browser'),
      vm: false,
      worker_threads: false,
      child_process: false,
      'require-in-the-middle': false
    }

    // Fix for ESM modules
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts'],
      '.jsx': ['.jsx', '.tsx']
    }

    // Add module resolution for problematic packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@opentelemetry/api': require.resolve('@opentelemetry/api'),
    }

    // Ignore problematic dynamic requires in client bundle
    if (!isServer && webpack) {
      config.plugins = config.plugins || []
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(require-in-the-middle|import-in-the-middle)$/,
        })
      )
    }

    // Development-only optimizations
    if (dev) {
      // Faster builds in development by skipping some optimizations
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
      }
    }

    return config
  },

  // Compiler options (let SWC handle optimizations)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false
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

    // Add CSP header for production
    if (process.env.NODE_ENV === 'production') {
      headers[0].headers.push({
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://app.posthog.com https://www.googletagmanager.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https: blob:",
          "font-src 'self' https:",
          "connect-src 'self' https://api.anthropic.com https://*.supabase.co https://app.posthog.com https://www.google-analytics.com https://*.sentry.io",
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

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['components', 'lib', 'app']
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