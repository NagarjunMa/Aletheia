/**
 * Monitoring Metrics API
 *
 * REST API endpoints for production metrics collection and retrieval
 * - Real-time metrics ingestion
 * - Historical data queries
 * - Performance aggregation
 * - Component-specific metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { productionMonitor } from '@/lib/monitoring/production-monitor'

// Metrics ingestion schema
const MetricsSchema = z.object({
  component: z.enum([
    'security_framework',
    'memory_engine',
    'parallel_processor',
    'voice_learning',
    'rag_engine',
    'overall_system'
  ]),
  metrics: z.object({
    latency: z.number().min(0),
    throughput: z.number().min(0),
    errorRate: z.number().min(0).max(100),
    resourceUsage: z.object({
      cpu: z.number().min(0).max(100),
      memory: z.number().min(0).max(100),
      bandwidth: z.number().min(0)
    }).optional(),
    customMetrics: z.record(z.any()).optional()
  }),
  context: z.object({
    userId: z.string().uuid().optional(),
    sessionId: z.string().optional(),
    operation: z.string().optional(),
    customData: z.record(z.any()).optional()
  }).optional()
})

// Query parameters schema
const QuerySchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional(),
  component: z.string().optional(),
  userId: z.string().uuid().optional(),
  aggregation: z.enum(['avg', 'max', 'min', 'sum', 'count']).optional(),
  limit: z.coerce.number().min(1).max(1000).optional()
})

/**
 * POST /api/monitoring/metrics
 * Ingest new production metrics
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Parse request body
    const body = await request.json()
    const validatedData = MetricsSchema.parse(body)

    console.log('📊 Ingesting metrics:', validatedData.component)

    // Track metrics using production monitor
    const result = await productionMonitor.trackMetrics(
      validatedData.component,
      validatedData.metrics,
      {
        userId: validatedData.context?.userId || user?.id,
        sessionId: validatedData.context?.sessionId,
        operation: validatedData.context?.operation,
        customData: validatedData.context?.customData
      }
    )

    return NextResponse.json({
      success: true,
      tracked: result.tracked,
      alertsTriggered: result.alerts.length,
      alerts: result.alerts,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to ingest metrics:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid metrics data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to process metrics'
    }, { status: 500 })
  }
}

/**
 * GET /api/monitoring/metrics
 * Retrieve production metrics with filtering and aggregation
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    const userRole = profile?.preferences?.role
    if (!['admin', 'manager', 'analyst'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const query = QuerySchema.parse({
      timeRange: searchParams.get('timeRange'),
      component: searchParams.get('component'),
      userId: searchParams.get('userId'),
      aggregation: searchParams.get('aggregation'),
      limit: searchParams.get('limit')
    })

    console.log('📊 Querying metrics with filters:', query)

    // Build database query
    const timeframeMs = getTimeframeMs(query.timeRange || '24h')
    const since = new Date(Date.now() - timeframeMs)

    let queryBuilder = supabase
      .from('production_metrics')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })

    // Apply filters
    if (query.component) {
      queryBuilder = queryBuilder.eq('component', query.component)
    }

    if (query.userId && (userRole === 'admin' || userRole === 'manager')) {
      queryBuilder = queryBuilder.eq('user_id', query.userId)
    }

    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit)
    }

    const { data: metrics, error } = await queryBuilder

    if (error) {
      throw error
    }

    // Apply aggregation if requested
    let processedMetrics = metrics || []
    if (query.aggregation && processedMetrics.length > 0) {
      processedMetrics = aggregateMetrics(processedMetrics, query.aggregation)
    }

    // Calculate summary statistics
    const summary = calculateSummary(processedMetrics)

    return NextResponse.json({
      success: true,
      metrics: processedMetrics,
      summary,
      query: {
        timeRange: query.timeRange || '24h',
        component: query.component,
        aggregation: query.aggregation,
        totalRecords: processedMetrics.length
      },
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to query metrics:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve metrics'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/monitoring/metrics
 * Cleanup old metrics (admin only)
 */
export async function DELETE(request: NextRequest) {
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

    // Parse retention period from query
    const { searchParams } = new URL(request.url)
    const retentionDays = parseInt(searchParams.get('retentionDays') || '90')
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000))

    console.log(`🧹 Cleaning up metrics older than ${retentionDays} days`)

    // Delete old metrics
    const { error: deleteError, count } = await supabase
      .from('production_metrics')
      .delete()
      .lt('created_at', cutoffDate.toISOString())

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      deletedRecords: count || 0,
      cutoffDate: cutoffDate.toISOString(),
      retentionDays
    })

  } catch (error) {
    console.error('Failed to cleanup metrics:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup metrics'
    }, { status: 500 })
  }
}

// Helper functions
function getTimeframeMs(timeRange: string): number {
  const timeframes = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  }
  return timeframes[timeRange as keyof typeof timeframes] || timeframes['24h']
}

function aggregateMetrics(metrics: any[], aggregation: string): any[] {
  // Group by component and time bucket (1 hour intervals)
  const buckets = new Map<string, any[]>()
  const intervalMs = 60 * 60 * 1000 // 1 hour

  metrics.forEach(metric => {
    const timestamp = new Date(metric.created_at).getTime()
    const bucket = Math.floor(timestamp / intervalMs) * intervalMs
    const key = `${metric.component}_${bucket}`

    if (!buckets.has(key)) {
      buckets.set(key, [])
    }
    buckets.get(key)!.push(metric)
  })

  // Aggregate each bucket
  return Array.from(buckets.entries()).map(([key, bucketMetrics]) => {
    const [component, timestamp] = key.split('_')
    const latencies = bucketMetrics.map(m => m.latency || 0)
    const throughputs = bucketMetrics.map(m => m.throughput || 0)
    const errorRates = bucketMetrics.map(m => m.error_rate || 0)

    let aggregatedValue = 0
    switch (aggregation) {
      case 'avg':
        aggregatedValue = latencies.reduce((sum, val) => sum + val, 0) / latencies.length
        break
      case 'max':
        aggregatedValue = Math.max(...latencies)
        break
      case 'min':
        aggregatedValue = Math.min(...latencies)
        break
      case 'sum':
        aggregatedValue = latencies.reduce((sum, val) => sum + val, 0)
        break
      case 'count':
        aggregatedValue = bucketMetrics.length
        break
      default:
        aggregatedValue = latencies.reduce((sum, val) => sum + val, 0) / latencies.length
    }

    return {
      component,
      timestamp: new Date(parseInt(timestamp)).toISOString(),
      latency: aggregatedValue,
      throughput: throughputs.reduce((sum, val) => sum + val, 0) / throughputs.length,
      error_rate: errorRates.reduce((sum, val) => sum + val, 0) / errorRates.length,
      count: bucketMetrics.length,
      aggregation
    }
  }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

function calculateSummary(metrics: any[]): any {
  if (metrics.length === 0) {
    return {
      totalRecords: 0,
      averageLatency: 0,
      averageThroughput: 0,
      averageErrorRate: 0,
      uniqueComponents: 0,
      timeRange: { start: null, end: null }
    }
  }

  const latencies = metrics.map(m => m.latency || 0)
  const throughputs = metrics.map(m => m.throughput || 0)
  const errorRates = metrics.map(m => m.error_rate || 0)
  const components = new Set(metrics.map(m => m.component))

  const timestamps = metrics
    .map(m => new Date(m.created_at || m.timestamp).getTime())
    .sort((a, b) => a - b)

  return {
    totalRecords: metrics.length,
    averageLatency: latencies.reduce((sum, val) => sum + val, 0) / latencies.length,
    averageThroughput: throughputs.reduce((sum, val) => sum + val, 0) / throughputs.length,
    averageErrorRate: errorRates.reduce((sum, val) => sum + val, 0) / errorRates.length,
    uniqueComponents: components.size,
    componentBreakdown: Array.from(components).map(component => ({
      component,
      count: metrics.filter(m => m.component === component).length
    })),
    timeRange: {
      start: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null,
      end: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null
    }
  }
}