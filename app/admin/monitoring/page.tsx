/**
 * Admin Monitoring Dashboard Page
 *
 * Full-featured monitoring dashboard for production AI systems
 * - Real-time system monitoring
 * - Interactive charts and widgets
 * - Alert management
 * - Performance analytics
 */

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Dashboard } from '@/components/monitoring/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  AlertTriangle,
  Download,
  RefreshCw,
  Settings
} from 'lucide-react'
import Link from 'next/link'

export default async function MonitoringPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Get user profile for role information
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences, full_name')
    .eq('id', user.id)
    .single()

  const userRole = profile?.preferences?.role || 'user'

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">Production Monitoring</h1>
              <Badge variant="outline" className="text-green-400 border-green-400/50">
                Live
              </Badge>
            </div>
            <p className="text-gray-400">
              Real-time monitoring and analytics for Ascendia's AI systems
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* System Health Indicator */}
            <Suspense fallback={<div className="w-24 h-6 bg-gray-800 rounded animate-pulse"></div>}>
              <HealthIndicator />
            </Suspense>

            {/* Action Buttons */}
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            <Link href="/admin/monitoring/settings">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </Button>
            </Link>
          </div>
        </div>

        {/* Alert Banner */}
        <Suspense fallback={null}>
          <AlertBanner />
        </Suspense>

        {/* Main Monitoring Dashboard */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-1">
          <Suspense fallback={<MonitoringDashboardLoading />}>
            <Dashboard
              userRole={userRole as 'admin' | 'manager' | 'analyst' | 'user'}
              userId={user.id}
              className="bg-transparent border-0"
            />
          </Suspense>
        </div>

        {/* Additional Admin Controls */}
        {userRole === 'admin' && (
          <Card className="border-gray-600 bg-gray-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-ascendia-accent" />
                Admin Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" size="sm" className="justify-start">
                  <Activity className="w-4 h-4 mr-2" />
                  Create Health Snapshot
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Configure Alert Rules
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// Async Components
async function HealthIndicator() {
  const supabase = createClient()

  try {
    // Get latest health snapshot
    const { data: snapshot } = await supabase
      .from('system_health_snapshots')
      .select('overall_health_score')
      .order('snapshot_time', { ascending: false })
      .limit(1)
      .single()

    if (!snapshot) {
      return (
        <Badge variant="outline" className="text-yellow-400 border-yellow-400/50">
          Initializing...
        </Badge>
      )
    }

    const healthScore = snapshot.overall_health_score || 0
    let status = 'Excellent'
    let colorClass = 'text-green-400 border-green-400/50'

    if (healthScore < 50) {
      status = 'Critical'
      colorClass = 'text-red-400 border-red-400/50'
    } else if (healthScore < 70) {
      status = 'Poor'
      colorClass = 'text-orange-400 border-orange-400/50'
    } else if (healthScore < 90) {
      status = 'Good'
      colorClass = 'text-yellow-400 border-yellow-400/50'
    }

    return (
      <Badge variant="outline" className={colorClass}>
        {status} ({healthScore.toFixed(1)}%)
      </Badge>
    )
  } catch (error) {
    console.error('Failed to get health indicator:', error)
    return (
      <Badge variant="outline" className="text-gray-400 border-gray-400/50">
        Unknown
      </Badge>
    )
  }
}

async function AlertBanner() {
  const supabase = createClient()

  try {
    // Check for critical alerts
    const { data: criticalAlerts } = await supabase
      .from('production_alerts')
      .select('id, message, component, triggered_at')
      .eq('status', 'active')
      .eq('severity', 'critical')
      .order('triggered_at', { ascending: false })
      .limit(3)

    if (!criticalAlerts || criticalAlerts.length === 0) {
      return null
    }

    return (
      <Card className="border-red-500/50 bg-red-500/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-400 font-medium mb-2">
                Critical System Alerts ({criticalAlerts.length})
              </h3>
              <div className="space-y-1">
                {criticalAlerts.map((alert, index) => (
                  <div key={index} className="text-sm text-red-300">
                    <span className="font-medium">{alert.component}:</span> {alert.message}
                  </div>
                ))}
              </div>
            </div>
            <Link href="/admin/monitoring#alerts">
              <Button variant="outline" size="sm" className="border-red-500 text-red-400 hover:bg-red-500/20">
                View All
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  } catch (error) {
    console.error('Failed to get alert banner:', error)
    return null
  }
}

function MonitoringDashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="animate-pulse space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-gray-800 rounded w-64"></div>
            <div className="h-4 bg-gray-800 rounded w-96"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-6 bg-gray-800 rounded w-20"></div>
            <div className="h-9 bg-gray-800 rounded w-32"></div>
          </div>
        </div>

        {/* Tab navigation skeleton */}
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-800 rounded w-24"></div>
          ))}
        </div>

        {/* Quick stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-800 rounded-lg"></div>
          ))}
        </div>

        {/* Main content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    </div>
  )
}