/**
 * Monitoring Dashboard API
 *
 * REST API endpoints for dashboard configuration management
 * - Dashboard configuration CRUD
 * - Real-time dashboard data aggregation
 * - Widget configuration management
 * - Dashboard sharing and permissions
 *
 * NOTE: Temporarily disabled after database cleanup.
 * Tables 'dashboard_configurations' and 'user_analytics' were removed
 * as they had zero usage. Feature will be reimplemented if needed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { dashboardDataProvider } from '@/lib/monitoring/dashboard-data-provider'

// Dashboard configuration schema
const DashboardConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  layoutConfig: z.object({
    grid: z.object({
      columns: z.number().min(6).max(24),
      rows: z.number().min(4).max(20)
    }).optional(),
    theme: z.enum(['light', 'dark', 'auto']).default('dark'),
    autoRefresh: z.boolean().default(true),
    refreshInterval: z.number().min(1000).max(300000).default(5000)
  }),
  widgetConfigurations: z.array(z.object({
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
      x: z.number().min(0),
      y: z.number().min(0),
      width: z.number().min(1).max(12),
      height: z.number().min(1).max(8)
    }),
    config: z.record(z.any()).optional(),
    refreshInterval: z.number().min(1000).max(300000).default(5000)
  })),
  permissions: z.object({
    canViewSystem: z.boolean().default(true),
    canViewUsers: z.boolean().default(false),
    canViewRevenue: z.boolean().default(false),
    canViewAlerts: z.boolean().default(true),
    canModifyConfig: z.boolean().default(false)
  }),
  filters: z.object({
    timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
    components: z.array(z.string()).optional(),
    userSegments: z.array(z.string()).optional(),
    alertSeverity: z.array(z.enum(['low', 'medium', 'high', 'critical'])).optional()
  }).optional()
})

const DashboardQuerySchema = z.object({
  isPublic: z.coerce.boolean().optional(),
  isDefault: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(50).optional()
})

/**
 * GET /api/monitoring/dashboard
 * Retrieve dashboard configurations or real-time data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dashboardId = searchParams.get('id')
    const dataOnly = searchParams.get('dataOnly') === 'true'

    // If requesting dashboard data only
    if (dataOnly && dashboardId) {
      return getDashboardData(supabase, user, dashboardId)
    }

    // If requesting specific dashboard configuration
    if (dashboardId) {
      return getDashboardConfig(supabase, user, dashboardId)
    }

    // List all dashboard configurations
    return listDashboardConfigs(supabase, user, searchParams)

  } catch (error) {
    console.error('Failed to handle dashboard request:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process dashboard request'
    }, { status: 500 })
  }
}

/**
 * POST /api/monitoring/dashboard
 * Create new dashboard configuration
 */
export async function POST(request: NextRequest) {
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
    if (!['admin', 'manager'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = DashboardConfigSchema.parse(body)

    // Generate unique dashboard ID
    const dashboardId = `dashboard_${Date.now()}_${user.id.slice(-8)}`

    console.log(`📊 Creating dashboard configuration: ${dashboardId}`)

    // Create dashboard configuration
    const { data: dashboard, error } = await supabase
      .from('dashboard_configurations')
      .insert({
        dashboard_id: dashboardId,
        name: validatedData.name,
        description: validatedData.description,
        owner_user_id: user.id,
        is_public: validatedData.isPublic,
        is_default: validatedData.isDefault,
        layout_config: validatedData.layoutConfig,
        widget_configurations: validatedData.widgetConfigurations,
        permissions: validatedData.permissions,
        auto_refresh_enabled: validatedData.layoutConfig.autoRefresh,
        refresh_interval_ms: validatedData.layoutConfig.refreshInterval,
        theme: validatedData.layoutConfig.theme
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Log dashboard creation
    await supabase
      .from('user_analytics')
      .insert({
        user_id: user.id,
        session_id: `dashboard_${Date.now()}`,
        event_type: 'dashboard_created',
        event_category: 'feature_usage',
        event_data: {
          dashboard_id: dashboardId,
          widget_count: validatedData.widgetConfigurations.length,
          is_public: validatedData.isPublic,
          is_default: validatedData.isDefault
        }
      })

    return NextResponse.json({
      success: true,
      dashboard,
      dashboardId,
      message: 'Dashboard configuration created successfully',
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to create dashboard:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid dashboard configuration',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to create dashboard configuration'
    }, { status: 500 })
  }
}

/**
 * PUT /api/monitoring/dashboard
 * Update dashboard configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dashboardId = searchParams.get('id')

    if (!dashboardId) {
      return NextResponse.json({
        success: false,
        error: 'Dashboard ID is required'
      }, { status: 400 })
    }

    const body = await request.json()
    const validatedData = DashboardConfigSchema.parse(body)

    // Check if user owns the dashboard
    const { data: existingDashboard, error: fetchError } = await supabase
      .from('dashboard_configurations')
      .select('owner_user_id, permissions')
      .eq('dashboard_id', dashboardId)
      .single()

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: 'Dashboard not found'
      }, { status: 404 })
    }

    // Check permissions
    if (existingDashboard.owner_user_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single()

      const userRole = profile?.preferences?.role
      if (!['admin', 'manager'].includes(userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    console.log(`📊 Updating dashboard configuration: ${dashboardId}`)

    // Update dashboard configuration
    const { data: updatedDashboard, error } = await supabase
      .from('dashboard_configurations')
      .update({
        name: validatedData.name,
        description: validatedData.description,
        is_public: validatedData.isPublic,
        is_default: validatedData.isDefault,
        layout_config: validatedData.layoutConfig,
        widget_configurations: validatedData.widgetConfigurations,
        permissions: validatedData.permissions,
        auto_refresh_enabled: validatedData.layoutConfig.autoRefresh,
        refresh_interval_ms: validatedData.layoutConfig.refreshInterval,
        theme: validatedData.layoutConfig.theme,
        updated_at: new Date().toISOString()
      })
      .eq('dashboard_id', dashboardId)
      .select()
      .single()

    if (error) {
      throw error
    }

    // Log dashboard update
    await supabase
      .from('user_analytics')
      .insert({
        user_id: user.id,
        session_id: `dashboard_${Date.now()}`,
        event_type: 'dashboard_updated',
        event_category: 'feature_usage',
        event_data: {
          dashboard_id: dashboardId,
          widget_count: validatedData.widgetConfigurations.length,
          is_public: validatedData.isPublic
        }
      })

    return NextResponse.json({
      success: true,
      dashboard: updatedDashboard,
      message: 'Dashboard configuration updated successfully',
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to update dashboard:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid dashboard configuration',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to update dashboard configuration'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/monitoring/dashboard
 * Delete dashboard configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dashboardId = searchParams.get('id')

    if (!dashboardId) {
      return NextResponse.json({
        success: false,
        error: 'Dashboard ID is required'
      }, { status: 400 })
    }

    // Check if user owns the dashboard
    const { data: existingDashboard, error: fetchError } = await supabase
      .from('dashboard_configurations')
      .select('owner_user_id, name')
      .eq('dashboard_id', dashboardId)
      .single()

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: 'Dashboard not found'
      }, { status: 404 })
    }

    // Check permissions
    if (existingDashboard.owner_user_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single()

      const userRole = profile?.preferences?.role
      if (userRole !== 'admin') {
        return NextResponse.json({ error: 'Only dashboard owners or admins can delete dashboards' }, { status: 403 })
      }
    }

    console.log(`📊 Deleting dashboard configuration: ${dashboardId}`)

    // Delete dashboard configuration
    const { error } = await supabase
      .from('dashboard_configurations')
      .delete()
      .eq('dashboard_id', dashboardId)

    if (error) {
      throw error
    }

    // Log dashboard deletion
    await supabase
      .from('user_analytics')
      .insert({
        user_id: user.id,
        session_id: `dashboard_${Date.now()}`,
        event_type: 'dashboard_deleted',
        event_category: 'feature_usage',
        event_data: {
          dashboard_id: dashboardId,
          dashboard_name: existingDashboard.name
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Dashboard configuration deleted successfully',
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to delete dashboard:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete dashboard configuration'
    }, { status: 500 })
  }
}

// Helper functions
async function getDashboardData(supabase: any, user: any, dashboardId: string) {
  try {
    console.log(`📊 Getting dashboard data for: ${dashboardId}`)

    // Get dashboard configuration
    const { data: config, error: configError } = await supabase
      .from('dashboard_configurations')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .single()

    if (configError) {
      throw configError
    }

    // Check access permissions
    if (!config.is_public && config.owner_user_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single()

      const userRole = profile?.preferences?.role
      if (!['admin', 'manager', 'analyst'].includes(userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    // Initialize dashboard data provider
    await dashboardDataProvider.initialize()

    // Build dashboard configuration for data provider
    const dashboardConfig = {
      dashboardId,
      userId: user.id,
      role: user.role || 'user',
      layout: {
        widgets: config.widget_configurations,
        theme: config.theme,
        autoRefresh: config.auto_refresh_enabled
      },
      permissions: config.permissions,
      filters: {
        timeRange: '24h'
      }
    }

    // Get dashboard data
    const { widgets, metadata } = await dashboardDataProvider.getDashboardData(dashboardConfig as any)

    // Update last accessed time
    await supabase
      .from('dashboard_configurations')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('dashboard_id', dashboardId)

    return NextResponse.json({
      success: true,
      data: {
        config: dashboardConfig,
        widgets,
        metadata
      },
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to get dashboard data:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve dashboard data'
    }, { status: 500 })
  }
}

async function getDashboardConfig(supabase: any, user: any, dashboardId: string) {
  try {
    const { data: dashboard, error } = await supabase
      .from('dashboard_configurations')
      .select(`
        *,
        owner_profile:owner_user_id(id, full_name)
      `)
      .eq('dashboard_id', dashboardId)
      .single()

    if (error) {
      throw error
    }

    // Check access permissions
    if (!dashboard.is_public && dashboard.owner_user_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single()

      const userRole = profile?.preferences?.role
      if (!['admin', 'manager', 'analyst'].includes(userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    return NextResponse.json({
      success: true,
      dashboard,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to get dashboard configuration:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve dashboard configuration'
    }, { status: 500 })
  }
}

async function listDashboardConfigs(supabase: any, user: any, searchParams: URLSearchParams) {
  try {
    const query = DashboardQuerySchema.parse({
      isPublic: searchParams.get('isPublic'),
      isDefault: searchParams.get('isDefault'),
      limit: searchParams.get('limit')
    })

    let queryBuilder = supabase
      .from('dashboard_configurations')
      .select(`
        *,
        owner_profile:owner_user_id(id, full_name)
      `)
      .order('updated_at', { ascending: false })

    // Filter by public/private
    if (query.isPublic !== undefined) {
      queryBuilder = queryBuilder.eq('is_public', query.isPublic)
    }

    // Filter by default dashboards
    if (query.isDefault !== undefined) {
      queryBuilder = queryBuilder.eq('is_default', query.isDefault)
    }

    // Show user's own dashboards + public dashboards
    queryBuilder = queryBuilder.or(`owner_user_id.eq.${user.id},is_public.eq.true`)

    // Apply limit
    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit)
    }

    const { data: dashboards, error } = await queryBuilder

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      dashboards: dashboards || [],
      query,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to list dashboard configurations:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to list dashboard configurations'
    }, { status: 500 })
  }
}