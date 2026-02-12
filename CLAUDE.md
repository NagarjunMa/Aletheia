# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Ascendia - Personalized Voice Agent

Ascendia is an AI-powered writing assistant that learns and adapts to each user's natural writing style. It generates dual drafts (Grammar Fix + Adaptive Polish) with CPL scoring to preserve authentic voice while ensuring professional quality.

### Core Mission
Maximize user approval rate on Adaptive Polish Draft outputs by preserving individual writing voice while ensuring professional clarity and correctness.

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 14.2.5 |
| Language | TypeScript (strict) | 5.6.2 |
| UI | React | 18.3.1 |
| Styling | Tailwind CSS + shadcn/ui | 3.4.12 |
| State | Zustand | 4.5.5 |
| Data Fetching | TanStack React Query | 5.56.2 |
| AI | Anthropic Claude SDK | 0.24.3 |
| AI SDK | Vercel AI SDK | 3.3.30 |
| Database | Supabase (PostgreSQL + Auth) | 2.45.4 |
| Validation | Zod | 3.25.76 |
| 3D/Animation | Three.js, Framer Motion | 0.182.0, 12.26.2 |
| Testing | Vitest + Playwright | 2.1.1, 1.57.0 |
| Monitoring | Sentry, OpenTelemetry | 10.29.0, 1.9.0 |
| Email | Resend | 6.6.0 |
| Logging | Pino | 8.21.0 |

---

## Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint check
npm run type-check       # TypeScript type checking

# Testing
npm run test             # Run Vitest unit tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:guardrails  # Guardrails-specific tests
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:ui      # Playwright with UI

# Utilities
npm run validate         # Startup validation script
npm run health-check     # Health check script
npm run analyze          # Bundle analyzer
npm run format           # Prettier format
npm run test:supabase    # Test Supabase connection
```

---

## Project Structure

```
ascendia/
├── app/                          # Next.js App Router pages
│   ├── api/                      # API routes
│   │   ├── conversations/        #   Conversation CRUD
│   │   ├── drafts/               #   Draft generation & feedback
│   │   ├── embeddings/           #   Vector embedding endpoints
│   │   ├── health/               #   Health check endpoint
│   │   ├── monitoring/           #   Alerts, dashboard, health, metrics
│   │   ├── stream/               #   SSE streaming (drafts, parallel)
│   │   ├── test-stream/          #   Stream testing endpoint
│   │   └── fix-rls/, verify-db/  #   Database utility endpoints
│   ├── admin/                    # Admin panel pages
│   ├── auth/                     # Login, register, callback, reset-password
│   ├── chat/                     # Chat page
│   ├── dashboard/                # Main dashboard
│   ├── about/, features/, feedback/ # Static/info pages
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Global styles + Tailwind
│
├── components/                   # React components
│   ├── admin/                    #   Admin components
│   ├── auth/                     #   Auth forms (login, register, reset)
│   ├── chat/                     #   Chat UI (interface, input, messages, drafts)
│   ├── landing/                  #   Landing page sections (hero, features, process, etc.)
│   ├── layout/                   #   Layout components (header, footer, nav, sidebar)
│   ├── monitoring/               #   Monitoring dashboard
│   ├── providers/                #   Context providers
│   ├── sidebar/                  #   Sidebar navigation & search
│   ├── themes/                   #   Theme system components
│   ├── ui/                       #   shadcn/ui + custom components (40 files)
│   ├── error-boundary.tsx        #   Error boundary
│   └── sentry-error-boundary.tsx #   Sentry integration
│
├── hooks/                        # Custom React hooks
│   ├── use-concurrent-streaming.ts  # Real-time concurrent streaming
│   ├── use-token-buffer.ts          # Token buffering (90% fewer re-renders)
│   ├── use-style-rag.ts             # Style-based RAG integration
│   ├── use-thread-settings.ts       # Thread/conversation settings
│   ├── use-debounce.ts              # Debounce utility
│   └── use-toast.ts                 # Toast notifications
│
├── lib/                          # Core libraries
│   ├── ai/                       # AI integration layer
│   │   ├── claude.ts             #   Core Claude API wrapper
│   │   ├── claude-service.ts     #   Higher-level Claude service
│   │   ├── parallel-orchestrator.ts # 3-phase parallel processing
│   │   ├── processor.ts          #   AI processing + DB integration
│   │   ├── model-selector.ts     #   Multi-model tiering (Haiku/Sonnet)
│   │   ├── vercel-streaming.ts   #   Vercel AI SDK streaming
│   │   ├── background-task-manager.ts # Background task orchestration
│   │   ├── sanitizer.ts          #   AI output sanitization
│   │   ├── utils.ts              #   Text analysis utilities
│   │   └── prompts/              #   AI prompt templates
│   │
│   ├── cpl/                      # Content Polish Level system
│   │   ├── scoring.ts            #   CPL scoring (5 dimensions, vector integration)
│   │   ├── calculator.ts         #   CPL calculation algorithms
│   │   ├── adaptive-learning.ts  #   User preference learning
│   │   └── README.md             #   CPL system documentation
│   │
│   ├── guardrails/               # AI Guardrails system
│   │   ├── core.ts               #   GuardrailEngine orchestration class
│   │   ├── config.ts             #   Configuration management
│   │   ├── types.ts              #   TypeScript interfaces
│   │   ├── middleware.ts          #   Vercel AI SDK integration
│   │   ├── index.ts              #   Public API exports
│   │   ├── plugins/              #   Validation plugins
│   │   │   ├── input-validation.ts   # Input validation plugin
│   │   │   ├── output-validation.ts  # Output validation plugin
│   │   │   ├── content-safety.ts     # Content safety filtering
│   │   │   └── index.ts              # Plugin exports
│   │   ├── logging/              #   Structured logging (Pino)
│   │   ├── monitoring/           #   OTTL metrics + alerting
│   │   └── __tests__/            #   5 test files (core, middleware, monitoring, plugins, setup)
│   │
│   ├── security/                 # Security framework
│   │   ├── security-framework.ts #   Main security orchestration
│   │   ├── input-shield.ts       #   Input protection layer
│   │   ├── input-validation.ts   #   Input validation rules
│   │   ├── output-filter.ts      #   Output filtering
│   │   ├── enhanced-validation.ts#   Enhanced validation rules
│   │   ├── compliance-auditor.ts #   Compliance checking
│   │   ├── process-vault.ts      #   Process security vault
│   │   └── security-middleware.ts#   Security middleware
│   │
│   ├── monitoring/               # Production monitoring
│   │   ├── production-monitor.ts #   Main production monitor
│   │   ├── analytics-engine.ts   #   Analytics processing
│   │   ├── alerting.ts           #   Alert system
│   │   ├── health-checks.ts      #   Health check system
│   │   ├── collectors.ts         #   Metrics collectors
│   │   ├── dashboard-data-provider.ts # Dashboard data
│   │   ├── performance.ts        #   Performance tracking
│   │   ├── analytics.tsx         #   Analytics React component
│   │   ├── integration.ts        #   Integration layer
│   │   └── index.ts              #   Exports
│   │
│   ├── memory/                   # Conversation memory
│   │   ├── conversation-memory-engine.ts  # Memory engine
│   │   ├── memory-persistence-manager.ts  # Persistence layer
│   │   └── thread-siloing-system.ts       # Thread isolation
│   │
│   ├── voice/                    # Voice learning system
│   │   ├── voice-learning.ts     #   Core voice learning
│   │   ├── advanced-voice-learning.ts # Advanced learning
│   │   ├── style-rag-engine.ts   #   Style-based RAG engine
│   │   └── style-rag-integration.ts #  RAG integration layer
│   │
│   ├── vectors/                  # Vector embeddings
│   │   ├── vector-service.ts     #   Vector operations
│   │   └── embedding-service.ts  #   Embedding generation
│   │
│   ├── plugins/                  # Plugin system
│   │   ├── registry.ts           #   Plugin registry
│   │   ├── types.ts              #   Plugin interfaces
│   │   └── post-stream/          #   Post-stream plugins
│   │
│   ├── stores/                   # Zustand state management
│   │   ├── chat-store.ts         #   Main chat state (messages, drafts, streaming, UI)
│   │   ├── streaming-store.ts    #   Streaming session management
│   │   ├── content-store.ts      #   Content state
│   │   ├── draft-store.ts        #   Draft management state
│   │   ├── auth-store.ts         #   Authentication state
│   │   ├── preferences-store.ts  #   User preferences state
│   │   ├── index.ts              #   Store exports
│   │   └── README.md             #   Store documentation
│   │
│   ├── actions/                  # Server Actions (15 files)
│   │   ├── auth.ts, profile.ts   #   Auth & profile actions
│   │   ├── conversations.ts      #   Conversation CRUD
│   │   ├── generate-draft.ts, dual-drafts.ts # Draft generation
│   │   ├── streaming.ts, stream-response.ts  # Streaming
│   │   ├── cpl.ts, voice-learning.ts         # CPL & voice
│   │   ├── ai.ts, inputs.ts                  # AI & input processing
│   │   └── email-actions.ts, utils.ts        # Email & utilities
│   │
│   ├── streaming/                # Streaming infrastructure
│   │   ├── server.ts             #   Server-side streaming
│   │   ├── client.ts             #   Client-side streaming
│   │   ├── websocket.ts          #   WebSocket support
│   │   └── README.md             #   Streaming docs
│   │
│   ├── drafts/                   # Draft management
│   │   ├── dual-generation.ts    #   Parallel dual draft generation
│   │   └── dual-draft-manager.ts #   Draft lifecycle management
│   │
│   ├── background/               # Background task system
│   │   ├── orchestrator.ts       #   Task orchestration
│   │   ├── task-orchestrator.ts  #   Detailed task management
│   │   └── middleware.ts         #   Background middleware
│   │
│   ├── supabase/                 # Database clients (5 files)
│   ├── database/                 # DB types & schemas
│   ├── email/                    # Email system (7 files)
│   ├── config/                   # App configuration
│   ├── validations/              # Zod validation schemas
│   └── query/                    # React Query hooks (9 files)
│
├── ascendia-extension/           # Browser extension scaffold
│   ├── manifest.json             #   Chrome extension manifest
│   ├── background/               #   Service worker
│   ├── content/                  #   Content scripts
│   ├── popup/                    #   Extension popup
│   ├── settings/                 #   Extension settings
│   └── icons/                    #   Extension icons
│
├── tests/                        # Test suite
│   ├── e2e/                      #   Playwright E2E (5 tests)
│   ├── integration/              #   Integration tests (4 tests)
│   ├── unit/                     #   Unit tests
│   ├── security/                 #   Security tests
│   ├── mocks/                    #   Test mocks (4 files)
│   ├── fixtures/                 #   Test fixtures
│   └── utils/                    #   Test utilities (5 files)
│
├── database/                     # SQL migrations (4 files)
├── scripts/                      # Utility scripts (4 files)
├── middleware.ts                  # Next.js route middleware
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind configuration
└── vitest.config.ts              # Vitest configuration
```

---

## Architecture

### Processing Pipeline (3-Phase Parallel Orchestration)

```
User Input → Security Validation → Parallel Processing → Output

Phase 1: Fast Parallel (Claude Haiku, ~500ms)
  ├── Grammar Fix
  ├── User Context Fetch
  └── Security Checks

Phase 2: Quality Streaming (Claude Sonnet, ~1500ms)
  └── Adaptive Polish (streamed to client)

Phase 3: Background Non-blocking
  ├── Analytics & Usage Tracking
  ├── Vector Embeddings
  └── CPL Learning Updates
```

### CPL Scoring (5 Dimensions)

| Dimension | Weight | Measures |
|-----------|--------|----------|
| Grammar & Mechanics | 20% | Spelling, punctuation, syntax |
| Clarity & Structure | 25% | Organization, flow, coherence |
| Style & Voice | 20% | Tone, audience appropriateness |
| Engagement & Impact | 20% | Memorability, persuasiveness |
| Vocabulary | 15% | Word choice, variety, precision |

Score range: 1-100. Benchmarks defined per user type (student, professional, writer, general).

### State Management (Zustand)

The chat store uses 4-layer separation:
- **conversation**: Current conversation, messages, metadata
- **draftGeneration**: Current drafts, streaming drafts, progress
- **streaming**: SSE connection, status, content buffer
- **ui**: Loading states, input text, category, errors

### Security Architecture

Multi-layer security pipeline:
1. **Input Shield** → Prompt injection detection, content validation
2. **Security Framework** → Orchestrates all security checks
3. **Guardrails Plugins** → Input validation, output validation, content safety
4. **AI Sanitizer** → Output cleaning (HTML, profanity, harmful patterns, PII)
5. **Compliance Auditor** → Regulatory compliance verification
6. **Process Vault** → Secure process management

### Guardrails System

Fully implemented with:
- **Core engine** → Plugin-based validation pipeline
- **4 plugins**: input-validation, output-validation, content-safety, index
- **Middleware** → Vercel AI SDK integration
- **Monitoring** → Metrics collection and alerting
- **Logging** → Pino structured logging
- **5 test files** → Core, middleware, monitoring, plugins, setup

### Voice Learning & Style RAG

- **Voice Learning Engine** → Analyzes user writing patterns
- **Advanced Voice Learning** → Deep pattern recognition
- **Style RAG Engine** → Retrieval-Augmented Generation for style matching
- **Style RAG Integration** → Connects RAG to draft generation pipeline
- **`use-style-rag` hook** → React hook for frontend integration

### Memory System

- **Conversation Memory Engine** → Context retention across conversations
- **Thread Siloing** → Conversation isolation for privacy
- **Memory Persistence Manager** → Durable storage of learned patterns

---

## Key Patterns

### Server Actions (preferred over API routes)
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function myAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // ... validated logic
}
```

### Streaming (SSE)
```typescript
// Server: ReadableStream with text/event-stream
// Client: EventSource or fetch with ReadableStream reader
// Token buffering via use-token-buffer hook (100ms flush interval)
```

### Database (Supabase + RLS)
- All tables have Row-Level Security (RLS) policies
- Users can only access their own data
- Service role key used only in server-side code
- 15 core tables + 3 thread system tables
- 20+ strategic performance indexes

---

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=

# Optional
OPENAI_API_KEY=
RESEND_API_KEY=
REDIS_URL=
SENTRY_DSN=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

---

## Development Guidelines

- **TypeScript strict mode** — no `any` without justification
- **Server Components by default** — `'use client'` only when needed
- **Zod validation on all inputs** — server actions and API routes
- **Error boundaries** — wrap route segments
- **Loading states** — proper UX feedback throughout
- **RLS on all tables** — never expose data without auth
- **Never expose API keys** — use Server Actions/API routes
- **React 18 concurrent features** — `useDeferredValue`, `useTransition`
- **Bundle optimization** — dynamic imports for heavy components