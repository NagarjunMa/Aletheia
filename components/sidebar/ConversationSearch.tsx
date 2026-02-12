'use client'

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Search, X, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Conversation {
  id: string
  user_id: string
  title: string
  category: string
  created_at: string
  updated_at: string
  last_activity_at: string
  metadata?: any
}

interface ConversationSearchProps {
  query: string
  onQueryChange: (query: string) => void
  onClose: () => void
  onConversationSelect?: (conversationId: string) => void
  className?: string
}

export function ConversationSearch({
  query,
  onQueryChange,
  onClose,
  onConversationSelect,
  className
}: ConversationSearchProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  useEffect(() => {
    // Focus input when component mounts
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.trim()) {
      searchConversations(query)
    } else {
      setConversations([])
    }
  }, [query])

  const searchConversations = async (searchQuery: string) => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please sign in to search conversations')
        return
      }

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .or(`title.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`)
        .order('last_activity_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error searching conversations:', error)
        setError('Failed to search conversations')
        return
      }

      setConversations(data || [])
    } catch (err) {
      console.error('Error in searchConversations:', err)
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleConversationClick = (conversationId: string) => {
    onConversationSelect?.(conversationId)
    onClose()
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const getCategoryIcon = (category: string) => {
    const categoryMap = {
      'instagram_post': '📱',
      'linkedin': '💼',
      'medium_article': '📝',
      'email': '✉️',
      'conversational': '💬'
    }
    return categoryMap[category as keyof typeof categoryMap] || '💬'
  }

  return (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 bg-black/50 z-50 flex items-start justify-start',
        className
      )}
      onClick={handleOverlayClick}
    >
      <div className="w-80 h-full bg-ascendia-gray border-r border-ascendia-accent/20">
        {/* Search Header */}
        <div className="flex items-center gap-3 p-4 border-b border-ascendia-accent/20">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search conversations..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-ascendia-black border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-ascendia-accent focus:outline-none focus:ring-1 focus:ring-ascendia-accent transition-colors"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-ascendia-accent/10 p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-400 text-sm">Searching...</div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center p-8">
              <div className="text-red-400 text-sm text-center">
                {error}
              </div>
            </div>
          )}

          {!loading && !error && query.trim() && conversations.length === 0 && (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-400 text-sm text-center">
                No conversations found for "{query}"
              </div>
            </div>
          )}

          {!loading && !error && !query.trim() && (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-400 text-sm text-center">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 text-gray-500" />
                Type to search conversations
              </div>
            </div>
          )}

          {conversations.length > 0 && (
            <div className="p-2 space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="flex items-center p-3 rounded-lg cursor-pointer transition-colors hover:bg-ascendia-accent/10"
                  onClick={() => handleConversationClick(conversation.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs">{getCategoryIcon(conversation.category)}</span>
                      <div className="text-sm font-medium text-white truncate">
                        {conversation.title || 'Untitled Conversation'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 capitalize">
                        {conversation.category.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(conversation.last_activity_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-4 border-t border-ascendia-accent/20">
          <div className="text-xs text-gray-500 text-center">
            Press ESC to close
          </div>
        </div>
      </div>
    </div>
  )
}