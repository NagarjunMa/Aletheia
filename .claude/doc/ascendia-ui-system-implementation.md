# Ascendia UI System Implementation Plan

## Overview
Complete implementation plan for Ascendia's UI system using shadcn/ui, modern React patterns, and TypeScript. This document provides step-by-step implementation for all remaining components.

## Architecture Summary

### Tech Stack
- **Next.js 14.x**: App Router with Server/Client Components
- **React 18.3**: Modern hooks and patterns
- **TypeScript 5.6+**: Strict typing with advanced types
- **Tailwind CSS v4**: Utility-first styling with custom design tokens
- **shadcn/ui**: Radix UI-based accessible components
- **Framer Motion**: Smooth animations and micro-interactions
- **Zustand**: State management with persistence
- **TanStack Query**: Server state management
- **React Hook Form + Zod**: Form validation

## Completed Components

✅ **Core Setup**
- Next.js App Router structure
- Tailwind CSS configuration with design tokens
- shadcn/ui configuration and core components
- Zustand stores (auth, chat, drafts, preferences)

✅ **Authentication**
- Login/Register forms with validation
- Google OAuth integration
- Password strength indicator
- Error handling and loading states

## Remaining Implementation

### 1. Chat Interface Components

#### ChatInterface Component
```typescript
// components/chat/chat-interface.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '@/lib/stores/chat-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Send, Sparkles, FileText, Mail, FileCheck, ScrollText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DraftDisplay } from '@/components/drafts/draft-display'
import { StreamingText } from '@/components/chat/streaming-text'

export function ChatInterface() {
  const {
    messages,
    inputText,
    selectedCategory,
    isGeneratingDrafts,
    currentDrafts,
    setInputText,
    setSelectedCategory,
    generateDrafts,
    clearInput
  } = useChatStore()

  const [isComposing, setIsComposing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [inputText])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async () => {
    if (!inputText.trim() || isGeneratingDrafts) return

    setIsComposing(true)
    try {
      await generateDrafts(inputText.trim())
      clearInput()
    } finally {
      setIsComposing(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const categoryIcons = {
    email: Mail,
    letter: FileText,
    proposal: FileCheck,
    memo: ScrollText,
    general: Sparkles
  }

  const CategoryIcon = categoryIcons[selectedCategory]

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-4xl mx-auto">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card className={`max-w-[80%] ${message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
              }`}>
                <CardContent className="p-4">
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <p className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Show drafts after generation */}
          {currentDrafts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <DraftDisplay drafts={currentDrafts} />
            </motion.div>
          )}

          {/* Loading indicator */}
          {isGeneratingDrafts && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <Card className="bg-muted">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                    <span className="text-sm">Generating your drafts...</span>
                  </div>
                  <StreamingText />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-background p-4 space-y-4">
        {/* Category Selection */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Category:</span>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList>
              <TabsTrigger value="general" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                General
              </TabsTrigger>
              <TabsTrigger value="email" className="text-xs">
                <Mail className="w-3 h-3 mr-1" />
                Email
              </TabsTrigger>
              <TabsTrigger value="letter" className="text-xs">
                <FileText className="w-3 h-3 mr-1" />
                Letter
              </TabsTrigger>
              <TabsTrigger value="proposal" className="text-xs">
                <FileCheck className="w-3 h-3 mr-1" />
                Proposal
              </TabsTrigger>
              <TabsTrigger value="memo" className="text-xs">
                <ScrollText className="w-3 h-3 mr-1" />
                Memo
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Text Input */}
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Write something you'd like me to improve..."
              className="min-h-[60px] max-h-[200px] resize-none pr-12"
              disabled={isGeneratingDrafts}
            />
            <div className="absolute bottom-2 right-2">
              <CategoryIcon className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!inputText.trim() || isGeneratingDrafts}
            size="lg"
            className="px-6"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to send
        </p>
      </div>
    </div>
  )
}
```

#### StreamingText Component
```typescript
// components/chat/streaming-text.tsx
'use client'

import { useState, useEffect } from 'react'
import { useChatStore } from '@/lib/stores/chat-store'
import { motion } from 'framer-motion'

export function StreamingText() {
  const { streamingContent, isStreaming } = useChatStore()
  const [displayedText, setDisplayedText] = useState('')

  useEffect(() => {
    if (streamingContent) {
      setDisplayedText(streamingContent)
    }
  }, [streamingContent])

  if (!isStreaming && !displayedText) return null

  return (
    <div className="mt-2">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-mono text-sm"
      >
        {displayedText}
        {isStreaming && (
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="ml-1"
          >
            ▊
          </motion.span>
        )}
      </motion.div>
    </div>
  )
}
```

### 2. Dashboard Layout Components

#### DashboardLayout Component
```typescript
// components/layout/dashboard-layout.tsx
'use client'

import { ReactNode } from 'react'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: ReactNode
  className?: string
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const { user, profile } = useAuthStore()

  if (!user) {
    return null // This should be handled by middleware
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64">
        <Header user={user} profile={profile} />
        <main className={cn("pt-16", className)}>
          {children}
        </main>
      </div>
    </div>
  )
}
```

#### Sidebar Component
```typescript
// components/layout/sidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  History,
  Settings,
  FileText,
  TrendingUp,
  Sparkles,
  Menu,
  X
} from 'lucide-react'

const navigation = [
  { name: 'Chat', href: '/dashboard', icon: MessageSquare },
  { name: 'History', href: '/dashboard/history', icon: History },
  { name: 'Analytics', href: '/dashboard/analytics', icon: TrendingUp },
  { name: 'Drafts', href: '/dashboard/drafts', icon: FileText },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="ml-3 text-xl font-bold">Ascendia</h1>
          <Badge variant="secondary" className="ml-auto text-xs">
            Beta
          </Badge>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="text-xs text-muted-foreground">
            <p>© 2024 Ascendia</p>
            <p className="mt-1">Your AI Writing Assistant</p>
          </div>
        </div>
      </div>

      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
```

### 3. Draft Display Components

#### DraftDisplay Component
```typescript
// components/drafts/draft-display.tsx
'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useChatStore, Draft } from '@/lib/stores/chat-store'
import {
  Check,
  X,
  Copy,
  Edit3,
  Zap,
  Sparkles,
  TrendingUp,
  Download
} from 'lucide-react'
import { motion } from 'framer-motion'
import { DraftFeedback } from '@/components/drafts/draft-feedback'

interface DraftDisplayProps {
  drafts: Draft[]
}

export function DraftDisplay({ drafts }: DraftDisplayProps) {
  const [activeTab, setActiveTab] = useState('grammar_fix')
  const { acceptDraft, rejectDraft } = useChatStore()

  const grammarDraft = drafts.find(d => d.type === 'grammar_fix')
  const polishDraft = drafts.find(d => d.type === 'adaptive_polish')

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Your Improved Drafts</CardTitle>
            <div className="flex space-x-2">
              <Badge variant="outline" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Generated
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="grammar_fix" className="flex items-center">
                <Check className="w-4 h-4 mr-2" />
                Grammar Fix
                {grammarDraft && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    CPL {Math.round(grammarDraft.cpl_score)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="adaptive_polish" className="flex items-center">
                <Sparkles className="w-4 h-4 mr-2" />
                Adaptive Polish
                {polishDraft && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    CPL {Math.round(polishDraft.cpl_score)}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {grammarDraft && (
              <TabsContent value="grammar_fix" className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Grammar & Spelling Fixed</h4>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(grammarDraft.content)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {grammarDraft.content}
                  </p>
                </div>
                <DraftFeedback draft={grammarDraft} />
              </TabsContent>
            )}

            {polishDraft && (
              <TabsContent value="adaptive_polish" className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Polished to Match Your Style</h4>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(polishDraft.content)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {polishDraft.content}
                  </p>
                </div>
                <DraftFeedback draft={polishDraft} />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  )
}
```

#### DraftFeedback Component
```typescript
// components/drafts/draft-feedback.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useChatStore, Draft } from '@/lib/stores/chat-store'
import { Check, X, Edit3 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface DraftFeedbackProps {
  draft: Draft
}

export function DraftFeedback({ draft }: DraftFeedbackProps) {
  const [userEdits, setUserEdits] = useState(draft.content)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { acceptDraft, rejectDraft } = useChatStore()

  const handleAccept = async () => {
    setIsSubmitting(true)
    try {
      const edits = userEdits !== draft.content ? userEdits : undefined
      await acceptDraft(draft.id, edits)
    } catch (error) {
      console.error('Failed to accept draft:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    setIsSubmitting(true)
    try {
      await rejectDraft(draft.id)
    } catch (error) {
      console.error('Failed to reject draft:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasEdits = userEdits !== draft.content

  if (draft.is_accepted !== null) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`p-3 rounded-lg border ${
          draft.is_accepted
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}
      >
        <div className="flex items-center space-x-2">
          {draft.is_accepted ? (
            <Check className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {draft.is_accepted ? 'Draft accepted' : 'Draft rejected'}
          </span>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Label htmlFor="user-edits" className="text-sm font-medium">
              Edit the draft if needed:
            </Label>
            <Textarea
              id="user-edits"
              value={userEdits}
              onChange={(e) => setUserEdits(e.target.value)}
              className="min-h-[120px] mt-2"
              placeholder="Make any edits to improve the draft..."
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleAccept}
          disabled={isSubmitting}
          variant={hasEdits ? "secondary" : "default"}
          size="sm"
          className="flex items-center"
        >
          <Check className="w-4 h-4 mr-2" />
          {hasEdits ? 'Accept with Edits' : 'Accept Draft'}
        </Button>

        <Button
          onClick={handleReject}
          disabled={isSubmitting}
          variant="outline"
          size="sm"
          className="flex items-center"
        >
          <X className="w-4 h-4 mr-2" />
          Reject
        </Button>

        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant="ghost"
          size="sm"
          className="flex items-center"
        >
          <Edit3 className="w-4 h-4 mr-2" />
          {isEditing ? 'Cancel Edit' : 'Edit'}
        </Button>
      </div>

      {hasEdits && (
        <p className="text-xs text-muted-foreground">
          Your edits help Ascendia learn your preferences and writing style better.
        </p>
      )}
    </div>
  )
}
```

### 4. TypeScript Types

#### Global Type Definitions
```typescript
// types/global.ts

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  cpl_score: number
  preferences: UserPreferences
  created_at: string
  updated_at: string
  monthly_api_usage: number
  monthly_limit: number
  subscription_status: 'free' | 'pro' | 'enterprise'
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  category: ContentCategory
  context: Record<string, any>
  is_archived: boolean
  created_at: string
  updated_at: string
  last_activity_at: string
}

export interface UserInput {
  id: string
  conversation_id: string
  user_id: string
  raw_text: string
  input_metadata: {
    word_count: number
    character_count: number
    estimated_complexity: number
  }
  created_at: string
}

export interface GeneratedDraft {
  id: string
  user_input_id: string
  conversation_id: string
  user_id: string
  content: string
  draft_type: 'grammar_fix' | 'adaptive_polish'
  cpl_score: number
  is_accepted: boolean | null
  user_edits: string | null
  ai_metadata: {
    model_version: string
    processing_time_ms: number
    confidence_score: number
    improvement_areas: string[]
  }
  created_at: string
  updated_at: string
}

export type ContentCategory = 'email' | 'letter' | 'proposal' | 'memo' | 'general'

export interface CPLMetrics {
  lexicalDiversity: number
  sentenceComplexity: number
  formalityLevel: number
  coherence: number
}

export interface ProcessingContext {
  userCPL: number
  conversationHistory: Message[]
  categoryRules: CategoryRules
  timestamp: Date
  estimatedTokens: number
}

export interface CategoryRules {
  maxLength?: number
  requiredElements?: string[]
  formalityLevel: 'casual' | 'professional' | 'formal'
  toneGuidelines: string[]
}

export interface ValidationResult {
  valid: boolean
  error?: string
  sanitized: string
  statistics?: {
    wordCount: number
    characterCount: number
    sentenceCount: number
  }
}

export interface QualityReport {
  passed: boolean
  issues: string[]
  score: number
  recommendations: string[]
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    requestId: string
    timestamp: string
    processingTime: number
  }
}

export interface DraftGenerationResponse {
  drafts: GeneratedDraft[]
  userInput: UserInput
  processingMetadata: {
    cplAnalysis: CPLMetrics
    improvementSuggestions: string[]
    confidenceScore: number
  }
}

// Form types
export interface LoginFormData {
  email: string
  password: string
}

export interface RegisterFormData {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

export interface ProfileUpdateData {
  full_name?: string
  avatar_url?: string
  preferences?: Partial<UserPreferences>
}

// Error types
export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: Date
}

export interface ValidationError {
  field: string
  message: string
  code: string
}
```

## Installation Dependencies

### Required Packages
```bash
# Core dependencies (already installed)
npm install @anthropic-ai/sdk ai @supabase/supabase-js @supabase/ssr
npm install zustand @tanstack/react-query zod react-hook-form @hookform/resolvers
npm install framer-motion next-themes

# Additional UI dependencies needed
npm install @radix-ui/react-label @radix-ui/react-slot
npm install tailwindcss-animate
npm install @hookform/resolvers
```

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

## Testing Strategy

### Component Testing
```typescript
// tests/components/chat-interface.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatInterface } from '@/components/chat/chat-interface'
import { useChatStore } from '@/lib/stores/chat-store'

// Mock the store
jest.mock('@/lib/stores/chat-store')

describe('ChatInterface', () => {
  it('renders input area correctly', () => {
    render(<ChatInterface />)
    expect(screen.getByPlaceholderText(/write something/i)).toBeInTheDocument()
  })

  it('handles draft generation', async () => {
    const mockGenerateDrafts = jest.fn()
    ;(useChatStore as jest.Mock).mockReturnValue({
      inputText: 'test input',
      generateDrafts: mockGenerateDrafts,
      // ... other store values
    })

    render(<ChatInterface />)
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(mockGenerateDrafts).toHaveBeenCalledWith('test input')
    })
  })
})
```

### E2E Testing
```typescript
// tests/e2e/draft-generation.spec.ts
import { test, expect } from '@playwright/test'

test('complete draft generation flow', async ({ page }) => {
  await page.goto('/dashboard')

  // Login
  await page.fill('[data-testid="email-input"]', 'test@example.com')
  await page.fill('[data-testid="password-input"]', 'password123')
  await page.click('[data-testid="login-button"]')

  // Generate drafts
  await page.fill('[data-testid="chat-input"]', 'Please help me write a professional email.')
  await page.click('[data-testid="send-button"]')

  // Wait for drafts
  await expect(page.locator('[data-testid="draft-display"]')).toBeVisible()
  await expect(page.locator('[data-testid="grammar-fix-tab"]')).toBeVisible()
  await expect(page.locator('[data-testid="adaptive-polish-tab"]')).toBeVisible()
})
```

## Performance Optimizations

### Code Splitting
```typescript
// Dynamic imports for heavy components
const DraftDisplay = dynamic(() => import('@/components/drafts/draft-display'), {
  loading: () => <DraftDisplaySkeleton />,
  ssr: false
})

const AnalyticsChart = dynamic(() => import('@/components/analytics/chart'), {
  loading: () => <ChartSkeleton />
})
```

### Memoization
```typescript
// Memoized expensive components
const MemoizedDraftDisplay = memo(DraftDisplay, (prevProps, nextProps) => {
  return prevProps.drafts.length === nextProps.drafts.length &&
    prevProps.drafts.every((draft, index) =>
      draft.id === nextProps.drafts[index]?.id
    )
})
```

## Accessibility Features

### ARIA Labels and Roles
```typescript
// Proper accessibility attributes
<button
  aria-label="Generate drafts for your text"
  aria-describedby="generation-help"
  role="button"
  disabled={isLoading}
>
  Generate Drafts
</button>

<div id="generation-help" className="sr-only">
  This will create two versions of your text: a grammar-corrected version and one adapted to your writing style
</div>
```

### Keyboard Navigation
```typescript
// Keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit()
    }
    if (e.key === 'Escape') {
      clearInput()
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [])
```

## Mobile Responsiveness

### Responsive Design Patterns
```typescript
// Mobile-first responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div className="col-span-1 md:col-span-2 lg:col-span-1">
    {/* Main content */}
  </div>
  <div className="col-span-1 lg:col-span-2">
    {/* Secondary content */}
  </div>
</div>
```

## Deployment Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] All tests passing
- [ ] Bundle size analysis complete
- [ ] Performance audit complete
- [ ] Accessibility audit complete

### Production Configuration
```typescript
// next.config.js
module.exports = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons']
  },
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com']
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' }
        ]
      }
    ]
  }
}
```

## Next Steps

1. **Complete Component Implementation**: Follow the code examples above to implement all remaining components
2. **API Route Creation**: Create the necessary API routes for draft generation and feedback processing
3. **Database Setup**: Set up Supabase with the schema defined in architecture-decisions.md
4. **Testing Implementation**: Add comprehensive unit and E2E tests
5. **Performance Optimization**: Implement code splitting, memoization, and caching strategies
6. **Security Hardening**: Add rate limiting, CSRF protection, and input validation
7. **Monitoring Setup**: Configure error tracking and performance monitoring
8. **Documentation**: Complete API documentation and user guides

This implementation plan provides a complete foundation for building Ascendia's UI system with modern React patterns, excellent performance, and accessibility compliance.