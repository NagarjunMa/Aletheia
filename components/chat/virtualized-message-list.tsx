'use client'

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { VariableSizeList } from 'react-window'
import { Message } from '@/lib/stores/chat-store'
import { MessageSquare, User, Clock } from 'lucide-react'

interface VirtualizedMessageListProps {
  messages: Message[]
  height: number
  isStreaming?: boolean
}

/**
 * Virtualized Message List for Large Conversations
 * Handles 10,000+ messages with constant memory usage
 */
export function VirtualizedMessageList({
  messages,
  height,
  isStreaming = false
}: VirtualizedMessageListProps) {
  const listRef = useRef<VariableSizeList>(null)
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map())

  // Calculate estimated item height based on content length
  const getEstimatedHeight = useCallback((index: number) => {
    const message = messages[index]
    if (!message) return 80

    // Base height + estimated content height
    const contentLines = Math.ceil(message.content.length / 50)
    const totalHeight = 60 + contentLines * 20 + 20
    return Math.min(Math.max(totalHeight, 80), 400)
  }, [messages])

  // Get cached or estimated item height
  const getItemHeight = useCallback((index: number) => {
    return itemHeights.get(index) || getEstimatedHeight(index)
  }, [itemHeights, getEstimatedHeight])

  // Message row component
  const MessageRow = React.memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const message = messages[index]
    if (!message) return null

    return (
      <div style={style} className="px-4 py-2">
        <div className={`flex gap-3 w-full ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            message.role === 'user' ? 'bg-ascendia-accent/50 text-black' : 'bg-gray-700 text-white'
          }`}>
            {message.role === 'user' ? <User className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </div>
          <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block p-3 rounded-lg ${
              message.role === 'user'
                ? 'bg-ascendia-accent/20 text-white border border-ascendia-accent/30'
                : 'bg-gray-800 text-gray-100 border border-gray-700'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.content}</p>
              <div className={`text-xs mt-2 flex items-center gap-1 ${
                message.role === 'user' ? 'justify-end text-gray-400' : 'justify-start text-gray-500'
              }`}>
                <Clock className="w-3 h-3" />
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  })

  MessageRow.displayName = 'MessageRow'

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end')
    }
  }, [messages.length])

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <VariableSizeList
        ref={listRef}
        height={height}
        itemCount={messages.length}
        itemSize={getItemHeight}
        overscanCount={5}
        className="scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
      >
        {MessageRow}
      </VariableSizeList>

      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 p-2 border-t border-gray-700 bg-gray-800">
          <span>Messages: {messages.length} | Cached Heights: {itemHeights.size}</span>
        </div>
      )}
    </div>
  )
}
