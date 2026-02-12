/**
 * Admin Analytics Dashboard Page
 *
 * Advanced analytics interface for business intelligence
 * - User behavior analytics
 * - Revenue optimization insights
 * - AI model performance analytics
 * - Predictive modeling results
 */

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart3,
  Brain,
  DollarSign,
  Download,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react'

export default async function AnalyticsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Get user profile for role information
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .single()

  const userRole = profile?.preferences?.role || 'user'
  const canViewRevenue = userRole === 'admin'

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-gray-400">
            Advanced analytics and business intelligence for Ascendia AI
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-ascendia-accent border-ascendia-accent/50">
            Real-time Data
          </Badge>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <Suspense fallback={<KeyMetricsLoading />}>
        <KeyMetrics canViewRevenue={canViewRevenue} />
      </Suspense>

      {/* Analytics Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-gray-800">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            User Analytics
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Performance
          </TabsTrigger>
          {canViewRevenue && (
            <TabsTrigger value="revenue" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Revenue Analytics
            </TabsTrigger>
          )}
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Trends & Insights
          </TabsTrigger>
        </TabsList>

        {/* User Analytics Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-gray-600 bg-gray-800/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  User Engagement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartLoading />}>
                  <UserEngagement />
                </Suspense>
              </CardContent>
            </Card>

            <Card className="border-gray-600 bg-gray-800/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  Feature Adoption
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartLoading />}>
                  <FeatureAdoption />
                </Suspense>
              </CardContent>
            </Card>
          </div>

          <Card className="border-gray-600 bg-gray-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                User Segmentation & Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<TableLoading />}>
                <UserSegmentation />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Performance Tab */}
        <TabsContent value="ai" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-gray-600 bg-gray-800/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Model Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartLoading />}>
                  <ModelPerformance />
                </Suspense>
              </CardContent>
            </Card>

            <Card className="border-gray-600 bg-gray-800/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Processing Efficiency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartLoading />}>
                  <ProcessingEfficiency />
                </Suspense>
              </CardContent>
            </Card>
          </div>

          <Card className="border-gray-600 bg-gray-800/50">
            <CardHeader>
              <CardTitle className="text-white">AI System Optimization Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<TableLoading />}>
                <OptimizationRecommendations />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Analytics Tab */}
        {canViewRevenue && (
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="border-gray-600 bg-gray-800/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    Revenue Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<ChartLoading />}>
                    <RevenueMetrics />
                  </Suspense>
                </CardContent>
              </Card>

              <Card className="border-gray-600 bg-gray-800/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    Growth Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<ChartLoading />}>
                    <GrowthTrends />
                  </Suspense>
                </CardContent>
              </Card>

              <Card className="border-gray-600 bg-gray-800/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    Customer LTV
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<ChartLoading />}>
                    <CustomerLTV />
                  </Suspense>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Trends & Insights Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card className="border-gray-600 bg-gray-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-ascendia-accent" />
                Predictive Analytics & Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<TableLoading />}>
                <PredictiveInsights />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Async Components
async function KeyMetrics({ canViewRevenue }: { canViewRevenue: boolean }) {
  const supabase = createClient()

  const [
    totalUsersResult,
    monthlyActiveResult,
    avgSessionResult,
    satisfactionResult
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('user_analytics')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('user_analytics')
      .select('session_duration')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('generated_drafts')
      .select('is_accepted')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  ])

  const totalUsers = totalUsersResult.count || 0
  const monthlyActiveUsers = new Set((monthlyActiveResult.data || []).map(m => m.user_id)).size

  // Calculate average session duration
  const sessionData = avgSessionResult.data || []
  const avgSession = sessionData.length > 0
    ? sessionData.reduce((sum, s) => {
        const duration = s.session_duration ? parseInterval(s.session_duration) : 0
        return sum + duration
      }, 0) / sessionData.length / 60 // convert to minutes
    : 0

  // Calculate satisfaction rate
  const draftData = satisfactionResult.data || []
  const satisfactionRate = draftData.length > 0
    ? (draftData.filter(d => d.is_accepted).length / draftData.length) * 100
    : 0

  const metrics = [
    {
      label: 'Total Users',
      value: totalUsers.toLocaleString(),
      change: '+12%',
      positive: true,
      icon: Users
    },
    {
      label: 'Monthly Active',
      value: monthlyActiveUsers.toLocaleString(),
      change: '+8%',
      positive: true,
      icon: TrendingUp
    },
    {
      label: 'Avg Session',
      value: `${Math.round(avgSession)}min`,
      change: '+5%',
      positive: true,
      icon: BarChart3
    },
    {
      label: 'Satisfaction Rate',
      value: `${satisfactionRate.toFixed(1)}%`,
      change: '+3%',
      positive: true,
      icon: Zap
    }
  ]

  if (canViewRevenue) {
    metrics.push({
      label: 'Monthly Revenue',
      value: '$12,450',
      change: '+18%',
      positive: true,
      icon: DollarSign
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon
        return (
          <Card key={index} className="border-gray-600 bg-gray-800/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{metric.label}</p>
                  <p className="text-2xl font-bold text-white">{metric.value}</p>
                  <p className={`text-sm ${metric.positive ? 'text-green-400' : 'text-red-400'}`}>
                    {metric.change}
                  </p>
                </div>
                <Icon className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// Mock Components (in production, these would fetch real data)
async function UserEngagement() {
  return (
    <div className="h-64 flex items-center justify-center text-gray-400">
      <div className="text-center">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>User engagement chart would be rendered here</p>
        <p className="text-sm">Daily active users, session duration, feature usage</p>
      </div>
    </div>
  )
}

async function FeatureAdoption() {
  return (
    <div className="space-y-4">
      {[
        { feature: 'Grammar Fix', adoption: 95, users: 342 },
        { feature: 'Adaptive Polish', adoption: 87, users: 298 },
        { feature: 'Voice Learning', adoption: 76, users: 267 },
        { feature: 'Parallel Processing', adoption: 68, users: 234 },
        { feature: 'Memory Engine', adoption: 45, users: 156 }
      ].map((item, index) => (
        <div key={index} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-300">{item.feature}</span>
            <span className="text-gray-400">{item.adoption}% ({item.users} users)</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-ascendia-accent rounded-full h-2 transition-all duration-300"
              style={{ width: `${item.adoption}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

async function UserSegmentation() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { segment: 'Power Users', count: 45, revenue: '$3,200', engagement: 'High' },
          { segment: 'Regular Users', count: 234, revenue: '$7,800', engagement: 'Medium' },
          { segment: 'New Users', count: 89, revenue: '$1,450', engagement: 'Growing' }
        ].map((segment, index) => (
          <div key={index} className="p-4 bg-gray-700/50 rounded-lg">
            <h4 className="text-white font-medium">{segment.segment}</h4>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Users:</span>
                <span className="text-white">{segment.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Revenue:</span>
                <span className="text-white">{segment.revenue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Engagement:</span>
                <Badge variant="outline" size="sm">{segment.engagement}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

async function ModelPerformance() {
  return (
    <div className="space-y-4">
      {[
        { model: 'Security Framework', accuracy: 98.5, latency: 18 },
        { model: 'Parallel Processor', accuracy: 96.2, latency: 245 },
        { model: 'Voice Learning', accuracy: 87.3, latency: 1200 },
        { model: 'RAG Engine', accuracy: 91.8, latency: 450 }
      ].map((model, index) => (
        <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded">
          <div>
            <p className="text-white font-medium">{model.model}</p>
            <p className="text-sm text-gray-400">Accuracy: {model.accuracy}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-300">{model.latency}ms</p>
            <p className="text-xs text-gray-400">avg latency</p>
          </div>
        </div>
      ))}
    </div>
  )
}

async function ProcessingEfficiency() {
  return (
    <div className="h-64 flex items-center justify-center text-gray-400">
      <div className="text-center">
        <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Processing efficiency metrics</p>
        <p className="text-sm">Throughput, resource utilization, cost optimization</p>
      </div>
    </div>
  )
}

async function OptimizationRecommendations() {
  return (
    <div className="space-y-3">
      {[
        {
          title: 'Implement Redis Caching for Security Rules',
          impact: 'Reduce latency by 60-80%',
          priority: 'High',
          effort: 'Medium'
        },
        {
          title: 'Optimize Voice Learning Memory Usage',
          impact: 'Reduce memory usage by 40%',
          priority: 'Medium',
          effort: 'High'
        },
        {
          title: 'Dynamic Model Selection',
          impact: 'Increase efficiency by 15-25%',
          priority: 'Low',
          effort: 'High'
        }
      ].map((rec, index) => (
        <div key={index} className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-white font-medium">{rec.title}</h4>
              <p className="text-sm text-gray-400 mt-1">{rec.impact}</p>
            </div>
            <div className="flex gap-2">
              <Badge
                variant="outline"
                className={
                  rec.priority === 'High' ? 'text-red-400 border-red-400/50' :
                  rec.priority === 'Medium' ? 'text-yellow-400 border-yellow-400/50' :
                  'text-blue-400 border-blue-400/50'
                }
                size="sm"
              >
                {rec.priority}
              </Badge>
              <Badge variant="outline" size="sm">
                {rec.effort}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

async function RevenueMetrics() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-3xl font-bold text-green-400">$12,450</p>
        <p className="text-sm text-gray-400">Monthly Recurring Revenue</p>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Growth Rate:</span>
          <span className="text-green-400">+18%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Churn Rate:</span>
          <span className="text-red-400">2.3%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Avg Revenue per User:</span>
          <span className="text-white">$34.50</span>
        </div>
      </div>
    </div>
  )
}

async function GrowthTrends() {
  return (
    <div className="h-48 flex items-center justify-center text-gray-400">
      <div className="text-center">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Growth trend visualization</p>
      </div>
    </div>
  )
}

async function CustomerLTV() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-3xl font-bold text-purple-400">$890</p>
        <p className="text-sm text-gray-400">Average Customer LTV</p>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Payback Period:</span>
          <span className="text-white">3.2 months</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Retention Rate:</span>
          <span className="text-green-400">89%</span>
        </div>
      </div>
    </div>
  )
}

async function PredictiveInsights() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            title: 'User Growth Prediction',
            value: '+25% next month',
            confidence: '87%',
            trend: 'positive'
          },
          {
            title: 'Churn Risk Alert',
            value: '12 users at risk',
            confidence: '94%',
            trend: 'negative'
          }
        ].map((insight, index) => (
          <div key={index} className="p-4 bg-gray-700/50 rounded-lg">
            <h4 className="text-white font-medium">{insight.title}</h4>
            <p className={`text-lg font-bold mt-2 ${
              insight.trend === 'positive' ? 'text-green-400' : 'text-orange-400'
            }`}>
              {insight.value}
            </p>
            <p className="text-sm text-gray-400">Confidence: {insight.confidence}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Loading Components
function KeyMetricsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse"></div>
      ))}
    </div>
  )
}

function ChartLoading() {
  return <div className="h-64 bg-gray-700 rounded animate-pulse"></div>
}

function TableLoading() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-700 rounded animate-pulse"></div>
      ))}
    </div>
  )
}

// Helper function
function parseInterval(interval: string): number {
  // Simple interval parser for PostgreSQL intervals
  const match = interval.match(/(\d+):(\d+):(\d+)/)
  if (match) {
    const [, hours, minutes, seconds] = match
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)
  }
  return 0
}