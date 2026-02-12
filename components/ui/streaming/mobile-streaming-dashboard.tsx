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
  Plus,
  Smartphone
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
import { ResponsiveGrid } from '@/components/ui/responsive-grid'
import { MobileOptimizedLayout } from '@/components/layout/mobile-optimized-layout'

interface MobileStreamingDashboardProps {
  className?: string
}

export function MobileStreamingDashboard({ className }: MobileStreamingDashboardProps) {
  const [activeTab, setActiveTab] = useState('editor')

  // Streaming state
  const { isConnected, sessionCount, maxSessions } = useStreamingStatus()
  const { sessions } = useStreamingStore()
  const { clearAllSessions } = useStreamingActions()

  // Content stats
  const conversations = useConversationList()
  const contentStats = useContentStats()

  // CPL data
  const { data: cplTrends } = useCPLTrends('week')
  const { data: cplStats } = useCPLStatistics()

  const sessionList = Array.from(sessions.values())
  const activeSessions = sessionList.filter(s =>
    s.status === 'streaming' || s.status === 'connecting'
  )
  const completedToday = sessionList.filter(s =>
    s.status === 'completed' &&
    new Date(s.id.split('-')[1] || 0).toDateString() === new Date().toDateString()
  ).length

  return (
    <MobileOptimizedLayout
      title="Ascendia"
      subtitle="AI-powered writing enhancement"
      className={className}
    >
      <div className="space-y-4 pb-6">
        {/* Quick Stats - Mobile Optimized */}
        <ResponsiveGrid
          cols={{ default: 2, md: 4 }}
          gap="sm"
          className="mb-6"
        >
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-xl font-bold">{activeSessions.length}</p>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-1">
              <Badge variant="outline" className="text-xs">
                {sessionCount}/{maxSessions}
              </Badge>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Today</p>
                <p className="text-xl font-bold">{completedToday}</p>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-1">
              <span className="text-xs text-muted-foreground">
                Completed
              </span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg CPL</p>
                <p className="text-xl font-bold">
                  {contentStats?.averageCPL || cplStats?.averageScore || 0}
                </p>
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-1">
              {cplTrends && cplTrends.length > 1 && (
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-600">
                    +{Math.round(((cplTrends[cplTrends.length - 1]?.score || 0) -
                    (cplTrends[cplTrends.length - 2]?.score || 0)))}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Chats</p>
                <p className="text-xl font-bold">
                  {contentStats?.totalConversations || conversations.length}
                </p>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-1">
              <span className="text-xs text-muted-foreground">
                All time
              </span>
            </div>
          </Card>
        </ResponsiveGrid>

        {/* Mobile-First Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full h-12">
            <TabsTrigger value="editor" className="flex flex-col items-center gap-1 py-2">
              <Plus className="h-4 w-4" />
              <span className="text-xs">Editor</span>
            </TabsTrigger>
            <TabsTrigger value="streaming" className="flex flex-col items-center gap-1 py-2">
              <Zap className="h-4 w-4" />
              <span className="text-xs">Stream</span>
              {activeSessions.length > 0 && (
                <Badge variant="secondary" className="text-xs h-4 px-1">
                  {activeSessions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex flex-col items-center gap-1 py-2">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="mt-6">
            <RealTimeEditor
              placeholder="Start writing your content here. Ascendia will analyze your text in real-time and provide CPL scores..."
              onSave={(content, inputId) => {
                console.log('Saved content:', { content, inputId })
              }}
            />
          </TabsContent>

          <TabsContent value="streaming" className="mt-6">
            <div className="space-y-4">
              {/* Active Sessions Overview - Mobile */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Active Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activeSessions.length > 0 ? (
                    <div className="space-y-3">
                      {activeSessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {session.draftType === 'grammar_fix'
                                  ? 'Grammar Fix'
                                  : 'Polish'
                                }
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {session.stage || 'Processing...'}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {session.progress}%
                          </Badge>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllSessions}
                        className="w-full mt-3"
                      >
                        Clear All Sessions
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No Active Sessions</p>
                      <p className="text-sm">Tap Editor to start generating drafts</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <StreamingManager />
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <div className="space-y-4">
              {/* CPL Trends - Mobile */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">CPL Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {cplTrends && cplTrends.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">This Week</span>
                        <Badge variant="outline" className="text-xs">
                          {cplTrends.length} analyses
                        </Badge>
                      </div>
                      <div className="h-24 bg-muted/30 rounded-lg flex items-center justify-center">
                        <span className="text-sm text-muted-foreground">Chart visualization</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No CPL Data</p>
                      <p className="text-sm">Start writing to see progress</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Session History - Mobile */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Recent Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  {sessionList.length > 0 ? (
                    <div className="space-y-2">
                      {sessionList.slice(-3).reverse().map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Badge
                              variant={session.status === 'completed' ? 'default' : 'secondary'}
                              className="text-xs flex-shrink-0"
                            >
                              {session.status}
                            </Badge>
                            <span className="text-xs truncate">
                              {session.draftType === 'grammar_fix'
                                ? 'Grammar'
                                : 'Polish'
                              }
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {session.fullContent.length} chars
                          </span>
                        </div>
                      ))}
                      {sessionList.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{sessionList.length - 3} more sessions
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No History</p>
                      <p className="text-sm">Completed sessions appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MobileOptimizedLayout>
  )
}