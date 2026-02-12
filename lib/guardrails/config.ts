// Guardrail Configuration Management System
// Purpose: Centralized configuration for AI guardrail system with type safety and environment-aware defaults

import { z } from 'zod'
import type {
  GuardrailConfig,
  SystemConfig,
  PerformanceConfig,
  SecurityConfig,
  LoggingConfig,
  PluginConfig,
  UserGuardrailPreferences,
  PerformanceThresholds,
  RateLimitingConfig,
  ContentAnonymizationConfig,
  AccessControlConfig,
  LogBatchingConfig,
  PluginId
} from './types'

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'
const isStaging = process.env.NODE_ENV === 'staging'

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/** Default system configuration */
const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  enabled: true,
  globalTimeout: isDevelopment ? 30000 : 10000, // 30s dev, 10s prod
  maxConcurrentValidations: isDevelopment ? 10 : 100,
  featureFlags: {
    enableAdvancedPromptInjection: true,
    enableHallucinationDetection: true,
    enableContentSafety: true,
    enableQualityMetrics: true,
    enableUserCustomization: true,
    enableAnalytics: isProduction,
    enableDebugLogging: isDevelopment,
  },
  rateLimiting: {
    enabled: isProduction,
    requestsPerMinute: 60,
    burstLimit: 10,
    windowMs: 60000,
  }
}

/** Default performance configuration */
const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableCaching: true,
  cacheTtl: 1000 * 60 * 15, // 15 minutes
  maxCacheSize: isDevelopment ? 100 : 1000,
  enableMonitoring: true,
  thresholds: {
    maxAverageLatency: 100, // 100ms
    maxP95Latency: 250, // 250ms
    minCacheHitRate: 0.8, // 80%
    maxErrorRate: 0.01, // 1%
  }
}

/** Default security configuration */
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enableAuditLogging: isProduction,
  contentAnonymization: {
    hashAlgorithm: 'sha256',
    enablePiiRedaction: true,
    piiPatterns: [
      // Email patterns
      '[\\w\\.-]+@[\\w\\.-]+\\.[a-z]{2,}',
      // Phone patterns
      '\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b',
      // SSN patterns
      '\\b\\d{3}-\\d{2}-\\d{4}\\b',
      // Credit card patterns
      '\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b',
    ],
    retentionPeriod: 90, // 90 days
  },
  accessControl: {
    requiredPermissions: ['guardrails:read', 'guardrails:write'],
    adminUsers: [],
    configChangeRateLimit: 5, // 5 changes per hour
  }
}

/** Default logging configuration */
const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  level: isDevelopment ? 'debug' : 'info',
  structured: true,
  destinations: [
    {
      type: 'console',
      config: {
        colorize: isDevelopment,
        prettyPrint: isDevelopment,
      },
      minLevel: 'debug',
    },
    ...(isProduction ? [{
      type: 'supabase',
      config: {
        table: 'guardrail_logs',
        batchSize: 100,
      },
      minLevel: 'info',
    }] : []),
  ],
  retentionDays: isProduction ? 90 : 7,
  batching: {
    enabled: isProduction,
    batchSize: 50,
    flushInterval: 5000, // 5 seconds
    maxBatchAge: 30000, // 30 seconds
  }
}

/** Default plugin configurations */
const DEFAULT_PLUGIN_CONFIGS: Record<PluginId, PluginConfig> = {
  'prompt-injection': {
    settings: {
      useAdvancedPatterns: true,
      semanticSimilarityThreshold: 0.85,
      confidenceThreshold: 0.8,
      patterns: [
        // System instruction overrides
        'ignore.*previous.*instruction',
        'disregard.*system.*prompt',
        'forget.*everything.*above',
        'new.*instruction.*begin',

        // Role confusion attempts
        'you.*are.*now.*assistant',
        'your.*role.*is.*to',
        'act.*as.*if.*you.*are',
        'pretend.*you.*are',

        // Context manipulation
        'context.*window.*override',
        'system.*context.*reset',
        'memory.*wipe.*command',

        // Jailbreak patterns (2024)
        'DAN.*mode.*activated',
        'Developer.*Mode.*enabled',
        'UnlimitedGPT.*activated',
        'evil.*bot.*mode',
      ],
    },
    sensitivity: 'high',
    failFast: true,
    timeout: 1000,
    cacheResults: true,
  },

  'instructor-validation': {
    settings: {
      enableStructuredOutput: true,
      retryAttempts: 3,
      retryDelay: 1000,
      fallbackToRawOutput: false,
    },
    sensitivity: 'high',
    failFast: false,
    timeout: 5000,
    cacheResults: true,
  },

  'content-safety': {
    settings: {
      toxicityThreshold: 0.8,
      biasThreshold: 0.7,
      inappropriateContentThreshold: 0.9,
      enableCulturalSensitivity: true,
      enableProfessionalStandards: true,
    },
    sensitivity: 'medium',
    failFast: false,
    timeout: 2000,
    cacheResults: true,
  },

  'hallucination-detector': {
    settings: {
      confidenceThreshold: 0.8,
      factCheckingEnabled: true,
      citationRequired: false,
      knowledgeCutoffAware: true,
      uncertaintyThreshold: 0.6,
    },
    sensitivity: 'medium',
    failFast: false,
    timeout: 3000,
    cacheResults: true,
  },

  'quality-metrics': {
    settings: {
      relevanceThreshold: 0.7,
      coherenceThreshold: 0.8,
      completenessThreshold: 0.75,
      professionalQualityEnabled: true,
    },
    sensitivity: 'low',
    failFast: false,
    timeout: 1500,
    cacheResults: true,
  },
}

/** Default user preferences */
const DEFAULT_USER_PREFERENCES: UserGuardrailPreferences = {
  sensitivity: 'balanced',
  plugins: {
    'prompt-injection': {
      enabled: true,
      sensitivity: 'high',
    },
    'instructor-validation': {
      enabled: true,
      sensitivity: 'high',
    },
    'content-safety': {
      enabled: true,
      sensitivity: 'medium',
    },
    'hallucination-detector': {
      enabled: true,
      sensitivity: 'medium',
    },
    'quality-metrics': {
      enabled: true,
      sensitivity: 'low',
    },
  },
  contentTypes: {
    'email': {
      strictMode: false,
      allowedCharacteristics: ['informal', 'personal', 'direct'],
      blockedPatterns: [],
    },
    'letter': {
      strictMode: true,
      allowedCharacteristics: ['formal', 'professional', 'structured'],
      blockedPatterns: ['slang', 'abbreviations'],
    },
    'proposal': {
      strictMode: true,
      allowedCharacteristics: ['formal', 'professional', 'detailed', 'persuasive'],
      blockedPatterns: ['casual', 'personal'],
    },
    'general': {
      strictMode: false,
      allowedCharacteristics: ['flexible', 'adaptable'],
      blockedPatterns: [],
    },
    'memo': {
      strictMode: true,
      allowedCharacteristics: ['professional', 'concise', 'clear'],
      blockedPatterns: ['lengthy', 'conversational'],
    },
  },
  customRules: [],
  notifications: {
    onViolation: true,
    onFalsePositive: true,
    email: false,
    inApp: true,
  },
}

// ============================================================================
// CONFIGURATION VALIDATION SCHEMAS
// ============================================================================

const PerformanceThresholdsSchema = z.object({
  maxAverageLatency: z.number().min(0),
  maxP95Latency: z.number().min(0),
  minCacheHitRate: z.number().min(0).max(1),
  maxErrorRate: z.number().min(0).max(1),
})

const RateLimitingConfigSchema = z.object({
  enabled: z.boolean(),
  requestsPerMinute: z.number().min(1),
  burstLimit: z.number().min(1),
  windowMs: z.number().min(1000),
})

const SystemConfigSchema = z.object({
  enabled: z.boolean(),
  globalTimeout: z.number().min(1000),
  maxConcurrentValidations: z.number().min(1),
  featureFlags: z.record(z.boolean()),
  rateLimiting: RateLimitingConfigSchema,
})

const PerformanceConfigSchema = z.object({
  enableCaching: z.boolean(),
  cacheTtl: z.number().min(0),
  maxCacheSize: z.number().min(1),
  enableMonitoring: z.boolean(),
  thresholds: PerformanceThresholdsSchema,
})

const ContentAnonymizationConfigSchema = z.object({
  hashAlgorithm: z.enum(['sha256', 'sha512']),
  enablePiiRedaction: z.boolean(),
  piiPatterns: z.array(z.string()),
  retentionPeriod: z.number().min(1),
})

const AccessControlConfigSchema = z.object({
  requiredPermissions: z.array(z.string()),
  adminUsers: z.array(z.string()),
  configChangeRateLimit: z.number().min(1),
})

const SecurityConfigSchema = z.object({
  enableAuditLogging: z.boolean(),
  contentAnonymization: ContentAnonymizationConfigSchema,
  accessControl: AccessControlConfigSchema,
})

const LogDestinationSchema = z.object({
  type: z.enum(['console', 'file', 'supabase', 'elasticsearch']),
  config: z.record(z.unknown()),
  minLevel: z.enum(['debug', 'info', 'warn', 'error']),
})

const LogBatchingConfigSchema = z.object({
  enabled: z.boolean(),
  batchSize: z.number().min(1),
  flushInterval: z.number().min(1000),
  maxBatchAge: z.number().min(5000),
})

const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  structured: z.boolean(),
  destinations: z.array(LogDestinationSchema),
  retentionDays: z.number().min(1),
  batching: LogBatchingConfigSchema,
})

const PluginConfigSchema = z.object({
  settings: z.record(z.unknown()),
  sensitivity: z.enum(['low', 'medium', 'high', 'custom']),
  failFast: z.boolean(),
  timeout: z.number().min(100),
  cacheResults: z.boolean(),
})

const GuardrailConfigSchema = z.object({
  system: SystemConfigSchema,
  plugins: z.record(PluginConfigSchema),
  defaultUserPreferences: z.any(), // Complex schema - validate separately
  performance: PerformanceConfigSchema,
  security: SecurityConfigSchema,
  logging: LoggingConfigSchema,
})

// ============================================================================
// CONFIGURATION MANAGER CLASS
// ============================================================================

export class ConfigurationManager {
  private static instance: ConfigurationManager | null = null
  private config: GuardrailConfig
  private listeners: Map<string, (config: GuardrailConfig) => void> = new Map()

  private constructor() {
    this.config = this.buildDefaultConfig()
    this.loadFromEnvironment()
  }

  /** Get singleton instance */
  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager()
    }
    return ConfigurationManager.instance
  }

  /** Build default configuration */
  private buildDefaultConfig(): GuardrailConfig {
    return {
      system: DEFAULT_SYSTEM_CONFIG,
      plugins: DEFAULT_PLUGIN_CONFIGS,
      defaultUserPreferences: DEFAULT_USER_PREFERENCES,
      performance: DEFAULT_PERFORMANCE_CONFIG,
      security: DEFAULT_SECURITY_CONFIG,
      logging: DEFAULT_LOGGING_CONFIG,
    }
  }

  /** Load configuration overrides from environment variables */
  private loadFromEnvironment(): void {
    // System configuration from environment
    if (process.env.GUARDRAILS_ENABLED !== undefined) {
      this.config.system.enabled = process.env.GUARDRAILS_ENABLED === 'true'
    }

    if (process.env.GUARDRAILS_GLOBAL_TIMEOUT) {
      this.config.system.globalTimeout = parseInt(process.env.GUARDRAILS_GLOBAL_TIMEOUT, 10)
    }

    if (process.env.GUARDRAILS_MAX_CONCURRENT) {
      this.config.system.maxConcurrentValidations = parseInt(process.env.GUARDRAILS_MAX_CONCURRENT, 10)
    }

    // Performance configuration
    if (process.env.GUARDRAILS_ENABLE_CACHING !== undefined) {
      this.config.performance.enableCaching = process.env.GUARDRAILS_ENABLE_CACHING === 'true'
    }

    if (process.env.GUARDRAILS_CACHE_TTL) {
      this.config.performance.cacheTtl = parseInt(process.env.GUARDRAILS_CACHE_TTL, 10)
    }

    // Security configuration
    if (process.env.GUARDRAILS_ENABLE_AUDIT_LOGGING !== undefined) {
      this.config.security.enableAuditLogging = process.env.GUARDRAILS_ENABLE_AUDIT_LOGGING === 'true'
    }

    // Logging configuration
    if (process.env.GUARDRAILS_LOG_LEVEL) {
      this.config.logging.level = process.env.GUARDRAILS_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error'
    }
  }

  /** Get current configuration */
  getConfig(): GuardrailConfig {
    return structuredClone(this.config)
  }

  /** Get system configuration */
  getSystemConfig(): SystemConfig {
    return structuredClone(this.config.system)
  }

  /** Get plugin configuration */
  getPluginConfig(pluginId: PluginId): PluginConfig | null {
    const config = this.config.plugins[pluginId]
    return config ? structuredClone(config) : null
  }

  /** Get performance configuration */
  getPerformanceConfig(): PerformanceConfig {
    return structuredClone(this.config.performance)
  }

  /** Get security configuration */
  getSecurityConfig(): SecurityConfig {
    return structuredClone(this.config.security)
  }

  /** Get logging configuration */
  getLoggingConfig(): LoggingConfig {
    return structuredClone(this.config.logging)
  }

  /** Get default user preferences */
  getDefaultUserPreferences(): UserGuardrailPreferences {
    return structuredClone(this.config.defaultUserPreferences)
  }

  /** Update system configuration */
  updateSystemConfig(updates: Partial<SystemConfig>): void {
    const newSystemConfig = { ...this.config.system, ...updates }

    // Validate updated configuration
    SystemConfigSchema.parse(newSystemConfig)

    this.config.system = newSystemConfig
    this.notifyListeners()
  }

  /** Update plugin configuration */
  updatePluginConfig(pluginId: PluginId, updates: Partial<PluginConfig>): void {
    const currentConfig = this.config.plugins[pluginId] || DEFAULT_PLUGIN_CONFIGS[pluginId]
    const newPluginConfig = { ...currentConfig, ...updates }

    // Validate updated configuration
    PluginConfigSchema.parse(newPluginConfig)

    this.config.plugins[pluginId] = newPluginConfig
    this.notifyListeners()
  }

  /** Update performance configuration */
  updatePerformanceConfig(updates: Partial<PerformanceConfig>): void {
    const newPerformanceConfig = { ...this.config.performance, ...updates }

    // Validate updated configuration
    PerformanceConfigSchema.parse(newPerformanceConfig)

    this.config.performance = newPerformanceConfig
    this.notifyListeners()
  }

  /** Update security configuration */
  updateSecurityConfig(updates: Partial<SecurityConfig>): void {
    const newSecurityConfig = { ...this.config.security, ...updates }

    // Validate updated configuration
    SecurityConfigSchema.parse(newSecurityConfig)

    this.config.security = newSecurityConfig
    this.notifyListeners()
  }

  /** Update logging configuration */
  updateLoggingConfig(updates: Partial<LoggingConfig>): void {
    const newLoggingConfig = { ...this.config.logging, ...updates }

    // Validate updated configuration
    LoggingConfigSchema.parse(newLoggingConfig)

    this.config.logging = newLoggingConfig
    this.notifyListeners()
  }

  /** Validate entire configuration */
  validateConfig(config?: GuardrailConfig): { isValid: boolean; errors: string[] } {
    const configToValidate = config || this.config
    const errors: string[] = []

    try {
      GuardrailConfigSchema.parse(configToValidate)
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(err => `${err.path.join('.')}: ${err.message}`))
      } else {
        errors.push('Unknown validation error')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /** Reset to default configuration */
  resetToDefaults(): void {
    this.config = this.buildDefaultConfig()
    this.loadFromEnvironment()
    this.notifyListeners()
  }

  /** Subscribe to configuration changes */
  subscribe(listenerId: string, callback: (config: GuardrailConfig) => void): void {
    this.listeners.set(listenerId, callback)
  }

  /** Unsubscribe from configuration changes */
  unsubscribe(listenerId: string): void {
    this.listeners.delete(listenerId)
  }

  /** Notify all listeners of configuration changes */
  private notifyListeners(): void {
    for (const [listenerId, callback] of this.listeners) {
      try {
        callback(this.getConfig())
      } catch (error) {
        console.error(`Error notifying config listener ${listenerId}:`, error)
      }
    }
  }

  /** Export configuration for backup */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2)
  }

  /** Import configuration from backup */
  importConfig(configJson: string): { success: boolean; errors: string[] } {
    try {
      const importedConfig = JSON.parse(configJson) as GuardrailConfig
      const validation = this.validateConfig(importedConfig)

      if (validation.isValid) {
        this.config = importedConfig
        this.notifyListeners()
        return { success: true, errors: [] }
      } else {
        return { success: false, errors: validation.errors }
      }
    } catch (error) {
      return {
        success: false,
        errors: [`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  /** Get configuration for specific environment */
  getEnvironmentConfig(): Partial<GuardrailConfig> {
    if (isDevelopment) {
      return {
        system: {
          ...this.config.system,
          globalTimeout: 30000,
          rateLimiting: { ...this.config.system.rateLimiting, enabled: false },
        },
        logging: {
          ...this.config.logging,
          level: 'debug',
          destinations: this.config.logging.destinations.filter(dest => dest.type === 'console'),
        },
        performance: {
          ...this.config.performance,
          maxCacheSize: 100,
        }
      }
    }

    if (isStaging) {
      return {
        system: {
          ...this.config.system,
          rateLimiting: { ...this.config.system.rateLimiting, requestsPerMinute: 30 },
        },
        logging: {
          ...this.config.logging,
          level: 'info',
          retentionDays: 30,
        }
      }
    }

    // Production config (default)
    return this.config
  }
}

// ============================================================================
// CONFIGURATION UTILITIES
// ============================================================================

/** Get current configuration manager instance */
export function getConfigManager(): ConfigurationManager {
  return ConfigurationManager.getInstance()
}

/** Get current guardrail configuration */
export function getCurrentConfig(): GuardrailConfig {
  return getConfigManager().getConfig()
}

/** Get plugin configuration by ID */
export function getPluginConfig(pluginId: PluginId): PluginConfig | null {
  return getConfigManager().getPluginConfig(pluginId)
}

/** Check if a feature flag is enabled */
export function isFeatureEnabled(featureName: string): boolean {
  const config = getConfigManager().getSystemConfig()
  return config.featureFlags[featureName] === true
}

/** Get environment-specific configuration */
export function getEnvironmentConfig(): Partial<GuardrailConfig> {
  return getConfigManager().getEnvironmentConfig()
}

/** Validate a configuration object */
export function validateConfiguration(config: GuardrailConfig): { isValid: boolean; errors: string[] } {
  return getConfigManager().validateConfig(config)
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SUPPORTED_PLUGIN_IDS = Object.keys(DEFAULT_PLUGIN_CONFIGS) as PluginId[]

export const DEFAULT_TIMEOUTS = {
  FAST_VALIDATION: 1000,    // 1 second
  MEDIUM_VALIDATION: 3000,  // 3 seconds
  SLOW_VALIDATION: 5000,    // 5 seconds
  GLOBAL_TIMEOUT: 10000,    // 10 seconds
} as const

export const CACHE_KEYS = {
  CONFIG: 'guardrail:config',
  PLUGIN_CONFIG: (id: PluginId) => `guardrail:plugin:${id}`,
  USER_PREFERENCES: (userId: string) => `guardrail:user:${userId}`,
  VALIDATION_RESULT: (hash: string) => `guardrail:result:${hash}`,
} as const

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
  DEFAULT_SECURITY_CONFIG,
  DEFAULT_LOGGING_CONFIG,
  DEFAULT_PLUGIN_CONFIGS,
  DEFAULT_USER_PREFERENCES,
}

export type {
  GuardrailConfig,
  SystemConfig,
  PerformanceConfig,
  SecurityConfig,
  LoggingConfig,
  PluginConfig,
  UserGuardrailPreferences,
}