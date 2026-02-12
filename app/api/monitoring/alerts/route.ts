/**
 * Monitoring Alerts API
 *
 * REST API endpoints for production alert management
 * - Alert retrieval and filtering
 * - Alert acknowledgment and resolution
 * - Alert subscription management
 * - Real-time alert streaming
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Alert query schema
const AlertQuerySchema = z.object({
  status: z.enum(['active', 'acknowledged', 'resolved', 'suppressed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  component: z.string().optional(),
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  assignedToMe: z.coerce.boolean().optional()
})

// Alert update schema
const AlertUpdateSchema = z.object({
  alertId: z.string().uuid(),
  action: z.enum(['acknowledge', 'resolve', 'assign', 'suppress']),
  assignedTo: z.string().uuid().optional(),
  resolutionNotes: z.string().optional()
})

// Alert subscription schema
const SubscriptionSchema = z.object({
  severities: z.array(z.enum(['low', 'medium', 'high', 'critical'])).optional(),
  components: z.array(z.string()).optional(),
  deliveryMethod: z.enum(['email', 'webhook', 'in_app']),
  endpoint: z.string().url().optional(),
  enabled: z.boolean().default(true)
})

/**
 * GET /api/monitoring/alerts
 * Retrieve production alerts with filtering
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
    const query = AlertQuerySchema.parse({
      status: searchParams.get('status'),
      severity: searchParams.get('severity'),
      component: searchParams.get('component'),
      timeRange: searchParams.get('timeRange'),
      limit: searchParams.get('limit'),
      assignedToMe: searchParams.get('assignedToMe')
    })

    console.log('🚨 Querying alerts with filters:', query)

    // Build database query
    let queryBuilder = supabase
      .from('production_alerts')
      .select(`
        *,
        assigned_profile:assigned_to(id, full_name),
        user_profile:user_id(id, full_name)
      `)
      .order('triggered_at', { ascending: false })

    // Apply filters
    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status)
    }

    if (query.severity) {
      queryBuilder = queryBuilder.eq('severity', query.severity)
    }

    if (query.component) {
      queryBuilder = queryBuilder.eq('component', query.component)
    }

    if (query.assignedToMe) {
      queryBuilder = queryBuilder.eq('assigned_to', user.id)
    }

    if (query.timeRange) {
      const timeframeMs = getTimeframeMs(query.timeRange)
      const since = new Date(Date.now() - timeframeMs)
      queryBuilder = queryBuilder.gte('triggered_at', since.toISOString())
    }

    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit)
    } else {
      queryBuilder = queryBuilder.limit(50) // Default limit
    }

    const { data: alerts, error } = await queryBuilder

    if (error) {
      throw error
    }

    // Calculate alert summary
    const summary = calculateAlertSummary(alerts || [])

    return NextResponse.json({
      success: true,
      alerts: alerts || [],
      summary,
      query,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to query alerts:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve alerts'
    }, { status: 500 })
  }
}

/**
 * POST /api/monitoring/alerts
 * Create or update alert
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Check if this is an alert update
    if (body.action) {
      return handleAlertUpdate(supabase, user, body)
    }

    // For now, alert creation is handled by the monitoring system
    return NextResponse.json({
      success: false,
      error: 'Direct alert creation not supported. Alerts are generated automatically by the monitoring system.'
    }, { status: 400 })

  } catch (error) {
    console.error('Failed to process alert request:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process alert request'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/monitoring/alerts/:id
 * Update alert status (acknowledge, resolve, assign)
 */
async function handleAlertUpdate(supabase: any, user: any, body: any) {
  try {
    const validatedData = AlertUpdateSchema.parse(body)

    // Check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    const userRole = profile?.preferences?.role
    if (!['admin', 'manager'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions for alert updates' }, { status: 403 })
    }

    console.log(`🚨 Updating alert ${validatedData.alertId}: ${validatedData.action}`)

    // Prepare update data
    const updateData: any = {}

    switch (validatedData.action) {
      case 'acknowledge':
        updateData.status = 'acknowledged'
        updateData.acknowledged_at = new Date().toISOString()
        break

      case 'resolve':
        updateData.status = 'resolved'
        updateData.resolved = true
        updateData.resolved_at = new Date().toISOString()
        updateData.auto_resolved = false
        if (validatedData.resolutionNotes) {
          updateData.resolution_notes = validatedData.resolutionNotes
        }
        break

      case 'assign':
        if (!validatedData.assignedTo) {
          return NextResponse.json({
            success: false,
            error: 'assignedTo is required for assign action'
          }, { status: 400 })
        }
        updateData.assigned_to = validatedData.assignedTo
        break

      case 'suppress':
        updateData.status = 'suppressed'
        break
    }

    // Update the alert
    const { data: updatedAlert, error } = await supabase
      .from('production_alerts')
      .update(updateData)
      .eq('id', validatedData.alertId)
      .select(`
        *,
        assigned_profile:assigned_to(id, full_name),
        user_profile:user_id(id, full_name)
      `)
      .single()

    if (error) {
      throw error
    }

    // Log the action
    await supabase
      .from('user_analytics')
      .insert({
        user_id: user.id,
        session_id: `alert_${Date.now()}`,
        event_type: `alert_${validatedData.action}`,
        event_category: 'performance',
        event_data: {
          alert_id: validatedData.alertId,
          action: validatedData.action,
          assigned_to: validatedData.assignedTo,
          resolution_notes: validatedData.resolutionNotes
        }
      })

    return NextResponse.json({
      success: true,
      alert: updatedAlert,
      action: validatedData.action,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to update alert:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid update data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to update alert'
    }, { status: 500 })
  }
}

/**
 * PUT /api/monitoring/alerts/subscribe
 * Manage alert subscriptions
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = SubscriptionSchema.parse(body)

    console.log(`📧 Managing alert subscription for user ${user.id}`)

    // Store subscription preferences in user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    if (profileError) {
      throw profileError
    }

    const currentPreferences = profile?.preferences || {}
    const alertSubscription = {
      severities: validatedData.severities || ['high', 'critical'],
      components: validatedData.components,
      deliveryMethod: validatedData.deliveryMethod,
      endpoint: validatedData.endpoint,
      enabled: validatedData.enabled,
      updatedAt: new Date().toISOString()
    }

    const updatedPreferences = {
      ...currentPreferences,
      alertSubscription
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ preferences: updatedPreferences })
      .eq('id', user.id)

    if (updateError) {
      throw updateError
    }

    // Log subscription change
    await supabase
      .from('user_analytics')
      .insert({
        user_id: user.id,
        session_id: `subscription_${Date.now()}`,
        event_type: 'alert_subscription_updated',
        event_category: 'feature_usage',
        event_data: {
          delivery_method: validatedData.deliveryMethod,
          enabled: validatedData.enabled,
          severity_count: validatedData.severities?.length || 0,
          component_count: validatedData.components?.length || 0
        }
      })

    return NextResponse.json({
      success: true,
      subscription: alertSubscription,
      message: `Alert subscription ${validatedData.enabled ? 'enabled' : 'disabled'}`,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to manage alert subscription:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid subscription data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to manage alert subscription'
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

function calculateAlertSummary(alerts: any[]): any {
  const summary = {
    total: alerts.length,
    byStatus: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
    byComponent: {} as Record<string, number>,
    unresolved: 0,
    avgResolutionTime: 0
  }

  alerts.forEach(alert => {
    // Count by status
    summary.byStatus[alert.status] = (summary.byStatus[alert.status] || 0) + 1

    // Count by severity
    summary.bySeverity[alert.severity] = (summary.bySeverity[alert.severity] || 0) + 1

    // Count by component
    summary.byComponent[alert.component] = (summary.byComponent[alert.component] || 0) + 1

    // Count unresolved
    if (!alert.resolved) {
      summary.unresolved++
    }
  })

  // Calculate average resolution time for resolved alerts
  const resolvedAlerts = alerts.filter(alert => alert.resolved && alert.resolved_at)
  if (resolvedAlerts.length > 0) {
    const totalResolutionTime = resolvedAlerts.reduce((sum, alert) => {
      const triggered = new Date(alert.triggered_at).getTime()
      const resolved = new Date(alert.resolved_at).getTime()
      return sum + (resolved - triggered)
    }, 0)

    summary.avgResolutionTime = totalResolutionTime / resolvedAlerts.length / (60 * 1000) // in minutes
  }

  return summary
}