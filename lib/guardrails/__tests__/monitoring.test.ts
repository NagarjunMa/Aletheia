// Monitoring and Analytics Tests
// Purpose: Test suite for monitoring, metrics, and alerting

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  GuardrailMetricsCollector,
  AlertManager,
  GuardrailDashboard,
  getMetricsCollector,
  getAlertManager,
  getGuardrailDashboard
} from '../monitoring/dashboard'
import type { MetricsSnapshot, AlertRule, SecurityViolation } from '../monitoring/dashboard'

// Mock dependencies
vi.mock('../core', () => ({
  getGuardrailEngine: () => ({
    getSystemHealth: vi.fn().mockResolvedValue({
      overall: { status: 'healthy', lastCheck: new Date() },
      components: {
        'input-validation': { status: 'healthy', lastCheck: new Date(), details: {} },
        'output-validation': { status: 'healthy', lastCheck: new Date(), details: {} },
        'content-safety': { status: 'healthy', lastCheck: new Date(), details: {} }
      }
    }),
    getPerformanceMetrics: vi.fn().mockReturnValue({
      averageLatency: 100,
      p95Latency: 200,
      p99Latency: 300,
      throughput: 50,
      errorRate: 0.01,
      cacheHitRate: 0.85,
      memoryUsage: 60,
      cpuUsage: 30
    }),
    getPlugins: vi.fn().mockReturnValue([
      { id: 'input-validation', name: 'Input Validation' },
      { id: 'output-validation', name: 'Output Validation' },
      { id: 'content-safety', name: 'Content Safety' }
    ]),
    getPluginStats: vi.fn().mockResolvedValue({
      totalValidations: 100,
      errors: 2,
      averageLatency: 50,
      cacheHitRate: 0.8,
      lastValidation: new Date()
    }),
    getActiveValidationCount: vi.fn().mockReturnValue(3)
  })
}))

vi.mock('../config', () => ({
  getCurrentConfig: () => ({
    monitoring: { enabled: true }
  })
}))

describe('GuardrailMetricsCollector', () => {
  let collector: GuardrailMetricsCollector

  beforeEach(() => {
    // Reset singleton for each test
    ;(GuardrailMetricsCollector as any).instance = null
    collector = getMetricsCollector()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    collector.stopCollection()
    vi.useRealTimers()
    ;(GuardrailMetricsCollector as any).instance = null
  })

  describe('Metrics Collection', () => {
    it('should start metrics collection automatically', () => {
      expect(collector).toBeDefined()
      // Collection should be started automatically
    })

    it('should collect metrics snapshots', async () => {
      // Manually trigger metrics collection
      await (collector as any).collectMetrics()

      const snapshot = collector.getLatestSnapshot()
      expect(snapshot).toBeDefined()
      expect(snapshot?.timestamp).toBeInstanceOf(Date)
      expect(snapshot?.performance).toBeDefined()
      expect(snapshot?.health).toBeDefined()
    })

    it('should maintain metrics history', async () => {
      // Collect multiple snapshots
      await (collector as any).collectMetrics()
      await (collector as any).collectMetrics()
      await (collector as any).collectMetrics()

      const history = collector.getMetricsHistory()
      expect(history.length).toBeGreaterThanOrEqual(3)
    })

    it('should limit history size', async () => {
      // Override max history size for test
      ;(collector as any).maxHistorySize = 2

      await (collector as any).collectMetrics()
      await (collector as any).collectMetrics()
      await (collector as any).collectMetrics()

      const history = collector.getMetricsHistory()
      expect(history.length).toBe(2)
    })
  })

  describe('Security Violation Tracking', () => {
    it('should record security violations', () => {
      const violation: Omit<SecurityViolation, 'timestamp'> = {
        correlationId: 'test-correlation',
        severity: 'high',
        pluginId: 'content-safety',
        category: 'harmful_content',
        reason: 'Detected violent content',
        userId: 'test-user',
        blocked: true
      }

      collector.recordViolation(violation)

      const recentViolations = collector.getRecentViolations(60000) // Last minute
      expect(recentViolations).toHaveLength(1)
      expect(recentViolations[0].correlationId).toBe('test-correlation')
    })

    it('should filter violations by time window', () => {
      const oldViolation: Omit<SecurityViolation, 'timestamp'> = {
        correlationId: 'old-violation',
        severity: 'medium',
        pluginId: 'input-validation',
        category: 'prompt_injection',
        reason: 'Old violation',
        blocked: false
      }

      collector.recordViolation(oldViolation)

      // Fast-forward time by 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000)

      const recentViolation: Omit<SecurityViolation, 'timestamp'> = {
        correlationId: 'recent-violation',
        severity: 'high',
        pluginId: 'content-safety',
        category: 'harmful_content',
        reason: 'Recent violation',
        blocked: true
      }

      collector.recordViolation(recentViolation)

      // Get violations from last 5 minutes
      const recentViolations = collector.getRecentViolations(5 * 60 * 1000)
      expect(recentViolations).toHaveLength(1)
      expect(recentViolations[0].correlationId).toBe('recent-violation')
    })

    it('should limit violation history', () => {
      // Record more than the limit
      for (let i = 0; i < 1010; i++) {
        collector.recordViolation({
          correlationId: `violation-${i}`,
          severity: 'low',
          pluginId: 'test',
          category: 'test',
          reason: 'Test violation',
          blocked: false
        })
      }

      const allViolations = collector.getRecentViolations(24 * 60 * 60 * 1000) // Last day
      expect(allViolations.length).toBeLessThanOrEqual(1000)
    })
  })

  describe('Aggregated Statistics', () => {
    beforeEach(() => {
      // Add some test violations
      collector.recordViolation({
        correlationId: 'violation-1',
        severity: 'high',
        pluginId: 'content-safety',
        category: 'harmful_content',
        reason: 'Violence',
        blocked: true
      })

      collector.recordViolation({
        correlationId: 'violation-2',
        severity: 'medium',
        pluginId: 'input-validation',
        category: 'prompt_injection',
        reason: 'Injection attempt',
        blocked: false
      })

      collector.recordViolation({
        correlationId: 'violation-3',
        severity: 'high',
        pluginId: 'content-safety',
        category: 'harmful_content',
        reason: 'More violence',
        blocked: true
      })
    })

    it('should calculate aggregated statistics', () => {
      const stats = collector.getAggregatedStats()

      expect(stats).toBeDefined()
      expect(stats.blockedRequests).toBe(2)
      expect(stats.flaggedRequests).toBe(1)
      expect(stats.topViolationCategories).toContainEqual({
        category: 'harmful_content',
        count: 2
      })
    })

    it('should filter statistics by time window', () => {
      // Fast-forward time
      vi.advanceTimersByTime(2 * 60 * 60 * 1000) // 2 hours

      // Add new violation
      collector.recordViolation({
        correlationId: 'new-violation',
        severity: 'low',
        pluginId: 'output-validation',
        category: 'quality_issue',
        reason: 'Quality problem',
        blocked: false
      })

      // Get stats for last hour (should only include new violation)
      const stats = collector.getAggregatedStats(60 * 60 * 1000) // 1 hour
      expect(stats.blockedRequests).toBe(0)
      expect(stats.flaggedRequests).toBe(1)
    })
  })
})

describe('AlertManager', () => {
  let alertManager: AlertManager

  beforeEach(() => {
    ;(AlertManager as any).instance = null
    alertManager = getAlertManager()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    alertManager.stopMonitoring()
    vi.useRealTimers()
    ;(AlertManager as any).instance = null
  })

  describe('Alert Rules', () => {
    it('should initialize with default alert rules', () => {
      const rules = (alertManager as any).alertRules
      expect(rules.size).toBeGreaterThan(0)
      expect(rules.has('high-error-rate')).toBe(true)
      expect(rules.has('high-latency')).toBe(true)
    })

    it('should add custom alert rules', () => {
      const customRule: AlertRule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        description: 'A custom alert rule',
        condition: () => false,
        severity: 'medium',
        enabled: true,
        cooldownMs: 60000
      }

      alertManager.addAlertRule(customRule)

      const rules = (alertManager as any).alertRules
      expect(rules.has('custom-rule')).toBe(true)
    })

    it('should remove alert rules', () => {
      const removed = alertManager.removeAlertRule('high-error-rate')
      expect(removed).toBe(true)

      const rules = (alertManager as any).alertRules
      expect(rules.has('high-error-rate')).toBe(false)
    })
  })

  describe('Alert Triggering', () => {
    it('should trigger alerts when conditions are met', async () => {
      const collector = getMetricsCollector()

      // Create a snapshot that triggers high error rate alert
      const badSnapshot: MetricsSnapshot = {
        timestamp: new Date(),
        performance: {
          averageLatency: 100,
          p95Latency: 200,
          p99Latency: 300,
          throughput: 50,
          errorRate: 0.1, // 10% error rate (should trigger alert)
          cacheHitRate: 0.85,
          memoryUsage: 60,
          cpuUsage: 30
        },
        health: {
          overall: { status: 'healthy', lastCheck: new Date() },
          components: {}
        },
        pluginStats: {},
        activeValidations: 0,
        recentViolations: []
      }

      // Mock the latest snapshot
      vi.spyOn(collector, 'getLatestSnapshot').mockReturnValue(badSnapshot)

      // Trigger alert check
      await (alertManager as any).checkAlerts()

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts.length).toBeGreaterThan(0)
      expect(activeAlerts[0].ruleId).toBe('high-error-rate')
    })

    it('should respect alert cooldowns', async () => {
      const collector = getMetricsCollector()

      const badSnapshot: MetricsSnapshot = {
        timestamp: new Date(),
        performance: {
          averageLatency: 100,
          p95Latency: 200,
          p99Latency: 300,
          throughput: 50,
          errorRate: 0.1, // High error rate
          cacheHitRate: 0.85,
          memoryUsage: 60,
          cpuUsage: 30
        },
        health: {
          overall: { status: 'healthy', lastCheck: new Date() },
          components: {}
        },
        pluginStats: {},
        activeValidations: 0,
        recentViolations: []
      }

      vi.spyOn(collector, 'getLatestSnapshot').mockReturnValue(badSnapshot)

      // Trigger first alert
      await (alertManager as any).checkAlerts()
      let activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts.length).toBe(1)

      // Try to trigger again immediately (should be blocked by cooldown)
      await (alertManager as any).checkAlerts()
      activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts.length).toBe(1) // Should still be 1, not 2
    })

    it('should allow alerts after cooldown period', async () => {
      const collector = getMetricsCollector()

      const badSnapshot: MetricsSnapshot = {
        timestamp: new Date(),
        performance: {
          averageLatency: 100,
          p95Latency: 200,
          p99Latency: 5000, // Very high latency
          throughput: 50,
          errorRate: 0.01,
          cacheHitRate: 0.85,
          memoryUsage: 60,
          cpuUsage: 30
        },
        health: {
          overall: { status: 'healthy', lastCheck: new Date() },
          components: {}
        },
        pluginStats: {},
        activeValidations: 0,
        recentViolations: []
      }

      vi.spyOn(collector, 'getLatestSnapshot').mockReturnValue(badSnapshot)

      // Trigger first alert
      await (alertManager as any).checkAlerts()

      // Fast-forward past cooldown period
      vi.advanceTimersByTime(6 * 60 * 1000) // 6 minutes

      // Update rule to have shorter cooldown for test
      const rules = (alertManager as any).alertRules
      const highLatencyRule = rules.get('high-latency')
      if (highLatencyRule) {
        highLatencyRule.lastTriggered = new Date(Date.now() - 6 * 60 * 1000)
      }

      // Trigger again
      await (alertManager as any).checkAlerts()

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts.length).toBe(2) // Should have 2 alerts now
    })
  })

  describe('Alert Resolution', () => {
    it('should resolve active alerts', async () => {
      // First trigger an alert
      const collector = getMetricsCollector()
      const badSnapshot: MetricsSnapshot = {
        timestamp: new Date(),
        performance: {
          averageLatency: 100,
          p95Latency: 200,
          p99Latency: 300,
          throughput: 50,
          errorRate: 0.1,
          cacheHitRate: 0.85,
          memoryUsage: 60,
          cpuUsage: 30
        },
        health: {
          overall: { status: 'healthy', lastCheck: new Date() },
          components: {}
        },
        pluginStats: {},
        activeValidations: 0,
        recentViolations: []
      }

      vi.spyOn(collector, 'getLatestSnapshot').mockReturnValue(badSnapshot)
      await (alertManager as any).checkAlerts()

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts.length).toBe(1)

      // Resolve the alert
      const alertId = activeAlerts[0].id
      const resolved = alertManager.resolveAlert(alertId, 'test-user')
      expect(resolved).toBe(true)

      const remainingAlerts = alertManager.getActiveAlerts()
      expect(remainingAlerts.length).toBe(0)

      // Check alert history
      const history = alertManager.getAlertHistory(10)
      expect(history[0].resolved).toBeInstanceOf(Date)
      expect(history[0].resolvedBy).toBe('test-user')
    })

    it('should maintain alert history', async () => {
      // Add a resolved alert to history
      const collector = getMetricsCollector()
      const badSnapshot: MetricsSnapshot = {
        timestamp: new Date(),
        performance: {
          averageLatency: 100,
          p95Latency: 200,
          p99Latency: 300,
          throughput: 50,
          errorRate: 0.1,
          cacheHitRate: 0.85,
          memoryUsage: 60,
          cpuUsage: 30
        },
        health: {
          overall: { status: 'healthy', lastCheck: new Date() },
          components: {}
        },
        pluginStats: {},
        activeValidations: 0,
        recentViolations: []
      }

      vi.spyOn(collector, 'getLatestSnapshot').mockReturnValue(badSnapshot)
      await (alertManager as any).checkAlerts()

      const history = alertManager.getAlertHistory()
      expect(history.length).toBeGreaterThan(0)
    })
  })
})

describe('GuardrailDashboard', () => {
  let dashboard: GuardrailDashboard

  beforeEach(() => {
    ;(GuardrailDashboard as any).instance = null
    dashboard = getGuardrailDashboard()
  })

  afterEach(() => {
    ;(GuardrailDashboard as any).instance = null
  })

  describe('System Status', () => {
    it('should provide current system status', () => {
      const status = dashboard.getSystemStatus()

      expect(status).toBeDefined()
      expect(status.timestamp).toBeInstanceOf(Date)
      expect(status.status).toBeDefined()
      expect(status.stats).toBeDefined()
      expect(typeof status.activeAlerts).toBe('number')
    })

    it('should include performance metrics in status', () => {
      const status = dashboard.getSystemStatus()

      expect(status.performance).toBeDefined()
      if (status.performance) {
        expect(typeof status.performance.errorRate).toBe('number')
        expect(typeof status.performance.p99Latency).toBe('number')
        expect(typeof status.performance.cacheHitRate).toBe('number')
      }
    })
  })

  describe('Detailed Metrics', () => {
    it('should provide detailed metrics for time window', () => {
      const metrics = dashboard.getDetailedMetrics(60 * 60 * 1000) // 1 hour

      expect(metrics).toBeDefined()
      expect(metrics.timeWindow).toBe(60 * 60 * 1000)
      expect(metrics.aggregatedStats).toBeDefined()
      expect(Array.isArray(metrics.snapshots)).toBe(true)
      expect(Array.isArray(metrics.securityViolations)).toBe(true)
    })

    it('should filter metrics by time window', () => {
      const shortWindow = dashboard.getDetailedMetrics(5 * 60 * 1000) // 5 minutes
      const longWindow = dashboard.getDetailedMetrics(60 * 60 * 1000) // 1 hour

      expect(shortWindow.timeWindow).toBe(5 * 60 * 1000)
      expect(longWindow.timeWindow).toBe(60 * 60 * 1000)
    })
  })

  describe('Alert Information', () => {
    it('should provide alert information', () => {
      const alerts = dashboard.getAlerts()

      expect(alerts).toBeDefined()
      expect(Array.isArray(alerts.active)).toBe(true)
      expect(Array.isArray(alerts.recent)).toBe(true)
      expect(alerts.summary).toBeDefined()
      expect(typeof alerts.summary.total).toBe('number')
    })

    it('should categorize alerts by severity', () => {
      const alerts = dashboard.getAlerts()

      expect(alerts.summary.bySevertiy).toBeDefined()
      expect(typeof alerts.summary.bySevertiy.low).toBe('number')
      expect(typeof alerts.summary.bySevertiy.medium).toBe('number')
      expect(typeof alerts.summary.bySevertiy.high).toBe('number')
      expect(typeof alerts.summary.bySevertiy.critical).toBe('number')
    })
  })

  describe('Singleton Behavior', () => {
    it('should return the same instance across calls', () => {
      const dashboard1 = getGuardrailDashboard()
      const dashboard2 = getGuardrailDashboard()

      expect(dashboard1).toBe(dashboard2)
    })
  })
})