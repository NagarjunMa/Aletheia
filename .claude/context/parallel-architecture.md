# Parallel Processing Architecture

## Overview

The parallel orchestrator (`lib/ai/parallel-orchestrator.ts`) implements a 3-phase processing pipeline that reduces response time from ~6-7s to ~2-3s through intelligent task parallelization and model tiering.

## Model Tiering

| Tier | Model | Avg Latency | Cost/1K Tokens | Use Cases |
|------|-------|-------------|----------------|-----------|
| Fast | Claude 3 Haiku | ~500ms | Low | Grammar fix, context retrieval, CPL quick analysis |
| Quality | Claude 3.5 Sonnet | ~2000ms | Medium | Adaptive polish, complex reasoning, voice preservation |

Configuration: `lib/ai/model-selector.ts`

## 3-Phase Execution

### Phase 1: Fast Parallel (Haiku — ~500ms)
All tasks run concurrently via `Promise.all`:
- **Grammar Fix** — Quick error correction using Haiku
- **User Context Retrieval** — Fetch preferences, CPL history, voice profile
- **Security Validation** — Input shield + guardrails checks

### Phase 2: Quality Streaming (Sonnet — ~1500ms)
Depends on Phase 1 results:
- **Adaptive Polish** — Streamed to client in real-time
- Uses user context from Phase 1 to personalize output
- Token buffering on client (100ms flush, 90% fewer re-renders)

### Phase 3: Background Non-blocking
Fire-and-forget tasks that don't block the response:
- **Analytics tracking** — Usage events to Supabase
- **Vector embeddings** — Store content embeddings for similarity search
- **CPL learning updates** — Update user's baseline CPL score

## Performance Targets

| Metric | Before | After | Method |
|--------|--------|-------|--------|
| Total response time | 6-7s | 2-3s | Parallel + model tiering |
| Re-renders/sec | 50-100 | 5-10 | Token buffering (use-token-buffer hook) |
| Memory growth | Linear | Flat | React Virtuoso message virtualization |
| API cost per request | ~$0.009 | ~$0.005 | Haiku for fast ops |

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/ai/parallel-orchestrator.ts` | Main orchestrator (716 lines) |
| `lib/ai/model-selector.ts` | Model tiering logic |
| `lib/ai/background-task-manager.ts` | Background task orchestration |
| `lib/ai/vercel-streaming.ts` | Vercel AI SDK streaming |
| `lib/background/orchestrator.ts` | Background task runner |
| `lib/background/task-orchestrator.ts` | Task lifecycle management |
| `hooks/use-token-buffer.ts` | Client-side token buffering |
| `hooks/use-concurrent-streaming.ts` | Concurrent streaming hook |