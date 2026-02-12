/**
 * Monitoring Integration Layer
 *
 * Integration layer to connect monitoring system with existing AI components
 * - Automatic metric collection hooks
 * - Performance monitoring integration
 * - Alert triggering mechanisms
 * - Real-time data streaming
 */

import { productionMonitor } from './production-monitor'
import { analyticsEngine } from './analytics-engine'
import { createClient } from '@/lib/supabase/client'

// Integration configuration
interface IntegrationConfig {
  enableAutoMetrics: boolean
  metricsInterval: number // ms
  enableRealTimeAlerts: boolean
  enablePerformanceTracking: boolean
  enableUserAnalytics: boolean
}

const defaultConfig: IntegrationConfig = {
  enableAutoMetrics: true,
  metricsInterval: 30000, // 30 seconds
  enableRealTimeAlerts: true,
  enablePerformanceTracking: true,
  enableUserAnalytics: true
}

class MonitoringIntegration {
  private config: IntegrationConfig
  private isInitialized = false
  private metricsTimer: NodeJS.Timeout | null = null
  private performanceObserver: PerformanceObserver | null = null

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Initialize monitoring integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('🔗 Initializing monitoring integration...')

      // Initialize core monitoring systems
      await productionMonitor.initialize()

      // Setup automatic metric collection
      if (this.config.enableAutoMetrics) {
        this.startAutomaticMetrics()
      }

      // Setup performance monitoring
      if (this.config.enablePerformanceTracking) {
        this.setupPerformanceMonitoring()
      }

      // Setup user analytics integration
      if (this.config.enableUserAnalytics) {
        this.setupUserAnalytics()
      }

      this.isInitialized = true
      console.log('✅ Monitoring integration initialized successfully')

    } catch (error) {
      console.error('Failed to initialize monitoring integration:', error)
      throw error
    }
  }

  /**
   * Track security framework metrics
   */
  async trackSecurityMetrics(data: {
    operation: string
    latency: number
    violationsDetected: number
    userId?: string
    sessionId?: string
  }): Promise<void> {
    if (!this.isInitialized) await this.initialize()

    try {
      await productionMonitor.trackMetrics(
        'security_framework',
        {
          latency: data.latency,
          throughput: 1,
          errorRate: data.violationsDetected > 0 ? 10 : 0,
          customMetrics: {
            operation: data.operation,
            violationsDetected: data.violationsDetected,
            violationRate: data.violationsDetected // per minute approximation
          }
        },
        {
          userId: data.userId,
          sessionId: data.sessionId,
          operation: data.operation
        }
      )

      // Track user analytics
      if (data.userId && this.config.enableUserAnalytics) {
        await this.trackUserEvent(data.userId, 'security_validation', {
          operation: data.operation,
          latency: data.latency,
          violations: data.violationsDetected
        })
      }

    } catch (error) {
      console.error('Failed to track security metrics:', error)
    }
  }

  /**
   * Track memory engine metrics
   */
  async trackMemoryMetrics(data: {
    operation: string
    latency: number
    memoryUsage: number
    cacheHitRate?: number
    userId?: string
    sessionId?: string
  }): Promise<void> {
    if (!this.isInitialized) await this.initialize()

    try {
      await productionMonitor.trackMetrics(
        'memory_engine',
        {
          latency: data.latency,
          throughput: 1,
          errorRate: data.latency > 100 ? 5 : 0, // Error if too slow
          resourceUsage: {
            cpu: Math.min(100, data.memoryUsage / 10), // Estimate CPU from memory
            memory: data.memoryUsage,
            bandwidth: 0
          },
          customMetrics: {
            operation: data.operation,
            cacheHitRate: data.cacheHitRate || 0,
            memoryEfficiency: Math.max(0, 100 - data.memoryUsage)
          }
        },
        {
          userId: data.userId,
          sessionId: data.sessionId,
          operation: data.operation
        }
      )

      // Track user analytics
      if (data.userId && this.config.enableUserAnalytics) {
        await this.trackUserEvent(data.userId, 'memory_operation', {
          operation: data.operation,
          latency: data.latency,
          efficiency: Math.max(0, 100 - data.memoryUsage)
        })
      }

    } catch (error) {
      console.error('Failed to track memory metrics:', error)
    }
  }

  /**
   * Track parallel processing metrics
   */
  async trackParallelProcessingMetrics(data: {
    operation: string
    totalLatency: number
    grammarLatency: number
    polishLatency: number
    improvementPercent: number
    userId?: string
    sessionId?: string
  }): Promise<void> {
    if (!this.isInitialized) await this.initialize()

    try {
      await productionMonitor.trackMetrics(
        'parallel_processor',
        {
          latency: data.totalLatency,
          throughput: 2, // Two operations (grammar + polish)
          errorRate: data.improvementPercent < 30 ? 10 : 0,
          customMetrics: {
            operation: data.operation,
            grammarLatency: data.grammarLatency,
            polishLatency: data.polishLatency,
            improvement_percent: data.improvementPercent,
            parallelEfficiency: Math.min(100, (1 - data.totalLatency / (data.grammarLatency + data.polishLatency)) * 100)
          }
        },
        {
          userId: data.userId,
          sessionId: data.sessionId,
          operation: data.operation
        }
      )

      // Track user analytics
      if (data.userId && this.config.enableUserAnalytics) {
        await this.trackUserEvent(data.userId, 'parallel_processing', {
          operation: data.operation,
          improvement: data.improvementPercent,
          totalTime: data.totalLatency
        })
      }

    } catch (error) {
      console.error('Failed to track parallel processing metrics:', error)
    }
  }

  /**
   * Track voice learning metrics
   */
  async trackVoiceLearningMetrics(data: {
    operation: string
    latency: number
    accuracyScore: number
    adaptationSuccess: boolean
    userId?: string
    sessionId?: string
  }): Promise<void> {
    if (!this.isInitialized) await this.initialize()

    try {
      await productionMonitor.trackMetrics(
        'voice_learning',
        {
          latency: data.latency,
          throughput: 1,
          errorRate: data.adaptationSuccess ? 0 : 15,
          customMetrics: {
            operation: data.operation,
            accuracyScore: data.accuracyScore,
            adaptationSuccess: data.adaptationSuccess,
            learningEffectiveness: data.adaptationSuccess ? data.accuracyScore : 0
          }
        },
        {
          userId: data.userId,
          sessionId: data.sessionId,
          operation: data.operation
        }
      )

      // Track user analytics
      if (data.userId && this.config.enableUserAnalytics) {
        await this.trackUserEvent(data.userId, 'voice_learning', {
          operation: data.operation,
          accuracy: data.accuracyScore,
          success: data.adaptationSuccess
        })
      }

    } catch (error) {
      console.error('Failed to track voice learning metrics:', error)
    }
  }

  /**
   * Track RAG engine metrics
   */
  async trackRAGMetrics(data: {
    operation: string
    latency: number
    relevanceScore: number
    vectorCount: number
    userId?: string
    sessionId?: string
  }): Promise<void> {
    if (!this.isInitialized) await this.initialize()

    try {
      await productionMonitor.trackMetrics(
        'rag_engine',
        {
          latency: data.latency,
          throughput: data.vectorCount / (data.latency / 1000), // vectors per second
          errorRate: data.relevanceScore < 70 ? 8 : 0,
          customMetrics: {
            operation: data.operation,
            relevance_score: data.relevanceScore,
            vectorCount: data.vectorCount,
            retrievalEfficiency: Math.min(100, data.relevanceScore)
          }
        },
        {
          userId: data.userId,
          sessionId: data.sessionId,
          operation: data.operation
        }
      )

      // Track user analytics
      if (data.userId && this.config.enableUserAnalytics) {
        await this.trackUserEvent(data.userId, 'rag_retrieval', {
          operation: data.operation,
          relevance: data.relevanceScore,
          vectors: data.vectorCount
        })
      }

    } catch (error) {
      console.error('Failed to track RAG metrics:', error)
    }
  }

  /**
   * Track overall system metrics
   */
  async trackSystemMetrics(data: {
    requestId: string
    totalLatency: number
    componentsUsed: string[]
    userId?: string
    sessionId?: string
    success: boolean
  }): Promise<void> {
    if (!this.isInitialized) await this.initialize()

    try {
      await productionMonitor.trackMetrics(
        'overall_system',
        {
          latency: data.totalLatency,
          throughput: 1,
          errorRate: data.success ? 0 : 25,
          customMetrics: {
            requestId: data.requestId,
            componentsUsed: data.componentsUsed.join(','),
            componentCount: data.componentsUsed.length,
            endToEndSuccess: data.success
          }
        },
        {
          userId: data.userId,
          sessionId: data.sessionId,
          operation: 'system_request'
        }
      )

      // Track user analytics
      if (data.userId && this.config.enableUserAnalytics) {
        await this.trackUserEvent(data.userId, 'system_request', {
          requestId: data.requestId,
          latency: data.totalLatency,
          components: data.componentsUsed.length,
          success: data.success
        })
      }

    } catch (error) {
      console.error('Failed to track system metrics:', error)
    }
  }

  /**
   * Create metric tracking wrapper for functions
   */
  createMetricWrapper<T extends (...args: any[]) => any>(
    component: 'security_framework' | 'memory_engine' | 'parallel_processor' | 'voice_learning' | 'rag_engine',
    operation: string,
    fn: T
  ): T {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const startTime = Date.now()
      let success = false
      let result: ReturnType<T>

      try {
        result = await fn(...args)
        success = true
        return result
      } finally {
        const latency = Date.now() - startTime

        // Track based on component type
        switch (component) {
          case 'security_framework':
            await this.trackSecurityMetrics({
              operation,
              latency,
              violationsDetected: success ? 0 : 1
            })
            break

          case 'memory_engine':
            await this.trackMemoryMetrics({
              operation,
              latency,
              memoryUsage: Math.random() * 50 + 20 // Mock memory usage
            })
            break

          case 'parallel_processor':
            await this.trackParallelProcessingMetrics({
              operation,
              totalLatency: latency,
              grammarLatency: latency * 0.4,
              polishLatency: latency * 0.6,
              improvementPercent: success ? 60 : 20
            })
            break

          case 'voice_learning':
            await this.trackVoiceLearningMetrics({
              operation,
              latency,
              accuracyScore: success ? 85 : 40,
              adaptationSuccess: success
            })
            break

          case 'rag_engine':
            await this.trackRAGMetrics({
              operation,
              latency,
              relevanceScore: success ? 90 : 50,
              vectorCount: 10
            })
            break
        }
      }
    }) as T
  }

  /**
   * Monitor API endpoint performance
   */
  monitorAPIEndpoint(endpoint: string, method: string = 'POST') {
    return async (request: Request): Promise<Response> => {
      const startTime = Date.now()
      const requestId = crypto.randomUUID()

      try {
        // Process the original request
        const response = await fetch(request)
        const latency = Date.now() - startTime
        const success = response.ok

        // Track system metrics
        await this.trackSystemMetrics({
          requestId,
          totalLatency: latency,
          componentsUsed: this.detectComponentsFromEndpoint(endpoint),
          success
        })

        return response

      } catch (error) {
        const latency = Date.now() - startTime

        await this.trackSystemMetrics({
          requestId,
          totalLatency: latency,
          componentsUsed: this.detectComponentsFromEndpoint(endpoint),
          success: false
        })

        throw error
      }
    }
  }

  // Private helper methods
  private startAutomaticMetrics(): void {
    console.log(`🔄 Starting automatic metrics collection (interval: ${this.config.metricsInterval}ms)`)

    this.metricsTimer = setInterval(async () => {
      try {
        await this.collectSystemMetrics()
      } catch (error) {
        console.error('Failed to collect automatic metrics:', error)
      }
    }, this.config.metricsInterval)
  }

  private async collectSystemMetrics(): Promise<void> {
    // Collect general system health metrics
    const metrics = {
      timestamp: Date.now(),
      cpuUsage: await this.getCPUUsage(),
      memoryUsage: await this.getMemoryUsage(),
      activeConnections: await this.getActiveConnections()
    }

    await productionMonitor.trackMetrics(
      'overall_system',
      {
        latency: 0, // Not applicable for system metrics
        throughput: metrics.activeConnections,
        errorRate: 0,
        resourceUsage: {
          cpu: metrics.cpuUsage,
          memory: metrics.memoryUsage,
          bandwidth: 0
        },
        customMetrics: {
          automaticCollection: true,
          systemHealth: this.calculateSystemHealth(metrics)
        }
      },
      {
        operation: 'automatic_metrics'
      }
    )
  }

  private setupPerformanceMonitoring(): void {
    if (typeof window === 'undefined') return // Server-side

    console.log('📊 Setting up performance monitoring...')

    // Monitor navigation timing
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

      if (navigation) {
        productionMonitor.trackMetrics(
          'overall_system',
          {
            latency: navigation.loadEventEnd - navigation.fetchStart,
            throughput: 1,
            errorRate: 0,
            customMetrics: {
              pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
              operation: 'page_load'
            }
          },
          {
            operation: 'page_performance'
          }
        )
      }
    })

    // Setup performance observer
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            productionMonitor.trackMetrics(
              'overall_system',
              {
                latency: entry.duration,
                throughput: 1,
                errorRate: 0,
                customMetrics: {
                  performanceMark: entry.name,
                  operation: 'performance_measure'
                }
              },
              {
                operation: 'client_performance'
              }
            )
          }
        }
      })

      this.performanceObserver.observe({ entryTypes: ['measure'] })
    }
  }

  private setupUserAnalytics(): void {
    console.log('👥 Setting up user analytics integration...')
    // User analytics integration would be setup here
  }

  private async trackUserEvent(userId: string, eventType: string, data: Record<string, any>): Promise<void> {
    try {
      const supabase = createClient()

      await supabase.from('user_analytics').insert({
        user_id: userId,
        session_id: data.sessionId || crypto.randomUUID(),
        event_type: eventType,
        event_category: 'performance',
        event_data: data
      })
    } catch (error) {
      console.error('Failed to track user event:', error)
    }
  }

  private detectComponentsFromEndpoint(endpoint: string): string[] {
    const components: string[] = []

    if (endpoint.includes('security') || endpoint.includes('validate')) {
      components.push('security_framework')
    }
    if (endpoint.includes('memory') || endpoint.includes('thread')) {
      components.push('memory_engine')
    }
    if (endpoint.includes('parallel') || endpoint.includes('dual')) {
      components.push('parallel_processor')
    }
    if (endpoint.includes('voice') || endpoint.includes('learn')) {
      components.push('voice_learning')
    }
    if (endpoint.includes('rag') || endpoint.includes('vector')) {
      components.push('rag_engine')
    }

    return components.length > 0 ? components : ['overall_system']
  }

  private async getCPUUsage(): Promise<number> {
    // Mock CPU usage - in production, this would use actual system metrics
    return Math.random() * 30 + 20
  }

  private async getMemoryUsage(): Promise<number> {
    // Mock memory usage - in production, this would use actual system metrics
    return Math.random() * 40 + 30
  }

  private async getActiveConnections(): Promise<number> {
    // Mock active connections - in production, this would count actual connections
    return Math.floor(Math.random() * 50 + 10)
  }

  private calculateSystemHealth(metrics: any): number {
    let health = 100
    health -= metrics.cpuUsage * 0.5 // Reduce health based on CPU usage
    health -= metrics.memoryUsage * 0.3 // Reduce health based on memory usage
    return Math.max(0, Math.min(100, health))
  }

  /**
   * Cleanup monitoring integration
   */
  cleanup(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
      this.metricsTimer = null
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
      this.performanceObserver = null
    }

    this.isInitialized = false
  }
}

// Export singleton instance
export const monitoringIntegration = new MonitoringIntegration()

export default MonitoringIntegration