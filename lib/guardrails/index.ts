// Guardrail System Main Export
// Purpose: Central export point for the entire guardrail system

// Core engine and utilities
export {
  GuardrailEngine,
  PluginRegistry,
  ValidationCache,
  getGuardrailEngine
} from './core'

// Configuration management
export {
  ConfigurationManager,
  getConfigManager,
  getCurrentConfig,
  isFeatureEnabled,
  validateConfig
} from './config'

// Logging system
export {
  GuardrailLogger,
  ContentAnonymizer,
  SupabaseTransport
} from './logging/logger'

// Middleware integration
export {
  createGuardrailMiddleware,
  createGuardrailedModel,
  createContentTypeMiddleware,
  createCPLAnalysisMiddleware,
  createVoiceLearningMiddleware,
  wrapClaudeWithGuardrails,
  GuardrailValidationError
} from './middleware'

// Plugins
export {
  createInputValidationPlugin,
  createOutputValidationPlugin,
  createContentSafetyPlugin,
  registerDefaultPlugins,
  PluginFactories,
  createEnvironmentConfigs,
  createContentTypeConfigs,
  DEFAULT_PLUGIN_CONFIGS
} from './plugins'

// Monitoring and analytics
export {
  GuardrailDashboard,
  GuardrailMetricsCollector,
  AlertManager,
  getGuardrailDashboard,
  getMetricsCollector,
  getAlertManager
} from './monitoring'

// Types
export type {
  // Core types
  GuardrailPlugin,
  ValidationResult,
  AggregatedValidationResult,
  ValidationContext,
  ValidationAction,
  CorrelationId,
  PluginId,
  PluginType,
  PluginConfig,
  ProcessingStage,
  RequestType,
  ContentType,
  Severity,

  // System types
  SystemHealthStatus,
  ComponentHealthStatus,
  SystemPerformanceMetrics,
  PluginStats,

  // Error types
  GuardrailError,
  PluginValidationError,
  TimeoutError,
  ConfigurationError,

  // Configuration types
  GuardrailConfig,
  SystemConfig,
  PerformanceConfig,
  LoggingConfig,
  SupabaseConfig,
  InstructorConfig,
  OpenAIConfig,
  MonitoringConfig,

  // Middleware types
  GuardrailMiddlewareOptions,

  // Monitoring types
  MetricsSnapshot,
  SecurityViolation,
  AlertRule,
  Alert
} from './types'

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/** Quick setup function for common use cases */
export function setupGuardrails(environment: 'development' | 'staging' | 'production' = 'development') {
  const engine = getGuardrailEngine()
  const dashboard = getGuardrailDashboard()

  return {
    engine,
    dashboard,
    createMiddleware: createGuardrailMiddleware,
    createModel: createGuardrailedModel
  }
}

/** Health check function for monitoring */
export async function healthCheck() {
  const engine = getGuardrailEngine()
  const health = await engine.getSystemHealth()
  const metrics = engine.getPerformanceMetrics()

  return {
    status: health.overall.status,
    timestamp: new Date(),
    components: Object.keys(health.components).length,
    activeValidations: engine.getActiveValidationCount(),
    errorRate: metrics.errorRate,
    latency: metrics.p99Latency,
    cacheHitRate: metrics.cacheHitRate
  }
}