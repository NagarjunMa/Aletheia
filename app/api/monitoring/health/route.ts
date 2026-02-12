/**
 * Monitoring Health Check API
 *
 * System health monitoring and status endpoints
 * - Overall system health status
 * - Component health checks
 * - Performance health metrics
 * - Automated health snapshots
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { productionMonitor } from '@/lib/monitoring/production-monitor'

/**
 * GET /api/monitoring/health
 * Get system health status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const component = searchParams.get('component')
    const detailed = searchParams.get('detailed') === 'true'

    console.log('🏥 Health check requested:', { component, detailed })

    if (component) {
      return getComponentHealth(supabase, component, detailed)
    }

    return getOverallHealth(supabase, detailed)

  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      success: false,
      status: 'error',
      message: 'Health check failed',
      timestamp: Date.now()
    }, { status: 500 })
  }
}

/**
 * POST /api/monitoring/health/snapshot
 * Create system health snapshot (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    if (profile?.preferences?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    console.log('📸 Creating system health snapshot...')

    // Calculate comprehensive health metrics
    const healthSnapshot = await calculateSystemHealthSnapshot(supabase)

    // Store the snapshot
    const { data: snapshot, error } = await supabase
      .from('system_health_snapshots')
      .insert(healthSnapshot)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      snapshot,
      message: 'System health snapshot created successfully',
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to create health snapshot:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create health snapshot'
    }, { status: 500 })
  }
}

// Helper functions
async function getOverallHealth(supabase: any, detailed: boolean) {
  try {
    // Get recent system metrics
    const since = new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes

    const [
      metricsResult,
      alertsResult,
      snapshotResult
    ] = await Promise.all([
      // Recent production metrics
      supabase
        .from('production_metrics')
        .select('component, latency, error_rate, system_status, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false }),

      // Active alerts
      supabase
        .from('production_alerts')
        .select('severity, component')
        .eq('status', 'active'),

      // Latest health snapshot
      supabase
        .from('system_health_snapshots')
        .select('*')
        .order('snapshot_time', { ascending: false })
        .limit(1)
        .single()
    ])

    const recentMetrics = metricsResult.data || []
    const activeAlerts = alertsResult.data || []
    const lastSnapshot = snapshotResult.data

    // Calculate current health score
    const healthScore = calculateCurrentHealthScore(recentMetrics, activeAlerts)

    // Component health breakdown
    const componentHealth = calculateComponentHealth(recentMetrics, activeAlerts)

    // System status
    const systemStatus = determineSystemStatus(healthScore, activeAlerts)

    const response: any = {
      success: true,
      status: systemStatus,
      healthScore: Math.round(healthScore * 100) / 100,
      components: componentHealth,
      alerts: {
        total: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        high: activeAlerts.filter(a => a.severity === 'high').length,
        medium: activeAlerts.filter(a => a.severity === 'medium').length,
        low: activeAlerts.filter(a => a.severity === 'low').length
      },
      metrics: {
        averageLatency: recentMetrics.length > 0
          ? recentMetrics.reduce((sum, m) => sum + (m.latency || 0), 0) / recentMetrics.length
          : 0,
        averageErrorRate: recentMetrics.length > 0
          ? recentMetrics.reduce((sum, m) => sum + (m.error_rate || 0), 0) / recentMetrics.length
          : 0,
        dataPoints: recentMetrics.length
      },
      timestamp: Date.now()
    }

    // Add detailed information if requested
    if (detailed) {
      response.detailed = {
        lastSnapshot: lastSnapshot ? {
          time: lastSnapshot.snapshot_time,
          overallScore: lastSnapshot.overall_health_score,
          componentScores: {
            security: lastSnapshot.security_health_score,
            memory: lastSnapshot.memory_health_score,
            parallel: lastSnapshot.parallel_health_score,
            voice: lastSnapshot.voice_health_score,
            rag: lastSnapshot.rag_health_score
          },
          systemMetrics: {
            activeUsers: lastSnapshot.total_active_users,
            requestsPerMinute: lastSnapshot.requests_per_minute,
            avgResponseTime: lastSnapshot.average_response_time_ms,
            cpuUtilization: lastSnapshot.cpu_utilization_percent,
            memoryUtilization: lastSnapshot.memory_utilization_percent
          }
        } : null,
        recentActivity: recentMetrics.slice(0, 10),
        uptime: await calculateUptime(supabase),
        performance: await calculatePerformanceMetrics(supabase)
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Failed to get overall health:', error)
    return NextResponse.json({
      success: false,
      status: 'error',
      message: 'Failed to retrieve system health'
    }, { status: 500 })
  }
}

async function getComponentHealth(supabase: any, component: string, detailed: boolean) {
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes

    const [metricsResult, alertsResult] = await Promise.all([
      // Component-specific metrics
      supabase
        .from('production_metrics')
        .select('*')
        .eq('component', component)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false }),

      // Component alerts
      supabase
        .from('production_alerts')
        .select('*')
        .eq('component', component)
        .eq('status', 'active')
    ])

    const metrics = metricsResult.data || []
    const alerts = alertsResult.data || []

    if (metrics.length === 0) {
      return NextResponse.json({
        success: true,
        component,
        status: 'unknown',
        message: 'No recent data available',
        timestamp: Date.now()
      })
    }

    // Calculate component health
    const latencies = metrics.map(m => m.latency || 0)
    const errorRates = metrics.map(m => m.error_rate || 0)
    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length
    const avgErrorRate = errorRates.reduce((sum, val) => sum + val, 0) / errorRates.length

    // Determine component status
    let status = 'healthy'
    let healthScore = 100

    if (avgErrorRate > 10 || alerts.some(a => a.severity === 'critical')) {
      status = 'critical'
      healthScore = Math.max(0, 100 - (avgErrorRate * 5) - (alerts.length * 10))
    } else if (avgErrorRate > 5 || avgLatency > 3000 || alerts.some(a => a.severity === 'high')) {
      status = 'degraded'
      healthScore = Math.max(20, 100 - (avgErrorRate * 3) - (avgLatency / 100) - (alerts.length * 5))
    } else if (avgErrorRate > 1 || avgLatency > 1000) {
      status = 'warning'
      healthScore = Math.max(50, 100 - (avgErrorRate * 2) - (avgLatency / 200))
    }

    const response: any = {
      success: true,
      component,
      status,
      healthScore: Math.round(healthScore * 100) / 100,
      metrics: {
        averageLatency: Math.round(avgLatency * 100) / 100,
        averageErrorRate: Math.round(avgErrorRate * 100) / 100,
        dataPoints: metrics.length,
        timeRange: '10 minutes'
      },
      alerts: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length
      },
      timestamp: Date.now()
    }

    if (detailed) {
      response.detailed = {
        recentMetrics: metrics.slice(0, 5),
        trends: calculateTrends(metrics),
        resourceUsage: {
          cpu: metrics.length > 0
            ? metrics.reduce((sum, m) => sum + (m.cpu_usage || 0), 0) / metrics.length
            : 0,
          memory: metrics.length > 0
            ? metrics.reduce((sum, m) => sum + (m.memory_usage || 0), 0) / metrics.length
            : 0
        },
        activeAlerts: alerts
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error(`Failed to get ${component} health:`, error)
    return NextResponse.json({
      success: false,
      component,
      status: 'error',
      message: `Failed to retrieve ${component} health`
    }, { status: 500 })
  }
}

async function calculateSystemHealthSnapshot(supabase: any) {
  try {
    const now = new Date()
    const since = new Date(now.getTime() - 60 * 60 * 1000) // Last hour

    // Get comprehensive system metrics
    const { data: metrics } = await supabase
      .from('production_metrics')
      .select('*')
      .gte('created_at', since.toISOString())

    const { data: alerts } = await supabase
      .from('production_alerts')
      .select('*')
      .eq('status', 'active')

    const recentMetrics = metrics || []
    const activeAlerts = alerts || []

    // Calculate overall health score
    const overallHealthScore = calculateCurrentHealthScore(recentMetrics, activeAlerts)

    // Calculate component scores
    const components = ['security_framework', 'memory_engine', 'parallel_processor', 'voice_learning', 'rag_engine']
    const componentScores: Record<string, number> = {}

    components.forEach(component => {
      const componentMetrics = recentMetrics.filter(m => m.component === component)
      const componentAlerts = activeAlerts.filter(a => a.component === component)
      componentScores[component] = calculateCurrentHealthScore(componentMetrics, componentAlerts)
    })

    // Calculate system metrics
    const activeUsers = new Set(recentMetrics.map(m => m.user_id).filter(Boolean)).size
    const requestsPerMinute = recentMetrics.length / 60 // approximate
    const avgResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + (m.latency || 0), 0) / recentMetrics.length
      : 0

    // Mock resource utilization (in production, these would come from system monitoring)
    const cpuUtilization = Math.max(0, Math.min(100,
      50 + (activeAlerts.length * 10) + Math.random() * 20
    ))
    const memoryUtilization = Math.max(0, Math.min(100,
      45 + (activeAlerts.length * 8) + Math.random() * 15
    ))

    return {
      overall_health_score: overallHealthScore,
      security_health_score: componentScores.security_framework || overallHealthScore * 0.98,
      memory_health_score: componentScores.memory_engine || overallHealthScore * 1.02,
      parallel_health_score: componentScores.parallel_processor || overallHealthScore * 0.99,
      voice_health_score: componentScores.voice_learning || overallHealthScore * 1.01,
      rag_health_score: componentScores.rag_engine || overallHealthScore * 0.97,
      total_active_users: activeUsers,
      requests_per_minute: Math.round(requestsPerMinute * 100) / 100,
      average_response_time_ms: Math.round(avgResponseTime * 100) / 100,
      error_rate_percent: recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + (m.error_rate || 0), 0) / recentMetrics.length
        : 0,
      cpu_utilization_percent: Math.round(cpuUtilization * 100) / 100,
      memory_utilization_percent: Math.round(memoryUtilization * 100) / 100,
      storage_utilization_percent: Math.max(30, Math.min(80, 45 + Math.random() * 10)),
      efficiency_score: Math.max(0, overallHealthScore - (activeAlerts.length * 2)),
      snapshot_data: {
        snapshot_version: '1.0',
        metrics_count: recentMetrics.length,
        alerts_count: activeAlerts.length,
        components_monitored: components.length,
        data_quality: recentMetrics.length > 10 ? 'high' : recentMetrics.length > 5 ? 'medium' : 'low'
      }
    }

  } catch (error) {
    console.error('Failed to calculate health snapshot:', error)
    throw error
  }
}

function calculateCurrentHealthScore(metrics: any[], alerts: any[]): number {
  let healthScore = 100

  // Penalty for alerts
  alerts.forEach(alert => {
    switch (alert.severity) {
      case 'critical':
        healthScore -= 20
        break
      case 'high':
        healthScore -= 10
        break
      case 'medium':
        healthScore -= 5
        break
      case 'low':
        healthScore -= 2
        break
    }
  })

  // Penalty for poor metrics
  if (metrics.length > 0) {
    const avgErrorRate = metrics.reduce((sum, m) => sum + (m.error_rate || 0), 0) / metrics.length
    const avgLatency = metrics.reduce((sum, m) => sum + (m.latency || 0), 0) / metrics.length

    healthScore -= avgErrorRate * 2 // 2 points per % error rate
    healthScore -= Math.max(0, (avgLatency - 1000) / 100) // Penalty for latency > 1s
  }

  return Math.max(0, Math.min(100, healthScore))
}

function calculateComponentHealth(metrics: any[], alerts: any[]) {
  const components = ['security_framework', 'memory_engine', 'parallel_processor', 'voice_learning', 'rag_engine']

  return components.map(component => {
    const componentMetrics = metrics.filter(m => m.component === component)
    const componentAlerts = alerts.filter(a => a.component === component)

    const healthScore = calculateCurrentHealthScore(componentMetrics, componentAlerts)

    let status = 'healthy'
    if (healthScore < 50) status = 'critical'
    else if (healthScore < 70) status = 'degraded'
    else if (healthScore < 90) status = 'warning'

    return {
      component,
      status,
      healthScore: Math.round(healthScore * 100) / 100,
      alertCount: componentAlerts.length,
      dataPoints: componentMetrics.length
    }
  })
}

function determineSystemStatus(healthScore: number, alerts: any[]): string {
  if (alerts.some(a => a.severity === 'critical') || healthScore < 50) {
    return 'critical'
  } else if (alerts.some(a => a.severity === 'high') || healthScore < 70) {
    return 'degraded'
  } else if (alerts.length > 0 || healthScore < 90) {
    return 'warning'
  }
  return 'healthy'
}

function calculateTrends(metrics: any[]) {
  if (metrics.length < 2) {
    return { latency: 'stable', errorRate: 'stable' }
  }

  const sortedMetrics = metrics.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const firstHalf = sortedMetrics.slice(0, Math.floor(sortedMetrics.length / 2))
  const secondHalf = sortedMetrics.slice(Math.floor(sortedMetrics.length / 2))

  const firstLatency = firstHalf.reduce((sum, m) => sum + (m.latency || 0), 0) / firstHalf.length
  const secondLatency = secondHalf.reduce((sum, m) => sum + (m.latency || 0), 0) / secondHalf.length

  const firstErrorRate = firstHalf.reduce((sum, m) => sum + (m.error_rate || 0), 0) / firstHalf.length
  const secondErrorRate = secondHalf.reduce((sum, m) => sum + (m.error_rate || 0), 0) / secondHalf.length

  return {
    latency: secondLatency > firstLatency * 1.1 ? 'increasing' :
             secondLatency < firstLatency * 0.9 ? 'decreasing' : 'stable',
    errorRate: secondErrorRate > firstErrorRate * 1.1 ? 'increasing' :
               secondErrorRate < firstErrorRate * 0.9 ? 'decreasing' : 'stable'
  }
}

async function calculateUptime(supabase: any): Promise<number> {
  // Calculate uptime based on health snapshots or system availability
  // For now, return a mock value based on recent alert activity
  const { data: recentAlerts } = await supabase
    .from('production_alerts')
    .select('triggered_at')
    .gte('triggered_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .eq('severity', 'critical')

  const criticalAlerts = recentAlerts || []
  const downtimeMinutes = criticalAlerts.length * 5 // Assume 5 min downtime per critical alert
  const totalMinutes = 24 * 60 // 24 hours

  return Math.max(95, ((totalMinutes - downtimeMinutes) / totalMinutes) * 100)
}

async function calculatePerformanceMetrics(supabase: any) {
  const since = new Date(Date.now() - 60 * 60 * 1000) // Last hour

  const { data: metrics } = await supabase
    .from('production_metrics')
    .select('latency, throughput, error_rate')
    .gte('created_at', since.toISOString())

  if (!metrics || metrics.length === 0) {
    return {
      averageLatency: 0,
      p95Latency: 0,
      averageThroughput: 0,
      errorRate: 0
    }
  }

  const latencies = metrics.map(m => m.latency || 0).sort((a, b) => a - b)
  const throughputs = metrics.map(m => m.throughput || 0)
  const errorRates = metrics.map(m => m.error_rate || 0)

  return {
    averageLatency: latencies.reduce((sum, val) => sum + val, 0) / latencies.length,
    p95Latency: latencies[Math.floor(latencies.length * 0.95)] || 0,
    averageThroughput: throughputs.reduce((sum, val) => sum + val, 0) / throughputs.length,
    errorRate: errorRates.reduce((sum, val) => sum + val, 0) / errorRates.length
  }
}