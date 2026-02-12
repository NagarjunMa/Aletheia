/**
 * Dashboard Data Provider
 *
 * Real-time data aggregation and delivery for monitoring dashboards
 * - Real-time metrics streaming
 * - Interactive data visualization support
 * - Multi-tenant dashboard configuration
 * - Performance-optimized data queries
 *
 * Performance Targets:
 * - Data aggregation: <500ms
 * - Real-time updates: <1s latency
 * - Query optimization: 95%+ cache hit rate
 * - Dashboard rendering: <200ms
 */

import { createClient } from '@/lib/supabase/client'
import { productionMonitor } from './production-monitor'
import { analyticsEngine } from './analytics-engine'
import { z } from 'zod'

// Dashboard Configuration Schema
const DashboardConfigSchema = z.object({
  dashboardId: z.string(),
  userId: z.string().uuid().optional(),
  role: z.enum(['admin', 'manager', 'analyst', 'user']),
  layout: z.object({
    widgets: z.array(z.object({
      id: z.string(),
      type: z.enum([
        'system_overview',
        'performance_metrics',
        'user_analytics',
        'revenue_analytics',
        'ai_efficiency',
        'alert_center',
        'component_health',
        'trends_chart',
        'user_segmentation',
        'optimization_recommendations'
      ]),
      position: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number()
      }),
      config: z.record(z.any()).optional(),
      refreshInterval: z.number().default(5000)
    })),
    theme: z.enum(['light', 'dark', 'auto']).default('dark'),
    autoRefresh: z.boolean().default(true)
  }),
  permissions: z.object({
    canViewSystem: z.boolean(),
    canViewUsers: z.boolean(),
    canViewRevenue: z.boolean(),
    canViewAlerts: z.boolean(),
    canModifyConfig: z.boolean()
  }),
  filters: z.object({
    timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
    components: z.array(z.string()).optional(),
    userSegments: z.array(z.string()).optional(),
    alertSeverity: z.array(z.enum(['low', 'medium', 'high', 'critical'])).optional()
  }).optional()
})

export type DashboardConfig = z.infer<typeof DashboardConfigSchema>

// Real-time Update Schema
const UpdateEventSchema = z.object({
  dashboardId: z.string(),
  widgetId: z.string(),
  timestamp: z.number(),
  data: z.record(z.any()),
  type: z.enum(['metric_update', 'alert_new', 'alert_resolved', 'system_status', 'user_action'])
})

export type UpdateEvent = z.infer<typeof UpdateEventSchema>

class DashboardDataProvider {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()
  private subscribers: Map<string, Set<(event: UpdateEvent) => void>> = new Map()
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map()
  private isInitialized = false

  constructor() {
    this.initialize()
  }

  /**
   * Initialize dashboard data provider with cache optimization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('🚀 Initializing Dashboard Data Provider...')

      // Setup cache warming for common queries
      await this.warmCache()

      // Setup real-time data streaming
      this.setupRealTimeStreaming()

      // Setup automatic cache cleanup
      this.setupCacheCleanup()

      this.isInitialized = true
      console.log('✅ Dashboard Data Provider initialized successfully')
    } catch (error) {
      console.error('Failed to initialize dashboard data provider:', error)
      throw error
    }
  }

  /**
   * Get complete dashboard data based on configuration
   */
  async getDashboardData(config: DashboardConfig): Promise<{
    widgets: Record<string, any>
    metadata: {
      lastUpdate: number
      cacheHitRate: number
      refreshRate: number
      dataFreshness: Record<string, number>
    }
  }> {
    try {
      const startTime = Date.now()
      const widgets: Record<string, any> = {}
      const dataFreshness: Record<string, number> = {}
      let cacheHits = 0
      let totalQueries = 0

      // Process each widget in parallel for optimal performance
      const widgetPromises = config.layout.widgets.map(async (widget) => {
        totalQueries++
        const cacheKey = this.generateCacheKey(widget.type, widget.config, config.filters)

        // Check cache first
        const cachedData = this.getCachedData(cacheKey)
        if (cachedData) {
          cacheHits++
          widgets[widget.id] = cachedData.data
          dataFreshness[widget.id] = Date.now() - cachedData.timestamp
          return
        }

        // Fetch fresh data
        const widgetData = await this.getWidgetData(widget, config)
        widgets[widget.id] = widgetData
        dataFreshness[widget.id] = 0

        // Cache the result
        this.setCachedData(cacheKey, widgetData, widget.refreshInterval)
      })

      await Promise.all(widgetPromises)

      const processingTime = Date.now() - startTime
      const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0

      console.log(`📊 Dashboard data generated in ${processingTime}ms (${cacheHitRate.toFixed(1)}% cache hit rate)`)

      return {
        widgets,
        metadata: {
          lastUpdate: Date.now(),
          cacheHitRate,
          refreshRate: Math.min(...config.layout.widgets.map(w => w.refreshInterval)),
          dataFreshness
        }
      }
    } catch (error) {
      console.error('Failed to get dashboard data:', error)
      throw error
    }
  }

  /**
   * Get specific widget data with role-based access control
   */
  async getWidgetData(
    widget: DashboardConfig['layout']['widgets'][0],
    config: DashboardConfig
  ): Promise<any> {
    try {
      // Check permissions
      if (!this.hasPermissionForWidget(widget.type, config.permissions)) {
        return { error: 'Insufficient permissions', type: 'permission_denied' }
      }

      const timeRange = config.filters?.timeRange || '24h'

      switch (widget.type) {
        case 'system_overview':
          return await this.getSystemOverviewData(timeRange)

        case 'performance_metrics':
          return await this.getPerformanceMetricsData(timeRange, widget.config)

        case 'user_analytics':
          return await this.getUserAnalyticsData(timeRange, config.filters)

        case 'revenue_analytics':
          return await this.getRevenueAnalyticsData(timeRange, config.permissions)

        case 'ai_efficiency':
          return await this.getAIEfficiencyData(timeRange)

        case 'alert_center':
          return await this.getAlertCenterData(config.filters?.alertSeverity)

        case 'component_health':
          return await this.getComponentHealthData(config.filters?.components)

        case 'trends_chart':
          return await this.getTrendsChartData(timeRange, widget.config)

        case 'user_segmentation':
          return await this.getUserSegmentationData()

        case 'optimization_recommendations':
          return await this.getOptimizationRecommendationsData()

        default:
          return { error: 'Unknown widget type', type: 'unknown_widget' }
      }
    } catch (error) {
      console.error(`Failed to get widget data for ${widget.type}:`, error)
      return { error: error.message, type: 'data_error' }
    }
  }

  /**
   * Subscribe to real-time dashboard updates
   */
  subscribeToDashboard(
    dashboardId: string,
    callback: (event: UpdateEvent) => void
  ): () => void {
    if (!this.subscribers.has(dashboardId)) {
      this.subscribers.set(dashboardId, new Set())
    }

    this.subscribers.get(dashboardId)!.add(callback)

    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(dashboardId)
      if (subscribers) {
        subscribers.delete(callback)
        if (subscribers.size === 0) {
          this.subscribers.delete(dashboardId)
        }
      }
    }
  }

  /**
   * Setup automatic refresh for dashboard widgets
   */
  setupAutoRefresh(config: DashboardConfig): () => void {
    const timers: NodeJS.Timeout[] = []

    config.layout.widgets.forEach(widget => {
      if (config.layout.autoRefresh) {
        const timer = setInterval(async () => {
          try {
            const widgetData = await this.getWidgetData(widget, config)

            // Notify subscribers
            this.notifySubscribers(config.dashboardId, {
              dashboardId: config.dashboardId,
              widgetId: widget.id,
              timestamp: Date.now(),
              data: widgetData,
              type: 'metric_update'
            })
          } catch (error) {
            console.error(`Failed to refresh widget ${widget.id}:`, error)
          }
        }, widget.refreshInterval)

        timers.push(timer)
        this.refreshTimers.set(`${config.dashboardId}_${widget.id}`, timer)
      }
    })

    // Return cleanup function
    return () => {
      timers.forEach(timer => clearInterval(timer))
      config.layout.widgets.forEach(widget => {
        const timerKey = `${config.dashboardId}_${widget.id}`
        this.refreshTimers.delete(timerKey)
      })
    }
  }

  /**
   * Generate optimized chart data for visualization
   */
  async generateChartData(
    type: 'line' | 'bar' | 'pie' | 'area' | 'scatter',
    config: {
      metric: string
      timeRange: string
      groupBy?: string
      aggregation?: 'sum' | 'avg' | 'max' | 'min' | 'count'
      resolution?: 'minute' | 'hour' | 'day'
      filters?: Record<string, any>
    }
  ): Promise<{
    data: any[]
    metadata: {
      totalPoints: number
      timeRange: { start: number; end: number }
      aggregation: string
      resolution: string
    }
  }> {
    try {
      const supabase = createClient()
      const timeframeMs = this.getTimeframeMs(config.timeRange)
      const startTime = Date.now() - timeframeMs
      const endTime = Date.now()

      // Determine optimal resolution based on time range
      const resolution = config.resolution || this.getOptimalResolution(config.timeRange)
      const intervalMs = this.getIntervalMs(resolution)

      // Query data based on metric type
      let queryBuilder = supabase
        .from('production_metrics')
        .select('*')
        .gte('created_at', new Date(startTime).toISOString())
        .lte('created_at', new Date(endTime).toISOString())

      // Apply filters
      if (config.filters) {
        Object.entries(config.filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryBuilder = queryBuilder.eq(key, value)
          }
        })
      }

      const { data: rawData } = await queryBuilder.order('created_at', { ascending: true })

      if (!rawData || rawData.length === 0) {
        return {
          data: [],
          metadata: {
            totalPoints: 0,
            timeRange: { start: startTime, end: endTime },
            aggregation: config.aggregation || 'avg',
            resolution
          }
        }
      }

      // Aggregate data by time intervals
      const aggregatedData = this.aggregateByTimeInterval(
        rawData,
        intervalMs,
        config.metric,
        config.aggregation || 'avg'
      )

      // Format for chart library
      const chartData = this.formatChartData(aggregatedData, type, config)

      return {
        data: chartData,
        metadata: {
          totalPoints: chartData.length,
          timeRange: { start: startTime, end: endTime },
          aggregation: config.aggregation || 'avg',
          resolution
        }
      }
    } catch (error) {
      console.error('Failed to generate chart data:', error)
      throw error
    }
  }

  // Private helper methods
  private async warmCache(): Promise<void> {
    console.log('🔥 Warming dashboard cache...')

    // Warm common queries
    const commonQueries = [
      { type: 'system_overview', timeRange: '24h' },
      { type: 'performance_metrics', timeRange: '1h' },
      { type: 'alert_center', timeRange: '24h' }
    ]

    await Promise.all(commonQueries.map(async (query) => {
      try {
        const cacheKey = this.generateCacheKey(query.type, {}, { timeRange: query.timeRange })
        const data = await this.fetchWidgetDataFromSource(query.type, { timeRange: query.timeRange })
        this.setCachedData(cacheKey, data, 30000) // 30s TTL
      } catch (error) {
        console.warn(`Failed to warm cache for ${query.type}:`, error)
      }
    }))
  }

  private setupRealTimeStreaming(): void {
    console.log('🔄 Setting up real-time data streaming...')

    // Setup production monitor alerts
    productionMonitor.subscribeToAlerts((alert) => {
      this.notifyAllSubscribers({
        dashboardId: '*', // Broadcast to all dashboards
        widgetId: 'alert_center',
        timestamp: Date.now(),
        data: alert,
        type: 'alert_new'
      })
    })

    // Setup periodic system status updates
    setInterval(async () => {
      try {
        const systemStatus = await this.getSystemOverviewData('1h')
        this.notifyAllSubscribers({
          dashboardId: '*',
          widgetId: 'system_overview',
          timestamp: Date.now(),
          data: systemStatus,
          type: 'system_status'
        })
      } catch (error) {
        console.warn('Failed to broadcast system status:', error)
      }
    }, 30000) // Every 30 seconds
  }

  private setupCacheCleanup(): void {
    console.log('🧹 Setting up cache cleanup...')

    setInterval(() => {
      const now = Date.now()
      const keysToDelete: string[] = []

      this.cache.forEach((value, key) => {
        if (now > value.timestamp + value.ttl) {
          keysToDelete.push(key)
        }
      })

      keysToDelete.forEach(key => this.cache.delete(key))

      if (keysToDelete.length > 0) {
        console.log(`🧹 Cleaned up ${keysToDelete.length} expired cache entries`)
      }
    }, 60000) // Every minute
  }

  private generateCacheKey(
    widgetType: string,
    config?: Record<string, any>,
    filters?: Record<string, any>
  ): string {
    const configStr = config ? JSON.stringify(config) : ''
    const filtersStr = filters ? JSON.stringify(filters) : ''
    const hash = this.simpleHash(configStr + filtersStr)
    return `${widgetType}_${hash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private getCachedData(key: string): { data: any; timestamp: number } | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() <= cached.timestamp + cached.ttl) {
      return { data: cached.data, timestamp: cached.timestamp }
    }
    if (cached) {
      this.cache.delete(key) // Remove expired entry
    }
    return null
  }

  private setCachedData(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })

    // Prevent memory leaks by limiting cache size
    if (this.cache.size > 1000) {
      const oldestKey = Array.from(this.cache.keys())[0]
      this.cache.delete(oldestKey)
    }
  }

  private hasPermissionForWidget(widgetType: string, permissions: DashboardConfig['permissions']): boolean {
    const permissionMap = {
      system_overview: permissions.canViewSystem,
      performance_metrics: permissions.canViewSystem,
      user_analytics: permissions.canViewUsers,
      revenue_analytics: permissions.canViewRevenue,
      ai_efficiency: permissions.canViewSystem,
      alert_center: permissions.canViewAlerts,
      component_health: permissions.canViewSystem,
      trends_chart: permissions.canViewSystem,
      user_segmentation: permissions.canViewUsers,
      optimization_recommendations: permissions.canViewSystem
    }

    return permissionMap[widgetType as keyof typeof permissionMap] || false
  }

  private async fetchWidgetDataFromSource(widgetType: string, filters: Record<string, any>): Promise<any> {
    // This would contain the actual data fetching logic for each widget type
    // For now, return mock data structure
    return { type: widgetType, data: {}, timestamp: Date.now() }
  }

  private async getSystemOverviewData(timeRange: string): Promise<any> {
    const dashboardData = await productionMonitor.getDashboardData(timeRange as any)
    return {
      overview: dashboardData.overview,
      systemHealth: 94.5,
      totalRequests: dashboardData.overview.totalRequests,
      averageLatency: dashboardData.overview.averageLatency,
      errorRate: dashboardData.overview.errorRate,
      uptime: dashboardData.overview.uptime,
      activeUsers: dashboardData.overview.activeUsers,
      timestamp: Date.now()
    }
  }

  private async getPerformanceMetricsData(timeRange: string, config?: Record<string, any>): Promise<any> {
    const modelPerformance = await analyticsEngine.analyzeModelPerformance()
    return {
      security: modelPerformance.securityFramework,
      parallel: modelPerformance.parallelProcessing,
      voice: modelPerformance.voiceLearning,
      rag: modelPerformance.ragEngine,
      overall: modelPerformance.overallEfficiency,
      timestamp: Date.now()
    }
  }

  private async getUserAnalyticsData(timeRange: string, filters?: Record<string, any>): Promise<any> {
    const segmentation = await analyticsEngine.analyzeUserSegmentation()
    return {
      totalUsers: segmentation.totalUsers,
      segments: segmentation.segments,
      insights: segmentation.insights,
      trends: segmentation.trends,
      timestamp: Date.now()
    }
  }

  private async getRevenueAnalyticsData(timeRange: string, permissions: DashboardConfig['permissions']): Promise<any> {
    if (!permissions.canViewRevenue) {
      return { error: 'Insufficient permissions to view revenue data' }
    }

    const revenue = await analyticsEngine.analyzeRevenue()
    return {
      current: revenue.currentRevenue,
      bySegment: revenue.revenueBySegment,
      upgrades: revenue.upgradePotential,
      churn: revenue.churnRisk,
      optimizations: revenue.optimizationOpportunities,
      predictions: revenue.predictions,
      timestamp: Date.now()
    }
  }

  private async getAIEfficiencyData(timeRange: string): Promise<any> {
    const systemAnalytics = await analyticsEngine.generateSystemAnalytics()
    return {
      efficiency: systemAnalytics.aiEfficiencyMetrics,
      optimization: await productionMonitor.getOptimizationRecommendations(),
      timestamp: Date.now()
    }
  }

  private async getAlertCenterData(severityFilter?: string[]): Promise<any> {
    const dashboardData = await productionMonitor.getDashboardData('24h')
    let alerts = dashboardData.activeAlerts

    if (severityFilter && severityFilter.length > 0) {
      alerts = alerts.filter(alert => severityFilter.includes(alert.severity))
    }

    return {
      active: alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
      },
      timestamp: Date.now()
    }
  }

  private async getComponentHealthData(componentFilter?: string[]): Promise<any> {
    const dashboardData = await productionMonitor.getDashboardData('24h')
    let components = dashboardData.componentHealth

    if (componentFilter && componentFilter.length > 0) {
      components = components.filter(comp => componentFilter.includes(comp.component))
    }

    return {
      components,
      summary: {
        healthy: components.filter(c => c.status === 'healthy').length,
        degraded: components.filter(c => c.status === 'degraded').length,
        critical: components.filter(c => c.status === 'critical').length,
        offline: components.filter(c => c.status === 'offline').length
      },
      timestamp: Date.now()
    }
  }

  private async getTrendsChartData(timeRange: string, config?: Record<string, any>): Promise<any> {
    const dashboardData = await productionMonitor.getDashboardData(timeRange as any)
    return {
      trends: dashboardData.performanceTrends,
      configuration: config,
      timestamp: Date.now()
    }
  }

  private async getUserSegmentationData(): Promise<any> {
    const segmentation = await analyticsEngine.analyzeUserSegmentation()
    return {
      segments: segmentation.segments,
      insights: segmentation.insights,
      strategies: segmentation.strategies,
      trends: segmentation.trends,
      timestamp: Date.now()
    }
  }

  private async getOptimizationRecommendationsData(): Promise<any> {
    const recommendations = await productionMonitor.getOptimizationRecommendations()
    return {
      immediate: recommendations.immediate,
      planned: recommendations.planned,
      experimental: recommendations.experimental,
      projectedImpact: recommendations.projectedImpact,
      timestamp: Date.now()
    }
  }

  private notifySubscribers(dashboardId: string, event: UpdateEvent): void {
    const subscribers = this.subscribers.get(dashboardId)
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error('Error notifying subscriber:', error)
        }
      })
    }
  }

  private notifyAllSubscribers(event: UpdateEvent): void {
    this.subscribers.forEach((subscribers, dashboardId) => {
      const targetEvent = { ...event, dashboardId }
      subscribers.forEach(callback => {
        try {
          callback(targetEvent)
        } catch (error) {
          console.error('Error broadcasting to subscriber:', error)
        }
      })
    })
  }

  private getTimeframeMs(timeRange: string): number {
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    }
    return timeframes[timeRange as keyof typeof timeframes] || timeframes['24h']
  }

  private getOptimalResolution(timeRange: string): 'minute' | 'hour' | 'day' {
    const resolutionMap = {
      '1h': 'minute',
      '6h': 'minute',
      '24h': 'hour',
      '7d': 'hour',
      '30d': 'day'
    }
    return resolutionMap[timeRange as keyof typeof resolutionMap] as any || 'hour'
  }

  private getIntervalMs(resolution: 'minute' | 'hour' | 'day'): number {
    const intervals = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000
    }
    return intervals[resolution]
  }

  private aggregateByTimeInterval(
    data: any[],
    intervalMs: number,
    metric: string,
    aggregation: string
  ): any[] {
    const buckets = new Map<number, any[]>()

    // Group data into time buckets
    data.forEach(item => {
      const timestamp = new Date(item.created_at).getTime()
      const bucket = Math.floor(timestamp / intervalMs) * intervalMs

      if (!buckets.has(bucket)) {
        buckets.set(bucket, [])
      }
      buckets.get(bucket)!.push(item)
    })

    // Aggregate each bucket
    return Array.from(buckets.entries()).map(([timestamp, items]) => {
      const values = items.map(item => this.extractMetricValue(item, metric)).filter(v => v !== null)

      let aggregatedValue = 0
      switch (aggregation) {
        case 'sum':
          aggregatedValue = values.reduce((sum, val) => sum + val, 0)
          break
        case 'avg':
          aggregatedValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
          break
        case 'max':
          aggregatedValue = values.length > 0 ? Math.max(...values) : 0
          break
        case 'min':
          aggregatedValue = values.length > 0 ? Math.min(...values) : 0
          break
        case 'count':
          aggregatedValue = values.length
          break
        default:
          aggregatedValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
      }

      return {
        timestamp,
        value: aggregatedValue,
        count: items.length
      }
    }).sort((a, b) => a.timestamp - b.timestamp)
  }

  private extractMetricValue(item: any, metric: string): number | null {
    // Extract metric value from data item based on metric path
    const metricPaths = {
      latency: 'latency',
      throughput: 'throughput',
      errorRate: 'error_rate',
      cpuUsage: 'cpu_usage',
      memoryUsage: 'memory_usage',
      bandwidthUsage: 'bandwidth_usage'
    }

    const path = metricPaths[metric as keyof typeof metricPaths] || metric
    return item[path] || null
  }

  private formatChartData(aggregatedData: any[], type: string, config: any): any[] {
    switch (type) {
      case 'line':
      case 'area':
        return aggregatedData.map(item => ({
          x: item.timestamp,
          y: item.value,
          label: new Date(item.timestamp).toLocaleString()
        }))

      case 'bar':
        return aggregatedData.map(item => ({
          category: new Date(item.timestamp).toLocaleString(),
          value: item.value,
          count: item.count
        }))

      case 'pie':
        // For pie charts, aggregate all values
        const total = aggregatedData.reduce((sum, item) => sum + item.value, 0)
        return aggregatedData.map((item, index) => ({
          label: `Segment ${index + 1}`,
          value: item.value,
          percentage: (item.value / total) * 100
        }))

      case 'scatter':
        return aggregatedData.map(item => ({
          x: item.timestamp,
          y: item.value,
          size: item.count
        }))

      default:
        return aggregatedData
    }
  }
}

// Export singleton instance
export const dashboardDataProvider = new DashboardDataProvider()

export default DashboardDataProvider