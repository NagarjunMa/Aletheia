'use client'

import React, { useEffect, useRef } from 'react'
import { Message, useChatStore } from '@/lib/stores/chat-store'
import { MessageSquare, Bot } from 'lucide-react'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = React.useState(true)

  // Get real-time state from chat store
  const {
    ui: { isTyping, messagePreview },
    streaming: { isActive: isStreamingActive, content: streamingContent }
  } = useChatStore()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Smart auto-scrolling (only when user is at bottom)
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom()
    }
  }, [messages, messagePreview, streamingContent, isAtBottom])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-2xl">
          <div className="w-16 h-16 bg-aletheia-accent rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-2xl font-semibold text-aletheia-text mb-4">
            How can I help you today?
          </h3>
          <p className="text-aletheia-text-muted text-lg leading-relaxed">
            I'm Claude, an AI assistant created by Anthropic. I can help you with writing, analysis, math, coding, creative tasks, and much more.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.role === 'user'
                ? 'bg-aletheia-accent text-white'
                : 'bg-aletheia-surface text-aletheia-accent'
            }`}>
              {message.role === 'user' ? (
                <MessageSquare className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-[80%] ${
              message.role === 'user' ? 'text-right' : 'text-left'
            }`}>
              <div className={`inline-block p-4 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-aletheia-accent text-white'
                  : 'bg-aletheia-surface text-aletheia-text border border-aletheia-glass-border'
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              </div>
              <div className={`text-xs text-aletheia-text-dim mt-2 ${
                message.role === 'user' ? 'text-right' : 'text-left'
              }`}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && messagePreview && (
          <div className="flex gap-4 flex-row-reverse">
            <div className="w-8 h-8 rounded-full bg-aletheia-accent/50 text-white flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="flex-1 max-w-[80%] text-right">
              <div className="inline-block p-4 rounded-2xl bg-aletheia-accent/20 text-aletheia-text border border-aletheia-accent/30">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-aletheia-accent rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-aletheia-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-aletheia-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-xs text-aletheia-accent">Typing...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Streaming Content Display */}
        {isStreamingActive && streamingContent && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-aletheia-surface text-aletheia-accent flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1 max-w-[80%]">
              <div className="inline-block p-4 rounded-2xl bg-aletheia-surface text-aletheia-text border border-aletheia-glass-border">
                <p className="whitespace-pre-wrap leading-relaxed">
                  {streamingContent}
                  <span className="animate-pulse">|</span>
                </p>
              </div>
              <div className="text-xs text-aletheia-text-dim mt-2">
                AI is thinking...
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !isStreamingActive && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-aletheia-surface text-aletheia-accent flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1 max-w-[80%]">
              <div className="inline-block p-4 rounded-2xl bg-aletheia-surface text-aletheia-text border border-aletheia-glass-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-aletheia-accent rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-aletheia-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-aletheia-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-aletheia-text-muted text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}