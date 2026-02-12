'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  MessageCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Settings,
  Archive,
  User
} from 'lucide-react'
import { ConversationList } from './ConversationList'

interface ConversationSidebarProps {
  isOpen?: boolean
  onToggle?: () => void
  className?: string
  onConversationSelect?: (conversationId: string) => void
}

export function ConversationSidebar({
  isOpen = true,
  onToggle,
  className,
  onConversationSelect
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed top-0 left-0 h-full bg-aletheia-surface border-r border-aletheia-glass-border z-50',
          'flex flex-col transition-all duration-300 ease-out',
          'lg:static lg:z-auto',
          isOpen ? 'w-72' : 'w-0 lg:w-16',
          'overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-aletheia-glass-border min-h-[70px]">
          {isOpen && (
            <>
              {/* Logo/Title */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-aletheia-accent rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-lg text-aletheia-text">Claude</span>
              </div>

              {/* New Chat Button */}
              <Button
                size="sm"
                className="bg-aletheia-accent hover:bg-aletheia-accent-dark text-white p-2 rounded-lg transition-colors"
                onClick={() => {
                  console.log('Creating new conversation...')
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Collapse/Expand Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={cn(
              "text-aletheia-text-muted hover:text-aletheia-text hover:bg-aletheia-glass p-2 rounded-lg transition-colors",
              !isOpen && "mx-auto"
            )}
          >
            {isOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Search Bar */}
        {isOpen && (
          <div className="p-4 border-b border-aletheia-glass-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-aletheia-text-muted" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-aletheia-bg border border-aletheia-glass-border rounded-lg text-aletheia-text placeholder-aletheia-text-muted focus:border-aletheia-accent focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Conversation List */}
        {isOpen && (
          <div className="flex-1 overflow-hidden">
            <ConversationList
              searchQuery={searchQuery}
              onConversationSelect={onConversationSelect}
            />
          </div>
        )}

        {/* Collapsed State - Just Icons */}
        {!isOpen && (
          <div className="flex-1 flex flex-col items-center py-4 space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-10 h-10 text-aletheia-text-muted hover:text-aletheia-text hover:bg-aletheia-glass p-0 rounded-lg transition-colors"
              onClick={() => {
                console.log('Creating new conversation...')
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-10 h-10 text-aletheia-text-muted hover:text-aletheia-text hover:bg-aletheia-glass p-0 rounded-lg transition-colors"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Footer */}
        {isOpen && (
          <div className="p-4 border-t border-aletheia-glass-border space-y-3">
            {/* Quick Actions */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-aletheia-text-muted hover:text-aletheia-text hover:bg-aletheia-glass flex items-center gap-2 rounded-lg transition-colors"
              >
                <Archive className="w-4 h-4" />
                <span className="text-sm">Archived</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-aletheia-text-muted hover:text-aletheia-text hover:bg-aletheia-glass p-2 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-aletheia-glass transition-colors cursor-pointer">
              <div className="w-8 h-8 bg-aletheia-accent rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-aletheia-text truncate">User</p>
                <p className="text-xs text-aletheia-text-muted truncate">Free plan</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}