# Performance Optimization

## Implemented Optimizations

### 1. Token Buffering (90% fewer re-renders)
- **Hook**: `hooks/use-token-buffer.ts`
- **Mechanism**: Buffers incoming stream tokens, flushes every 100ms
- **Before**: 50-100 state updates/sec → **After**: 5-10 updates/sec
- **Impact**: Smooth streaming UI, reduced CPU from React reconciliation

### 2. Model Tiering (60% latency reduction)
- **File**: `lib/ai/model-selector.ts`
- **Haiku** for grammar fix, context retrieval (~500ms)
- **Sonnet** for adaptive polish, complex reasoning (~2000ms)
- **Combined**: 6-7s → 2-3s total response time

### 3. Parallel Processing
- **File**: `lib/ai/parallel-orchestrator.ts`
- Phase 1 tasks run concurrently (grammar + context + security)
- Phase 3 tasks are fire-and-forget (analytics, embeddings, learning)
- Only Phase 2 (quality polish) is sequential

### 4. Background Task Orchestration
- **Files**: `lib/ai/background-task-manager.ts`, `lib/background/orchestrator.ts`
- Non-blocking database operations after response sent
- Analytics, embedding generation, CPL updates run in background

### 5. Message Virtualization
- **Dependency**: `react-virtuoso` (v4.18.1)
- Only renders visible messages in chat
- Flat memory usage regardless of conversation length

### 6. Concurrent React Features
- `useDeferredValue` for non-urgent rendering
- `useTransition` for smooth state transitions
- `useRef` for render counting (avoids re-render loops)

### 7. Sanitization Caching
- **File**: `lib/ai/sanitizer.ts`
- Content hash → cached sanitization results
- 5-minute TTL, auto-cleanup of stale entries

### 8. Strategic Database Indexes
- 20+ indexes on frequently queried columns
- `user_id`, `conversation_id`, `created_at` indexed on all tables
- CPL score indexed for leaderboard/analytics queries

## Performance Monitoring

| File | Purpose |
|------|---------|
| `lib/monitoring/performance.ts` | Performance tracking |
| `lib/monitoring/collectors.ts` | Metrics collection |
| `lib/monitoring/health-checks.ts` | System health monitoring |
| `/api/monitoring/metrics/` | Metrics API endpoint |
| `/api/monitoring/health/` | Health check endpoint |

## Bundle Optimization
- Dynamic imports for Three.js components (landing page only)
- Code splitting per route (Next.js automatic)
- `@next/bundle-analyzer` available via `npm run analyze`
- Target: <250KB initial JavaScript bundle