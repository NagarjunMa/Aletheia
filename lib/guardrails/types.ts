// Guardrail System Type Definitions
// Purpose: Comprehensive TypeScript types for modular AI guardrail system

import { z } from 'zod'

// ============================================================================
// CORE TYPES
// ============================================================================

/** Unique correlation ID for request tracking */
export type CorrelationId = string

/** User identifier (can be pseudonymized for privacy) */
export type UserId = string

/** Content hash for privacy-preserving logging */
export type ContentHash = string

/** Plugin identifier */
export type PluginId = string

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

/** Validation result from a guardrail plugin */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean

  /** Confidence score (0-1) */
  confidence: number

  /** Severity level if invalid */
  severity?: 'low' | 'medium' | 'high' | 'critical'

  /** Reason for validation failure */
  reason?: string

  /** Plugin that generated this result */
  pluginId: PluginId

  /** Processing time in milliseconds */
  processingTime: number

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** Suggested remediation actions */
  suggestions?: string[]
}

/** Aggregated validation results from multiple plugins */
export interface AggregatedValidationResult {
  /** Overall validation status */
  isValid: boolean

  /** Highest severity found */
  maxSeverity: 'none' | 'low' | 'medium' | 'high' | 'critical'

  /** Total processing time */
  totalProcessingTime: number

  /** Individual plugin results */
  results: ValidationResult[]

  /** Action to take based on results */
  action: ValidationAction

  /** Correlation ID for tracking */
  correlationId: CorrelationId
}

/** Actions that can be taken based on validation */
export type ValidationAction = 'allow' | 'block' | 'modify' | 'flag' | 'retry'

// ============================================================================
// PLUGIN ARCHITECTURE
// ============================================================================

/** Base interface for all guardrail plugins */
export interface GuardrailPlugin {
  /** Unique plugin identifier */
  id: PluginId

  /** Human-readable name */
  name: string

  /** Plugin description */
  description: string

  /** Plugin version */
  version: string

  /** Priority for execution order (lower = higher priority) */
  priority: number

  /** Plugin type */
  type: PluginType

  /** Whether plugin is enabled */
  enabled: boolean

  /** Plugin configuration */
  config: PluginConfig

  /** Validate content */
  validate(content: string, context: ValidationContext): Promise<ValidationResult>

  /** Initialize plugin (optional) */
  initialize?(): Promise<void>

  /** Cleanup plugin resources (optional) */
  cleanup?(): Promise<void>

  /** Update plugin configuration (optional) */
  updateConfig?(config: Partial<PluginConfig>): Promise<void>
}

/** Types of guardrail plugins */
export type PluginType =
  | 'input-validation'      // Validates user input before AI processing
  | 'output-validation'     // Validates AI output before returning to user
  | 'content-safety'        // Filters harmful, toxic, or inappropriate content
  | 'hallucination-detection' // Detects factually incorrect information
  | 'quality-assessment'    // Assesses response quality and relevance
  | 'custom'               // User-defined custom validation

/** Plugin configuration interface */
export interface PluginConfig {
  /** Plugin-specific settings */
  settings: Record<string, unknown>

  /** Sensitivity level */
  sensitivity: 'low' | 'medium' | 'high' | 'custom'

  /** Whether to fail fast on validation failure */
  failFast: boolean

  /** Maximum processing time before timeout */
  timeout: number

  /** Cache results for repeated content */
  cacheResults: boolean
}

// ============================================================================
// VALIDATION CONTEXT
// ============================================================================

/** Context information for validation */
export interface ValidationContext {
  /** Correlation ID for this request */
  correlationId: CorrelationId

  /** User identifier */
  userId?: UserId

  /** Session identifier */
  sessionId?: string

  /** Request type */
  requestType: RequestType

  /** Content type being validated */
  contentType: ContentType

  /** Processing stage */
  stage: ProcessingStage

  /** User preferences for this validation */
  userPreferences?: UserGuardrailPreferences

  /** Additional context metadata */
  metadata: Record<string, unknown>

  /** Timestamp */
  timestamp: Date
}

/** Types of requests that can be validated */
export type RequestType = 'cpl-analysis' | 'draft-generation' | 'voice-learning' | 'embedding-generation'

/** Content types supported by the system */
export type ContentType = 'instagram_post' | 'linkedin' | 'medium_article' | 'email' | 'conversational'

/** Processing stages where validation can occur */
export type ProcessingStage = 'input' | 'pre-processing' | 'post-processing' | 'output' | 'streaming'

// ============================================================================
// USER PREFERENCES
// ============================================================================

/** User preferences for guardrail behavior */
export interface UserGuardrailPreferences {
  /** Overall sensitivity level */
  sensitivity: 'permissive' | 'balanced' | 'strict' | 'custom'

  /** Individual plugin settings */
  plugins: Record<PluginId, PluginPreferences>

  /** Content type specific preferences */
  contentTypes: Record<ContentType, ContentTypePreferences>

  /** Custom rules defined by user */
  customRules: CustomRule[]

  /** Notification preferences */
  notifications: NotificationPreferences
}

/** Preferences for individual plugins */
export interface PluginPreferences {
  /** Whether plugin is enabled */
  enabled: boolean

  /** Sensitivity override */
  sensitivity?: 'low' | 'medium' | 'high'

  /** Custom configuration */
  config?: Record<string, unknown>
}

/** Preferences for content types */
export interface ContentTypePreferences {
  /** Stricter validation for professional content */
  strictMode: boolean

  /** Allowed content characteristics */
  allowedCharacteristics: string[]

  /** Blocked content patterns */
  blockedPatterns: string[]
}

/** Custom user-defined validation rule */
export interface CustomRule {
  /** Rule identifier */
  id: string

  /** Rule name */
  name: string

  /** Rule pattern (regex or keyword) */
  pattern: string

  /** Action to take when rule matches */
  action: ValidationAction

  /** Rule severity */
  severity: 'low' | 'medium' | 'high' | 'critical'

  /** Whether rule is enabled */
  enabled: boolean
}

/** Notification preferences */
export interface NotificationPreferences {
  /** Notify on violations */
  onViolation: boolean

  /** Notify on false positives */
  onFalsePositive: boolean

  /** Email notifications */
  email: boolean

  /** In-app notifications */
  inApp: boolean
}

// ============================================================================
// LOGGING TYPES
// ============================================================================

/** Structured log entry for guardrail events */
export interface GuardrailLogEntry {
  /** Unique log entry identifier */
  id: string

  /** Correlation ID for request tracking */
  correlationId: CorrelationId

  /** Pseudonymized user identifier */
  userId?: string

  /** Event type */
  eventType: LogEventType

  /** Event severity */
  severity: 'debug' | 'info' | 'warn' | 'error' | 'critical'

  /** Content hash (privacy-preserving) */
  contentHash?: ContentHash

  /** Plugin that generated the event */
  pluginId?: PluginId

  /** Validation result */
  validationResult?: ValidationResult

  /** Action taken */
  actionTaken?: ValidationAction

  /** Processing metrics */
  metrics: ProcessingMetrics

  /** Additional metadata */
  metadata: Record<string, unknown>

  /** Timestamp */
  timestamp: Date

  /** Environment */
  environment: 'development' | 'staging' | 'production'
}

/** Types of log events */
export type LogEventType =
  | 'validation-start'
  | 'validation-complete'
  | 'validation-failed'
  | 'plugin-error'
  | 'config-updated'
  | 'performance-warning'
  | 'security-violation'
  | 'user-feedback'

/** Processing performance metrics */
export interface ProcessingMetrics {
  /** Total processing time in milliseconds */
  totalTime: number

  /** Individual plugin processing times */
  pluginTimes: Record<PluginId, number>

  /** Memory usage in MB */
  memoryUsage?: number

  /** CPU usage percentage */
  cpuUsage?: number

  /** Cache hit/miss information */
  cacheStats?: {
    hits: number
    misses: number
    hitRate: number
  }
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/** Global guardrail system configuration */
export interface GuardrailConfig {
  /** System-wide settings */
  system: SystemConfig

  /** Plugin configurations */
  plugins: Record<PluginId, PluginConfig>

  /** Default user preferences */
  defaultUserPreferences: UserGuardrailPreferences

  /** Performance settings */
  performance: PerformanceConfig

  /** Security settings */
  security: SecurityConfig

  /** Logging configuration */
  logging: LoggingConfig
}

/** System-wide configuration */
export interface SystemConfig {
  /** Whether guardrails are enabled globally */
  enabled: boolean

  /** Maximum processing time before timeout */
  globalTimeout: number

  /** Maximum concurrent validations */
  maxConcurrentValidations: number

  /** Feature flags */
  featureFlags: Record<string, boolean>

  /** Rate limiting settings */
  rateLimiting: RateLimitingConfig
}

/** Performance configuration */
export interface PerformanceConfig {
  /** Enable caching */
  enableCaching: boolean

  /** Cache TTL in milliseconds */
  cacheTtl: number

  /** Maximum cache size */
  maxCacheSize: number

  /** Enable performance monitoring */
  enableMonitoring: boolean

  /** Performance thresholds */
  thresholds: PerformanceThresholds
}

/** Performance thresholds for alerts */
export interface PerformanceThresholds {
  /** Maximum average latency in milliseconds */
  maxAverageLatency: number

  /** Maximum 95th percentile latency */
  maxP95Latency: number

  /** Minimum cache hit rate */
  minCacheHitRate: number

  /** Maximum error rate percentage */
  maxErrorRate: number
}

/** Security configuration */
export interface SecurityConfig {
  /** Enable audit logging */
  enableAuditLogging: boolean

  /** Content anonymization settings */
  contentAnonymization: ContentAnonymizationConfig

  /** Access control settings */
  accessControl: AccessControlConfig
}

/** Content anonymization configuration */
export interface ContentAnonymizationConfig {
  /** Hash algorithm for content */
  hashAlgorithm: 'sha256' | 'sha512'

  /** Enable PII redaction */
  enablePiiRedaction: boolean

  /** PII patterns to redact */
  piiPatterns: string[]

  /** Retention period for anonymized data */
  retentionPeriod: number
}

/** Access control configuration */
export interface AccessControlConfig {
  /** Required permissions for guardrail configuration */
  requiredPermissions: string[]

  /** Admin users who can modify system config */
  adminUsers: string[]

  /** Rate limiting for configuration changes */
  configChangeRateLimit: number
}

/** Logging configuration */
export interface LoggingConfig {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error'

  /** Enable structured logging */
  structured: boolean

  /** Log destinations */
  destinations: LogDestination[]

  /** Log retention period in days */
  retentionDays: number

  /** Batch logging settings */
  batching: LogBatchingConfig
}

/** Log destination configuration */
export interface LogDestination {
  /** Destination type */
  type: 'console' | 'file' | 'supabase' | 'elasticsearch'

  /** Destination-specific configuration */
  config: Record<string, unknown>

  /** Minimum log level for this destination */
  minLevel: 'debug' | 'info' | 'warn' | 'error'
}

/** Log batching configuration */
export interface LogBatchingConfig {
  /** Enable batch logging */
  enabled: boolean

  /** Batch size */
  batchSize: number

  /** Flush interval in milliseconds */
  flushInterval: number

  /** Maximum batch age before forced flush */
  maxBatchAge: number
}

/** Rate limiting configuration */
export interface RateLimitingConfig {
  /** Enable rate limiting */
  enabled: boolean

  /** Requests per minute per user */
  requestsPerMinute: number

  /** Burst allowance */
  burstLimit: number

  /** Rate limit window in milliseconds */
  windowMs: number
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

/** Zod schema for validation result */
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  confidence: z.number().min(0).max(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  reason: z.string().optional(),
  pluginId: z.string(),
  processingTime: z.number().min(0),
  metadata: z.record(z.unknown()).optional(),
  suggestions: z.array(z.string()).optional(),
})

/** Zod schema for validation context */
export const ValidationContextSchema = z.object({
  correlationId: z.string(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  requestType: z.enum(['cpl-analysis', 'draft-generation', 'voice-learning', 'embedding-generation']),
  contentType: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational']),
  stage: z.enum(['input', 'pre-processing', 'post-processing', 'output', 'streaming']),
  metadata: z.record(z.unknown()),
  timestamp: z.date(),
})

/** Zod schema for plugin configuration */
export const PluginConfigSchema = z.object({
  settings: z.record(z.unknown()),
  sensitivity: z.enum(['low', 'medium', 'high', 'custom']),
  failFast: z.boolean(),
  timeout: z.number().min(0),
  cacheResults: z.boolean(),
})

// ============================================================================
// ERROR TYPES
// ============================================================================

/** Base error class for guardrail system */
export class GuardrailError extends Error {
  public readonly code: string
  public readonly correlationId?: CorrelationId
  public readonly context?: Record<string, unknown>

  constructor(
    message: string,
    code: string,
    correlationId?: CorrelationId,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'GuardrailError'
    this.code = code
    this.correlationId = correlationId
    this.context = context
  }
}

/** Plugin validation error */
export class PluginValidationError extends GuardrailError {
  public readonly pluginId: PluginId

  constructor(
    message: string,
    pluginId: PluginId,
    correlationId?: CorrelationId,
    context?: Record<string, unknown>
  ) {
    super(message, 'PLUGIN_VALIDATION_ERROR', correlationId, context)
    this.name = 'PluginValidationError'
    this.pluginId = pluginId
  }
}

/** Configuration error */
export class ConfigurationError extends GuardrailError {
  constructor(
    message: string,
    correlationId?: CorrelationId,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFIGURATION_ERROR', correlationId, context)
    this.name = 'ConfigurationError'
  }
}

/** Timeout error */
export class TimeoutError extends GuardrailError {
  public readonly timeoutMs: number

  constructor(
    message: string,
    timeoutMs: number,
    correlationId?: CorrelationId,
    context?: Record<string, unknown>
  ) {
    super(message, 'TIMEOUT_ERROR', correlationId, context)
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Promise that can be cancelled */
export interface CancellablePromise<T> extends Promise<T> {
  cancel(): void
  isCancelled(): boolean
}

/** Plugin execution statistics */
export interface PluginStats {
  /** Total executions */
  totalExecutions: number

  /** Successful executions */
  successfulExecutions: number

  /** Failed executions */
  failedExecutions: number

  /** Average processing time */
  averageProcessingTime: number

  /** 95th percentile processing time */
  p95ProcessingTime: number

  /** Last execution timestamp */
  lastExecution?: Date

  /** Error rate percentage */
  errorRate: number
}

/** System health status */
export interface SystemHealthStatus {
  /** Overall system status */
  status: 'healthy' | 'degraded' | 'unhealthy'

  /** Individual component statuses */
  components: Record<string, ComponentHealthStatus>

  /** Performance metrics */
  performance: SystemPerformanceMetrics

  /** Last check timestamp */
  lastCheck: Date
}

/** Component health status */
export interface ComponentHealthStatus {
  /** Component status */
  status: 'healthy' | 'degraded' | 'unhealthy'

  /** Status message */
  message?: string

  /** Last check timestamp */
  lastCheck: Date

  /** Component-specific metrics */
  metrics?: Record<string, number>
}

/** System performance metrics */
export interface SystemPerformanceMetrics {
  /** Average latency across all validations */
  averageLatency: number

  /** 95th percentile latency */
  p95Latency: number

  /** 99th percentile latency */
  p99Latency: number

  /** Throughput (validations per second) */
  throughput: number

  /** Error rate percentage */
  errorRate: number

  /** Cache hit rate percentage */
  cacheHitRate: number

  /** Memory usage in MB */
  memoryUsage: number

  /** CPU usage percentage */
  cpuUsage: number
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/** Type guard for validation result */
export function isValidationResult(obj: unknown): obj is ValidationResult {
  try {
    ValidationResultSchema.parse(obj)
    return true
  } catch {
    return false
  }
}

/** Type guard for validation context */
export function isValidationContext(obj: unknown): obj is ValidationContext {
  try {
    ValidationContextSchema.parse(obj)
    return true
  } catch {
    return false
  }
}

/** Type guard for plugin configuration */
export function isPluginConfig(obj: unknown): obj is PluginConfig {
  try {
    PluginConfigSchema.parse(obj)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  // Core validation types
  ValidationResult,
  AggregatedValidationResult,
  ValidationAction,
  ValidationContext,

  // Plugin types
  GuardrailPlugin,
  PluginType,
  PluginConfig,
  PluginPreferences,
  PluginStats,

  // User preference types
  UserGuardrailPreferences,
  ContentTypePreferences,
  CustomRule,
  NotificationPreferences,

  // Configuration types
  GuardrailConfig,
  SystemConfig,
  PerformanceConfig,
  SecurityConfig,
  LoggingConfig,

  // Logging types
  GuardrailLogEntry,
  LogEventType,
  ProcessingMetrics,
  LogDestination,
  LogBatchingConfig,

  // Health and monitoring types
  SystemHealthStatus,
  ComponentHealthStatus,
  SystemPerformanceMetrics,

  // Utility types
  CancellablePromise,
}