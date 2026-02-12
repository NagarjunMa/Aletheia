'use client'

import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StreamingSession } from '@/lib/stores/streaming-store'

interface StreamingProgressProps {
  session: StreamingSession
  className?: string
}

export function StreamingProgress({ session, className }: StreamingProgressProps) {
  const getStatusIcon = () => {
    switch (session.status) {
      case 'connecting':
      case 'streaming':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusColor = () => {
    switch (session.status) {
      case 'connecting':
        return 'bg-blue-500'
      case 'streaming':
        return 'bg-yellow-500'
      case 'completed':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = () => {
    switch (session.status) {
      case 'connecting':
        return 'Connecting to AI...'
      case 'streaming':
        return session.stage || 'Processing...'
      case 'completed':
        return 'Completed'
      case 'error':
        return 'Error occurred'
      default:
        return 'Idle'
    }
  }

  const getDraftTypeLabel = () => {
    return session.draftType === 'grammar_fix'
      ? 'Grammar Fix Only'
      : 'Adaptive Polish'
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium text-sm">
                {getDraftTypeLabel()}
              </span>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                'text-white',
                session.status === 'completed' && 'bg-green-500',
                session.status === 'error' && 'bg-red-500',
                session.status === 'streaming' && 'bg-yellow-500',
                session.status === 'connecting' && 'bg-blue-500'
              )}
            >
              {session.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>

          {/* Progress Bar */}
          {(session.status === 'streaming' || session.status === 'connecting') && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{getStatusText()}</span>
                <span>{session.progress}%</span>
              </div>
              <Progress
                value={session.progress}
                className="w-full h-2"
              />
            </div>
          )}

          {/* Current Stage */}
          {session.stage && session.status === 'streaming' && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <div className={cn(
                'w-2 h-2 rounded-full animate-pulse',
                getStatusColor()
              )} />
              {session.stage}
            </div>
          )}

          {/* Content Preview */}
          {session.content && (
            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-2">Preview</div>
              <div className="bg-muted/50 rounded-md p-3 text-sm max-h-20 overflow-y-auto">
                {session.content.length > 100
                  ? `${session.content.substring(0, 100)}...`
                  : session.content
                }
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}