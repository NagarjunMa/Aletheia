# Ascendia Project Overview

## What is Ascendia?

Ascendia is a **Personalized Voice Agent (PVA)** — an AI writing assistant that learns each user's natural writing style and generates polished content while preserving the writer's authentic voice.

## Core Value Proposition

Unlike generic AI writing tools, Ascendia:
1. **Learns your voice** — Tracks writing patterns, vocabulary, formality preferences
2. **Generates dual drafts** — Grammar Fix (minimal changes) + Adaptive Polish (style-enhanced)
3. **Scores quality** — CPL scoring across 5 dimensions (grammar, clarity, style, engagement, vocabulary)
4. **Improves over time** — Feedback loop tunes future outputs to your preferences

## Primary KPI

> **Maximize user approval rate on Adaptive Polish Draft outputs**
> Target: >85% acceptance rate on a rolling 30-day basis

## User Flow

```
Register → Login → Dashboard → Select/Create Conversation →
Type Text → Choose Category → Generate Drafts →
Review Grammar Fix + Adaptive Polish → Accept/Reject →
System learns from feedback → Better future outputs
```

## Content Categories

### Web Application
- **Email** — Professional correspondence
- **Letter** — Personal or formal letters
- **Proposal** — Business proposals, technical documentation
- **Memo** — Internal communications
- **General** — Conversational, social media, other

### Chrome Extension
- **LinkedIn Connection** — Connection request messages (300 char limit)
- **Cold Email** — Apollo-style cold emails (100-150 words)
- **LinkedIn InMail** — InMail messages (80-120 words)

## Tech Stack Summary

- **Frontend**: Next.js 14.2.5, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **State**: Zustand (6 stores) + TanStack React Query (9 hook files)
- **Backend**: Next.js Server Actions (15 files) + API Routes
- **AI**: Anthropic Claude (Haiku for speed, Sonnet for quality), Vercel AI SDK
- **Database**: Supabase PostgreSQL (15 tables, 100% RLS coverage, 20+ indexes)
- **Streaming**: Server-Sent Events (SSE) + WebSocket support
- **Security**: Guardrails system, input shield, compliance auditor, output filter
- **Monitoring**: Production monitor, analytics engine, alerting, health checks
- **Testing**: Vitest (unit/integration) + Playwright (E2E) + guardrails-specific tests
- **Additional**: Sentry error tracking, Pino logging, OpenTelemetry tracing, Resend email

## Architecture Highlights

### 3-Phase Parallel Processing
Reduces response time from 6-7s to 2-3s:
- **Phase 1** (Haiku, parallel): Grammar fix + context fetch + security checks
- **Phase 2** (Sonnet, streaming): Adaptive polish with live UI updates
- **Phase 3** (background): Analytics, embeddings, CPL learning

### Multi-Layer Security
Input Shield → Security Framework → Guardrails Plugins → AI Sanitizer → Compliance Auditor → Process Vault

### Voice Learning Pipeline
Voice Learning Engine → Advanced Voice Learning → Style RAG Engine → Style RAG Integration

### Memory System
Conversation Memory Engine → Thread Siloing → Memory Persistence Manager

## Success Metrics

| Metric | Target |
|--------|--------|
| Draft approval rate | >85% |
| Response time (P95) | <2s |
| Grammar accuracy | >99% |
| API error rate | <1% |
| Cache hit rate | >60% |
| System uptime | 99.9% |