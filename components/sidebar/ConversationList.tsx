'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MessageSquare, MoreHorizontal, Trash2, Archive, Edit } from 'lucide-react'
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

interface ConversationListProps {
  searchQuery?: string
  activeConversationId?: string
  onConversationSelect?: (conversationId: string) => void
  className?: string
}

export function ConversationList({
  searchQuery = '',
  activeConversationId,
  onConversationSelect,
  className
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please sign in to view conversations')
        return
      }

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_activity_at', { ascending: false })

      if (error) {
        console.error('Error loading conversations:', error)
        setError('Failed to load conversations')
        return
      }

      setConversations(data || [])
    } catch (err) {
      console.error('Error in loadConversations:', err)
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  const handleConversationClick = (conversationId: string) => {
    onConversationSelect?.(conversationId)
  }

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm('Delete this conversation? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)

      if (error) {
        console.error('Error deleting conversation:', error)
        return
      }

      setConversations(prev => prev.filter(conv => conv.id !== conversationId))
    } catch (err) {
      console.error('Error in deleteConversation:', err)
    }
  }

  if (loading) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-cortex-gray-muted text-sm">Loading conversations...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('flex-1 flex items-center justify-center p-4', className)}>
        <div className="text-red-400 text-sm text-center">
          {error}
          <Button
            variant="ghost"
            size="sm"
            onClick={loadConversations}
            className="mt-2 text-cortex-orange hover:bg-cortex-orange/10 transition-colors"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (filteredConversations.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center p-4', className)}>
        <div className="text-cortex-gray-muted text-sm text-center">
          {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
          {!searchQuery && (
            <div className="mt-2 text-xs">
              Start a new conversation to see it here
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex-1 overflow-y-auto', className)}>
      <div className="p-2 space-y-1">
        {filteredConversations.map((conversation) => (
          <div
            key={conversation.id}
            className={cn(
              'group flex items-center p-3 rounded-lg cursor-pointer transition-colors',
              'hover:bg-cortex-orange/10',
              activeConversationId === conversation.id
                ? 'bg-cortex-orange/20 border-l-2 border-cortex-orange'
                : 'border-l-2 border-transparent'
            )}
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
                <span className="text-xs text-cortex-gray-muted capitalize">
                  {conversation.category.replace('_', ' ')}
                </span>
                <span className="text-xs text-cortex-gray-light">
                  {formatDate(conversation.last_activity_at)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0 text-cortex-gray-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                onClick={(e) => deleteConversation(conversation.id, e)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}