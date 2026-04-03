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
| Logging | Pino + pino-pretty | JSON in prod, pretty in dev |
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
  {logger.ts,cors.ts}

middleware.ts          ← auth session refresh + security headers
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

Copy `.env.local.example` → `.env.local` for local dev. Never commit secrets.

**Dev:** `npm run dev` — Pino pretty-print, Next.js fast refresh
**Prod:** Deployed to Vercel. CI runs lint → type-check → build on push to `main`.

---

## Deployment

- **Platform:** Vercel (configured via env vars and `next.config.js`)
- **CI:** GitHub Actions (`.github/workflows/ci.yml`)
  - Triggers: push/PR to `main`
  - Jobs: lint + type-check → build (Node 20.x)
- **Database migrations:** `supabase/migrations/` — apply via Supabase CLI
- **No Docker** — Vercel-native deployment

---

## Dos and Don'ts

### DO
- Use `createClient()` (browser) and `createServiceClient()` (server/admin) — never mix
- Validate all API inputs with Zod at the route boundary
- Use `getLogger(module)` from `lib/logger.ts` for structured logging — no `console.log`
- Use lazy factory functions for SDK clients — avoid module-level instantiation
- Keep sanitizer and fingerprint detector in `lib/ai/` — don't inline AI post-processing in routes
- Use `check_and_increment_rate_limit` RPC for extension rate limiting — don't reimplement
- Return errors with structured JSON `{ error: string, code?: string }` and correct HTTP status
- Add security headers via middleware — don't add them ad hoc in individual routes
- Use Supabase RLS — never bypass it with service role for user-facing operations
- Reference only user-provided data in prompts — never invent metrics, projects, or achievements

### DON'T
- Don't import `lib/supabase/server.ts` in client components
- Don't use `console.log` — use the Pino logger
- Don't skip Zod validation on any API input
- Don't add new Claude API calls without going through the sanitization pipeline
- Don't hardcode model strings — update the single constant in the generate route if model changes
- Don't block the generate response with analytics/style processing — keep it fire-and-forget
- Don't modify the AI fingerprint patterns list without updating the authenticity scoring weights
- Don't commit `.env.local` or any file containing secrets
- Don't bypass RLS using service role key for user queries (only for admin/background jobs)
- Don't add module-level SDK instantiation (breaks Vercel edge cold starts)

---

## Key API Contracts

**POST `/api/extension/generate`** — main generation endpoint
Auth: Bearer token (JWT) | Rate limit: 30 req/day/user (`extension_rate_limits` table)

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
- Run: `npm run test` | `npm run test:coverage`
- Must test: sanitizer logic, fingerprint detector patterns, Zod schema validation, style analyzer
- Mock: Anthropic SDK, Supabase client via MSW
- Do NOT test UI rendering — use Playwright for that

### E2E Tests (Playwright)
- Run: `npm run test:e2e` | `npm run test:e2e:debug`
- Cover: auth flows, extension session handoff, generate endpoint (mocked AI)
- Do NOT call real Anthropic API in E2E

### Guardrails Tests
- Run: `npm run test:guardrails`
- Purpose: validate sanitizer blocks harmful content (injection, hate speech, PII)
- Must pass before any PR that touches `lib/ai/`

### CI Gate
- Lint + `tsc --noEmit` + build must all pass
- `strict: true` in tsconfig — type errors block merge

### Rules
1. Never call real external APIs (Anthropic, Supabase) in automated tests — mock all I/O
2. Keep unit tests fast (< 5s total)
3. Guardrail tests are non-negotiable — never skip or comment out
4. Test sanitizer and fingerprint detector with adversarial inputs
5. Cover rate limit logic for both under-limit and over-limit cases
