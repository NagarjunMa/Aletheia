import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright Configuration for Ascendia
 * E2E testing with mobile-first responsive design support
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ...(process.env.CI ? [['github']] : [['list']])
  ],

  // Global test settings
  use: {
    // Base URL for tests
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: 'retain-on-failure',

    // Global timeout for actions
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers and devices
  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/desktop/**/*.spec.ts', '**/general/**/*.spec.ts']
    },

    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
      testMatch: ['**/desktop/**/*.spec.ts', '**/general/**/*.spec.ts']
    },

    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
      testMatch: ['**/desktop/**/*.spec.ts', '**/general/**/*.spec.ts']
    },

    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: ['**/mobile/**/*.spec.ts', '**/responsive/**/*.spec.ts']
    },

    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      testMatch: ['**/mobile/**/*.spec.ts', '**/responsive/**/*.spec.ts']
    },

    // Tablet
    {
      name: 'tablet-chrome',
      use: { ...devices['iPad Pro'] },
      testMatch: ['**/tablet/**/*.spec.ts', '**/responsive/**/*.spec.ts']
    },

    // Critical user journeys (all browsers)
    {
      name: 'critical-journeys-chrome',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/critical/**/*.spec.ts'],
      retries: 3 // More retries for critical tests
    },

    {
      name: 'critical-journeys-mobile',
      use: { ...devices['iPhone 12'] },
      testMatch: ['**/critical/**/*.spec.ts'],
      retries: 3
    }
  ],

  // Web server configuration
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
    env: {
      // Test environment variables
      NODE_ENV: 'test',
      NEXT_PUBLIC_APP_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL_TEST || 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST || 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY_TEST || 'test-service-key',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY_TEST || 'test-anthropic-key'
    }
  },

  // Test output directory
  outputDir: './test-results/',

  // Timeout settings
  timeout: 30 * 1000, // 30 seconds
  expect: {
    // Default expect timeout
    timeout: 10 * 1000 // 10 seconds
  }
})