/**
 * Monitoring System - Main Entry Point
 *
 * Centralized monitoring system initialization and management
 * - Automatic startup and configuration
 * - Component integration
 * - Error handling and recovery
 * - Performance optimization
 */

import { productionMonitor } from './production-monitor'
import { analyticsEngine } from './analytics-engine'
import { dashboardDataProvider } from './dashboard-data-provider'
import { monitoringIntegration } from './integration'
import { metricCollectors } from './collectors'
import { alertingSystem } from './alerting'

// System configuration
export interface MonitoringSystemConfig {
  autoStart: boolean
  enableMetricCollection: boolean
  enableRealTimeAlerts: boolean
  enableDashboards: boolean
  enableAnalytics: boolean
  performanceMode: 'high' | 'balanced' | 'low'
  retryAttempts: number
}

const defaultConfig: MonitoringSystemConfig = {
  autoStart: true,
  enableMetricCollection: true,
  enableRealTimeAlerts: true,
  enableDashboards: true,
  enableAnalytics: true,
  performanceMode: 'balanced',
  retryAttempts: 3
}

class MonitoringSystem {
  private config: MonitoringSystemConfig
  private isInitialized = false
  private isRunning = false
  private healthCheckTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<MonitoringSystemConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Initialize the complete monitoring system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('🚀 Initializing Ascendia Monitoring System...')
      const startTime = Date.now()

      // Initialize core components in order
      await this.initializeComponents()

      // Setup system health monitoring
      if (this.config.autoStart) {
        await this.start()
      }

      this.isInitialized = true
      const initTime = Date.now() - startTime

      console.log(`✅ Monitoring system initialized successfully in ${initTime}ms`)
      console.log('📊 Features enabled:', {
        metricCollection: this.config.enableMetricCollection,
        realTimeAlerts: this.config.enableRealTimeAlerts,
        dashboards: this.config.enableDashboards,
        analytics: this.config.enableAnalytics
      })

    } catch (error) {
      console.error('❌ Failed to initialize monitoring system:', error)
      throw new Error(`Monitoring system initialization failed: ${error.message}`)
    }
  }

  /**
   * Start the monitoring system
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    try {
      console.log('▶️ Starting monitoring system...')

      // Start metric collection
      if (this.config.enableMetricCollection) {
        await metricCollectors.start()
      }

      // Initialize alerting system
      if (this.config.enableRealTimeAlerts) {
        await alertingSystem.initialize()
      }

      // Setup system health monitoring
      this.startHealthMonitoring()

      this.isRunning = true
      console.log('✅ Monitoring system started successfully')

    } catch (error) {
      console.error('❌ Failed to start monitoring system:', error)
      throw error
    }
  }

  /**
   * Stop the monitoring system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return

    try {
      console.log('⏹️ Stopping monitoring system...')

      // Stop metric collection
      if (this.config.enableMetricCollection) {
        metricCollectors.stop()
      }

      // Stop health monitoring
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer)
        this.healthCheckTimer = null
      }

      // Cleanup alerting system
      alertingSystem.cleanup()

      this.isRunning = false
      console.log('✅ Monitoring system stopped successfully')

    } catch (error) {
      console.error('❌ Failed to stop monitoring system:', error)
    }
  }

  /**
   * Get system status and health
   */
  async getSystemStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'critical'
    initialized: boolean
    running: boolean
    components: Record<string, boolean>
    metrics: {
      uptime: number
      totalAlerts: number
      activeCollectors: number
      dashboardConnections: number
    }
  }> {
    try {
      const components = {
        productionMonitor: true, // Always available
        analyticsEngine: this.config.enableAnalytics,
        dashboards: this.config.enableDashboards,
        metricCollection: this.config.enableMetricCollection && this.isRunning,
        alerting: this.config.enableRealTimeAlerts
      }

      // Get basic metrics
      const activeAlerts = alertingSystem.getActiveAlerts()
      const uptime = this.isRunning ? Date.now() - (this.startTime || Date.now()) : 0

      return {
        status: this.determineSystemStatus(components, activeAlerts.length),
        initialized: this.isInitialized,
        running: this.isRunning,
        components,
        metrics: {
          uptime: Math.floor(uptime / 1000), // seconds
          totalAlerts: activeAlerts.length,
          activeCollectors: this.isRunning ? 8 : 0, // Number of collectors
          dashboardConnections: 0 // Would be tracked in production
        }
      }

    } catch (error) {
      console.error('Failed to get system status:', error)
      return {
        status: 'critical',
        initialized: this.isInitialized,
        running: this.isRunning,
        components: {},
        metrics: {
          uptime: 0,
          totalAlerts: 0,
          activeCollectors: 0,
          dashboardConnections: 0
        }
      }
    }
  }

  /**
   * Track metrics for a specific component
   */
  async trackComponentMetrics(
    component: 'security_framework' | 'memory_engine' | 'parallel_processor' | 'voice_learning' | 'rag_engine',
    operation: string,
    metrics: {
      latency: number
      success: boolean
      customMetrics?: Record<string, any>
    },
    context: {
      userId?: string
      sessionId?: string
    } = {}
  ): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Monitoring system not initialized, skipping metric tracking')
      return
    }

    try {
      // Track based on component type
      switch (component) {
        case 'security_framework':
          await monitoringIntegration.trackSecurityMetrics({
            operation,
            latency: metrics.latency,
            violationsDetected: metrics.success ? 0 : 1,
            userId: context.userId,
            sessionId: context.sessionId
          })
          break

        case 'memory_engine':
          await monitoringIntegration.trackMemoryMetrics({
            operation,
            latency: metrics.latency,
            memoryUsage: metrics.customMetrics?.memoryUsage || 50,
            cacheHitRate: metrics.customMetrics?.cacheHitRate || 85,
            userId: context.userId,
            sessionId: context.sessionId
          })
          break

        case 'parallel_processor':
          await monitoringIntegration.trackParallelProcessingMetrics({
            operation,
            totalLatency: metrics.latency,
            grammarLatency: metrics.customMetrics?.grammarLatency || metrics.latency * 0.4,
            polishLatency: metrics.customMetrics?.polishLatency || metrics.latency * 0.6,
            improvementPercent: metrics.customMetrics?.improvementPercent || (metrics.success ? 60 : 30),
            userId: context.userId,
            sessionId: context.sessionId
          })
          break

        case 'voice_learning':
          await monitoringIntegration.trackVoiceLearningMetrics({
            operation,
            latency: metrics.latency,
            accuracyScore: metrics.customMetrics?.accuracyScore || (metrics.success ? 85 : 60),
            adaptationSuccess: metrics.success,
            userId: context.userId,
            sessionId: context.sessionId
          })
          break

        case 'rag_engine':
          await monitoringIntegration.trackRAGMetrics({
            operation,
            latency: metrics.latency,
            relevanceScore: metrics.customMetrics?.relevanceScore || (metrics.success ? 90 : 70),
            vectorCount: metrics.customMetrics?.vectorCount || 10,
            userId: context.userId,
            sessionId: context.sessionId
          })
          break
      }

      // Process metrics for alerting
      if (this.config.enableRealTimeAlerts) {
        await alertingSystem.processMetrics(component, {
          latency: metrics.latency,
          ...metrics.customMetrics
        }, context)
      }

    } catch (error) {
      console.error(`Failed to track ${component} metrics:`, error)
    }
  }

  /**
   * Create monitoring wrapper for functions
   */
  createMonitoringWrapper<T extends (...args: any[]) => any>(
    component: 'security_framework' | 'memory_engine' | 'parallel_processor' | 'voice_learning' | 'rag_engine',
    operation: string
  ) {
    return (fn: T): T => {
      return monitoringIntegration.createMetricWrapper(component, operation, fn)
    }
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData(config: any): Promise<any> {
    if (!this.config.enableDashboards) {
      throw new Error('Dashboard functionality is disabled')
    }

    await dashboardDataProvider.initialize()
    return dashboardDataProvider.getDashboardData(config)
  }

  /**
   * Generate analytics report
   */
  async generateAnalyticsReport(type: 'user' | 'system' | 'revenue' = 'system'): Promise<any> {
    if (!this.config.enableAnalytics) {
      throw new Error('Analytics functionality is disabled')
    }

    switch (type) {
      case 'system':
        return analyticsEngine.generateSystemAnalytics()
      case 'user':
        return analyticsEngine.analyzeUserSegmentation()
      case 'revenue':
        return analyticsEngine.analyzeRevenue()
      default:
        throw new Error(`Unknown analytics report type: ${type}`)
    }
  }

  // Private helper methods
  private async initializeComponents(): Promise<void> {
    const components = [
      { name: 'Production Monitor', fn: () => productionMonitor.initialize() },
      { name: 'Monitoring Integration', fn: () => monitoringIntegration.initialize() },
      { name: 'Dashboard Data Provider', fn: () => dashboardDataProvider.initialize() }
    ]

    // Add optional components based on configuration
    if (this.config.enableAnalytics) {
      components.push({ name: 'Analytics Engine', fn: () => Promise.resolve() })
    }

    if (this.config.enableRealTimeAlerts) {
      components.push({ name: 'Alerting System', fn: () => alertingSystem.initialize() })
    }

    // Initialize components with retry logic
    for (const component of components) {
      await this.initializeComponentWithRetry(component.name, component.fn)
    }
  }

  private async initializeComponentWithRetry(
    name: string,
    initFn: () => Promise<void>,
    attempt: number = 1
  ): Promise<void> {
    try {
      console.log(`🔧 Initializing ${name}...`)
      await initFn()
      console.log(`✅ ${name} initialized successfully`)

    } catch (error) {
      console.error(`❌ Failed to initialize ${name} (attempt ${attempt}):`, error)

      if (attempt < this.config.retryAttempts) {
        const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
        console.log(`🔄 Retrying ${name} in ${delay}ms...`)

        await new Promise(resolve => setTimeout(resolve, delay))
        return this.initializeComponentWithRetry(name, initFn, attempt + 1)
      } else {
        throw new Error(`Failed to initialize ${name} after ${this.config.retryAttempts} attempts`)
      }
    }
  }

  private startHealthMonitoring(): void {
    console.log('💊 Starting system health monitoring...')

    this.healthCheckTimer = setInterval(async () => {
      try {
        const status = await this.getSystemStatus()

        // Log health status
        if (status.status !== 'healthy') {
          console.warn('⚠️ System health degraded:', status)
        }

        // Auto-restart collectors if they've stopped
        if (this.config.enableMetricCollection && status.metrics.activeCollectors === 0) {
          console.log('🔄 Restarting metric collectors...')
          await metricCollectors.start()
        }

      } catch (error) {
        console.error('Failed to check system health:', error)
      }
    }, 60000) // Every minute
  }

  private determineSystemStatus(
    components: Record<string, boolean>,
    activeAlerts: number
  ): 'healthy' | 'degraded' | 'critical' {
    const componentCount = Object.values(components).filter(Boolean).length
    const totalComponents = Object.keys(components).length

    // Critical if less than 50% of components are working or too many alerts
    if (componentCount < totalComponents * 0.5 || activeAlerts > 10) {
      return 'critical'
    }

    // Degraded if less than 80% of components are working or some alerts
    if (componentCount < totalComponents * 0.8 || activeAlerts > 3) {
      return 'degraded'
    }

    return 'healthy'
  }

  private startTime?: number

  /**
   * Cleanup monitoring system
   */
  async cleanup(): Promise<void> {
    await this.stop()

    // Cleanup individual components
    monitoringIntegration.cleanup()
    alertingSystem.cleanup()

    this.isInitialized = false
    console.log('🧹 Monitoring system cleaned up')
  }
}

// Create and export singleton instance
export const monitoringSystem = new MonitoringSystem()

// Auto-initialize if configured
if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'test') {
  monitoringSystem.initialize().catch(error => {
    console.error('Failed to auto-initialize monitoring system:', error)
  })
}

// Export all monitoring components for direct access if needed
export {
  productionMonitor,
  analyticsEngine,
  dashboardDataProvider,
  monitoringIntegration,
  metricCollectors,
  alertingSystem
}

export default monitoringSystem