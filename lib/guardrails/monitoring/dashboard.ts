// Monitoring and Analytics Dashboard
// Purpose: Real-time monitoring, analytics, and alerting for guardrail system

import type {
  SystemHealthStatus,
  ComponentHealthStatus,
  SystemPerformanceMetrics,
  PluginStats,
  ValidationResult,
  AggregatedValidationResult,
  CorrelationId,
  Severity
} from '../types'
import { GuardrailLogger } from '../logging/logger'
import { getGuardrailEngine } from '../core'
import { getCurrentConfig } from '../config'

// ============================================================================
// MONITORING INTERFACES
// ============================================================================

interface MetricsSnapshot {
  timestamp: Date
  performance: SystemPerformanceMetrics
  health: SystemHealthStatus
  pluginStats: Record<string, PluginStats>
  activeValidations: number
  recentViolations: SecurityViolation[]
}

interface SecurityViolation {
  correlationId: CorrelationId
  timestamp: Date
  severity: Severity
  pluginId: string
  category: string
  reason: string
  userId?: string
  blocked: boolean
}

interface AlertRule {
  id: string
  name: string
  description: string
  condition: (snapshot: MetricsSnapshot) => boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  cooldownMs: number
  lastTriggered?: Date
}

interface Alert {
  id: string
  ruleId: string
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  snapshot: MetricsSnapshot
  resolved?: Date
  resolvedBy?: string
}

// ============================================================================
// METRICS COLLECTOR
// ============================================================================

export class GuardrailMetricsCollector {
  private static instance: GuardrailMetricsCollector | null = null
  private logger = GuardrailLogger.getInstance()
  private metricsHistory: MetricsSnapshot[] = []
  private securityViolations: SecurityViolation[] = []
  private maxHistorySize = 1000
  private collectionInterval: NodeJS.Timeout | null = null
  private isRunning = false

  private constructor() {
    this.startCollection()
  }

  static getInstance(): GuardrailMetricsCollector {
    if (!GuardrailMetricsCollector.instance) {
      GuardrailMetricsCollector.instance = new GuardrailMetricsCollector()
    }
    return GuardrailMetricsCollector.instance
  }

  /** Start metrics collection */
  startCollection(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.collectionInterval = setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error) {
        this.logger.error('Failed to collect metrics', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }, 30000) // Collect every 30 seconds

    this.logger.info('Metrics collection started')
  }

  /** Stop metrics collection */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval)
      this.collectionInterval = null
    }
    this.isRunning = false
    this.logger.info('Metrics collection stopped')
  }

  /** Collect current metrics snapshot */
  private async collectMetrics(): Promise<void> {
    const engine = getGuardrailEngine()
    const timestamp = new Date()

    try {
      // Get system health and performance metrics
      const health = await engine.getSystemHealth()
      const performance = engine.getPerformanceMetrics()
      const plugins = engine.getPlugins()
      const pluginStats: Record<string, PluginStats> = {}

      // Collect plugin statistics
      for (const plugin of plugins) {
        const stats = await engine.getPluginStats(plugin.id)
        if (stats) {
          pluginStats[plugin.id] = stats
        }
      }

      const activeValidations = engine.getActiveValidationCount()

      // Create snapshot
      const snapshot: MetricsSnapshot = {
        timestamp,
        performance,
        health,
        pluginStats,
        activeValidations,
        recentViolations: this.getRecentViolations(300000) // Last 5 minutes
      }

      // Store snapshot
      this.metricsHistory.push(snapshot)

      // Trim history if needed
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.splice(0, this.metricsHistory.length - this.maxHistorySize)
      }

      // Log metrics summary
      this.logger.debug('Metrics collected', {
        timestamp,
        activeValidations,
        errorRate: performance.errorRate,
        p99Latency: performance.p99Latency,
        cacheHitRate: performance.cacheHitRate,
        healthStatus: health.overall.status
      })

    } catch (error) {
      this.logger.error('Failed to collect metrics snapshot', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /** Record a security violation */
  recordViolation(violation: Omit<SecurityViolation, 'timestamp'>): void {
    this.securityViolations.push({
      ...violation,
      timestamp: new Date()
    })

    // Trim old violations (keep last 1000)
    if (this.securityViolations.length > 1000) {
      this.securityViolations.splice(0, this.securityViolations.length - 1000)
    }

    this.logger.info('Security violation recorded', violation)
  }

  /** Get recent violations */
  getRecentViolations(timeWindowMs: number = 300000): SecurityViolation[] {
    const cutoff = new Date(Date.now() - timeWindowMs)
    return this.securityViolations.filter(v => v.timestamp >= cutoff)
  }

  /** Get metrics history */
  getMetricsHistory(limit?: number): MetricsSnapshot[] {
    const history = [...this.metricsHistory].reverse()
    return limit ? history.slice(0, limit) : history
  }

  /** Get latest metrics snapshot */
  getLatestSnapshot(): MetricsSnapshot | null {
    return this.metricsHistory.length > 0
      ? this.metricsHistory[this.metricsHistory.length - 1]
      : null
  }

  /** Get aggregated statistics */
  getAggregatedStats(timeWindowMs: number = 3600000): {
    totalValidations: number
    blockedRequests: number
    flaggedRequests: number
    averageLatency: number
    errorRate: number
    topViolationCategories: Array<{ category: string; count: number }>
  } {
    const cutoff = new Date(Date.now() - timeWindowMs)
    const recentSnapshots = this.metricsHistory.filter(s => s.timestamp >= cutoff)
    const recentViolations = this.getRecentViolations(timeWindowMs)

    let totalValidations = 0
    let totalLatency = 0
    let totalErrors = 0

    for (const snapshot of recentSnapshots) {
      for (const stats of Object.values(snapshot.pluginStats)) {
        totalValidations += stats.totalValidations
        totalLatency += stats.averageLatency * stats.totalValidations
        totalErrors += stats.errors
      }
    }

    const blockedRequests = recentViolations.filter(v => v.blocked).length
    const flaggedRequests = recentViolations.filter(v => !v.blocked).length

    // Count violation categories
    const categoryCount = new Map<string, number>()
    for (const violation of recentViolations) {
      categoryCount.set(violation.category, (categoryCount.get(violation.category) || 0) + 1)
    }

    const topViolationCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalValidations,
      blockedRequests,
      flaggedRequests,
      averageLatency: totalValidations > 0 ? totalLatency / totalValidations : 0,
      errorRate: totalValidations > 0 ? totalErrors / totalValidations : 0,
      topViolationCategories
    }
  }
}

// ============================================================================
// ALERT MANAGER
// ============================================================================

export class AlertManager {
  private static instance: AlertManager | null = null
  private logger = GuardrailLogger.getInstance()
  private alertRules: Map<string, AlertRule> = new Map()
  private activeAlerts: Map<string, Alert> = new Map()
  private alertHistory: Alert[] = []
  private monitoringInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.initializeDefaultAlertRules()
    this.startMonitoring()
  }

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager()
    }
    return AlertManager.instance
  }

  /** Initialize default alert rules */
  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds 5%',
        condition: (snapshot) => snapshot.performance.errorRate > 0.05,
        severity: 'high',
        enabled: true,
        cooldownMs: 300000 // 5 minutes
      },
      {
        id: 'high-latency',
        name: 'High Latency',
        description: 'P99 latency exceeds 2000ms',
        condition: (snapshot) => snapshot.performance.p99Latency > 2000,
        severity: 'medium',
        enabled: true,
        cooldownMs: 300000
      },
      {
        id: 'low-cache-hit-rate',
        name: 'Low Cache Hit Rate',
        description: 'Cache hit rate below 70%',
        condition: (snapshot) => snapshot.performance.cacheHitRate < 0.7,
        severity: 'low',
        enabled: true,
        cooldownMs: 600000 // 10 minutes
      },
      {
        id: 'security-violations-spike',
        name: 'Security Violations Spike',
        description: 'More than 10 security violations in 5 minutes',
        condition: (snapshot) => snapshot.recentViolations.length > 10,
        severity: 'critical',
        enabled: true,
        cooldownMs: 180000 // 3 minutes
      },
      {
        id: 'system-unhealthy',
        name: 'System Unhealthy',
        description: 'Overall system health is not healthy',
        condition: (snapshot) => snapshot.health.overall.status !== 'healthy',
        severity: 'high',
        enabled: true,
        cooldownMs: 60000 // 1 minute
      }
    ]

    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule)
    }

    this.logger.info('Default alert rules initialized', {
      ruleCount: defaultRules.length
    })
  }

  /** Start alert monitoring */
  startMonitoring(): void {
    if (this.monitoringInterval) return

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAlerts()
      } catch (error) {
        this.logger.error('Failed to check alerts', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }, 30000) // Check every 30 seconds

    this.logger.info('Alert monitoring started')
  }

  /** Stop alert monitoring */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    this.logger.info('Alert monitoring stopped')
  }

  /** Check alert conditions */
  private async checkAlerts(): Promise<void> {
    const collector = GuardrailMetricsCollector.getInstance()
    const snapshot = collector.getLatestSnapshot()

    if (!snapshot) {
      return
    }

    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue

      // Check cooldown
      if (rule.lastTriggered &&
          Date.now() - rule.lastTriggered.getTime() < rule.cooldownMs) {
        continue
      }

      try {
        if (rule.condition(snapshot)) {
          await this.triggerAlert(rule, snapshot)
        }
      } catch (error) {
        this.logger.error(`Failed to evaluate alert rule ${ruleId}`, {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  /** Trigger an alert */
  private async triggerAlert(rule: AlertRule, snapshot: MetricsSnapshot): Promise<void> {
    const alertId = `${rule.id}-${Date.now()}`
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      timestamp: new Date(),
      severity: rule.severity,
      message: `${rule.name}: ${rule.description}`,
      snapshot
    }

    // Update rule last triggered
    rule.lastTriggered = new Date()

    // Store alert
    this.activeAlerts.set(alertId, alert)
    this.alertHistory.push(alert)

    // Trim alert history
    if (this.alertHistory.length > 1000) {
      this.alertHistory.splice(0, this.alertHistory.length - 1000)
    }

    // Log alert
    await this.logger.logSecurityViolation(
      `alert-${alertId}`,
      {
        type: 'system_alert',
        severity: rule.severity,
        pluginId: 'monitoring',
        reason: alert.message,
        action: 'alert'
      },
      {
        metadata: {
          ruleId: rule.id,
          alertId,
          snapshot: {
            errorRate: snapshot.performance.errorRate,
            latency: snapshot.performance.p99Latency,
            cacheHitRate: snapshot.performance.cacheHitRate,
            healthStatus: snapshot.health.overall.status
          }
        }
      }
    )

    this.logger.warn('Alert triggered', {
      alertId,
      ruleId: rule.id,
      severity: rule.severity,
      message: alert.message
    })
  }

  /** Get active alerts */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
  }

  /** Get alert history */
  getAlertHistory(limit?: number): Alert[] {
    const history = [...this.alertHistory].reverse()
    return limit ? history.slice(0, limit) : history
  }

  /** Resolve an alert */
  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (!alert) return false

    alert.resolved = new Date()
    alert.resolvedBy = resolvedBy

    this.activeAlerts.delete(alertId)

    this.logger.info('Alert resolved', {
      alertId,
      resolvedBy,
      duration: alert.resolved.getTime() - alert.timestamp.getTime()
    })

    return true
  }

  /** Add custom alert rule */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule)
    this.logger.info('Alert rule added', { ruleId: rule.id, name: rule.name })
  }

  /** Remove alert rule */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId)
    if (removed) {
      this.logger.info('Alert rule removed', { ruleId })
    }
    return removed
  }
}

// ============================================================================
// DASHBOARD API
// ============================================================================

export class GuardrailDashboard {
  private static instance: GuardrailDashboard | null = null
  private logger = GuardrailLogger.getInstance()
  private collector = GuardrailMetricsCollector.getInstance()
  private alertManager = AlertManager.getInstance()

  private constructor() {
    this.logger.info('Guardrail dashboard initialized')
  }

  static getInstance(): GuardrailDashboard {
    if (!GuardrailDashboard.instance) {
      GuardrailDashboard.instance = new GuardrailDashboard()
    }
    return GuardrailDashboard.instance
  }

  /** Get current system status */
  getSystemStatus() {
    const snapshot = this.collector.getLatestSnapshot()
    const activeAlerts = this.alertManager.getActiveAlerts()
    const stats = this.collector.getAggregatedStats()

    return {
      timestamp: new Date(),
      status: snapshot?.health.overall.status || 'unknown',
      performance: snapshot?.performance || null,
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
      stats
    }
  }

  /** Get detailed metrics */
  getDetailedMetrics(timeWindowMs: number = 3600000) {
    const cutoff = new Date(Date.now() - timeWindowMs)
    const history = this.collector.getMetricsHistory()
      .filter(s => s.timestamp >= cutoff)

    return {
      timeWindow: timeWindowMs,
      snapshots: history,
      aggregatedStats: this.collector.getAggregatedStats(timeWindowMs),
      securityViolations: this.collector.getRecentViolations(timeWindowMs)
    }
  }

  /** Get alert information */
  getAlerts() {
    return {
      active: this.alertManager.getActiveAlerts(),
      recent: this.alertManager.getAlertHistory(50),
      summary: {
        total: this.alertManager.getActiveAlerts().length,
        bySevertiy: this.getAlertsBySeverity()
      }
    }
  }

  private getAlertsBySeverity() {
    const alerts = this.alertManager.getActiveAlerts()
    const summary = { low: 0, medium: 0, high: 0, critical: 0 }

    for (const alert of alerts) {
      summary[alert.severity]++
    }

    return summary
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export function getGuardrailDashboard(): GuardrailDashboard {
  return GuardrailDashboard.getInstance()
}

export function getMetricsCollector(): GuardrailMetricsCollector {
  return GuardrailMetricsCollector.getInstance()
}

export function getAlertManager(): AlertManager {
  return AlertManager.getInstance()
}

// Auto-start monitoring when module is loaded
const config = getCurrentConfig()
if (config.monitoring?.enabled !== false) {
  // Initialize monitoring components
  getMetricsCollector()
  getAlertManager()
}

export type {
  MetricsSnapshot,
  SecurityViolation,
  AlertRule,
  Alert
}