# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Ascendia - Personalized Voice Agent

Ascendia is an advanced AI writing assistant that acts as a Personalized Voice Agent (PVA), learning and adapting to users' natural writing styles while providing grammatically correct, polished content without losing the original human voice.

### Core Mission
Maximize user approval rate on Adaptive Polish Draft outputs by preserving individual writing voice while ensuring professional clarity and correctness.

## Tech Stack & Architecture

### Core Technologies
- **Frontend**: Next.js 14.x (App Router), React 18.3, TypeScript 5.6+
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Backend**: Next.js Server Actions, Supabase (PostgreSQL + Auth)
- **AI**: Anthropic Claude API with Vercel AI SDK for streaming
- **State**: Zustand + TanStack Query
- **Testing**: Vitest, Playwright
- **Deployment**: Vercel (primary), Railway (scaling)

### Architecture Decisions
- **Next.js 14.x over 15.x**: Supabase compatibility issues with 15.x
- **Vercel AI SDK over LangChain**: Better bundle size, simpler Next.js integration
- **Supabase over alternatives**: Cost-effective, full-stack capabilities
- **Server Actions over API routes**: Better type safety, integrated with App Router

## Commands

### Development Setup
```bash
# Initialize project
npx create-next-app@14 . --typescript --tailwind --eslint --app

# Install dependencies
npm install @anthropic-ai/sdk ai @supabase/supabase-js @supabase/ssr
npm install @radix-ui/react-* lucide-react class-variance-authority clsx tailwind-merge
npm install zustand @tanstack/react-query zod react-hook-form @hookform/resolvers

# Install shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input card dialog dropdown-menu avatar badge tabs

# Development
npm run dev

# Build and test
npm run build
npm run test
npm run test:e2e
```

### Database Commands
```bash
# Supabase local development
npx supabase start
npx supabase db reset
npx supabase db push
```

## Key Implementation Patterns

### Server Actions Pattern
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const schema = z.object({
  content: z.string().min(1).max(5000),
  type: z.enum(['email', 'letter', 'proposal'])
})

export async function generateDraft(formData: FormData) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const validatedData = schema.parse({
      content: formData.get('content'),
      type: formData.get('type')
    })

    // AI processing logic here

    revalidatePath('/dashboard')
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

### Streaming Implementation
```typescript
// Server Action for streaming
export async function streamResponse(prompt: string) {
  const stream = new ReadableStream({
    start(controller) {
      anthropic.messages.stream({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      }).on('text', (text) => {
        controller.enqueue(`data: ${JSON.stringify({ text })}\n\n`)
      }).on('end', () => {
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  })
}

// Client component
const { completion, complete } = useCompletion({
  api: '/api/stream'
})
```

### Content Polish Level (CPL) Scoring
```typescript
export function calculateCPL(content: string, userHistory: string[]): number {
  const metrics = {
    lexicalDiversity: calculateTTR(content),
    sentenceComplexity: averageSentenceLength(content),
    formalityLevel: calculateFormality(content),
    coherence: calculateCoherence(content)
  }

  const userBaseline = calculateUserBaseline(userHistory)
  const adaptiveScore = adaptToUserStyle(metrics, userBaseline)

  return Math.min(100, Math.max(0, adaptiveScore))
}

function calculateTTR(text: string): number {
  const words = text.toLowerCase().split(/\s+/)
  const uniqueWords = new Set(words)
  return (uniqueWords.size / words.length) * 100
}
```

### Final Sanitation Layer
```typescript
export function sanitizeLLMOutput(text: string): string {
  // Strip zero-width characters (potential watermarks)
  const zeroWidthRegex = /[\u200B-\u200D\uFEFF\u200E\u200F]/g
  let cleanText = text.replace(zeroWidthRegex, '')

  // Collapse excessive whitespace
  const whitespaceRegex = /\s\s+/g
  cleanText = cleanText.trim().replace(whitespaceRegex, ' ')

  return cleanText
}
```

## Database Schema

### Core Tables
```sql
-- Profiles (linked to auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  cpl_score DECIMAL(5,2) DEFAULT 0.0,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Inputs (raw text for learning)
CREATE TABLE user_inputs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  raw_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated Drafts
CREATE TABLE generated_drafts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_input_id UUID REFERENCES user_inputs(id) NOT NULL,
  conversation_id UUID REFERENCES conversations(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  draft_type TEXT CHECK (draft_type IN ('grammar_fix', 'adaptive_polish')),
  cpl_score DECIMAL(5,2),
  is_accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row-Level Security
```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_drafts ENABLE ROW LEVEL SECURITY;

-- Policies (users can only access their own data)
CREATE POLICY "Users can access own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can access own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);
```

## Security Requirements

### Authentication
- Google OAuth via Supabase Auth
- Email/Password with email verification
- Custom welcome email template
- Session management with automatic refresh

### API Security
- Server Actions for all AI calls (protect API keys)
- Zod validation on all inputs
- Rate limiting (Redis-based)
- Anti-prompt injection protection

### Content Security
```typescript
export function validateInput(input: string): { isValid: boolean; reason?: string } {
  const dangerousPatterns = [
    /ignore\s+previous\s+instructions/i,
    /system\s*:\s*/i,
    /assistant\s*:\s*/i
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      return { isValid: false, reason: 'Potentially dangerous content detected' }
    }
  }

  return { isValid: true }
}
```

## Performance Guidelines

### Bundle Optimization
- Use dynamic imports for heavy components
- Optimize images with Next.js Image component
- Implement code splitting per route
- Target <250KB initial JavaScript bundle

### Caching Strategy
- Redis for complex caching (user preferences, CPL scores)
- In-memory caching for simple data
- Next.js cache for API responses
- CDN caching for static assets

### Database Optimization
- Proper indexing on user_id and created_at columns
- Connection pooling via Supabase
- Efficient RLS policies
- Regular VACUUM and ANALYZE

## Testing Strategy

### Unit Tests (Vitest)
```typescript
import { describe, it, expect } from 'vitest'
import { calculateCPL } from '@/lib/cpl'

describe('CPL Calculation', () => {
  it('should calculate basic CPL score', () => {
    const content = 'This is a test sentence.'
    const score = calculateCPL(content, [])
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
```

### E2E Tests (Playwright)
```typescript
import { test, expect } from '@playwright/test'

test('user can generate draft', async ({ page }) => {
  await page.goto('/dashboard')
  await page.fill('[data-testid="input-text"]', 'Test content')
  await page.click('[data-testid="generate-button"]')
  await expect(page.locator('[data-testid="draft-output"]')).toBeVisible()
})
```

## Deployment

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=

# Security
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Cache
REDIS_URL=
```

### Build Commands
```bash
npm run build
npm run start
```

## Common Patterns

### Error Handling
```typescript
try {
  const result = await riskyOperation()
  return { success: true, data: result }
} catch (error) {
  console.error('Operation failed:', error)
  return { success: false, error: 'Operation failed' }
}
```

### Form Handling
```typescript
'use client'
import { useFormState } from 'react-dom'

export function MyForm() {
  const [state, formAction] = useFormState(serverAction, null)

  return (
    <form action={formAction}>
      <input name="content" required />
      <button type="submit">Submit</button>
      {state?.error && <p className="text-red-500">{state.error}</p>}
    </form>
  )
}
```

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Implement proper error boundaries
- Follow Next.js App Router patterns
- Use Server Components by default
- Client Components only when necessary

### Security First
- Never expose API keys to client
- Validate all user inputs with Zod
- Implement proper RLS policies
- Use HTTPS everywhere
- Regular security audits

### Performance First
- Optimize for Core Web Vitals
- Use React.memo() for expensive components
- Implement proper loading states
- Minimize client-side JavaScript
- Monitor bundle size regularly

This documentation serves as the foundation for building Ascendia. Follow these patterns and guidelines to ensure consistency, security, and performance across the application.