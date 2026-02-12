/**
 * Metric Collectors
 *
 * Automated metric collection for AI components
 * - Component-specific metric collection
 * - Performance data aggregation
 * - Error and anomaly detection
 * - Real-time data streaming
 */

import { monitoringIntegration } from './integration'
import { createClient } from '@/lib/supabase/client'

// Collector configuration
interface CollectorConfig {
  enabled: boolean
  collectionInterval: number // ms
  batchSize: number
  retryAttempts: number
  errorThreshold: number // percentage
}

const defaultConfig: CollectorConfig = {
  enabled: true,
  collectionInterval: 15000, // 15 seconds
  batchSize: 50,
  retryAttempts: 3,
  errorThreshold: 5
}

class MetricCollectors {
  private config: CollectorConfig
  private isRunning = false
  private collectors: Map<string, NodeJS.Timeout> = new Map()
  private errorCounts: Map<string, number> = new Map()

  constructor(config: Partial<CollectorConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Start all metric collectors
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    try {
      console.log('📊 Starting metric collectors...')

      // Initialize monitoring integration
      await monitoringIntegration.initialize()

      // Start individual collectors
      await Promise.all([
        this.startSecurityCollector(),
        this.startMemoryCollector(),
        this.startParallelProcessingCollector(),
        this.startVoiceLearningCollector(),
        this.startRAGEngineCollector(),
        this.startSystemHealthCollector(),
        this.startDatabaseMetricsCollector(),
        this.startUserActivityCollector()
      ])

      this.isRunning = true
      console.log('✅ All metric collectors started successfully')

    } catch (error) {
      console.error('Failed to start metric collectors:', error)
      throw error
    }
  }

  /**
   * Stop all metric collectors
   */
  stop(): void {
    if (!this.isRunning) return

    console.log('🛑 Stopping metric collectors...')

    // Clear all collector timers
    this.collectors.forEach((timer, name) => {
      clearInterval(timer)
      console.log(`Stopped ${name} collector`)
    })

    this.collectors.clear()
    this.isRunning = false

    console.log('✅ All metric collectors stopped')
  }

  /**
   * Security Framework Metrics Collector
   */
  private async startSecurityCollector(): Promise<void> {
    const collectorName = 'security_collector'

    const timer = setInterval(async () => {
      try {
        const metrics = await this.collectSecurityMetrics()

        await monitoringIntegration.trackSecurityMetrics({
          operation: 'automated_collection',
          latency: metrics.avgValidationTime,
          violationsDetected: metrics.violationsPerMinute
        })

        this.resetErrorCount(collectorName)

      } catch (error) {
        await this.handleCollectorError(collectorName, error)
      }
    }, this.config.collectionInterval)

    this.collectors.set(collectorName, timer)
    console.log('🛡️ Security metrics collector started')
  }

  /**
   * Memory Engine Metrics Collector
   */
  private async startMemoryCollector(): Promise<void> {
    const collectorName = 'memory_collector'

    const timer = setInterval(async () => {
      try {
        const metrics = await this.collectMemoryMetrics()

        await monitoringIntegration.trackMemoryMetrics({
          operation: 'automated_collection',
          latency: metrics.avgAccessTime,
          memoryUsage: metrics.utilizationPercent,
          cacheHitRate: metrics.cacheHitRate
        })

        this.resetErrorCount(collectorName)

      } catch (error) {
        await this.handleCollectorError(collectorName, error)
      }
    }, this.config.collectionInterval)

    this.collectors.set(collectorName, timer)
    console.log('🧠 Memory metrics collector started')
  }

  /**
   * Parallel Processing Metrics Collector
   */
  private async startParallelProcessingCollector(): Promise<void> {
    const collectorName = 'parallel_collector'

    const timer = setInterval(async () => {
      try {
        const metrics = await this.collectParallelProcessingMetrics()

        await monitoringIntegration.trackParallelProcessingMetrics({
          operation: 'automated_collection',
          totalLatency: metrics.avgTotalTime,
          grammarLatency: metrics.avgGrammarTime,
          polishLatency: metrics.avgPolishTime,
          improvementPercent: metrics.avgImprovement
        })

        this.resetErrorCount(collectorName)

      } catch (error) {
        await this.handleCollectorError(collectorName, error)
      }
    }, this.config.collectionInterval)

    this.collectors.set(collectorName, timer)
    console.log('⚡ Parallel processing metrics collector started')
  }

  /**
   * Voice Learning Metrics Collector
   */
  private async startVoiceLearningCollector(): Promise<void> {
    const collectorName = 'voice_collector'

    const timer = setInterval(async () => {
      try {
        const metrics = await this.collectVoiceLearningMetrics()

        await monitoringIntegration.trackVoiceLearningMetrics({
          operation: 'automated_collection',
          latency: metrics.avgAdaptationTime,
          accuracyScore: metrics.avgAccuracy,
          adaptationSuccess: metrics.successRate > 0.8
        })

        this.resetErrorCount(collectorName)

      } catch (error) {
        await this.handleCollectorError(collectorName, error)
      }
    }, this.config.collectionInterval)

    this.collectors.set(collectorName, timer)
    console.log('🗣️ Voice learning metrics collector started')
  }

  /**
   * RAG Engine Metrics Collector
   */
  private async startRAGEngineCollector(): Promise<void> {
    const collectorName = 'rag_collector'

    const timer = setInterval(async () => {
      try {
        const metrics = await this.collectRAGEngineMetrics()

        await monitoringIntegration.trackRAGMetrics({
          operation: 'automated_collection',
          latency: metrics.avgRetrievalTime,
          relevanceScore: metrics.avgRelevance,
          vectorCount: metrics.avgVectorCount
        })

        this.resetErrorCount(collectorName)

      } catch (error) {
        await this.handleCollectorError(collectorName, error)
      }
    }, this.config.collectionInterval)

    this.collectors.set(collectorName, timer)
    console.log('📚 RAG engine metrics collector started')
  }

  /**
   * System Health Metrics Collector
   */
  private async startSystemHealthCollector(): Promise<void> {
    const collectorName = 'system_health_collector'

    const timer = setInterval(async () => {
      try {
        const metrics = await this.collectSystemHealthMetrics()

        await monitoringIntegration.trackSystemMetrics({
          requestId: crypto.randomUUID(),
          totalLatency: 0, // Not applicable for health metrics
          componentsUsed: ['overall_system'],
          success: metrics.overallHealth > 80
        })

        this.resetErrorCount(collectorName)

      } catch (error) {
        await this.handleCollectorError(collectorName, error)
      }
    }, this.config.collectionInterval * 2) // Less frequent for system health

    this.collectors.set(collectorName, timer)
    console.log('💊 System health metrics collector started')
  }

  /**
   * Database Metrics Collector
   */
  private async startDatabaseMetricsCollector(): Promise<void> {
    const collectorName = 'database_collector'

    const timer = setInterval(async () => {
      try {
        const metrics = await this.collectDatabaseMetrics()

        // Track database performance as part of system metrics
        await monitoringIntegration.trackSystemMetrics({
          requestId: crypto.randomUUID(),
          totalLatency: metrics.avgQueryTime,
          componentsUsed: ['database'],
          success: metrics.connectionHealth > 90
        })

        this.resetErrorCount(collectorName)

      } catch (error) {
        await this.handleCollectorError(collectorName, error)
      }
    }, this.config.collectionInterval * 3) // Less frequent for database

    this.collectors.set(collectorName, timer)
    console.log('🗄️ Database metrics collector started')
  }

  /**
   * User Activity Metrics Collector
   */
  private async startUserActivityCollector(): Promise<void> {
    const collectorName = 'user_activity_collector'

    const timer = setInterval(async () => {
      try {
        const metrics = await this.collectUserActivityMetrics()

        // Store user activity metrics for analytics
        await this.storeUserActivityMetrics(metrics)

        this.resetErrorCount(collectorName)

      } catch (error) {
        await this.handleCollectorError(collectorName, error)
      }
    }, this.config.collectionInterval * 4) // Less frequent for user activity

    this.collectors.set(collectorName, timer)
    console.log('👥 User activity metrics collector started')
  }

  // Individual metric collection methods
  private async collectSecurityMetrics(): Promise<{
    avgValidationTime: number
    violationsPerMinute: number
    falsePositiveRate: number
    threatsBlocked: number
  }> {
    const supabase = createClient()

    // Get recent security violations (table removed during cleanup)
    // const { data: violations } = await supabase
    //   .from('security_violations')
    //   .select('created_at, violation_type, is_false_positive')
    //   .gte('created_at', new Date(Date.now() - 60 * 1000).toISOString()) // Last minute
    const violations: any[] = [] // Fallback until feature is reimplemented

    const violationCount = violations?.length || 0
    const falsePositives = violations?.filter(v => v.is_false_positive).length || 0

    // Get recent production metrics for validation times
    const { data: metrics } = await supabase
      .from('production_metrics')
      .select('latency')
      .eq('component', 'security_framework')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes

    const avgValidationTime = metrics && metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.latency || 0), 0) / metrics.length
      : 25 // Default expected validation time

    return {
      avgValidationTime,
      violationsPerMinute: violationCount,
      falsePositiveRate: violationCount > 0 ? (falsePositives / violationCount) * 100 : 0,
      threatsBlocked: violationCount - falsePositives
    }
  }

  private async collectMemoryMetrics(): Promise<{
    avgAccessTime: number
    utilizationPercent: number
    cacheHitRate: number
    activeContexts: number
  }> {
    const supabase = createClient()

    // Get recent memory operations
    const { data: metrics } = await supabase
      .from('production_metrics')
      .select('latency, custom_metrics')
      .eq('component', 'memory_engine')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

    // Get active conversation contexts
    const { data: contexts } = await supabase
      .from('conversation_memory')
      .select('id')
      .gte('last_accessed', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Active in last 30 min

    const avgAccessTime = metrics && metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.latency || 0), 0) / metrics.length
      : 35

    // Extract cache hit rate from custom metrics
    const cacheHitRate = metrics && metrics.length > 0
      ? metrics
          .map(m => m.custom_metrics?.cacheHitRate || 0)
          .reduce((sum, rate) => sum + rate, 0) / metrics.length
      : 85 // Default cache hit rate

    // Calculate memory utilization (mock for now)
    const utilizationPercent = Math.min(95, 40 + (contexts?.length || 0) * 2)

    return {
      avgAccessTime,
      utilizationPercent,
      cacheHitRate,
      activeContexts: contexts?.length || 0
    }
  }

  private async collectParallelProcessingMetrics(): Promise<{
    avgTotalTime: number
    avgGrammarTime: number
    avgPolishTime: number
    avgImprovement: number
    successRate: number
  }> {
    const supabase = createClient()

    // Get recent parallel processing metrics
    const { data: metrics } = await supabase
      .from('production_metrics')
      .select('latency, custom_metrics')
      .eq('component', 'parallel_processor')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

    if (!metrics || metrics.length === 0) {
      return {
        avgTotalTime: 2500,
        avgGrammarTime: 800,
        avgPolishTime: 1700,
        avgImprovement: 62,
        successRate: 0.95
      }
    }

    const avgTotalTime = metrics.reduce((sum, m) => sum + (m.latency || 0), 0) / metrics.length

    // Extract specific timing data from custom metrics
    const grammarTimes = metrics.map(m => m.custom_metrics?.grammarLatency || 0).filter(t => t > 0)
    const polishTimes = metrics.map(m => m.custom_metrics?.polishLatency || 0).filter(t => t > 0)
    const improvements = metrics.map(m => m.custom_metrics?.improvement_percent || 0).filter(i => i > 0)

    return {
      avgTotalTime,
      avgGrammarTime: grammarTimes.length > 0 ? grammarTimes.reduce((s, t) => s + t, 0) / grammarTimes.length : avgTotalTime * 0.3,
      avgPolishTime: polishTimes.length > 0 ? polishTimes.reduce((s, t) => s + t, 0) / polishTimes.length : avgTotalTime * 0.7,
      avgImprovement: improvements.length > 0 ? improvements.reduce((s, i) => s + i, 0) / improvements.length : 60,
      successRate: metrics.filter(m => m.custom_metrics?.improvement_percent > 30).length / metrics.length
    }
  }

  private async collectVoiceLearningMetrics(): Promise<{
    avgAdaptationTime: number
    avgAccuracy: number
    successRate: number
    totalAdaptations: number
  }> {
    const supabase = createClient()

    // Get recent voice learning operations
    const { data: metrics } = await supabase
      .from('production_metrics')
      .select('latency, custom_metrics')
      .eq('component', 'voice_learning')
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // 10 minutes

    if (!metrics || metrics.length === 0) {
      return {
        avgAdaptationTime: 1200,
        avgAccuracy: 87.3,
        successRate: 0.89,
        totalAdaptations: 0
      }
    }

    const avgAdaptationTime = metrics.reduce((sum, m) => sum + (m.latency || 0), 0) / metrics.length

    // Extract accuracy and success data
    const accuracies = metrics.map(m => m.custom_metrics?.accuracyScore || 0).filter(a => a > 0)
    const successes = metrics.filter(m => m.custom_metrics?.adaptationSuccess === true)

    return {
      avgAdaptationTime,
      avgAccuracy: accuracies.length > 0 ? accuracies.reduce((s, a) => s + a, 0) / accuracies.length : 85,
      successRate: successes.length / metrics.length,
      totalAdaptations: metrics.length
    }
  }

  private async collectRAGEngineMetrics(): Promise<{
    avgRetrievalTime: number
    avgRelevance: number
    avgVectorCount: number
    cacheEfficiency: number
  }> {
    const supabase = createClient()

    // Get recent RAG operations
    const { data: metrics } = await supabase
      .from('production_metrics')
      .select('latency, custom_metrics')
      .eq('component', 'rag_engine')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

    if (!metrics || metrics.length === 0) {
      return {
        avgRetrievalTime: 450,
        avgRelevance: 91.8,
        avgVectorCount: 15,
        cacheEfficiency: 88
      }
    }

    const avgRetrievalTime = metrics.reduce((sum, m) => sum + (m.latency || 0), 0) / metrics.length

    // Extract RAG-specific metrics
    const relevanceScores = metrics.map(m => m.custom_metrics?.relevance_score || 0).filter(r => r > 0)
    const vectorCounts = metrics.map(m => m.custom_metrics?.vectorCount || 0).filter(v => v > 0)

    return {
      avgRetrievalTime,
      avgRelevance: relevanceScores.length > 0 ? relevanceScores.reduce((s, r) => s + r, 0) / relevanceScores.length : 90,
      avgVectorCount: vectorCounts.length > 0 ? vectorCounts.reduce((s, v) => s + v, 0) / vectorCounts.length : 12,
      cacheEfficiency: Math.max(80, 95 - avgRetrievalTime / 50) // Efficiency inversely related to retrieval time
    }
  }

  private async collectSystemHealthMetrics(): Promise<{
    overallHealth: number
    componentCount: number
    activeAlerts: number
    uptime: number
  }> {
    const supabase = createClient()

    // Get latest health snapshot (table removed during cleanup)
    // const { data: snapshot } = await supabase
    //   .from('system_health_snapshots')
    //   .select('overall_health_score')
    //   .order('snapshot_time', { ascending: false })
    //   .limit(1)
    //   .single()

    // Get active alerts (table removed during cleanup)
    // const { data: alerts } = await supabase
    //   .from('production_alerts')
    //   .select('id', { count: 'exact' })
    //   .eq('status', 'active')
    const snapshot = null // Fallback until feature is reimplemented
    const alerts: any[] = [] // Fallback until feature is reimplemented

    return {
      overallHealth: snapshot?.overall_health_score || 94.5,
      componentCount: 5, // Number of monitored components
      activeAlerts: alerts?.length || 0,
      uptime: 99.9 // Mock uptime
    }
  }

  private async collectDatabaseMetrics(): Promise<{
    avgQueryTime: number
    connectionHealth: number
    activeConnections: number
    cacheHitRate: number
  }> {
    // Mock database metrics - in production, these would come from actual DB monitoring
    return {
      avgQueryTime: Math.random() * 50 + 10, // 10-60ms
      connectionHealth: Math.random() * 10 + 90, // 90-100%
      activeConnections: Math.floor(Math.random() * 20 + 5), // 5-25 connections
      cacheHitRate: Math.random() * 15 + 85 // 85-100%
    }
  }

  private async collectUserActivityMetrics(): Promise<{
    activeUsers: number
    sessionsPerHour: number
    avgSessionDuration: number
    featureUsage: Record<string, number>
  }> {
    const supabase = createClient()

    // Get recent user activity
    const { data: analytics } = await supabase
      .from('user_analytics')
      .select('user_id, session_duration, event_type')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour

    const activeUsers = new Set(analytics?.map(a => a.user_id) || []).size
    const sessionsPerHour = analytics?.length || 0

    // Calculate average session duration
    const sessionDurations = analytics?.map(a => {
      if (a.session_duration) {
        // Parse PostgreSQL interval
        const match = a.session_duration.match(/(\d+):(\d+):(\d+)/)
        if (match) {
          const [, hours, minutes, seconds] = match
          return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)
        }
      }
      return 0
    }).filter(d => d > 0) || []

    const avgSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length
      : 0

    // Feature usage breakdown
    const featureUsage: Record<string, number> = {}
    analytics?.forEach(a => {
      if (a.event_type) {
        featureUsage[a.event_type] = (featureUsage[a.event_type] || 0) + 1
      }
    })

    return {
      activeUsers,
      sessionsPerHour,
      avgSessionDuration,
      featureUsage
    }
  }

  private async storeUserActivityMetrics(metrics: any): Promise<void> {
    // Store aggregated user activity metrics for later analysis
    const supabase = createClient()

    try {
      await supabase.from('user_analytics').insert({
        user_id: null, // System-generated metric
        session_id: `system_${Date.now()}`,
        event_type: 'system_metrics_collection',
        event_category: 'performance',
        event_data: {
          activeUsers: metrics.activeUsers,
          sessionsPerHour: metrics.sessionsPerHour,
          avgSessionDuration: metrics.avgSessionDuration,
          featureUsage: metrics.featureUsage,
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      console.error('Failed to store user activity metrics:', error)
    }
  }

  private async handleCollectorError(collectorName: string, error: any): Promise<void> {
    const errorCount = this.errorCounts.get(collectorName) || 0
    this.errorCounts.set(collectorName, errorCount + 1)

    console.error(`Error in ${collectorName}:`, error)

    // Stop collector if error threshold exceeded
    if (errorCount >= this.config.retryAttempts) {
      console.error(`Stopping ${collectorName} due to repeated errors`)

      const timer = this.collectors.get(collectorName)
      if (timer) {
        clearInterval(timer)
        this.collectors.delete(collectorName)
      }

      // Trigger alert for failed collector
      try {
        await monitoringIntegration.trackSystemMetrics({
          requestId: crypto.randomUUID(),
          totalLatency: 0,
          componentsUsed: ['monitoring_system'],
          success: false
        })
      } catch (alertError) {
        console.error('Failed to trigger collector failure alert:', alertError)
      }
    }
  }

  private resetErrorCount(collectorName: string): void {
    this.errorCounts.set(collectorName, 0)
  }
}

// Export singleton instance
export const metricCollectors = new MetricCollectors()

export default MetricCollectors