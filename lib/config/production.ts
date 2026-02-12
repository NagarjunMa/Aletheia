/**
 * Production Configuration
 *
 * Centralized configuration for production deployment
 * - Environment validation
 * - Feature flags
 * - Performance settings
 * - Monitoring configuration
 */

import { z } from 'zod'

// Environment variables schema validation
const envSchema = z.object({
  // Database
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // AI Services
  ANTHROPIC_API_KEY: z.string().min(1),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']),
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
})

// Validate environment variables
function validateEnv() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Environment validation failed:', error)
    process.exit(1)
  }
}

export const env = validateEnv()

// Production configuration
export const productionConfig = {
  // Monitoring settings
  monitoring: {
    enabled: env.NODE_ENV === 'production',
    sampleRate: env.NODE_ENV === 'production' ? 1.0 : 0.1,
    enableRealTimeAlerts: env.NODE_ENV === 'production',
    enableAnalytics: true,
    performanceMode: 'balanced' as const,
    retryAttempts: 3,
    healthCheckInterval: 60000, // 1 minute
    metricAggregationInterval: 300000, // 5 minutes
  },

  // AI processing settings
  ai: {
    maxConcurrentRequests: env.NODE_ENV === 'production' ? 100 : 10,
    requestTimeout: 30000, // 30 seconds
    maxRetries: 3,
    enableCaching: true,
    cacheSize: 1000,
    enableParallelProcessing: true,
    enableTokenBuffering: true,
    bufferFlushInterval: 100, // milliseconds
  },

  // Security settings
  security: {
    enableAdvancedValidation: env.NODE_ENV === 'production',
    enablePromptInjectionDetection: true,
    enableContentSafety: true,
    enableRateLimiting: env.NODE_ENV === 'production',
    rateLimitRequests: 100, // per minute
    enableDDoSProtection: env.NODE_ENV === 'production',
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Database settings
  database: {
    enableQueryOptimization: true,
    enableConnectionPooling: env.NODE_ENV === 'production',
    maxConnections: env.NODE_ENV === 'production' ? 100 : 10,
    queryTimeout: 30000,
    enableRLS: true,
    enableAuditLogging: env.NODE_ENV === 'production',
  },

  // Performance settings
  performance: {
    enableCompression: env.NODE_ENV === 'production',
    enableCaching: true,
    enableCDN: env.NODE_ENV === 'production',
    enableStaticGeneration: true,
    revalidateInterval: 3600, // 1 hour
    maxBundleSize: 250 * 1024, // 250KB
  },

  // Feature flags
  features: {
    enableAdvancedAI: true,
    enableStyleRAG: true,
    enableMemoryEngine: true,
    enableParallelProcessing: true,
    enableBackgroundTasks: true,
    enableGuardrails: env.NODE_ENV === 'production',
    enableAnalytics: true,
    enableRealTimeUpdates: true,
  },

  // API configuration
  api: {
    baseUrl: env.NEXT_PUBLIC_APP_URL || 'https://ascendia-app.vercel.app',
    version: 'v1',
    enableCompression: env.NODE_ENV === 'production',
    enableCORS: env.NODE_ENV === 'production',
    maxRequestSize: '10mb',
    enableLogging: true,
  },

  // Logging configuration
  logging: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    enableStructuredLogging: env.NODE_ENV === 'production',
    enableRemoteLogging: env.NODE_ENV === 'production',
    retentionDays: 30,
    enablePersonalDataRedaction: true,
    enablePerformanceMetrics: true,
  }
}

// Helper functions
export function isProduction() {
  return env.NODE_ENV === 'production'
}

export function isDevelopment() {
  return env.NODE_ENV === 'development'
}

export function isTest() {
  return env.NODE_ENV === 'test'
}

export function getFeatureFlag(flag: keyof typeof productionConfig.features): boolean {
  return productionConfig.features[flag]
}

export function getMonitoringConfig() {
  return productionConfig.monitoring
}

export function getPerformanceConfig() {
  return productionConfig.performance
}

export function getSecurityConfig() {
  return productionConfig.security
}

// Environment-specific overrides
if (isProduction()) {
  console.log('🚀 Production configuration loaded')
  console.log('📊 Monitoring enabled:', productionConfig.monitoring.enabled)
  console.log('🛡️ Security features enabled:', Object.keys(productionConfig.security).filter(key => (productionConfig.security as any)[key] === true).length)
  console.log('⚡ Performance optimizations enabled:', Object.keys(productionConfig.performance).filter(key => (productionConfig.performance as any)[key] === true).length)
}

export default productionConfig