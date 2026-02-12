'use client'

import React, { useRef } from 'react'
import { useChatStore } from '@/lib/stores/chat-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Send } from 'lucide-react'

export function ChatInput() {
  const {
    ui: { inputText, selectedCategory },
    draftGeneration: { isGenerating },
    streaming: { isActive: isStreamingActive },
    setInputText,
    setSelectedCategory,
    generateDraftsWithStreaming,
    generateDrafts,
    clearInput,
    updateMessagePreview,
    stopTyping
  } = useChatStore()

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputText.trim() || isGenerating || isStreamingActive) return

    const input = inputText.trim()
    clearInput()
    stopTyping()

    try {
      // Try streaming first, fallback to non-streaming
      await generateDraftsWithStreaming(input)
    } catch (error) {
      console.error('Failed to generate drafts:', error)
      // Fallback to non-streaming if streaming fails
      try {
        await generateDrafts(input)
      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const handleTextChange = (value: string) => {
    setInputText(value)

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }

    updateMessagePreview(value)
  }

  return (
    <div className="border-t border-aletheia-glass-border bg-aletheia-bg">
      <div className="max-w-3xl mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-aletheia-text-muted min-w-fit">Type:</span>
            <Select value={selectedCategory} onValueChange={(value: any) => setSelectedCategory(value)}>
              <SelectTrigger className="w-48 bg-aletheia-surface border-aletheia-glass-border text-aletheia-text hover:border-aletheia-accent transition-colors">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-aletheia-surface border-aletheia-glass-border">
                <SelectItem value="instagram_post" className="text-aletheia-text hover:bg-aletheia-accent/10 focus:bg-aletheia-accent/20">
                  📱 Instagram Post
                </SelectItem>
                <SelectItem value="linkedin" className="text-aletheia-text hover:bg-aletheia-accent/10 focus:bg-aletheia-accent/20">
                  💼 LinkedIn
                </SelectItem>
                <SelectItem value="medium_article" className="text-aletheia-text hover:bg-aletheia-accent/10 focus:bg-aletheia-accent/20">
                  📝 Medium Article
                </SelectItem>
                <SelectItem value="email" className="text-aletheia-text hover:bg-aletheia-accent/10 focus:bg-aletheia-accent/20">
                  ✉️ Email
                </SelectItem>
                <SelectItem value="conversational" className="text-aletheia-text hover:bg-aletheia-accent/10 focus:bg-aletheia-accent/20">
                  💬 Conversational
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Input Area */}
          <div className="flex gap-3">
            <div className="flex-1">
              <Textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => handleTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Claude..."
                className="min-h-[60px] max-h-32 resize-none bg-aletheia-surface border-aletheia-glass-border text-aletheia-text placeholder-aletheia-text-muted focus:border-aletheia-accent focus:ring-1 focus:ring-aletheia-accent/20 transition-colors rounded-xl"
                disabled={isGenerating || isStreamingActive}
              />
            </div>

            <Button
              type="submit"
              disabled={!inputText.trim() || isGenerating || isStreamingActive}
              className="bg-aletheia-accent hover:bg-aletheia-accent-dark text-white font-medium px-4 transition-colors rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              size="lg"
            >
              {(isGenerating || isStreamingActive) ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>

          {/* Helper Text */}
          <div className="text-xs text-aletheia-text-dim">
            Press Enter to send, Shift+Enter for new line
          </div>
        </form>
      </div>
    </div>
  )
}