# Architecture Decisions

## Key Technology Choices

### Next.js 14.x over 15.x
- **Reason**: Supabase SSR compatibility issues with Next.js 15.x
- **Impact**: Stable auth middleware and server components
- **Status**: Locked at 14.2.5

### Server-Sent Events over WebSocket (primary)
- **Reason**: Simpler implementation, better reliability for unidirectional streaming
- **Impact**: Draft generation streams tokens via SSE; WebSocket available as secondary
- **Status**: Both SSE (`lib/streaming/server.ts`) and WebSocket (`lib/streaming/websocket.ts`) implemented

### Supabase over Firebase/Custom Backend
- **Reason**: PostgreSQL + Auth + RLS + realtime in one platform
- **Impact**: 15 tables, 100% RLS coverage, 20+ indexes, MCP integration
- **Status**: Production-ready

### Server Actions over API Routes (primary)
- **Reason**: Better type safety, integrated with App Router, automatic bundling
- **Impact**: 15 server action files in `lib/actions/`; API routes used for streaming/webhooks
- **Status**: Dual approach — actions for mutations, routes for streaming/external

### Claude Haiku + Sonnet (Model Tiering)
- **Reason**: Haiku for fast/cheap operations, Sonnet for quality
- **Impact**: ~60% latency reduction, ~44% cost reduction
- **File**: `lib/ai/model-selector.ts`, `lib/ai/parallel-orchestrator.ts`

### Zustand over Redux/Context
- **Reason**: Minimal boilerplate, excellent TypeScript support, separation of concerns
- **Impact**: 6 stores with clear domain separation (chat, streaming, content, draft, auth, preferences)
- **File**: `lib/stores/`

### Plugin Architecture for Guardrails
- **Reason**: Extensibility, testability, separation of concerns
- **Impact**: 4 plugins (input-validation, output-validation, content-safety, index)
- **File**: `lib/guardrails/plugins/`, `lib/plugins/registry.ts`

---

## Architecture Patterns

### State Separation (4-Layer Chat Store)
```
conversation → Business logic (messages, current conversation)
draftGeneration → AI processing (drafts, streaming drafts, progress)
streaming → SSE connection state (active, content, status)
ui → Interface state (loading, input, category, errors)
```

### Processing Pipeline
```
Input → Validation → Security → Context → AI Generation → Sanitization → Output
                                    ↓
                            Parallel Orchestrator
                            ├── Phase 1: Fast (Haiku)
                            ├── Phase 2: Quality (Sonnet)
                            └── Phase 3: Background
```

### Security Pipeline
```
Client Input → Input Shield → Security Framework → Guardrails → AI Processing →
Output Filter → Compliance Check → Sanitizer → Client
```

### Token Buffering Pattern
```
Stream tokens → Buffer (accumulate) → Flush every 100ms → Update UI
Result: 90% fewer re-renders (50-100/sec → 5-10/sec)
```

---

## Database Design Decisions

### RLS-First Approach
- Every table has `user_id` column with RLS policy
- Service role key only used server-side
- No public access without authentication

### Embedding Storage
- User embeddings stored in `user_embeddings` table
- Vector similarity search for style matching
- CPL analysis history tracked with embeddings

### Thread Siloing
- Conversations are isolated (no cross-user access)
- Memory system respects conversation boundaries
- Thread settings per conversation

---

## Testing Strategy

### Test Pyramid
- **Unit tests** (Vitest): Core logic, CPL calculation, sanitization
- **Integration tests**: Store interactions, API pipeline
- **E2E tests** (Playwright): Full user flows
- **Guardrails tests**: Dedicated test config (`vitest.guardrails.config.ts`)
- **Security tests**: Injection detection, bypass attempts

### Mock Strategy
- MSW for API mocking in integration tests
- Custom fixtures for database responses
- Separate test setup files per domain