// Privacy-Preserving Structured Logger for Guardrail System
// Purpose: High-performance logging with content anonymization and GDPR compliance

import pino from 'pino'
import { createHash } from 'crypto'
import type {
  GuardrailLogEntry,
  LogEventType,
  ProcessingMetrics,
  CorrelationId,
  ValidationResult,
  ValidationAction,
  PluginId,
  ContentHash,
} from '../types'
import { getConfigManager } from '../config'

// ============================================================================
// CONTENT ANONYMIZATION
// ============================================================================

export class ContentAnonymizer {
  private readonly hashAlgorithm: string
  private readonly piiPatterns: RegExp[]

  constructor(hashAlgorithm: 'sha256' | 'sha512' = 'sha256', piiPatterns: string[] = []) {
    this.hashAlgorithm = hashAlgorithm
    this.piiPatterns = piiPatterns.map(pattern => new RegExp(pattern, 'gi'))
  }

  /** Hash content for privacy-preserving identification */
  hashContent(content: string): ContentHash {
    return createHash(this.hashAlgorithm)
      .update(content.trim().toLowerCase())
      .digest('hex')
      .substring(0, 16) // Use first 16 characters for shorter logs
  }

  /** Pseudonymize user ID */
  pseudonymizeUserId(userId: string): string {
    return createHash(this.hashAlgorithm)
      .update(`user:${userId}`)
      .digest('hex')
      .substring(0, 12)
  }

  /** Redact PII from text */
  redactPII(text: string): string {
    let redacted = text

    for (const pattern of this.piiPatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]')
    }

    return redacted
  }

  /** Extract safe metadata from content */
  extractSafeMetadata(content: string): Record<string, unknown> {
    return {
      length: content.length,
      wordCount: content.split(/\s+/).length,
      hasNumbers: /\d/.test(content),
      hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(content),
      language: this.detectLanguage(content), // Simplified language detection
    }
  }

  /** Simple language detection (could be enhanced) */
  private detectLanguage(content: string): string {
    // Very basic language detection - in production, use a proper language detection library
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']
    const words = content.toLowerCase().split(/\s+/)
    const englishWordCount = words.filter(word => englishWords.includes(word)).length

    return englishWordCount > words.length * 0.1 ? 'en' : 'unknown'
  }
}

// ============================================================================
// SUPABASE LOG TRANSPORT
// ============================================================================

export class SupabaseTransport {
  private readonly batchSize: number
  private readonly flushInterval: number
  private readonly maxBatchAge: number
  private batch: GuardrailLogEntry[] = []
  private lastFlush: Date = new Date()
  private flushTimer: NodeJS.Timeout | null = null

  constructor(options: { batchSize?: number; flushInterval?: number; maxBatchAge?: number } = {}) {
    this.batchSize = options.batchSize || 50
    this.flushInterval = options.flushInterval || 5000
    this.maxBatchAge = options.maxBatchAge || 30000

    // Start flush timer
    this.startFlushTimer()
  }

  /** Add log entry to batch */
  async write(logEntry: GuardrailLogEntry): Promise<void> {
    this.batch.push(logEntry)

    // Flush if batch is full
    if (this.batch.length >= this.batchSize) {
      await this.flush()
    }

    // Flush if batch is too old
    const batchAge = Date.now() - this.lastFlush.getTime()
    if (batchAge > this.maxBatchAge) {
      await this.flush()
    }
  }

  /** Flush batch to Supabase */
  private async flush(): Promise<void> {
    if (this.batch.length === 0) return

    try {
      // In a real implementation, you would send to Supabase here
      // For now, we'll just log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SUPABASE TRANSPORT] Flushing ${this.batch.length} log entries`)
        // console.log(JSON.stringify(this.batch, null, 2))
      } else {
        // TODO: Implement actual Supabase insertion
        // const { createClient } = require('@/lib/supabase/server')
        // const supabase = createClient()
        // await supabase.from('guardrail_logs').insert(this.batch)
      }

      this.batch = []
      this.lastFlush = new Date()
    } catch (error) {
      console.error('Failed to flush logs to Supabase:', error)
      // Keep the batch for retry
    }
  }

  /** Start periodic flush timer */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flush()
    }, this.flushInterval)
  }

  /** Stop flush timer and flush remaining entries */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    await this.flush()
  }
}

// ============================================================================
// GUARDRAIL LOGGER CLASS
// ============================================================================

export class GuardrailLogger {
  private static instance: GuardrailLogger | null = null
  private logger: pino.Logger
  private anonymizer: ContentAnonymizer
  private supabaseTransport: SupabaseTransport | null = null

  private constructor() {
    const config = getConfigManager().getLoggingConfig()
    const securityConfig = getConfigManager().getSecurityConfig()

    // Initialize content anonymizer
    this.anonymizer = new ContentAnonymizer(
      securityConfig.contentAnonymization.hashAlgorithm,
      securityConfig.contentAnonymization.piiPatterns
    )

    // Initialize Supabase transport if enabled
    if (config.destinations.some(dest => dest.type === 'supabase')) {
      this.supabaseTransport = new SupabaseTransport({
        batchSize: config.batching.batchSize,
        flushInterval: config.batching.flushInterval,
        maxBatchAge: config.batching.maxBatchAge,
      })
    }

    // Initialize Pino logger
    this.logger = pino({
      level: config.level,
      formatters: {
        level: (label) => ({ level: label }),
        bindings: (bindings) => ({
          pid: bindings.pid,
          hostname: bindings.hostname,
          service: 'ascendia-guardrails',
          version: process.env.npm_package_version || 'unknown',
        }),
      },
      redact: {
        paths: [
          'content',
          'prompt',
          'response',
          'userInput',
          'email',
          'password',
          'token',
          'apiKey',
        ],
        remove: true,
      },
      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
      ...(process.env.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname,service,version',
          },
        },
      }),
    })

    this.logger.info('GuardrailLogger initialized', {
      logLevel: config.level,
      structuredLogging: config.structured,
      supabaseEnabled: !!this.supabaseTransport,
    })
  }

  /** Get singleton instance */
  static getInstance(): GuardrailLogger {
    if (!GuardrailLogger.instance) {
      GuardrailLogger.instance = new GuardrailLogger()
    }
    return GuardrailLogger.instance
  }

  /** Log validation start event */
  async logValidationStart(
    correlationId: CorrelationId,
    options: {
      userId?: string
      requestType?: string
      contentType?: string
      stage?: string
      content?: string
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<void> {
    const logEntry = this.createLogEntry(
      correlationId,
      'validation-start',
      'info',
      {
        userId: options.userId,
        contentHash: options.content ? this.anonymizer.hashContent(options.content) : undefined,
        requestType: options.requestType,
        contentType: options.contentType,
        stage: options.stage,
        ...options.metadata,
      }
    )

    this.logger.info('Validation started', logEntry)
    await this.writeToSupabase(logEntry)
  }

  /** Log validation completion event */
  async logValidationComplete(
    correlationId: CorrelationId,
    result: {
      isValid: boolean
      action: ValidationAction
      maxSeverity: string
      totalTime: number
      pluginResults: ValidationResult[]
    },
    options: {
      userId?: string
      content?: string
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<void> {
    const logEntry = this.createLogEntry(
      correlationId,
      'validation-complete',
      result.isValid ? 'info' : 'warn',
      {
        userId: options.userId,
        contentHash: options.content ? this.anonymizer.hashContent(options.content) : undefined,
        validationResult: {
          isValid: result.isValid,
          action: result.action,
          maxSeverity: result.maxSeverity,
        },
        actionTaken: result.action,
        metrics: {
          totalTime: result.totalTime,
          pluginTimes: result.pluginResults.reduce((acc, r) => ({
            ...acc,
            [r.pluginId]: r.processingTime,
          }), {}),
        } as ProcessingMetrics,
        ...options.metadata,
      }
    )

    this.logger.info('Validation completed', logEntry)
    await this.writeToSupabase(logEntry)
  }

  /** Log validation failure event */
  async logValidationFailed(
    correlationId: CorrelationId,
    error: Error,
    options: {
      userId?: string
      pluginId?: PluginId
      content?: string
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<void> {
    const logEntry = this.createLogEntry(
      correlationId,
      'validation-failed',
      'error',
      {
        userId: options.userId,
        pluginId: options.pluginId,
        contentHash: options.content ? this.anonymizer.hashContent(options.content) : undefined,
        error: {
          message: this.anonymizer.redactPII(error.message),
          name: error.name,
          stack: error.stack ? this.anonymizer.redactPII(error.stack) : undefined,
        },
        ...options.metadata,
      }
    )

    this.logger.error('Validation failed', logEntry)
    await this.writeToSupabase(logEntry)
  }

  /** Log security violation event */
  async logSecurityViolation(
    correlationId: CorrelationId,
    violation: {
      type: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      pluginId: PluginId
      reason: string
      action: ValidationAction
    },
    options: {
      userId?: string
      content?: string
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<void> {
    const logEntry = this.createLogEntry(
      correlationId,
      'security-violation',
      'warn',
      {
        userId: options.userId,
        pluginId: violation.pluginId,
        contentHash: options.content ? this.anonymizer.hashContent(options.content) : undefined,
        violationType: violation.type,
        severity: violation.severity,
        reason: this.anonymizer.redactPII(violation.reason),
        actionTaken: violation.action,
        ...options.metadata,
      }
    )

    this.logger.warn('Security violation detected', logEntry)
    await this.writeToSupabase(logEntry)
  }

  /** Log plugin error event */
  async logPluginError(
    correlationId: CorrelationId,
    pluginId: PluginId,
    error: Error,
    options: {
      userId?: string
      content?: string
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<void> {
    const logEntry = this.createLogEntry(
      correlationId,
      'plugin-error',
      'error',
      {
        userId: options.userId,
        pluginId,
        contentHash: options.content ? this.anonymizer.hashContent(options.content) : undefined,
        error: {
          message: this.anonymizer.redactPII(error.message),
          name: error.name,
        },
        ...options.metadata,
      }
    )

    this.logger.error('Plugin error', logEntry)
    await this.writeToSupabase(logEntry)
  }

  /** Log performance warning event */
  async logPerformanceWarning(
    correlationId: CorrelationId,
    warning: {
      type: 'high_latency' | 'low_cache_hit_rate' | 'high_error_rate' | 'memory_usage'
      threshold: number
      actual: number
      pluginId?: PluginId
    },
    options: {
      userId?: string
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<void> {
    const logEntry = this.createLogEntry(
      correlationId,
      'performance-warning',
      'warn',
      {
        userId: options.userId,
        pluginId: warning.pluginId,
        warningType: warning.type,
        threshold: warning.threshold,
        actual: warning.actual,
        ...options.metadata,
      }
    )

    this.logger.warn('Performance warning', logEntry)
    await this.writeToSupabase(logEntry)
  }

  /** Log configuration update event */
  async logConfigUpdate(
    correlationId: CorrelationId,
    update: {
      section: string
      changes: Record<string, unknown>
      updatedBy?: string
    },
    options: {
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<void> {
    const logEntry = this.createLogEntry(
      correlationId,
      'config-updated',
      'info',
      {
        configSection: update.section,
        changes: update.changes,
        updatedBy: update.updatedBy,
        ...options.metadata,
      }
    )

    this.logger.info('Configuration updated', logEntry)
    await this.writeToSupabase(logEntry)
  }

  /** Generic structured logging methods */
  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(data, message)
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(data, message)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(data, message)
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.logger.error(data, message)
  }

  /** Create structured log entry */
  private createLogEntry(
    correlationId: CorrelationId,
    eventType: LogEventType,
    severity: 'debug' | 'info' | 'warn' | 'error' | 'critical',
    data: Record<string, unknown> = {}
  ): GuardrailLogEntry {
    return {
      id: this.generateLogId(),
      correlationId,
      userId: data.userId ? this.anonymizer.pseudonymizeUserId(data.userId as string) : undefined,
      eventType,
      severity,
      contentHash: data.contentHash as ContentHash | undefined,
      pluginId: data.pluginId as PluginId | undefined,
      validationResult: data.validationResult as ValidationResult | undefined,
      actionTaken: data.actionTaken as ValidationAction | undefined,
      metrics: data.metrics as ProcessingMetrics || {
        totalTime: 0,
        pluginTimes: {},
      },
      metadata: {
        ...data,
        // Remove sensitive fields that are already handled
        userId: undefined,
        contentHash: undefined,
        pluginId: undefined,
        validationResult: undefined,
        actionTaken: undefined,
        metrics: undefined,
      },
      timestamp: new Date(),
      environment: (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production',
    }
  }

  /** Generate unique log entry ID */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /** Write to Supabase transport */
  private async writeToSupabase(logEntry: GuardrailLogEntry): Promise<void> {
    if (this.supabaseTransport) {
      try {
        await this.supabaseTransport.write(logEntry)
      } catch (error) {
        // Don't let logging errors break the application
        console.error('Failed to write to Supabase transport:', error)
      }
    }
  }

  /** Shutdown logger */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down GuardrailLogger')

    if (this.supabaseTransport) {
      await this.supabaseTransport.destroy()
    }

    this.logger.info('GuardrailLogger shutdown complete')
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Get the guardrail logger instance */
export function getGuardrailLogger(): GuardrailLogger {
  return GuardrailLogger.getInstance()
}

/** Create content hash for privacy-preserving logging */
export function hashContent(content: string): ContentHash {
  const anonymizer = new ContentAnonymizer()
  return anonymizer.hashContent(content)
}

/** Redact PII from content for safe logging */
export function redactPII(content: string, patterns?: string[]): string {
  const anonymizer = new ContentAnonymizer('sha256', patterns)
  return anonymizer.redactPII(content)
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  ContentAnonymizer,
  SupabaseTransport,
}

export type {
  GuardrailLogEntry,
  LogEventType,
  ProcessingMetrics,
}