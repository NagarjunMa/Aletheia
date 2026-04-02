# Aletheia — AI-Powered LinkedIn Outreach Platform

Generate authentic, human-sounding LinkedIn connection requests, cold emails, and InMails. Aletheia reads a target's LinkedIn profile, combines it with the user's resume and intent, then runs the output through a multi-stage sanitization and AI-fingerprint-removal pipeline.

**CI:** lint → test → build, all on push/PR to `main`
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

Open [http://localhost:3000](http://localhost:3000). The app is running when you see the dashboard login.

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
           app/api/health/       ← GET   health check (/healthz alias)
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
   Supabase  Anthropic  PostHog / Sentry
   (DB+Auth) (Claude)   (analytics / errors)
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
│   │   │   └── route.test.ts   ← schema validation tests
│   │   ├── {auth/me,feedback,health}/
│   │   └── settings/
│   ├── auth/{login,register,callback,forgot-password,reset-password}/
│   ├── {dashboard,settings,profile}/
│   └── layout.tsx, page.tsx, providers.tsx
│
├── ascendia-extension/          ← Chrome MV3 extension (separate from web app)
│   ├── background/service-worker.js
│   ├── content/{linkedin-reader.js,auto-filler.js}
│   ├── popup/{popup.html,popup.js,popup.css}
│   ├── settings/{settings.html,settings.js,settings.css}
│   └── manifest.json
│
├── components/landing/          ← Landing page components (Hero, Navbar, Features, Footer)
│
├── lib/
│   ├── ai/
│   │   ├── prompts/             ← Category-specific system prompt builders
│   │   ├── sanitizer.ts         ← sanitizeAIOutput() — HTML/PII/injection filtering
│   │   ├── ai-fingerprint-detector.ts  ← detectAIFingerprints() — 21 patterns, 0–100 score
│   │   └── style-analyzer.ts    ← analyzeStyle() + mergeStylePatterns()
│   ├── supabase/
│   │   ├── client.ts            ← createClient() — browser only
│   │   └── server.ts            ← createClient() + createServiceClient() — server only
│   ├── database/types.ts        ← generated Supabase types (do not hand-edit)
│   ├── logger.ts                ← Pino structured logger
│   └── cors.ts                  ← CORS policy helper
│
├── supabase/migrations/         ← SQL migration files (YYYYMMDD_NNN_description.sql)
├── middleware.ts                 ← Auth session refresh + security headers
├── next.config.js
├── vitest.config.ts              ← Unit test config
├── vitest.guardrails.config.ts   ← Guardrail test config (separate run)
├── playwright.config.ts          ← E2E test config
├── Makefile                      ← Developer command shortcuts
└── CLAUDE.md                     ← Full code conventions reference
```

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the required values.

### Required

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API (keep server-only) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Pino log level |
| `NEXT_PUBLIC_POSTHOG_KEY` | — | Enables PostHog analytics |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://app.posthog.com` | PostHog endpoint |
| `NEXT_PUBLIC_SENTRY_DSN` | — | Enables Sentry (client) |
| `SENTRY_DSN` | — | Enables Sentry (server/edge) |
| `NEXT_TELEMETRY_DISABLED` | — | Set `1` to opt out of Next.js telemetry |

---

## Development Commands

Use `make` (preferred) or `npm run` equivalents.

```bash
make help          # list all targets
make dev           # start dev server on :3000
make build         # production build
make lint          # ESLint
make type-check    # tsc --noEmit
make format        # Prettier write
make test          # unit tests, single run
make guardrails    # guardrail tests (mandatory before lib/ai/ PRs)
make e2e           # Playwright E2E
make ci            # full pipeline: lint → type-check → test → guardrails → build
make clean         # rm -rf .next coverage node_modules/.cache
```

All targets map 1:1 to `npm run` scripts in `package.json`. See `Makefile` for the full list.

---

## AI Pipeline

Every message generated by `POST /api/extension/generate` passes through three stages:

### Stage 1 — Negative lexicon (prompt-level)
`sanitize()` in `lib/ai/prompts/linkedin-connection.ts`
Strips 22 known AI vocabulary fingerprints from the raw Claude output before further processing (e.g., "I'm reaching out", "leverage", "delve into").

### Stage 2 — Content sanitization
`sanitizeAIOutput()` in `lib/ai/sanitizer.ts`
- HTML tag stripping (DOMPurify via `isomorphic-dompurify`)
- Profanity filtering
- PII pattern redaction: SSN (`\d{3}-\d{2}-\d{4}`), credit cards (`\d{16}`), email addresses
- Injection blocking: `<script>`, `javascript:`, `UNION SELECT`, `DROP TABLE`, `| rm -rf`
- Hate speech / violence / illegal activity detection → returns `success: false`

### Stage 3 — AI fingerprint detection
`detectAIFingerprints()` in `lib/ai/ai-fingerprint-detector.ts`
Runs 21 named regex patterns (em-dash usage, "hope this finds you well", corporate buzzwords, etc.) against the sanitized content. Each pattern match reduces the **authenticity score** (0–100). Detected patterns are replaced with human equivalents and returned in `modificationsApplied`.

**Model:** `claude-sonnet-4-6` | **Temperature:** 0.8 | **Max tokens:** 600

**Category constraints:**

| Category | Format | Limit |
|----------|--------|-------|
| `linkedin_connection` | Plain text | 270 chars |
| `cold_email` | JSON `{ subject, body }` | 150 words |
| `linkedin_inmail` | JSON `{ subject, body }` | 120 words |

---

## Database

**Active tables:**

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data, synced from Supabase Auth |
| `generated_drafts` | All generated messages with authenticity scores |
| `user_feedback` | Explicit thumbs-up/down feedback on drafts |
| `user_preferences` | Per-user settings: formality, theme, style patterns |
| `extension_rate_limits` | 30 req/day rolling window per user |

**Migrations:**
Files live in `supabase/migrations/` with the naming convention `YYYYMMDD_NNN_description.sql`.
Apply via the Supabase Dashboard SQL Editor (recommended) or `supabase db push` if your CLI version matches the remote history.

**Regenerate TypeScript types** after a schema change:
```bash
npx supabase gen types typescript \
  --db-url "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" \
  > lib/database/types.ts
```
Do not hand-edit `lib/database/types.ts` — it is fully generated.

**Row-Level Security:** Enabled on all tables. Use `createClient()` (anon key) for user-facing queries. Only use `createServiceClient()` (service role) for background jobs and admin operations.

---

## Extension Development

The Chrome extension lives in `ascendia-extension/` and is a **separate codebase** from the Next.js app.

**Load the extension in Chrome:**
1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" → select `ascendia-extension/`
4. The extension icon appears in your toolbar

**Key files:**

| File | Role |
|------|------|
| `background/service-worker.js` | Handles messages from popup: generate, authenticate, logout, health check |
| `content/linkedin-reader.js` | Reads LinkedIn profile DOM on `/in/*` pages, sends data to service worker |
| `content/auto-filler.js` | Fills the LinkedIn message compose box with the generated draft |
| `popup/popup.js` | Main popup UI — triggers generation, shows authenticity score, captures feedback |
| `settings/settings.js` | Extension settings page (accessible via right-click → Options) |

**Session bridge:**
The extension uses a Bearer token for API calls. On first use it fetches a token via `GET /api/extension/session` (cookie-based auth endpoint), stores it in `chrome.storage.local`, and refreshes via an alarm every 20 minutes.

**Host permissions:** `linkedin.com`, `app.apollo.io`, `localhost:3000`, `*.vercel.app`

After any change to extension files: reload the extension from `chrome://extensions` (click the refresh icon on the extension card).

---

## Testing

**96 tests, all passing.** Test files are co-located with source files.

### Unit tests — `make test`

| Test file | What it covers |
|-----------|---------------|
| `lib/ai/style-analyzer.test.ts` | `analyzeStyle()`, `mergeStylePatterns()` — pure function behaviour |
| `lib/ai/ai-fingerprint-detector.test.ts` | Pattern detection by name, platform scoping, score calculation |
| `lib/ai/sanitizer.test.ts` | `stripSurrogates()`, `sanitizeAIOutput()` — HTML stripping, length limits, fingerprint integration |
| `app/api/extension/feedback/route.test.ts` | `feedbackSchema` — valid payloads, required fields, enum values |
| `app/api/settings/route.test.ts` | `settingsSchema` — optional fields, invalid values |
| `app/api/extension/generate/route.test.ts` | `generateRequestSchema` — profile shape, URL validation, category/intent enums |

### Guardrail tests — `make guardrails`

Must pass before any PR that touches `lib/ai/`. Tests the sanitizer against adversarial inputs:
- XSS (`<script>` injection)
- SQL injection (`UNION SELECT`, `DROP TABLE`)
- Command injection (`| rm -rf`)
- PII patterns (SSN, credit card numbers)
- Hate speech and violence patterns

### E2E tests — `make e2e`

Playwright, Chromium only. Test files go in `e2e/`. Do not call real Anthropic or Supabase APIs — mock them.

### Schemas are in `schema.ts`

Each API route has a `schema.ts` sibling that exports the Zod schema. Import from `schema.ts` in both the route handler and the test file:

```
app/api/extension/generate/
  schema.ts       ← export const generateRequestSchema = z.object(...)
  route.ts        ← import { generateRequestSchema } from './schema'
  route.test.ts   ← import { generateRequestSchema } from './schema'
```

This keeps test files free of Next.js routing constraints (Next.js only permits HTTP method exports from `route.ts`).

---

## CI/CD

GitHub Actions pipeline (`.github/workflows/ci.yml`). Triggers on push or PR to `main`.

```
lint-and-typecheck
  └── ESLint + tsc --noEmit

test  (needs: lint-and-typecheck)
  └── npm run test -- --run         (83 unit tests)
  └── npm run test:guardrails -- --run  (13 guardrail tests)

build  (needs: lint-and-typecheck, test)
  └── next build
```

All three jobs must pass before a PR can merge. TypeScript strict mode is on — type errors block the build.

**Deployment:** Vercel. Merging to `main` triggers an automatic production deploy.

---

## Adding a Feature

1. **Create `schema.ts`** next to the route with your Zod schema (never inline it in `route.ts`).
2. **Create `route.ts`** importing from `schema.ts`.
3. **Create `route.test.ts`** importing from `schema.ts` — test schema validation, not HTTP behaviour.
4. **For any `lib/ai/` change:** update or add a test in `lib/ai/*.test.ts` and `lib/ai/*.guardrails.test.ts`.
5. **Run `make ci`** — all checks must pass locally before opening a PR.
6. **Open a PR to `main`.**

Full conventions are in `CLAUDE.md` at the project root.

---

## Key Conventions

| Rule | Detail |
|------|--------|
| Supabase client selection | `createClient()` = browser; `createServiceClient()` = server/admin. Never mix. |
| Zod schemas | Always in `schema.ts` — not inline in `route.ts` |
| SDK instantiation | Use lazy factory functions (`getAnthropic()`, `getSupabaseService()`). No module-level instances — they break Vercel edge cold starts. |
| Analytics / style learning | Fire-and-forget. Never `await` these in the generate response path. |
| Logging | `createLogger('module-name')` from `lib/logger.ts`. No `console.log`. |
| API errors | Return `{ error: string, code?: string }` with the correct HTTP status. |
| Security headers | Via `middleware.ts` only — not ad-hoc in individual routes. |
| RLS | Never bypass with service role key for user-facing queries. |

---

## Monitoring & Health

| System | Trigger | Endpoint / check |
|--------|---------|-----------------|
| **Health check** | Always on | `GET /api/health` (alias: `/healthz`) |
| **Pino logging** | Always on | JSON in production, pretty in dev |
| **Sentry** | Set `SENTRY_DSN` | Client + server + edge error tracking |
| **PostHog** | Set `NEXT_PUBLIC_POSTHOG_KEY` | Product analytics, feature usage |
