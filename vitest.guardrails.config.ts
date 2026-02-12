// Vitest Configuration for Guardrails Testing
// Purpose: Dedicated test configuration for the guardrail system

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Test files pattern
    include: [
      'lib/guardrails/**/*.test.ts',
      'lib/guardrails/**/*.test.js',
      'lib/guardrails/**/*.spec.ts',
      'lib/guardrails/**/*.spec.js'
    ],

    // Setup files
    setupFiles: ['lib/guardrails/__tests__/setup.ts'],

    // Global test configuration
    globals: true,
    silent: false,

    // Test timeout
    testTimeout: 10000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'lib/guardrails/**/*.ts'
      ],
      exclude: [
        'lib/guardrails/**/*.test.ts',
        'lib/guardrails/**/*.spec.ts',
        'lib/guardrails/**/__tests__/**',
        'lib/guardrails/**/types.ts',
        'lib/guardrails/**/index.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },

    // Pool options for parallel testing
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      }
    },

    // Reporter configuration
    reporter: ['verbose', 'junit'],
    outputFile: {
      junit: './test-results/guardrails-junit.xml'
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '~': path.resolve(__dirname, './lib')
    }
  },

  // Define configuration for different environments
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
    'process.env.GUARDRAILS_TEST_MODE': JSON.stringify('true')
  }
})