'use client'

import React, { useDeferredValue, useTransition } from 'react'
import { useChatStore } from '@/lib/stores/chat-store'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { DraftDisplay } from './draft-display'
import { Badge } from '@/components/ui/badge'
import { BarChart } from 'lucide-react'

export function ChatInterface() {
  const {
    conversation: { messages },
    draftGeneration: { currentDrafts, isGenerating, streamingDrafts, progress },
    streaming: { isActive: isStreamingActive, connectionStatus },
    ui: { isLoading, errors }
  } = useChatStore()

  // React 18 Concurrent Features for Performance
  const [isPending, startTransition] = useTransition()
  const deferredMessages = useDeferredValue(messages)
  const deferredProgress = useDeferredValue(progress)

  // Development performance metrics - use ref to avoid triggering re-renders
  const renderCountRef = React.useRef(0)
  if (process.env.NODE_ENV === 'development') {
    renderCountRef.current += 1
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
      {/* Development Performance Metrics */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-4 py-2 bg-gray-900/20 border-b border-gray-700/30 text-xs">
          <div className="flex items-center gap-4 text-gray-400">
            <div className="flex items-center gap-1">
              <BarChart className="w-3 h-3" />
              <span>Renders: {renderCountRef.current}</span>
            </div>
            {isPending && (
              <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                Transition Pending
              </Badge>
            )}
            {isStreamingActive && (
              <Badge className="bg-blue-500/20 text-blue-400 text-xs animate-pulse">
                Streaming Active
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList messages={deferredMessages} isLoading={isLoading} />
      </div>

      {/* Draft Display */}
      {(currentDrafts.length > 0 || streamingDrafts.length > 0) && (
        <div className="border-t border-aletheia-glass-border bg-aletheia-surface p-4">
          <DraftDisplay
            drafts={currentDrafts.length > 0 ? currentDrafts : streamingDrafts}
            isStreaming={isStreamingActive}
            progress={deferredProgress}
          />
        </div>
      )}

      {/* Connection Status & Error Display */}
      {(isGenerating || isStreamingActive || errors.length > 0) && (
        <div className="border-t border-aletheia-glass-border bg-aletheia-surface p-4">
          {/* Loading/Generation State */}
          {(isGenerating || isStreamingActive) && (
            <div className="flex items-center gap-3 mb-2">
              <div className="w-4 h-4 border-2 border-aletheia-accent border-t-transparent rounded-full animate-spin"></div>
              <span className="text-aletheia-text text-sm">
                {isStreamingActive ? `Streaming (${connectionStatus})` : 'Generating drafts...'}
              </span>
              {isGenerating && (
                <div className="text-xs text-aletheia-text-muted">
                  Grammar: {progress.grammar}% | Polish: {progress.polish}%
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {errors.length > 0 && (
            <div className="space-y-1">
              {errors.map((error, index) => (
                <div key={index} className="text-red-400 text-sm p-2 bg-red-900/20 rounded">
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat Input */}
      <div className="border-t border-aletheia-glass-border bg-aletheia-bg">
        <ChatInput />
      </div>
    </div>
  )
}