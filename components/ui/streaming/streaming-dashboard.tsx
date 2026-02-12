'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  Clock,
  TrendingUp,
  Users,
  Zap,
  BarChart3,
  Settings,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useStreamingStore,
  useStreamingStatus,
  useStreamingActions
} from '@/lib/stores/streaming-store'
import { useConversationList, useContentStats } from '@/lib/stores/content-store'
import { useCPLTrends, useCPLStatistics } from '@/lib/query/hooks'
import { RealTimeEditor } from './real-time-editor'
import { StreamingManager } from './streaming-manager'

interface StreamingDashboardProps {
  className?: string
}

export function StreamingDashboard({ className }: StreamingDashboardProps) {
  const [activeTab, setActiveTab] = useState('editor')

  // Streaming state
  const { isConnected, sessionCount, maxSessions } = useStreamingStatus()
  const { sessions } = useStreamingStore()
  const { clearAllSessions } = useStreamingActions()

  // Content stats (lightweight Zustand stores)
  const conversations = useConversationList()
  const contentStats = useContentStats()

  // PERFORMANCE OPTIMIZATION: Only load expensive CPL data when analytics tab is active
  const { data: cplTrends } = useCPLTrends('week', activeTab === 'analytics')
  const { data: cplStats } = useCPLStatistics(activeTab === 'analytics')

  const sessionList = Array.from(sessions.values())
  const activeSessions = sessionList.filter(s =>
    s.status === 'streaming' || s.status === 'connecting'
  )
  const completedToday = sessionList.filter(s =>
    s.status === 'completed' &&
    new Date(s.id.split('-')[1] || 0).toDateString() === new Date().toDateString()
  ).length

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ascendia Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time AI-powered writing enhancement
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">{activeSessions.length}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                {sessionCount}/{maxSessions} total
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <p className="text-2xl font-bold">{completedToday}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                +{completedToday} from yesterday
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average CPL</p>
                <p className="text-2xl font-bold">
                  {contentStats?.averageCPL || cplStats?.averageScore || 0}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2">
              {cplTrends && cplTrends.length > 1 && (
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-600">
                    +{Math.round(((cplTrends[cplTrends.length - 1]?.score || 0) -
                    (cplTrends[cplTrends.length - 2]?.score || 0)))} this week
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Conversations</p>
                <p className="text-2xl font-bold">
                  {contentStats?.totalConversations || conversations.length}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                All time
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-1 md:grid-cols-3 w-full md:w-auto">
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="streaming" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Streaming
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="mt-6">
          <RealTimeEditor
            placeholder="Start writing your content here. As you type, Ascendia will analyze your text in real-time and provide CPL scores..."
            onSave={(content, inputId) => {
              console.log('Saved content:', { content, inputId })
            }}
          />
        </TabsContent>

        <TabsContent value="streaming" className="mt-6">
          <div className="space-y-6">
            {/* Active Sessions Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Streaming Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeSessions.length > 0 ? (
                  <div className="space-y-4">
                    {activeSessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <div>
                            <div className="font-medium">
                              {session.draftType === 'grammar_fix'
                                ? 'Grammar Fix Only'
                                : 'Adaptive Polish'
                              }
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {session.stage || 'Processing...'}
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {session.progress}%
                        </Badge>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllSessions}
                      className="w-full"
                    >
                      Clear All Sessions
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active streaming sessions</p>
                    <p className="text-sm">Go to the Editor tab to start generating drafts</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <StreamingManager />
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="space-y-6">
            {/* CPL Trends */}
            <Card>
              <CardHeader>
                <CardTitle>CPL Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {cplTrends && cplTrends.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">This Week</span>
                      <Badge variant="outline">
                        {cplTrends.length} analyses
                      </Badge>
                    </div>
                    <div className="h-32 bg-muted/30 rounded-lg flex items-center justify-center">
                      <span className="text-muted-foreground">Chart visualization placeholder</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No CPL data available</p>
                    <p className="text-sm">Start writing to see your progress</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Session History */}
            <Card>
              <CardHeader>
                <CardTitle>Session History</CardTitle>
              </CardHeader>
              <CardContent>
                {sessionList.length > 0 ? (
                  <div className="space-y-3">
                    {sessionList.slice(-5).reverse().map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={session.status === 'completed' ? 'default' : 'secondary'}
                            className="min-w-20"
                          >
                            {session.status}
                          </Badge>
                          <span className="text-sm">
                            {session.draftType === 'grammar_fix'
                              ? 'Grammar Fix'
                              : 'Adaptive Polish'
                            }
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {session.fullContent.length} chars
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No session history</p>
                    <p className="text-sm">Your completed sessions will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}