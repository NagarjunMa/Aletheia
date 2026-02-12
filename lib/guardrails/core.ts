// Core Guardrail Engine
// Purpose: Main orchestration system for AI guardrail validation with plugin architecture

import { haikunator } from 'haikunator'
import type {
  GuardrailPlugin,
  ValidationResult,
  AggregatedValidationResult,
  ValidationContext,
  ValidationAction,
  CorrelationId,
  PluginId,
  ProcessingStage,
  RequestType,
  ContentType,
  SystemHealthStatus,
  ComponentHealthStatus,
  SystemPerformanceMetrics,
  PluginStats,
  CancellablePromise,
  GuardrailError,
  PluginValidationError,
  TimeoutError,
  ConfigurationError,
} from './types'
import { getConfigManager, getCurrentConfig, isFeatureEnabled } from './config'
import { GuardrailLogger } from './logging/logger'
import { registerDefaultPlugins } from './plugins'

// ============================================================================
// PLUGIN REGISTRY
// ============================================================================

export class PluginRegistry {
  private plugins: Map<PluginId, GuardrailPlugin> = new Map()
  private stats: Map<PluginId, PluginStats> = new Map()
  private logger = GuardrailLogger.getInstance()

  /** Register a plugin */
  async register(plugin: GuardrailPlugin): Promise<void> {
    try {
      // Validate plugin
      if (!plugin.id || !plugin.name || !plugin.validate) {
        throw new ConfigurationError(`Invalid plugin: missing required properties`)
      }

      // Check for duplicate ID
      if (this.plugins.has(plugin.id)) {
        throw new ConfigurationError(`Plugin ${plugin.id} is already registered`)
      }

      // Initialize plugin if it has an initialize method
      if (plugin.initialize) {
        await plugin.initialize()
      }

      // Register plugin
      this.plugins.set(plugin.id, plugin)

      // Initialize stats
      this.stats.set(plugin.id, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageProcessingTime: 0,
        p95ProcessingTime: 0,
        errorRate: 0,
      })

      this.logger.info(`Plugin registered: ${plugin.id}`, {
        pluginName: plugin.name,
        pluginVersion: plugin.version,
        pluginType: plugin.type,
      })
    } catch (error) {
      this.logger.error(`Failed to register plugin ${plugin.id}`, { error })
      throw error
    }
  }

  /** Unregister a plugin */
  async unregister(pluginId: PluginId): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new ConfigurationError(`Plugin ${pluginId} is not registered`)
    }

    try {
      // Cleanup plugin if it has a cleanup method
      if (plugin.cleanup) {
        await plugin.cleanup()
      }

      // Remove from registry
      this.plugins.delete(pluginId)
      this.stats.delete(pluginId)

      this.logger.info(`Plugin unregistered: ${pluginId}`)
    } catch (error) {
      this.logger.error(`Failed to unregister plugin ${pluginId}`, { error })
      throw error
    }
  }

  /** Get all registered plugins */
  getAll(): GuardrailPlugin[] {
    return Array.from(this.plugins.values())
  }

  /** Get plugin by ID */
  get(pluginId: PluginId): GuardrailPlugin | null {
    return this.plugins.get(pluginId) || null
  }

  /** Get plugins by type */
  getByType(type: string): GuardrailPlugin[] {
    return this.getAll().filter(plugin => plugin.type === type)
  }

  /** Get enabled plugins sorted by priority */
  getEnabled(): GuardrailPlugin[] {
    return this.getAll()
      .filter(plugin => plugin.enabled)
      .sort((a, b) => a.priority - b.priority)
  }

  /** Update plugin stats */
  updateStats(pluginId: PluginId, processingTime: number, success: boolean): void {
    const stats = this.stats.get(pluginId)
    if (!stats) return

    stats.totalExecutions++
    if (success) {
      stats.successfulExecutions++
    } else {
      stats.failedExecutions++
    }

    // Update average processing time
    stats.averageProcessingTime =
      (stats.averageProcessingTime * (stats.totalExecutions - 1) + processingTime) / stats.totalExecutions

    // Update error rate
    stats.errorRate = stats.failedExecutions / stats.totalExecutions

    stats.lastExecution = new Date()
  }

  /** Get plugin statistics */
  getStats(pluginId: PluginId): PluginStats | null {
    return this.stats.get(pluginId) || null
  }

  /** Get all plugin statistics */
  getAllStats(): Map<PluginId, PluginStats> {
    return new Map(this.stats)
  }
}

// ============================================================================
// VALIDATION CACHE
// ============================================================================

interface CacheEntry {
  result: ValidationResult
  timestamp: Date
  hits: number
}

export class ValidationCache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly maxSize: number
  private readonly ttl: number
  private logger = GuardrailLogger.getInstance()

  constructor(maxSize: number = 1000, ttl: number = 15 * 60 * 1000) {
    this.maxSize = maxSize
    this.ttl = ttl

    // Periodic cleanup
    setInterval(() => this.cleanup(), ttl / 2)
  }

  /** Generate cache key */
  private generateKey(content: string, pluginId: PluginId, context: Partial<ValidationContext>): string {
    const keyData = {
      content: this.hashContent(content),
      pluginId,
      userId: context.userId,
      requestType: context.requestType,
      contentType: context.contentType,
      stage: context.stage,
    }
    return JSON.stringify(keyData)
  }

  /** Hash content for cache key */
  private hashContent(content: string): string {
    // Simple hash function - in production, consider using crypto.createHash
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  /** Get cached result */
  get(content: string, pluginId: PluginId, context: Partial<ValidationContext>): ValidationResult | null {
    const key = this.generateKey(content, pluginId, context)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check TTL
    if (Date.now() - entry.timestamp.getTime() > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Update hit count
    entry.hits++

    this.logger.debug('Cache hit', { pluginId, key })
    return entry.result
  }

  /** Set cached result */
  set(content: string, pluginId: PluginId, context: Partial<ValidationContext>, result: ValidationResult): void {
    const key = this.generateKey(content, pluginId, context)

    // Ensure cache size limit
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      result,
      timestamp: new Date(),
      hits: 1,
    })

    this.logger.debug('Cache set', { pluginId, key })
  }

  /** Evict least recently used entry */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache) {
      if (entry.timestamp.getTime() < oldestTime) {
        oldestTime = entry.timestamp.getTime()
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /** Cleanup expired entries */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp.getTime() > this.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cache cleanup: removed ${cleaned} expired entries`)
    }
  }

  /** Get cache statistics */
  getStats(): { size: number; hitRate: number } {
    let totalHits = 0
    let totalRequests = 0

    for (const entry of this.cache.values()) {
      totalHits += entry.hits
      totalRequests += entry.hits // Each entry represents at least one request
    }

    return {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
    }
  }

  /** Clear cache */
  clear(): void {
    this.cache.clear()
    this.logger.info('Cache cleared')
  }
}

// ============================================================================
// CANCELLABLE PROMISE UTILITY
// ============================================================================

function makeCancellable<T>(promise: Promise<T>): CancellablePromise<T> {
  let cancelled = false

  const cancellablePromise = new Promise<T>((resolve, reject) => {
    promise
      .then(result => {
        if (!cancelled) resolve(result)
      })
      .catch(error => {
        if (!cancelled) reject(error)
      })
  }) as CancellablePromise<T>

  cancellablePromise.cancel = () => {
    cancelled = true
  }

  cancellablePromise.isCancelled = () => cancelled

  return cancellablePromise
}

// ============================================================================
// CORE GUARDRAIL ENGINE
// ============================================================================

export class GuardrailEngine {
  private static instance: GuardrailEngine | null = null
  private registry: PluginRegistry
  private cache: ValidationCache
  private logger = GuardrailLogger.getInstance()
  private activeValidations: Map<CorrelationId, CancellablePromise<AggregatedValidationResult>> = new Map()
  private performanceMetrics: SystemPerformanceMetrics = {
    averageLatency: 0,
    p95Latency: 0,
    p99Latency: 0,
    throughput: 0,
    errorRate: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  }

  private constructor() {
    this.registry = new PluginRegistry()

    const config = getCurrentConfig()
    this.cache = new ValidationCache(
      config.performance.maxCacheSize,
      config.performance.cacheTtl
    )

    // Subscribe to configuration changes
    getConfigManager().subscribe('guardrail-engine', (config) => {
      this.onConfigurationChange(config)
    })

    // Initialize default plugins
    this.initializeDefaultPlugins()

    this.logger.info('GuardrailEngine initialized')
  }

  /** Get singleton instance */
  static getInstance(): GuardrailEngine {
    if (!GuardrailEngine.instance) {
      GuardrailEngine.instance = new GuardrailEngine()
    }
    return GuardrailEngine.instance
  }

  /** Initialize default plugins */
  private async initializeDefaultPlugins(): Promise<void> {
    try {
      await registerDefaultPlugins(this.registry)
      this.logger.info('Default plugins registered successfully')
    } catch (error) {
      this.logger.error('Failed to register default plugins', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /** Handle configuration changes */
  private onConfigurationChange(config: any): void {
    this.logger.info('Configuration updated', { config: config.system })
    // Update cache settings if needed
    // Reload plugins if needed
  }

  /** Register a plugin */
  async registerPlugin(plugin: GuardrailPlugin): Promise<void> {
    await this.registry.register(plugin)
  }

  /** Unregister a plugin */
  async unregisterPlugin(pluginId: PluginId): Promise<void> {
    await this.registry.unregister(pluginId)
  }

  /** Get all registered plugins */
  getPlugins(): GuardrailPlugin[] {
    return this.registry.getAll()
  }

  /** Validate content with all applicable plugins */
  async validate(
    content: string,
    context: Partial<ValidationContext> = {},
    options: {
      stage?: ProcessingStage
      pluginIds?: PluginId[]
      timeout?: number
    } = {}
  ): Promise<AggregatedValidationResult> {
    const correlationId = context.correlationId || haikunator()
    const startTime = Date.now()

    // Check if system is enabled
    const config = getCurrentConfig()
    if (!config.system.enabled) {
      return this.createPassthroughResult(correlationId, startTime)
    }

    // Build full context
    const fullContext: ValidationContext = {
      correlationId,
      userId: context.userId,
      sessionId: context.sessionId,
      requestType: context.requestType || 'general',
      contentType: context.contentType || 'general',
      stage: options.stage || 'input',
      userPreferences: context.userPreferences,
      metadata: context.metadata || {},
      timestamp: new Date(),
    }

    this.logger.info('Starting validation', {
      correlationId,
      contentLength: content.length,
      stage: fullContext.stage,
      requestType: fullContext.requestType,
    })

    try {
      // Create cancellable promise
      const validationPromise = this.performValidation(content, fullContext, options)
      const cancellablePromise = makeCancellable(validationPromise)

      // Track active validation
      this.activeValidations.set(correlationId, cancellablePromise)

      // Set timeout
      const timeout = options.timeout || config.system.globalTimeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError(`Validation timeout after ${timeout}ms`, timeout, correlationId))
        }, timeout)
      })

      // Race between validation and timeout
      const result = await Promise.race([cancellablePromise, timeoutPromise])

      // Update performance metrics
      this.updatePerformanceMetrics(Date.now() - startTime, true)

      return result
    } catch (error) {
      const processingTime = Date.now() - startTime
      this.updatePerformanceMetrics(processingTime, false)

      this.logger.error('Validation failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      })

      // Return error result
      return {
        isValid: false,
        maxSeverity: 'critical',
        totalProcessingTime: processingTime,
        results: [],
        action: 'block',
        correlationId,
      }
    } finally {
      // Clean up active validation
      this.activeValidations.delete(correlationId)
    }
  }

  /** Perform actual validation with plugins */
  private async performValidation(
    content: string,
    context: ValidationContext,
    options: { pluginIds?: PluginId[] }
  ): Promise<AggregatedValidationResult> {
    const startTime = Date.now()
    const results: ValidationResult[] = []

    // Get applicable plugins
    let plugins = this.registry.getEnabled()

    // Filter by stage if specified
    if (context.stage) {
      plugins = plugins.filter(plugin => this.isPluginApplicableForStage(plugin, context.stage))
    }

    // Filter by specific plugin IDs if provided
    if (options.pluginIds) {
      plugins = plugins.filter(plugin => options.pluginIds!.includes(plugin.id))
    }

    this.logger.debug('Running validation plugins', {
      correlationId: context.correlationId,
      pluginCount: plugins.length,
      plugins: plugins.map(p => p.id),
    })

    // Run plugins sequentially (for now - could be parallelized for independent plugins)
    for (const plugin of plugins) {
      try {
        const result = await this.validateWithPlugin(plugin, content, context)
        results.push(result)

        // Update plugin stats
        this.registry.updateStats(plugin.id, result.processingTime, result.isValid)

        // Stop on first critical failure if plugin is configured to fail fast
        if (!result.isValid && plugin.config.failFast && result.severity === 'critical') {
          break
        }
      } catch (error) {
        this.logger.error(`Plugin ${plugin.id} failed`, {
          correlationId: context.correlationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        // Create error result
        const errorResult: ValidationResult = {
          isValid: false,
          confidence: 0,
          severity: 'critical',
          reason: `Plugin error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          pluginId: plugin.id,
          processingTime: 0,
        }
        results.push(errorResult)

        // Update plugin stats
        this.registry.updateStats(plugin.id, 0, false)

        // Stop on plugin error if configured to fail fast
        if (plugin.config.failFast) {
          break
        }
      }
    }

    return this.aggregateResults(results, context.correlationId, Date.now() - startTime)
  }

  /** Validate content with a specific plugin */
  private async validateWithPlugin(
    plugin: GuardrailPlugin,
    content: string,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = Date.now()

    // Check cache first
    if (plugin.config.cacheResults) {
      const cached = this.cache.get(content, plugin.id, context)
      if (cached) {
        this.logger.debug(`Using cached result for plugin ${plugin.id}`)
        return cached
      }
    }

    // Run plugin validation
    const result = await plugin.validate(content, context)

    // Cache result if enabled
    if (plugin.config.cacheResults && result.isValid) {
      this.cache.set(content, plugin.id, context, result)
    }

    const processingTime = Date.now() - startTime
    result.processingTime = processingTime

    this.logger.debug(`Plugin ${plugin.id} completed`, {
      correlationId: context.correlationId,
      isValid: result.isValid,
      confidence: result.confidence,
      processingTime,
    })

    return result
  }

  /** Check if plugin is applicable for processing stage */
  private isPluginApplicableForStage(plugin: GuardrailPlugin, stage: ProcessingStage): boolean {
    // Input validation plugins run on input and pre-processing stages
    if (plugin.type === 'input-validation') {
      return stage === 'input' || stage === 'pre-processing'
    }

    // Output validation plugins run on post-processing and output stages
    if (plugin.type === 'output-validation') {
      return stage === 'post-processing' || stage === 'output' || stage === 'streaming'
    }

    // Content safety and quality plugins can run on any stage
    return true
  }

  /** Aggregate individual plugin results */
  private aggregateResults(
    results: ValidationResult[],
    correlationId: CorrelationId,
    totalProcessingTime: number
  ): AggregatedValidationResult {
    if (results.length === 0) {
      return this.createPassthroughResult(correlationId, Date.now())
    }

    // Determine overall validity
    const isValid = results.every(result => result.isValid)

    // Determine maximum severity
    const severities: Array<'none' | 'low' | 'medium' | 'high' | 'critical'> = ['none', 'low', 'medium', 'high', 'critical']
    const maxSeverity = results.reduce((max, result) => {
      if (!result.isValid && result.severity) {
        const currentIndex = severities.indexOf(result.severity)
        const maxIndex = severities.indexOf(max)
        return currentIndex > maxIndex ? result.severity : max
      }
      return max
    }, 'none' as 'none' | 'low' | 'medium' | 'high' | 'critical')

    // Determine action
    let action: ValidationAction = 'allow'
    if (!isValid) {
      switch (maxSeverity) {
        case 'critical':
          action = 'block'
          break
        case 'high':
          action = 'flag'
          break
        case 'medium':
          action = 'modify'
          break
        case 'low':
          action = 'flag'
          break
        default:
          action = 'allow'
      }
    }

    return {
      isValid,
      maxSeverity,
      totalProcessingTime,
      results,
      action,
      correlationId,
    }
  }

  /** Create passthrough result for disabled system */
  private createPassthroughResult(correlationId: CorrelationId, startTime: number): AggregatedValidationResult {
    return {
      isValid: true,
      maxSeverity: 'none',
      totalProcessingTime: Date.now() - startTime,
      results: [],
      action: 'allow',
      correlationId,
    }
  }

  /** Cancel validation by correlation ID */
  async cancelValidation(correlationId: CorrelationId): Promise<boolean> {
    const activeValidation = this.activeValidations.get(correlationId)
    if (activeValidation) {
      activeValidation.cancel()
      this.activeValidations.delete(correlationId)
      this.logger.info(`Validation cancelled: ${correlationId}`)
      return true
    }
    return false
  }

  /** Get system health status */
  getHealthStatus(): SystemHealthStatus {
    const components: Record<string, ComponentHealthStatus> = {}

    // Check plugin health
    for (const plugin of this.registry.getAll()) {
      const stats = this.registry.getStats(plugin.id)
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

      if (stats) {
        if (stats.errorRate > 0.1) { // 10% error rate
          status = 'unhealthy'
        } else if (stats.errorRate > 0.05) { // 5% error rate
          status = 'degraded'
        }
      }

      components[plugin.id] = {
        status,
        lastCheck: new Date(),
        metrics: stats ? {
          totalExecutions: stats.totalExecutions,
          errorRate: stats.errorRate,
          averageProcessingTime: stats.averageProcessingTime,
        } : {},
      }
    }

    // Check cache health
    const cacheStats = this.cache.getStats()
    components['cache'] = {
      status: cacheStats.hitRate > 0.5 ? 'healthy' : 'degraded',
      message: `Hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`,
      lastCheck: new Date(),
      metrics: {
        size: cacheStats.size,
        hitRate: cacheStats.hitRate,
      },
    }

    // Overall status
    const componentStatuses = Object.values(components).map(c => c.status)
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (componentStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy'
    } else if (componentStatuses.includes('degraded')) {
      overallStatus = 'degraded'
    }

    return {
      status: overallStatus,
      components,
      performance: this.performanceMetrics,
      lastCheck: new Date(),
    }
  }

  /** Update performance metrics */
  private updatePerformanceMetrics(processingTime: number, success: boolean): void {
    // Simple running average - in production, consider using a proper metrics library
    const currentTime = Date.now()

    // Update latency
    this.performanceMetrics.averageLatency =
      (this.performanceMetrics.averageLatency * 0.9) + (processingTime * 0.1)

    // Update error rate
    const errorWeight = success ? 0 : 1
    this.performanceMetrics.errorRate =
      (this.performanceMetrics.errorRate * 0.9) + (errorWeight * 0.1)

    // Update cache hit rate
    const cacheStats = this.cache.getStats()
    this.performanceMetrics.cacheHitRate = cacheStats.hitRate

    // Update memory usage (simplified)
    if (process.memoryUsage) {
      this.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024
    }
  }

  /** Get performance metrics */
  getPerformanceMetrics(): SystemPerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /** Get plugin statistics */
  getPluginStats(): Map<PluginId, PluginStats> {
    return this.registry.getAllStats()
  }

  /** Clear cache */
  clearCache(): void {
    this.cache.clear()
  }

  /** Get active validation count */
  getActiveValidationCount(): number {
    return this.activeValidations.size
  }

  /** Get plugin statistics */
  async getPluginStats(pluginId: PluginId): Promise<PluginStats | null> {
    return this.registry.getStats(pluginId)
  }

  /** Get system health status */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    const components: Record<string, ComponentHealthStatus> = {}

    // Check plugin health
    const plugins = this.registry.getAll()
    for (const plugin of plugins) {
      const stats = await this.registry.getStats(plugin.id)
      const errorRate = stats ? stats.errors / Math.max(stats.totalValidations, 1) : 0

      components[plugin.id] = {
        status: errorRate > 0.1 ? 'unhealthy' : errorRate > 0.05 ? 'degraded' : 'healthy',
        lastCheck: new Date(),
        details: {
          errorRate,
          totalValidations: stats?.totalValidations || 0,
          averageLatency: stats?.averageLatency || 0
        }
      }
    }

    // Check cache health
    const cacheHitRate = this.performanceMetrics.cacheHitRate
    components.cache = {
      status: cacheHitRate < 0.5 ? 'unhealthy' : cacheHitRate < 0.7 ? 'degraded' : 'healthy',
      lastCheck: new Date(),
      details: { hitRate: cacheHitRate }
    }

    // Determine overall health
    const unhealthyCount = Object.values(components).filter(c => c.status === 'unhealthy').length
    const degradedCount = Object.values(components).filter(c => c.status === 'degraded').length

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy'
    } else if (degradedCount > 0) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'healthy'
    }

    return {
      overall: {
        status: overallStatus,
        lastCheck: new Date()
      },
      components
    }
  }

  /** Get performance metrics */
  getPerformanceMetrics(): SystemPerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /** Shutdown engine */
  async shutdown(): void {
    this.logger.info('Shutting down GuardrailEngine')

    // Cancel all active validations
    for (const [correlationId, validation] of this.activeValidations) {
      validation.cancel()
      this.logger.debug(`Cancelled validation: ${correlationId}`)
    }
    this.activeValidations.clear()

    // Cleanup all plugins
    const plugins = this.registry.getAll()
    for (const plugin of plugins) {
      try {
        await this.registry.unregister(plugin.id)
      } catch (error) {
        this.logger.error(`Error cleaning up plugin ${plugin.id}`, { error })
      }
    }

    this.logger.info('GuardrailEngine shutdown complete')
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Get the guardrail engine instance */
export function getGuardrailEngine(): GuardrailEngine {
  return GuardrailEngine.getInstance()
}

/** Validate content with guardrails */
export async function validateContent(
  content: string,
  context: Partial<ValidationContext> = {}
): Promise<AggregatedValidationResult> {
  const engine = getGuardrailEngine()
  return engine.validate(content, context)
}

/** Register a guardrail plugin */
export async function registerGuardrailPlugin(plugin: GuardrailPlugin): Promise<void> {
  const engine = getGuardrailEngine()
  return engine.registerPlugin(plugin)
}

/** Get system health status */
export function getGuardrailHealth(): SystemHealthStatus {
  const engine = getGuardrailEngine()
  return engine.getHealthStatus()
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  PluginRegistry,
  ValidationCache,
}

export type {
  GuardrailPlugin,
  ValidationResult,
  AggregatedValidationResult,
  ValidationContext,
  SystemHealthStatus,
  PluginStats,
}