# Plugin Registry System

## Overview

Ascendia uses an extensible plugin architecture for post-processing and guardrails. Plugins are registered, prioritized, and executed in sequence through a central registry.

## Plugin Registry (`lib/plugins/registry.ts`)

The registry manages plugin lifecycle:
- **Registration** — Plugins register with ID, priority, and phase
- **Execution** — Plugins run in priority order (0 = highest)
- **Error handling** — Plugin failures don't crash the pipeline

## Plugin Phases

| Phase | When | Example Plugins |
|-------|------|----------------|
| `pre-stream` | Before AI generation | Input validation, security checks |
| `post-stream` | After AI generation | Output validation, content safety |
| `background` | After response sent | Analytics, embeddings, learning |

## Plugin Types (`lib/plugins/types.ts`)

```typescript
interface Plugin {
  id: string
  phase: 'pre-stream' | 'post-stream' | 'background'
  priority: number  // 0 = highest
  execute(context: PluginContext): Promise<PluginResult>
}
```

## Implemented Plugins

### Guardrails Plugins (`lib/guardrails/plugins/`)
| Plugin | Priority | Phase | Purpose |
|--------|----------|-------|---------|
| `input-validation` | 0 | pre-stream | Validates user input, detects injection |
| `output-validation` | 10 | post-stream | Validates AI output structure |
| `content-safety` | 20 | post-stream | Filters harmful/inappropriate content |

### Post-Stream Plugins (`lib/plugins/post-stream/`)
Additional post-processing plugins executed after AI generation.

## Integration Points

- **AI Processor** (`lib/ai/processor.ts`) — Calls plugins during processing
- **Guardrails Middleware** (`lib/guardrails/middleware.ts`) — Wraps Vercel AI SDK
- **Background Task Manager** (`lib/ai/background-task-manager.ts`) — Runs background plugins