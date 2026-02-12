// Monitoring Module Index
// Purpose: Export monitoring components and utilities

export {
  GuardrailDashboard,
  GuardrailMetricsCollector,
  AlertManager,
  getGuardrailDashboard,
  getMetricsCollector,
  getAlertManager
} from './dashboard'

export type {
  MetricsSnapshot,
  SecurityViolation,
  AlertRule,
  Alert
} from './dashboard'

// Re-export monitoring types from core types
export type {
  SystemHealthStatus,
  ComponentHealthStatus,
  SystemPerformanceMetrics,
  PluginStats
} from '../types'