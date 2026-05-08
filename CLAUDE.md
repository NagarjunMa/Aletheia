# Aletheia — Claude Code Guide

## Active Work
See `.claude/claude-progress.txt` for the current cleanup and improvement phases with status.
Update that file whenever a phase completes or progress is made.

---

## Project Overview
Aletheia is an AI-powered LinkedIn outreach platform. It generates authentic, human-sounding LinkedIn connection requests, cold emails, and InMails by reading a target's LinkedIn profile, combining it with the user's resume/intent, and running the output through a multi-stage sanitization + AI fingerprint removal pipeline.

**Two surfaces:**
- **Next.js Web App** — auth, dashboard, settings, landing page
- **Chrome Extension (MV3)** — profile scraping, one-click generation, auto-fill

---

## Architecture

```
Chrome Extension (MV3)              Next.js Web App
  └─ Service Worker                   └─ Auth, Dashboard, Settings
  └─ Content Scripts (reader, filler)
  └─ Popup UI
         │ Bearer token                      │ Cookie auth
         ▼                                   ▼
         Next.js Server (Vercel)
           ├─ middleware.ts      — auth refresh, security headers
           ├─ /api/extension/*   — generate, feedback, config, session
           ├─ /api/auth/me       — user info + usage
           ├─ /api/feedback      — general feedback
           └─ /api/health        — health check
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
   Supabase  Anthropic  PostHog/Sentry
   (DB+Auth) (Claude)   (analytics/errors)
```

**Key design patterns:**
- **SSR-first:** App Router, server actions, server components where possible
- **Lazy factory functions:** `getAnthropic()`, `getSupabaseService()` — no module-level instantiation
- **Fire-and-forget analytics:** style learning / feedback processing is async, never blocks response
- **Multi-layer fallback parsing:** JSON → sanitize+retry → regex extraction → raw text
- **Smart truncation:** LinkedIn 270-char limit enforced by last-sentence boundary, not hard cut
- **Fail-closed rate limiting:** if Supabase RPC fails, requests are denied (not allowed) — prevents unlimited API burn during outages
- **Prompt injection defense:** all user inputs escaped via `escapeForXmlTag()` before injection into `<user_input>` tags

**AI Pipeline (core differentiator):**
1. Build prompt from category templates (`/lib/ai/prompts/`)
2. Claude generates (temp 0.8, max 600 tokens)
3. Basic sanitization — unicode stripping, blocked patterns, HTML sanitization, whitespace
4. AI fingerprint detection — 21 patterns scored against 100-point authenticity scale
5. Return sanitized content + authenticity score + detected patterns

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14 (App Router) | SSR, API routes, middleware, Vercel edge |
| UI | React 18, Tailwind CSS, Radix UI, shadcn/ui | Dark mode via class strategy |
| State | Zustand (client), TanStack Query v5 (server) | React Hook Form for forms |
| Validation | Zod | All API inputs validated at boundary |
| Database | Supabase (PostgreSQL + Auth + RLS) | `createClient()` for browser, `createServiceClient()` for admin |
| AI | Anthropic Claude (`claude-sonnet-4-6`) | `@anthropic-ai/sdk` |
| Auth | Supabase Auth SSR | Bearer token (extension), cookies (web) |
| Extension | Chrome Manifest V3 | Service worker, content scripts, popup |
| Logging | Pino + Grafana Cloud Loki | JSON to stdout + HTTP push to Loki; pretty in dev. No pino-loki — custom fetch stream. |
| Analytics | PostHog (optional) | Feature-gated |
| Error Tracking | Sentry | Client + server + edge configs |
| 3D / Animation | Three.js, React Three Fiber, Framer Motion, Lottie | Landing page only |
| Testing | Vitest (unit), Playwright (E2E), MSW (mocking) | |

---

## Project Structure

```
app/
  api/extension/{generate,feedback,config,session}/  ← core API
  api/{auth/me,health,feedback,docs}/
  auth/{login,register,callback,forgot-password,reset-password}/
  {dashboard,profile,settings,docs}/
  layout.tsx, page.tsx, providers.tsx

ascendia-extension/
  background/service-worker.js
  content/{linkedin-reader.js,auto-filler.js}
  popup/    settings/    lib/    manifest.json

components/landing/   ← 16 landing page components

lib/
  ai/{sanitizer.ts,ai-fingerprint-detector.ts,style-analyzer.ts,prompts/}
  supabase/{client.ts,server.ts}
  database/types.ts
  logger.ts            ← Pino logger (Node.js runtime only) — stdout + Grafana Loki via fetch
  logger.edge.ts       ← Edge-compatible console logger — used ONLY by middleware.ts
  cors.ts

middleware.ts          ← auth session refresh + security headers (imports logger.edge.ts)
next.config.js         ← Sentry, CSP, webpack, cache control
supabase/migrations/
```

---

## Environments

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (CORS whitelist) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations (server only) |
| `ANTHROPIC_API_KEY` | Claude API |
| `SENTRY_DSN` | Error tracking |
| `NEXT_PUBLIC_POSTHOG_KEY` | Analytics (optional) |
| `LOKI_HOST` | Grafana Cloud Loki push URL (e.g. `https://logs-prod-036.grafana.net`) |
| `LOKI_USERNAME` | Grafana Cloud numeric user ID |
| `LOKI_PASSWORD` | Grafana Cloud Access Policy token (scope: `logs:write`) |
| `LOG_LEVEL` | Pino log level — `debug` (dev default) / `info` (prod default) |
| `EXTENSION_DAILY_LIMIT` | Max generation requests per user per day (default: 30) |

Copy `.env.local.example` → `.env.local` for local dev. Never commit secrets.

**Dev:** `npm run dev` — Pino pretty-print, Next.js fast refresh
**Prod:** Deployed to Vercel via the `production` branch. `main` is the integration branch — not deployed anywhere.

---

## Deployment

- **Platform:** Vercel. Two projects: `aletheia` (production branch) + `aletheia-staging` (staging branch).
- **Branch → environment mapping:**
  - `main` → no Vercel deployment (integration gate only)
  - `staging` → Vercel staging project (auto-deploys on push)
  - `production` → Vercel production project (auto-deploys on push)
- **Three-stage CD pipeline (fully automated after PR merge):**
  - `ci.yml` — PR gate: lint + type-check + unit tests + guardrails + smoke build (triggers on `pull_request` to `main`)
  - `cd.yml` — post-merge gate: quality checks + mocked E2E (`@smoke`, local server, no real APIs) → fast-forward `staging` branch (triggers on `push` to `main`)
  - `staging.yml` — staging gate: quality checks + real E2E (`@e2e`, real Anthropic, against staging URL) → fast-forward `production` branch (triggers via `workflow_run` on cd.yml success)
- **Pre-commit:** Husky + lint-staged runs `eslint --fix`, `prettier --write`, and `vitest related --run` against modified files only.
- **No PAT needed** — `staging.yml` uses `workflow_run` trigger + `GITHUB_TOKEN` with `contents: write` for the production push.
- **Database migrations:** `supabase/migrations/` — apply via Supabase CLI or SQL Editor
- **No Docker** — Vercel-native deployment

---

## Dos and Don'ts

### DO
- Use `createClient()` (browser) and `createServiceClient()` (server/admin) — never mix
- Validate all API inputs with Zod at the route boundary — use `.trim()` before `.min()` on string fields
- Use `createLogger('module')` from `lib/logger.ts` for structured logging in API routes — no `console.log`
- Use `createLogger('module')` from `lib/logger.edge.ts` in `middleware.ts` — it is Edge Runtime safe
- Use lazy factory functions for SDK clients — validate env vars exist at call time with clear error messages
- Keep sanitizer and fingerprint detector in `lib/ai/` — don't inline AI post-processing in routes
- Use `check_and_increment_rate_limit` RPC for extension rate limiting — don't reimplement
- Return errors with structured JSON `{ error: string, code?: string, details?: Array }` and correct HTTP status — include field-level Zod details on 400s
- Add security headers via middleware — don't add them ad hoc in individual routes
- Use Supabase RLS — never bypass it with service role for user-facing operations
- Reference only user-provided data in prompts — never invent metrics, projects, or achievements
- Use atomic RPCs for concurrent data operations (style merge, counters) — fall back to upsert only if RPC unavailable
- Add `.max()` limits on all Zod string/array fields to prevent memory exhaustion via oversized payloads
- Log full user IDs in telemetry spans (for audit trails) but truncate to 12 chars in log messages (for privacy)
- Write a test for every new feature or non-trivial code change. Co-locate the test file with the source (`sanitizer.test.ts` next to `sanitizer.ts`). Minor fixes (typos, config tweaks, copy changes, dependency bumps) are exempt. For any change touching `lib/ai/`, guardrail tests are mandatory and must pass before merge.

### DON'T
- Don't import `lib/supabase/server.ts` in client components
- Don't import `lib/logger.ts` in `middleware.ts` — it uses Node.js streams which crash the Edge Runtime; use `lib/logger.edge.ts` instead
- Don't use `console.log` — use the Pino logger (`lib/logger.ts`) or edge logger (`lib/logger.edge.ts`)
- Don't skip Zod validation on any API input
- Don't add new Claude API calls without going through the sanitization pipeline
- Don't add new Claude API calls without a timeout — always pass `{ timeout: 30_000 }` as the second arg to `messages.create()`
- Don't hardcode model strings — update the single constant in the generate route if model changes
- Don't block the generate response with analytics/style processing — keep it fire-and-forget
- Don't modify the AI fingerprint patterns list without updating the authenticity scoring weights
- Don't commit `.env.local` or any file containing secrets
- Don't bypass RLS using service role key for user queries (only for admin/background jobs)
- Don't add module-level SDK instantiation (breaks Vercel edge cold starts)
- Don't install pino-loki or any transport that uses Node.js streams — Loki is pushed via native `fetch` in `lib/logger.ts`
- Don't inject user-supplied content into prompt XML tags without escaping — always use `escapeForXmlTag()` from `lib/ai/prompts/linkedin-connection.ts`
- Don't add regex-based HTML sanitization fallbacks — if DOMPurify is unavailable, fail closed (strip content entirely), never pretend regex is safe
- Don't make rate limiting fail-open — if the rate limit check fails, deny the request (fail-closed) to prevent unlimited API spend during outages
- Don't use non-null assertions (`!`) on environment variables — always validate with an explicit check and throw a clear error
- Don't log or expose `SUPABASE_SERVICE_ROLE_KEY` — read once into a local variable, never pass to logger
- Don't silently swallow non-text Claude response blocks — throw explicit errors with content type info
- Don't hardcode magic numbers — use env vars with fallback defaults (e.g. `EXTENSION_DAILY_LIMIT`)
- Don't return Zod 400 errors without field-level details — clients need `details: [{ field, message }]` to debug
- Don't use CORS wildcard `*` for null-origin requests — extensions must send `chrome-extension://` origin

---

## Key API Contracts

**POST `/api/extension/generate`** — main generation endpoint
Auth: Bearer token (JWT) | Rate limit: `EXTENSION_DAILY_LIMIT` req/day/user (default 30, `extension_rate_limits` table)

Request body (Zod-validated):
```typescript
{
  profile: { name, headline, location, about, experiences, recentPosts, skills, profileUrl }
  resume?: string          // max 8000 chars
  jd?: string              // max 4000 chars
  category: 'linkedin_connection' | 'cold_email' | 'linkedin_inmail'
  intent: 'networking' | 'referral' | 'mentorship' | 'job_inquiry'
  acceptedExamples?: string[]  // prior approved messages for style matching
}
```

Response:
```typescript
{
  message: string
  authenticityScore: number   // 0-100
  isAIGenerated: boolean
  modificationsApplied: string[]
}
```

---

## Testing Rules

### Unit Tests (Vitest)
- Files: `*.test.ts` / `*.spec.ts` co-located or in `__tests__/`
- Run: `npm run test` | `npm run test:coverage` (Currently scaling >87% global coverage)
- Must test: sanitizer logic, fingerprint detector patterns, complex route handlers, Zod schema validation
- Mock: Anthropic SDK, Supabase client using isolated `vi.mock()` factory in `__tests__/helpers`
- Do NOT test UI rendering — use Playwright for that

### E2E Tests (Playwright) — two tiers

**Mocked (`@smoke`) — used in cd.yml, safe locally with dummy env vars:**
- `e2e/health.spec.ts` — GET /api/health, no auth (runs in both tiers)
- `e2e/ui-smoke.spec.ts` — landing page + login page load (tagged `@smoke`)
- Run: `make e2e-smoke` or `npx playwright test --grep "@smoke"`
- No real Supabase or Anthropic calls. Dummy env vars are fine.

**Real (`@e2e`) — used in staging.yml only, requires staging secrets:**
- `e2e/generate.spec.ts` — auth via Supabase password grant + real Anthropic call (tagged `@e2e`)
- Run: `make e2e-staging` (set `PLAYWRIGHT_BASE_URL`, `NEXT_PUBLIC_SUPABASE_*`, `STAGING_TEST_USER_*` first)
- Capped at one cold_email call (~$0.01/run). Test user: `test@aletheia-staging.com`.

**Rules:**
- Tag mocked tests `@smoke`, real tests `@e2e`
- Do NOT call real Anthropic API from `@smoke` tests
- `e2e/` is excluded from vitest (add to `vitest.config.ts` exclude list)

### Guardrails Tests
- Run: `npm run test:guardrails` | `make guardrails`
- Purpose: validate sanitizer blocks harmful content (injection, hate speech, PII)
- Must pass before any PR that touches `lib/ai/`

### CI Gate & Local Hooks
- Husky Pre-Commit actively checks styled & modified files via `lint-staged`.
- CI pipeline (`ci.yml`) contains zero external database triggers — pure algorithm validation.
- `strict: true` in tsconfig — type errors block merge

### Rules
1. Never call real external APIs (Anthropic, Supabase) in `@smoke` or unit tests — mock all I/O.
2. Keep unit tests fast (< 5s total)
3. Guardrail tests are non-negotiable — never skip or comment out
4. Test sanitizer and fingerprint detector with adversarial inputs
5. Cover rate limit logic for both under-limit and over-limit cases
6. Write tests before marking any feature complete — test files are part of the definition of done
