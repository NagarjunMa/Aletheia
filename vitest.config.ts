/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '.next/',
        'coverage/',
        '**/*.config.*',
        '**/*.d.ts',
        'lib/types/**',
        'components/ui/**', // shadcn/ui components
        '**/*.stories.tsx',
        '**/test-utils.tsx',
        'app/globals.css',
        'middleware.ts'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        },
        // Per-file thresholds for critical modules
        'lib/stores/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'app/api/': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        'components/features/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    // Environment variables for testing
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      NEXTAUTH_SECRET: 'test-secret',
      NEXTAUTH_URL: 'http://localhost:3000'
    },
    // Performance settings
    testTimeout: 15000,
    hookTimeout: 10000,

    // Parallel execution optimization
    maxConcurrency: 4,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true
      }
    },
    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/e2e/**'
    ]
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@/components': resolve(__dirname, './components'),
      '@/lib': resolve(__dirname, './lib'),
      '@/tests': resolve(__dirname, './tests')
    }
  },
  define: {
    // Mock Next.js specific globals for testing
    'process.env.NODE_ENV': JSON.stringify('test'),
    'process.env.NEXT_RUNTIME': JSON.stringify('nodejs')
  }
})