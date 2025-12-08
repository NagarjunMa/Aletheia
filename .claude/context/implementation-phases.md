# Ascendia Implementation Phases

## Development Roadmap Overview

This document outlines the 4-phase development approach for Ascendia, designed to deliver a fully functional Personalized Voice Agent (PVA) with incremental value delivery and risk mitigation.

### Timeline Summary
- **Phase 1**: Foundation & Security (Weeks 1-2)
- **Phase 2**: AI Integration Core (Weeks 3-4)
- **Phase 3**: Frontend & UX (Weeks 5-6)
- **Phase 4**: Optimization & Deployment (Week 7+)

## Phase 1: Foundation & Security (Weeks 1-2)

### Objectives
Establish robust, secure foundation with authentication, database, and basic infrastructure.

### Week 1 Tasks

#### Project Initialization
```bash
# Day 1-2: Project Setup
npx create-next-app@14 . --typescript --tailwind --eslint --app
npm install @supabase/supabase-js @supabase/ssr
npm install zod react-hook-form @hookform/resolvers
```

#### Database Schema Implementation
```sql
-- Day 2-3: Core Tables
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  cpl_score DECIMAL(5,2) DEFAULT 0.0,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  context JSONB DEFAULT '{}',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Authentication Setup
```typescript
// Day 4-5: Auth Configuration
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options })
        }
      }
    }
  )
}
```

### Week 2 Tasks

#### Row-Level Security Implementation
```sql
-- Day 6-7: RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can access own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);
```

#### Security Middleware
```typescript
// Day 8-9: Middleware Setup
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const { data: { session } } = await supabase.auth.getSession()

  if (req.nextUrl.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}
```

#### Email Templates
```html
<!-- Day 10: Custom Email Template -->
<div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
  <h1 style="color: #4F46E5;">Welcome to Ascendia!</h1>
  <p>Thank you for joining our personalized writing assistant platform.</p>
  <p>Click below to confirm your email and start improving your writing:</p>
  <a href="{{ .ConfirmationURL }}"
     style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    Confirm Email
  </a>
</div>
```

### Phase 1 Deliverables
- ✅ Next.js 14.x project with TypeScript and Tailwind CSS
- ✅ Supabase project configured with database schema
- ✅ Google OAuth and Email/Password authentication
- ✅ Row-Level Security policies implemented
- ✅ Basic security middleware and session management
- ✅ Custom email verification templates

### Phase 1 Acceptance Criteria
1. Users can register via Google OAuth or Email/Password
2. Email verification process works with custom branding
3. All database tables have proper RLS policies
4. Authentication middleware protects dashboard routes
5. User sessions persist across browser refreshes
6. Database schema supports planned features

---

## Phase 2: AI Integration Core (Weeks 3-4)

### Objectives
Implement core AI functionality with Claude API, streaming responses, and content processing pipeline.

### Week 3 Tasks

#### Anthropic Claude API Setup
```typescript
// Day 11-12: AI Service Implementation
// lib/ai/claude.ts
import { Anthropic } from '@anthropic-ai/sdk'

export class ClaudeService {
  private client: Anthropic

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })
  }

  async generateDrafts(input: string, cplScore: number): Promise<DraftResult> {
    const systemPrompt = this.buildSystemPrompt(cplScore)

    const response = await this.client.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: this.buildUserPrompt(input)
      }]
    })

    return this.parseDualDrafts(response.content[0].text)
  }

  private buildSystemPrompt(cplScore: number): string {
    return `You are Ascendia, a personalized writing assistant.
    User's CPL score: ${cplScore}. Generate TWO versions:
    [DRAFT 1: Grammar Fix Only]: Correct only grammar/spelling errors.
    [DRAFT 2: Adaptive Polish]: Apply CPL-appropriate enhancements.`
  }
}
```

#### Streaming Implementation
```typescript
// Day 13-14: Streaming Server Action
// lib/actions/generate-stream.ts
'use server'

export async function streamDraftGeneration(input: string) {
  const stream = new ReadableStream({
    start(controller) {
      const claude = new ClaudeService()

      claude.streamGeneration(input)
        .on('text', (text) => {
          const sanitized = sanitizeLLMOutput(text)
          controller.enqueue(`data: ${JSON.stringify({ text: sanitized })}\n\n`)
        })
        .on('end', () => {
          controller.close()
        })
        .on('error', (error) => {
          controller.error(error)
        })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

### Week 4 Tasks

#### Content Polish Level (CPL) System
```typescript
// Day 15-16: CPL Calculator
// lib/cpl/calculator.ts
export class CPLCalculator {
  static calculate(content: string, userHistory: string[] = []): number {
    const metrics = {
      lexicalDiversity: this.calculateTTR(content),
      sentenceComplexity: this.calculateSentenceComplexity(content),
      formalityLevel: this.calculateFormality(content),
      coherence: this.calculateCoherence(content)
    }

    const baseScore = (
      metrics.lexicalDiversity * 0.3 +
      metrics.sentenceComplexity * 0.25 +
      metrics.formalityLevel * 0.25 +
      metrics.coherence * 0.2
    ) * 100

    return Math.round(Math.min(100, Math.max(0, baseScore)))
  }

  private static calculateTTR(text: string): number {
    const words = text.toLowerCase().split(/\s+/)
    const uniqueWords = new Set(words)
    return uniqueWords.size / words.length
  }

  private static calculateSentenceComplexity(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const avgLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length

    // Normalize to 0-1 scale (10-30 words = optimal complexity)
    return Math.min(1, Math.max(0, (avgLength - 10) / 20))
  }
}
```

#### Final Sanitation Layer
```typescript
// Day 17-18: Content Sanitization
// lib/sanitization/sanitizer.ts
export class ContentSanitizer {
  static sanitizeLLMOutput(text: string): string {
    // Remove zero-width characters (potential watermarks)
    const zeroWidthRegex = /[\u200B-\u200D\uFEFF\u200E\u200F]/g
    let cleaned = text.replace(zeroWidthRegex, '')

    // Collapse excessive whitespace
    const whitespaceRegex = /\s\s+/g
    cleaned = cleaned.trim().replace(whitespaceRegex, ' ')

    // Remove potential instruction injection
    const injectionPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /system\s*:\s*/gi,
      /<\|system\|>/gi
    ]

    for (const pattern of injectionPatterns) {
      cleaned = cleaned.replace(pattern, '[FILTERED]')
    }

    return cleaned
  }

  static validateUserInput(input: string): ValidationResult {
    if (input.length < 10) {
      return { valid: false, error: 'Input too short (minimum 10 characters)' }
    }

    if (input.length > 5000) {
      return { valid: false, error: 'Input too long (maximum 5000 characters)' }
    }

    return { valid: true }
  }
}
```

### Phase 2 Deliverables
- ✅ Anthropic Claude API integration with error handling
- ✅ Streaming response implementation via Server Actions
- ✅ Content Polish Level (CPL) scoring system
- ✅ Final sanitation layer for AI output cleaning
- ✅ Dual draft generation (Grammar Fix + Adaptive Polish)
- ✅ User input validation and safety measures

### Phase 2 Acceptance Criteria
1. AI generates two distinct drafts for user input
2. Streaming responses work smoothly in browser
3. CPL score accurately reflects content complexity
4. All AI output passes through sanitation layer
5. Server Actions handle errors gracefully
6. API costs stay within projected limits

---

## Phase 3: Frontend & UX (Weeks 5-6)

### Objectives
Build responsive, accessible user interface with real-time streaming components and state management.

### Week 5 Tasks

#### shadcn/ui Setup and Components
```bash
# Day 19-20: Component Library Setup
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input card dialog dropdown-menu
npx shadcn-ui@latest add avatar badge tabs scroll-area separator
```

```typescript
// Component Architecture
// components/ui/streaming-text.tsx
'use client'

interface StreamingTextProps {
  content: string
  isStreaming: boolean
}

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  return (
    <div className="relative">
      <div className="whitespace-pre-wrap">{content}</div>
      {isStreaming && (
        <div className="absolute -right-1 top-0 w-0.5 h-5 bg-primary animate-pulse" />
      )}
    </div>
  )
}
```

#### State Management Implementation
```typescript
// Day 21-22: Zustand Store Setup
// lib/stores/conversation-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ConversationState {
  conversations: Conversation[]
  currentConversation: Conversation | null
  isLoading: boolean
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  setCurrentConversation: (conversation: Conversation) => void
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversation: null,
      isLoading: false,

      addConversation: (conversation) =>
        set((state) => ({
          conversations: [conversation, ...state.conversations]
        })),

      updateConversation: (id, updates) =>
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id ? { ...conv, ...updates } : conv
          )
        })),

      setCurrentConversation: (conversation) =>
        set({ currentConversation: conversation })
    }),
    { name: 'conversation-storage' }
  )
)
```

### Week 6 Tasks

#### Real-Time Streaming UI Components
```typescript
// Day 23-24: Chat Interface
// components/chat/chat-interface.tsx
'use client'

import { useCompletion } from 'ai/react'
import { useState } from 'react'

export function ChatInterface() {
  const [input, setInput] = useState('')
  const [category, setCategory] = useState<Category>('general')

  const { completion, complete, isLoading } = useCompletion({
    api: '/api/chat/stream',
    onFinish: (prompt, completion) => {
      // Save to database via Server Action
      saveDraftAction({ content: completion, category })
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    await complete(input, {
      body: { category }
    })
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2 mb-2">
          <CategorySelect value={category} onChange={setCategory} />
        </div>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your text to improve..."
            className="flex-1 min-h-[100px] p-3 border rounded-md"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </form>

      <div className="flex-1 p-4 space-y-4">
        <DraftDisplay
          content={completion}
          isStreaming={isLoading}
          type="adaptive_polish"
        />
      </div>
    </div>
  )
}
```

#### Responsive Design Implementation
```typescript
// Day 25-26: Layout Components
// components/layout/dashboard-layout.tsx
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="hidden lg:flex lg:w-80 lg:flex-col">
        <ConversationSidebar />
      </div>

      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" className="lg:hidden">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <ConversationSidebar />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b p-4">
          <h1 className="text-2xl font-semibold">Ascendia</h1>
        </header>
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### Phase 3 Deliverables
- ✅ shadcn/ui component library configured
- ✅ Zustand and TanStack Query state management
- ✅ Real-time streaming UI components
- ✅ Responsive dashboard layout
- ✅ Mobile-first design implementation
- ✅ Conversation management interface

### Phase 3 Acceptance Criteria
1. UI renders correctly on mobile, tablet, and desktop
2. Real-time streaming displays smoothly without flickering
3. State management persists across page refreshes
4. All components follow accessibility guidelines
5. Design system is consistent across all pages
6. User interactions feel responsive and intuitive

---

## Phase 4: Optimization & Deployment (Week 7+)

### Objectives
Optimize performance, implement comprehensive testing, and deploy to production with monitoring.

### Week 7 Tasks

#### Performance Optimization
```typescript
// Day 27-28: Bundle Analysis and Optimization
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})

module.exports = withBundleAnalyzer({
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'framer-motion'
    ]
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200]
  }
})

// Component optimization
const ChatInterface = dynamic(() => import('@/components/chat/ChatInterface'), {
  loading: () => <ChatInterfaceSkeleton />,
  ssr: false
})
```

#### Testing Framework Setup
```typescript
// Day 29-30: Vitest Configuration
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})

// Example test
// tests/lib/cpl.test.ts
import { describe, it, expect } from 'vitest'
import { CPLCalculator } from '@/lib/cpl/calculator'

describe('CPL Calculator', () => {
  it('calculates basic CPL score correctly', () => {
    const content = 'This is a simple test sentence for calculation.'
    const score = CPLCalculator.calculate(content)

    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('handles empty content gracefully', () => {
    const score = CPLCalculator.calculate('')
    expect(score).toBe(0)
  })
})
```

### Week 8 Tasks

#### E2E Testing with Playwright
```typescript
// Day 31-32: E2E Test Setup
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('user can sign up and verify email', async ({ page }) => {
    await page.goto('/register')

    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!')
    await page.click('[data-testid="signup-button"]')

    await expect(page.locator('[data-testid="verification-message"]')).toBeVisible()
  })

  test('user can generate draft after login', async ({ page }) => {
    // Login flow
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'user@example.com')
    await page.fill('[data-testid="password-input"]', 'password')
    await page.click('[data-testid="login-button"]')

    // Navigate to dashboard
    await expect(page).toHaveURL('/dashboard')

    // Generate draft
    await page.fill('[data-testid="input-textarea"]', 'Test content for draft generation')
    await page.click('[data-testid="generate-button"]')

    await expect(page.locator('[data-testid="draft-output"]')).toBeVisible()
  })
})
```

#### Deployment Setup
```yaml
# Day 33-34: Deployment Configuration
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

### Phase 4 Deliverables
- ✅ Bundle size optimized and analyzed
- ✅ Comprehensive test suite (unit + E2E)
- ✅ CI/CD pipeline configured
- ✅ Production deployment on Vercel
- ✅ Performance monitoring setup
- ✅ Error tracking and logging

### Phase 4 Acceptance Criteria
1. Lighthouse score >90 for Performance
2. All tests pass in CI/CD pipeline
3. Application deploys successfully to production
4. Error tracking captures and reports issues
5. Performance monitoring shows acceptable metrics
6. User feedback collection system operational

---

## Risk Assessment and Mitigation

### High-Risk Items

#### Technical Risks
1. **Supabase + Next.js 15 Incompatibility**
   - **Risk Level**: High
   - **Impact**: Project delay or architecture change
   - **Mitigation**: Use Next.js 14.x, monitor Supabase v3.0 release
   - **Timeline**: Reassess in Q1 2025

2. **Claude API Rate Limits/Costs**
   - **Risk Level**: Medium
   - **Impact**: User experience degradation or cost overrun
   - **Mitigation**: Implement aggressive caching, usage limits, fallback responses
   - **Monitoring**: Track API costs daily, alert at 80% budget

#### Business Risks
1. **Poor CPL Accuracy**
   - **Risk Level**: High
   - **Impact**: Low user satisfaction and retention
   - **Mitigation**: Extensive testing with diverse user groups, gradual rollout
   - **Success Metric**: >85% user approval on adaptive drafts

2. **Competition from Established Players**
   - **Risk Level**: Medium
   - **Impact**: Market share loss before product maturity
   - **Mitigation**: Focus on unique personalization features, rapid iteration
   - **Strategy**: Build strong user community and feedback loop

### Timeline Risk Mitigation

#### Buffer Strategies
- **20% time buffer** added to each phase for unexpected challenges
- **Parallel development tracks** to reduce dependencies
- **Incremental delivery** allows for early user feedback and course correction
- **Fallback plans** for each critical dependency

#### Dependency Management
```typescript
// Risk: External API failures
const fallbackStrategies = {
  anthropicAPI: 'Use cached similar responses',
  supabaseDB: 'Local storage backup for critical data',
  vercelDeployment: 'Railway.app as backup hosting'
}
```

### Success Metrics Tracking

#### Phase Completion Metrics
Each phase has specific success criteria that must be met before proceeding:

**Phase 1 Success**: 100% test coverage for authentication flows
**Phase 2 Success**: <2 second response time for AI generation
**Phase 3 Success**: >95 Lighthouse accessibility score
**Phase 4 Success**: Zero critical bugs in production monitoring

#### User Acceptance Criteria
- **Week 4**: Internal alpha testing with development team
- **Week 6**: Beta testing with 10-20 external users
- **Week 8**: Public launch with monitoring and feedback collection
- **Week 10**: First user retention analysis and feature iteration

This phased approach ensures systematic, secure development while maintaining flexibility for adjustments based on testing and feedback.