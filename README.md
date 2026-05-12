# Aletheia — AI-Powered LinkedIn Outreach Platform

Generate authentic, human-sounding LinkedIn connection requests, cold emails, and InMails. Aletheia reads a target's LinkedIn profile, combines it with the user's resume and intent, then runs the output through a multi-stage sanitization + AI-fingerprint-stripping pipeline.

**Pipeline:** PR → `ci.yml` (lint + type + test + guardrails + smoke build) → merge to `main` → Vercel auto-deploys.
**License:** MIT

---

## Quick Start

```bash
git clone <repository-url>
cd aletheia
npm ci
cp .env.local.example .env.local   # fill in required values (see below)
npm run dev                         # or: make dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

```
Chrome Extension (MV3)                  Next.js Web App
  background/service-worker.js            app/auth/        ← login, register, OAuth
  content/linkedin-reader.js              app/dashboard/   ← usage stats, recent drafts
  content/auto-filler.js                  app/settings/    ← preferences, voice profile
  popup/popup.html + popup.js             app/profile/
  settings/settings.html
         │ Bearer token                          │ Cookie auth
         ▼                                       ▼
         Next.js Server (Vercel)
           middleware.ts         ← auth refresh, security headers, CSP
           app/api/extension/
             generate/           ← POST  core generation endpoint
             feedback/           ← POST  approval/rejection + style learning
             config/             ← GET   user config for extension
             session/            ← GET   cookie → token bridge
           app/api/auth/me/      ← GET   user info + usage
           app/api/feedback/     ← POST  general feedback
           app/api/health/       ← GET   health check
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
   Supabase  Anthropic  Sentry
   (DB+Auth) (Claude)   (errors)
```

---

## Project Structure

```
aletheia/
├── app/
│   ├── api/
│   │   ├── extension/{generate,feedback,config,session}/
│   │   │   ├── route.ts        ← HTTP handler
│   │   │   ├── schema.ts       ← Zod schema (imported by route + tests)
│   │   │   └── route.test.ts   ← schema + handler tests
│   │   ├── {auth/me,feedback,health}/
│   │   └── settings/
│   ├── auth/{login,register,callback,forgot-password,reset-password}/
│   ├── {dashboard,settings,profile}/
│   └── layout.tsx, page.tsx, providers.tsx
│
├── ascendia-extension/          ← Chrome MV3 extension (separate from web app)
│   ├── background/service-worker.js
│   ├── content/{linkedin-reader.js,auto-filler.js}
│   ├── popup/{popup.html,popup.js,popup.css,popup-core.js}
│   ├── settings/{settings.html,settings.js,settings.css}
│   └── manifest.json
│
├── components/landing/          ← Landing page components
│
├── lib/
│   ├── ai/
│   │   ├── prompts/             ← Category-specific system prompt builders
│   │   ├── sanitizer.ts         ← sanitizeAIOutput() — content + safety filtering
│   │   ├── ai-fingerprint-detector.ts  ← detectAIFingerprints() — 21 patterns
│   │   └── style-analyzer.ts    ← analyzeStyle() + mergeStylePatterns()
│   ├── supabase/{client.ts,server.ts}
│   ├── database/types.ts        ← generated Supabase types
│   ├── logger.ts                ← Pino → stdout (Vercel logs)
│   ├── logger.edge.ts           ← Edge-compatible console logger (middleware only)
│   └── cors.ts
│
├── supabase/migrations/         ← SQL migrations (YYYYMMDD_NNN_description.sql)
├── middleware.ts                 ← auth session refresh + security headers + CSP nonce
├── next.config.js
├── vitest.config.ts
├── vitest.guardrails.config.ts
├── playwright.config.ts
├── Makefile
└── CLAUDE.md                     ← Full code conventions reference
```

---

## Environment Variables

Copy `.env.local.example` to `.env.local`.

### Required

| Variable | Where |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (server-only) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Pino log level |
| `NEXT_PUBLIC_SENTRY_DSN` | — | Sentry client errors |
| `SENTRY_DSN` | — | Sentry server/edge errors |
| `EXTENSION_DAILY_LIMIT` | `30` | Max generation requests per user per day |
| `NEXT_TELEMETRY_DISABLED` | — | Set `1` to opt out of Next.js telemetry |

---

## Development Commands

```bash
make help          # list all targets
make install       # install deps + initialize husky hooks
make setup         # install + env check
make dev           # start dev server on :3000
make build         # production build
make lint          # ESLint
make type-check    # tsc --noEmit
make format        # Prettier write
make test          # unit tests, single run
make guardrails    # guardrail tests (mandatory before lib/ai/ PRs)
make e2e-smoke     # Playwright @smoke tests (local server, no real APIs)
make e2e           # Run all Playwright E2E tests
make ci            # full pipeline: lint → type-check → test → guardrails → build
make test-ext      # extension unit + integration tests
make build-ext     # extension esbuild → ascendia-extension/dist/
make clean         # rm -rf .next coverage node_modules/.cache
```

All targets map 1:1 to `npm run` scripts. See `Makefile`.

---

## AI Pipeline

Every message generated by `POST /api/extension/generate` passes through:

### Stage 1 — Prompt building (the moat)
`lib/ai/prompts/linkedin-connection.ts`
Category-specific system prompts with grounding rules, banned phrase lists (39 LinkedIn, 25 email), no-fabrication enforcement. User inputs escaped via `escapeForXmlTag()` before injection.

### Stage 2 — Claude generation
- Model: `claude-sonnet-4-6`
- Temperature: 0.8
- Max tokens: 600
- Timeout: 30s (returns 504 on exceed)

### Stage 3 — Sanitization
`sanitizeAIOutput()` in `lib/ai/sanitizer.ts`
- HTML tag stripping (regex — AI output is text-only, never rendered as HTML)
- Profanity filtering (5 pattern groups)
- PII redaction: SSN, credit card, email (context-aware — preserved for cold email)
- Injection blocking: `<script>`, `javascript:`, SQL/command patterns
- Hate speech / violence → returns `success: false`

### Stage 4 — AI fingerprint stripping
`detectAIFingerprints()` in `lib/ai/ai-fingerprint-detector.ts`
21 regex patterns (em-dash, "hope this finds you well", corporate buzzwords, formality formulas) rewritten with human equivalents. No scoring — patterns are stripped or not.

### Stage 5 — Style learning (feedback loop)
After user thumbs-up: `analyzeStyle()` + `mergeStylePatterns()` update `user_preferences.style_patterns` via atomic RPC. Next generate request reads style patterns + recent approved messages and injects them as `acceptedExamples` + `styleProfile` into the prompt.

**Category constraints:**

| Category | Format | Limit |
|----------|--------|-------|
| `linkedin_connection` | Plain text | 300 chars |
| `cold_email` | JSON `{ subject, body }` | 150 words |
| `linkedin_inmail` | JSON `{ subject, body }` | 120 words |

---

## Database

**Active tables:**

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data, synced from Supabase Auth |
| `generated_drafts` | All generated messages |
| `user_feedback` | Thumbs-up/down feedback on drafts |
| `user_preferences` | Per-user settings + learned style patterns |
| `extension_rate_limits` | Daily rolling window per user |

**Migrations:** Files in `supabase/migrations/` follow `YYYYMMDD_NNN_description.sql`. Apply via Supabase Dashboard SQL Editor or `supabase db push`.

**Regenerate TypeScript types:**
```bash
npx supabase gen types typescript --linked > lib/database/types.ts
```
Do not hand-edit `lib/database/types.ts`.

**RLS:** Enabled on all tables. Use `createClient()` (anon) for user queries. Only use `createServiceClient()` (service role) for background jobs.

---

## Extension Development

The Chrome extension lives in `ascendia-extension/` — separate codebase.

**Load in Chrome:**
1. `chrome://extensions`
2. Enable "Developer mode" (top right)
3. "Load unpacked" → select `ascendia-extension/`

**Key files:**

| File | Role |
|------|------|
| `background/service-worker.js` | Routes popup messages: generate, auth, logout |
| `background/auth-core.js` | Token lifecycle, session bridge, 20-min proactive refresh |
| `content/linkedin-reader.js` | Reads LinkedIn profile via `innerText` |
| `content/auto-filler.js` | Fills LinkedIn compose box with generated draft |
| `popup/popup.js` | Main UI — triggers generation, captures feedback |
| `popup/popup-core.js` | Pure functions: parsing, payload building, char counts |

**Session bridge:** Extension uses Bearer token. On first use, fetches via `GET /api/extension/session` (cookie auth), stores in `chrome.storage.local`, refreshes via alarm every 20 min.

**Host permissions:** `linkedin.com`, `app.apollo.io`, `localhost:3000`, `*.vercel.app`

Reload extension after any change: `chrome://extensions` → refresh icon on extension card.

---

## Testing

**232 root unit tests + 13 guardrails + 94 extension tests** — all co-located with source.

### Unit tests — `make test`

| Test file | Coverage |
|-----------|----------|
| `lib/ai/*.test.ts` | Sanitizer, fingerprint detector, style analyzer, prompt builder |
| `app/api/**/*.test.ts` | Auth guards, CORS, all route handlers |
| `app/api/extension/generate/route.test.ts` | Schema validation, business logic, error branches |
| `__tests__/helpers/` | Module mocks for Supabase + Anthropic |

### Guardrail tests — `make guardrails`

Mandatory before any PR touching `lib/ai/`. Adversarial sanitizer inputs:
- XSS (`<script>` injection)
- SQL injection (`UNION SELECT`, `DROP TABLE`)
- Command injection (`| rm -rf`)
- PII (SSN, credit card)
- Hate speech / violence (incl. leet-speak obfuscation)

### E2E tests — `make e2e-smoke`

Playwright, Chromium, `@smoke` tag. `e2e/health.spec.ts` + `e2e/ui-smoke.spec.ts`. No real APIs. Safe with dummy env vars.

### Extension tests — `make test-ext`

Run from `ascendia-extension/`. Covers auth core, profile extractor, popup core, and full generate-flow integration with chrome.* API mocks.

### Schemas in `schema.ts`

Each API route has a `schema.ts` sibling exporting the Zod schema. Imported by both `route.ts` and `route.test.ts`. Keeps tests free of Next.js routing constraints (Next.js only allows HTTP method exports from `route.ts`).

```
app/api/extension/generate/
  schema.ts       ← export const generateRequestSchema = z.object(...)
  route.ts        ← import { generateRequestSchema } from './schema'
  route.test.ts   ← import { generateRequestSchema } from './schema'
```

---

## CI/CD & Local Hooks

Single-stage pipeline. PR-gated. Vercel auto-deploys `main` to production.

```
feature/* → PR to main
              └── ci.yml  (PR gate — no real APIs)
                    lint-and-typecheck: ESLint + tsc --noEmit
                    test: 232 unit + 13 guardrail tests
                    smoke-test: next build + curl /api/health

merge to main
              └── Vercel auto-deploys → production
```

**Branch protection on `main`:** require 1 PR approval + all 3 `ci.yml` checks green before merge.

**Required GitHub Secrets:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (build-time)
- `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SENTRY_DSN` (runtime — set in Vercel project env)

**Husky pre-commit:** `eslint --fix`, `prettier --write`, `vitest related --run` against modified files only via lint-staged. Fast — only touches changed files.

---

## Adding a Feature

1. Create `schema.ts` next to the route with your Zod schema (never inline in `route.ts`).
2. Create `route.ts` importing from `schema.ts`.
3. Create `route.test.ts` importing from `schema.ts` — test schema validation + handler logic.
4. For any `lib/ai/` change: update `lib/ai/*.test.ts` and `lib/ai/*.guardrails.test.ts`.
5. Run `make ci` — all checks must pass locally before opening PR.
6. Open PR to `main`.

Full conventions in `CLAUDE.md`.

---

## Security Hardening

28 production-readiness issues resolved across 4 tiers. See `.claude/production-readiness-evaluation.md` for audit trail.

### Tier 1 — Critical Security

| Measure | Implementation | File |
|---------|---------------|------|
| **Fail-closed rate limiting** | Supabase RPC failure = denied. 1-min retry window. | `route.ts` |
| **Claude API timeout** | 30s timeout on `messages.create()`. Explicit `504`. | `route.ts` |
| **Session endpoint rate limit** | In-memory sliding window: 20 req/min/IP. | `session/route.ts` |
| **Prompt injection defense** | `escapeForXmlTag()` on all user inputs. | `linkedin-connection.ts` |

### Tier 2 — Security & Quality

| Measure | Implementation | File |
|---------|---------------|------|
| **Nonce-based CSP** | `'nonce-{nonce}' 'strict-dynamic'` per request via `x-nonce` header. | `middleware.ts`, `layout.tsx` |
| **Anthropic 401 → 502** | Upstream auth failure returns 502 Bad Gateway. | `route.ts` |
| **Context-aware email redaction** | Emails preserved in cold email, redacted on LinkedIn. | `sanitizer.ts` |

### Tier 3 — Hardening

| Measure | Implementation | File |
|---------|---------------|------|
| **CORS** | No `*` for null-origin. Extensions send `chrome-extension://` origin. | `cors.ts` |
| **Zod error details** | 400 responses include `details: [{ field, message }]`. | `route.ts` |
| **Model string constant** | Single `CLAUDE_MODEL` constant. | `route.ts` |
| **Schema input limits** | `profileUrl.max(2048)`, `resume.max(50k)`, `jd.max(20k)`. | `schema.ts` |

### Tier 4 — MVP Right-Sizing (Phase 24)

Removed measurement theater while keeping moat. See `.claude/phase-24-strategic-deletion.md`.
- AI pipeline LoC: 1,688 → 1,097 (-35%)
- Deps removed: 16 packages (zustand, react-query, OTel, Loki, PostHog, DOMPurify, webpack polyfills, pino-pretty)
- CI workflows: 3 → 1
- All moat preserved: prompt grounding, style learning, scraper, fail-closed rate limit, prompt escape, 30s timeout, Zod validation.

---

## Key Conventions

| Rule | Detail |
|------|--------|
| Supabase client | `createClient()` = browser; `createServiceClient()` = server/admin. Never mix. |
| Zod schemas | Always in `schema.ts` — not inline in `route.ts` |
| SDK instantiation | Lazy factory functions only — no module-level instances (breaks Vercel edge cold starts). |
| Style learning / analytics | Fire-and-forget. Never `await` in generate response path. |
| Logging | `createLogger('module')` from `lib/logger.ts`. No `console.log`. Middleware uses `lib/logger.edge.ts`. |
| API errors | Return `{ error: string, code?: string, details?: Array }` with correct HTTP status. |
| Security headers | Via `middleware.ts` only — not ad-hoc in routes. |
| RLS | Never bypass with service role for user-facing queries. |

---

## Monitoring & Health

| System | Trigger | Endpoint / check |
|--------|---------|-----------------|
| **Health check** | Always on | `GET /api/health` |
| **Pino logging** | Always on | JSON to stdout → Vercel function logs |
| **Sentry** | Set `SENTRY_DSN` | Client + server + edge error tracking |

Vercel function logs cover the 10–50 user MVP tier. For higher retention or log query language, add a log aggregator (Axiom, Better Stack, or Grafana Cloud Loki) by extending `lib/logger.ts` with a custom pino stream.
