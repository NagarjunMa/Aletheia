'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Play,
  Square,
  Trash2,
  Users,
  Activity,
  Clock,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useStreamingActions,
  useStreamingStore,
  StreamingSession
} from '@/lib/stores/streaming-store'
import { StreamingProgress } from './streaming-progress'
import { StreamingOutput } from './streaming-output'
import { useToast } from '@/hooks/use-toast'

interface StreamingManagerProps {
  inputId?: string
  originalText?: string
  className?: string
}

export function StreamingManager({
  inputId,
  originalText,
  className
}: StreamingManagerProps) {
  const { toast } = useToast()
  const [selectedSessionId, setSelectedSessionId] = useState<string>()

  const { sessions, isConnected, sessionCount, maxSessions } = useStreamingStore()
  const {
    createSession,
    completeSession,
    clearSession,
    clearAllSessions
  } = useStreamingActions()

  const sessionList = Array.from(sessions.values())
  const activeSessions = sessionList.filter(s => s.status !== 'idle')
  const completedSessions = sessionList.filter(s => s.status === 'completed')
  const errorSessions = sessionList.filter(s => s.status === 'error')

  // Auto-select the first active session if none selected
  useEffect(() => {
    if (!selectedSessionId && activeSessions.length > 0) {
      setSelectedSessionId(activeSessions[0].id)
    }
  }, [activeSessions, selectedSessionId])

  const canCreateSession = sessionCount < maxSessions

  const handleCreateGrammarFix = async () => {
    if (!inputId || !originalText) {
      toast({
        variant: 'destructive',
        description: 'Input ID and text are required to start streaming',
      })
      return
    }

    try {
      const sessionId = await createSession(inputId, 'grammar_fix')
      setSelectedSessionId(sessionId)
      toast({
        description: 'Grammar fix session started',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to start grammar fix session',
      })
    }
  }

  const handleCreateAdaptivePolish = async () => {
    if (!inputId || !originalText) {
      toast({
        variant: 'destructive',
        description: 'Input ID and text are required to start streaming',
      })
      return
    }

    try {
      const sessionId = await createSession(inputId, 'adaptive_polish')
      setSelectedSessionId(sessionId)
      toast({
        description: 'Adaptive polish session started',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to start adaptive polish session',
      })
    }
  }

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId)
  }

  const handleSessionComplete = (sessionId: string) => {
    completeSession(sessionId)
    toast({
      description: 'Session completed',
    })
  }

  const handleSessionClear = (sessionId: string) => {
    clearSession(sessionId)
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(undefined)
    }
    toast({
      description: 'Session cleared',
    })
  }

  const selectedSession = selectedSessionId ? sessions.get(selectedSessionId) : undefined

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Header & Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Streaming Manager
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <Badge variant="outline">
                {sessionCount}/{maxSessions} Sessions
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              onClick={handleCreateGrammarFix}
              disabled={!canCreateSession || !inputId || !originalText}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Grammar Fix Only
            </Button>
            <Button
              onClick={handleCreateAdaptivePolish}
              disabled={!canCreateSession || !inputId || !originalText}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Adaptive Polish
            </Button>
            {sessionCount > 0 && (
              <Button
                onClick={() => clearAllSessions()}
                variant="outline"
                size="sm"
                className="ml-auto flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>

          {!canCreateSession && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  Maximum concurrent sessions reached. Please wait for a session to complete or clear existing sessions.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Tabs */}
      {sessionList.length > 0 && (
        <Tabs value={selectedSessionId || ''} onValueChange={setSelectedSessionId}>
          {/* Session List */}
          <Card>
            <CardContent className="pt-6">
              <TabsList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 h-auto bg-transparent p-0">
                {sessionList.map((session) => (
                  <TabsTrigger
                    key={session.id}
                    value={session.id}
                    className="flex flex-col items-start p-3 h-auto data-[state=active]:bg-muted"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-sm font-medium">
                        {session.draftType === 'grammar_fix'
                          ? 'Grammar Fix'
                          : 'Adaptive Polish'
                        }
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-xs',
                          session.status === 'completed' && 'bg-green-100 text-green-800',
                          session.status === 'error' && 'bg-red-100 text-red-800',
                          session.status === 'streaming' && 'bg-yellow-100 text-yellow-800'
                        )}
                      >
                        {session.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                      <Clock className="h-3 w-3" />
                      <span>
                        {session.status === 'streaming' || session.status === 'connecting'
                          ? `${session.progress}%`
                          : session.status === 'completed'
                          ? `${session.fullContent.length} chars`
                          : 'Idle'
                        }
                      </span>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </CardContent>
          </Card>

          {/* Selected Session Content */}
          {selectedSession && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Progress Panel */}
              <div className="space-y-4">
                <StreamingProgress session={selectedSession} />

                {/* Session Actions */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex gap-2">
                      {selectedSession.status === 'completed' && (
                        <Button
                          onClick={() => handleSessionComplete(selectedSession.id)}
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Square className="h-3 w-3" />
                          Mark Complete
                        </Button>
                      )}
                      <Button
                        onClick={() => handleSessionClear(selectedSession.id)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear Session
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Output Panel */}
              {(selectedSession.status === 'completed' || selectedSession.status === 'error') && (
                <StreamingOutput
                  session={selectedSession}
                  originalText={originalText || ''}
                  onAccept={(content) => {
                    // Handle accept - could integrate with content store
                    console.log('Accepted content:', content)
                    toast({
                      description: 'Draft accepted successfully',
                    })
                  }}
                  onReject={() => {
                    handleSessionClear(selectedSession.id)
                  }}
                  onRegenerate={() => {
                    // Regenerate the same type
                    if (selectedSession.draftType === 'grammar_fix') {
                      handleCreateGrammarFix()
                    } else {
                      handleCreateAdaptivePolish()
                    }
                  }}
                />
              )}
            </div>
          )}
        </Tabs>
      )}

      {/* Empty State */}
      {sessionList.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted/50 rounded-full">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium">No Active Sessions</h3>
                <p className="text-muted-foreground">
                  Start a new streaming session to see AI-powered drafts in real-time.
                </p>
              </div>
              {!inputId || !originalText ? (
                <p className="text-sm text-muted-foreground">
                  Please provide input text to begin streaming.
                </p>
              ) : (
                <div className="flex gap-3">
                  <Button onClick={handleCreateGrammarFix} className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Start Grammar Fix
                  </Button>
                  <Button onClick={handleCreateAdaptivePolish} variant="secondary" className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Start Adaptive Polish
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}