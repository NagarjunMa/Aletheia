/**
 * Admin Dashboard Homepage
 *
 * Main admin interface with quick access to monitoring and analytics
 * - System overview cards
 * - Quick actions
 * - Recent activity feed
 * - Health status indicators
 */

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Database,
  Eye,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400">
            System administration and monitoring for Ascendia AI
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-green-400 border-green-400/50">
            System Operational
          </Badge>
          <Link href="/admin/monitoring">
            <Button className="bg-ascendia-accent text-black hover:bg-ascendia-accent/90">
              <Activity className="w-4 h-4 mr-2" />
              View Monitoring
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <Suspense fallback={<QuickStatsLoading />}>
        <QuickStats />
      </Suspense>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health Overview */}
        <Card className="border-gray-600 bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Suspense fallback={<SystemHealthLoading />}>
              <SystemHealthOverview />
            </Suspense>

            <div className="pt-4 border-t border-gray-700">
              <Link href="/admin/monitoring">
                <Button variant="outline" size="sm" className="w-full">
                  <Eye className="w-4 h-4 mr-2" />
                  View Detailed Monitoring
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-gray-600 bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-ascendia-accent" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Link href="/admin/monitoring">
                <Button variant="outline" size="sm" className="w-full">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Monitoring
                </Button>
              </Link>

              <Link href="/admin/analytics">
                <Button variant="outline" size="sm" className="w-full">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Analytics
                </Button>
              </Link>

              <Link href="/admin/users">
                <Button variant="outline" size="sm" className="w-full">
                  <Users className="w-4 h-4 mr-2" />
                  User Management
                </Button>
              </Link>

              <Link href="/admin/settings">
                <Button variant="outline" size="sm" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  System Settings
                </Button>
              </Link>
            </div>

            <div className="pt-3 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Advanced Actions</h4>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Database className="w-4 h-4 mr-2" />
                  Database Health Check
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Brain className="w-4 h-4 mr-2" />
                  AI Model Performance
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-gray-600 bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<RecentActivityLoading />}>
              <RecentActivity />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="border-gray-600 bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<SystemAlertsLoading />}>
              <SystemAlerts />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Async Components
async function QuickStats() {
  const supabase = createClient()

  const [
    totalUsersResult,
    activeSessionsResult,
    alertsResult,
    metricsResult
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('production_metrics')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()),
    supabase.from('production_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('production_metrics')
      .select('latency')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  ])

  const totalUsers = totalUsersResult.count || 0
  const activeSessions = new Set(
    (activeSessionsResult.data || []).map(m => m.user_id).filter(Boolean)
  ).size
  const activeAlerts = alertsResult.count || 0
  const recentMetrics = metricsResult.data || []
  const avgLatency = recentMetrics.length > 0
    ? recentMetrics.reduce((sum, m) => sum + (m.latency || 0), 0) / recentMetrics.length
    : 0

  const stats = [
    {
      label: 'Total Users',
      value: totalUsers.toLocaleString(),
      icon: Users,
      color: 'text-blue-400'
    },
    {
      label: 'Active Sessions',
      value: activeSessions.toString(),
      icon: Activity,
      color: 'text-green-400'
    },
    {
      label: 'Active Alerts',
      value: activeAlerts.toString(),
      icon: AlertTriangle,
      color: activeAlerts > 0 ? 'text-orange-400' : 'text-gray-400'
    },
    {
      label: 'Avg Response Time',
      value: `${Math.round(avgLatency)}ms`,
      icon: Zap,
      color: avgLatency > 1000 ? 'text-orange-400' : 'text-green-400'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index} className="border-gray-600 bg-gray-800/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
                <Icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

async function SystemHealthOverview() {
  const supabase = createClient()

  // Get latest health snapshot
  const { data: snapshot } = await supabase
    .from('system_health_snapshots')
    .select('*')
    .order('snapshot_time', { ascending: false })
    .limit(1)
    .single()

  if (!snapshot) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No health data available</p>
        <p className="text-sm">System health monitoring initializing...</p>
      </div>
    )
  }

  const healthScore = snapshot.overall_health_score || 0
  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-400'
    if (score >= 70) return 'text-yellow-400'
    if (score >= 50) return 'text-orange-400'
    return 'text-red-400'
  }

  const components = [
    { name: 'Security Framework', score: snapshot.security_health_score },
    { name: 'Memory Engine', score: snapshot.memory_health_score },
    { name: 'Parallel Processor', score: snapshot.parallel_health_score },
    { name: 'Voice Learning', score: snapshot.voice_health_score },
    { name: 'RAG Engine', score: snapshot.rag_health_score }
  ]

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className={`text-3xl font-bold ${getHealthColor(healthScore)}`}>
          {healthScore.toFixed(1)}%
        </div>
        <p className="text-sm text-gray-400">Overall System Health</p>
      </div>

      <div className="space-y-3">
        {components.map((component, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span className="text-gray-300">{component.name}</span>
            <span className={getHealthColor(component.score || 0)}>
              {(component.score || 0).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-gray-700 text-xs text-gray-400">
        Last updated: {new Date(snapshot.snapshot_time).toLocaleString()}
      </div>
    </div>
  )
}

async function RecentActivity() {
  const supabase = createClient()

  const { data: activities } = await supabase
    .from('user_analytics')
    .select(`
      event_type,
      event_category,
      created_at,
      profiles:user_id(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(8)

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No recent activity</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0">
          <div className="flex-1">
            <p className="text-sm text-white font-medium">
              {formatEventType(activity.event_type)}
            </p>
            <p className="text-xs text-gray-400">
              {activity.profiles?.full_name || 'System'} • {new Date(activity.created_at).toLocaleTimeString()}
            </p>
          </div>
          <Badge variant="outline" size="sm" className="text-xs">
            {activity.event_category}
          </Badge>
        </div>
      ))}
    </div>
  )
}

async function SystemAlerts() {
  const supabase = createClient()

  const { data: alerts } = await supabase
    .from('production_alerts')
    .select('*')
    .eq('status', 'active')
    .order('triggered_at', { ascending: false })
    .limit(6)

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No active alerts</p>
        <p className="text-sm">All systems operating normally</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <div key={index} className="p-3 rounded-lg bg-gray-700/50 border border-gray-600">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className={
                    alert.severity === 'critical' ? 'text-red-400 border-red-400/50' :
                    alert.severity === 'high' ? 'text-orange-400 border-orange-400/50' :
                    alert.severity === 'medium' ? 'text-yellow-400 border-yellow-400/50' :
                    'text-blue-400 border-blue-400/50'
                  }
                  size="sm"
                >
                  {alert.severity}
                </Badge>
                <span className="text-xs text-gray-400">{alert.component}</span>
              </div>
              <p className="text-sm text-white">{alert.message}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(alert.triggered_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Loading Components
function QuickStatsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse"></div>
      ))}
    </div>
  )
}

function SystemHealthLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-16 bg-gray-700 rounded"></div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-700 rounded"></div>
        ))}
      </div>
    </div>
  )
}

function RecentActivityLoading() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-700 rounded animate-pulse"></div>
      ))}
    </div>
  )
}

function SystemAlertsLoading() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-700 rounded animate-pulse"></div>
      ))}
    </div>
  )
}

// Utility functions
function formatEventType(eventType: string): string {
  return eventType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}