module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:3000',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/login'
      ],

      // Collection settings
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless',
        preset: 'desktop',
        onlyCategories: [
          'performance',
          'accessibility',
          'best-practices',
          'seo'
        ],
        skipAudits: [
          'canonical',
          'robots-txt'
        ],
        extraHeaders: JSON.stringify({
          'Accept-Language': 'en-US,en;q=0.9'
        })
      }
    },

    assert: {
      // Performance thresholds
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'first-meaningful-paint': ['error', { maxNumericValue: 2000 }],
        'speed-index': ['error', { maxNumericValue: 4000 }],
        'interactive': ['error', { maxNumericValue: 5000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],

        // Resource optimization
        'unused-javascript': ['warn', { maxNumericValue: 100000 }],
        'unused-css-rules': ['warn', { maxNumericValue: 50000 }],
        'unminified-css': ['error', { maxNumericValue: 0 }],
        'unminified-javascript': ['error', { maxNumericValue: 0 }],
        'efficient-animated-content': ['warn', { maxNumericValue: 0 }],
        'uses-optimized-images': ['warn', { maxNumericValue: 100000 }],
        'uses-webp-images': ['warn', { maxNumericValue: 100000 }],
        'uses-text-compression': ['error', { maxNumericValue: 0 }],

        // Network optimization
        'server-response-time': ['error', { maxNumericValue: 600 }],
        'redirects': ['warn', { maxNumericValue: 0 }],
        'uses-rel-preconnect': ['warn', { maxNumericValue: 500 }],
        'uses-rel-preload': ['warn', { maxNumericValue: 500 }],

        // JavaScript and CSS
        'render-blocking-resources': ['warn', { maxNumericValue: 500 }],
        'critical-request-chains': ['warn', { maxNumericValue: 3 }],
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 4000 }],
        'bootup-time': ['warn', { maxNumericValue: 3500 }],

        // Accessibility
        'color-contrast': ['error', { minScore: 1 }],
        'image-alt': ['error', { minScore: 1 }],
        'label': ['error', { minScore: 1 }],
        'link-name': ['error', { minScore: 1 }],
        'button-name': ['error', { minScore: 1 }],

        // Best practices
        'is-on-https': ['error', { minScore: 1 }],
        'uses-http2': ['warn', { minScore: 1 }],
        'no-vulnerable-libraries': ['error', { minScore: 1 }],
        'csp-xss': ['warn', { minScore: 1 }]
      }
    },

    upload: {
      target: 'temporary-public-storage'
    },

    server: {
      port: 9001,
      storage: {
        storageMethod: 'filesystem',
        storagePath: './.lighthouseci'
      }
    },

    wizard: {
      // GitHub integration
      github: {
        token: process.env.LHCI_GITHUB_APP_TOKEN
      }
    }
  }
}