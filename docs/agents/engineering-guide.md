# Aletheia — Engineering Guide

## Active Work

ALE-53 refund operations: see `docs/operations/ale-53-implementation.md` for the active execution context and `docs/operations/refund-review.md` for operator boundaries. Queue/admin and opt-in email delivery are implemented locally; delivery defaults disabled and rollout remains pending.

See `docs/progress.txt` for the current implementation and decision log.
Update that file whenever a phase completes or progress is made.

---

## Project Overview

Aletheia helps professionals draft LinkedIn connection notes, networking emails, follow-ups, and role-fit replies from context they choose. Users review and edit every draft before sending. The app combines selected profile or opportunity context with the user's resume/intent and runs the output through a multi-stage sanitization + AI fingerprint removal pipeline.

**Two surfaces:**

- **Next.js Web App** — auth, dashboard, settings, landing page
- **Chrome Extension (MV3)** — selected page context, one-click draft generation, auto-fill

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
           ├─ proxy.ts           — auth refresh, security headers
           ├─ /api/extension/*   — generate, feedback, config, session
           ├─ /api/auth/me       — user info + usage
           ├─ /api/feedback      — general feedback
           └─ /api/health        — health check
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
   Supabase  Anthropic  Sentry
   (DB+Auth) (Claude)   (errors)
```

**Key design patterns:**

- **SSR-first:** App Router, server actions, server components where possible
- **Lazy factory functions:** `getAnthropic()`, `getSupabaseService()` — no module-level instantiation
- **Hybrid feedback persistence:** `POST /api/extension/feedback` synchronously inserts the `user_feedback` row (eval signal must not be lost on worker crash), then returns 200 and runs style merge fire-and-forget
- **Single-pass parsing:** JSON → on failure, 502 with retry instruction. No regex extraction layer.
- **Connection composition:** LinkedIn notes use a shared 300-character budget, enforced after sanitation and whitespace normalization. Never truncate a note or drop its CTA/relevance; unusable output fails with compensation.
- **Fail-closed rate limiting:** if Supabase RPC fails, requests are denied (not allowed) — prevents unlimited API burn during outages
- **Prompt injection defense:** all user inputs escaped via `escapeForXmlTag()` before injection into `<user_input>` tags

**AI Pipeline (core differentiator):**

1. Build prompt from category templates (`/lib/ai/prompts/`) — grounded, banned-phrase enforced
2. Claude generates (temp 0.8, max 600 tokens, 30s timeout)
3. Sanitization — unicode strip, blocked patterns, HTML tag strip, profanity, email redaction
4. AI fingerprint stripping — 21 patterns rewritten (em-dash, buzzwords, formality formulas)
5. Style learning — approved messages feed back into prompt as `acceptedExamples` + `styleProfile`

---

## Tech Stack

| Layer             | Technology                                  | Notes                                                                                                 |
| ----------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Framework         | Next.js 16 (App Router)                     | SSR, API routes, proxy, Vercel                                                                        |
| UI                | React 19, Tailwind CSS, Radix UI, shadcn/ui | Dark mode via class strategy                                                                          |
| Forms             | React Hook Form + Zod                       | Validation at API boundary                                                                            |
| Database          | Supabase (PostgreSQL + Auth + RLS)          | `createClient()` for browser, `createServiceClient()` for admin                                       |
| AI                | Anthropic Claude (`claude-sonnet-4-6`)      | `@anthropic-ai/sdk`                                                                                   |
| Auth              | Supabase Auth SSR                           | Bearer token (extension), cookies (web)                                                               |
| Extension         | Chrome Manifest V3                          | Service worker, content scripts, popup                                                                |
| Logging           | Pino → stdout                               | JSON to stdout, picked up by Vercel logs                                                              |
| Error Tracking    | Sentry                                      | Client + server + edge configs                                                                        |
| Animation         | GSAP (`gsap@^3.15`, `@gsap/react`)          | Scoped landing choreography with responsive and reduced-motion fallbacks                              |
| Visual background | Layered CSS gradients                       | `components/ShaderBackground.tsx` mounts the shared near-black and evergreen northern-lights backdrop |
| Typography        | DM Sans + Cormorant Garamond + Flaviotte    | DM Sans for body/UI, Cormorant for editorial display, and local Flaviotte for the brand mark.         |
| Testing           | Vitest (unit), Playwright (E2E)             |                                                                                                       |

---

## Project Structure

```
app/
  api/extension/{generate,feedback,config,session,version}/  ← core API
  api/{auth/me,health,feedback}/
  auth/{login,register,callback,forgot-password,reset-password}/
  {dashboard,profile,settings}/
  dashboard/EmptyState.tsx  ← first-login CTA (Phase 30)
  demo/{page.tsx,sample-data.ts}  ← public no-auth sample (Phase 30)
  status/page.tsx               ← public build version + SHA (Phase 30)
  privacy/page.tsx              ← legal (Phase 29)
  terms/page.tsx                ← legal (Phase 29)
  layout.tsx, page.tsx, providers.tsx

ascendia-extension/
  background/service-worker.js
  content/{linkedin-reader.js,auto-filler.js}
  popup/    settings/    lib/    manifest.json

components/landing/   ← Hero, Navbar, WhyAletheia, HowItWorks, Pricing, FAQ, CTA, FounderNote, Footer
components/demo/DemoExample.tsx  ← client component for /demo route (Phase 30)
components/ShaderBackground.tsx  ← full-viewport CSS northern-lights background reused by landing, auth, privacy, terms, dashboard, profile, settings, demo, status

public/fonts/
  Flaviotte.woff2 / Flaviotte.woff  ← local font, registered via next/font/local

ascendia-extension/assets/fonts/
  Flaviotte.woff2 / Flaviotte.woff  ← same font bundled inside the extension

lib/
  ai/{sanitizer.ts,ai-fingerprint-detector.ts,style-analyzer.ts,prompts/}
  supabase/{client.ts,server.ts}
  database/types.ts
  logger.ts            ← Pino logger (Node.js runtime only) — JSON to stdout (Vercel logs)
  logger.edge.ts       ← Proxy-compatible console logger — used ONLY by proxy.ts
  cors.ts

proxy.ts               ← auth session refresh + security headers (imports logger.edge.ts)
next.config.js         ← Sentry, CSP, webpack, cache control
supabase/migrations/
```

---

## Environments

| Variable                                       | Purpose                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                          | Canonical app URL (CORS whitelist)                                                     |
| `CHROME_EXTENSION_ID` / `CHROME_EXTENSION_IDS` | Exact Chrome extension IDs allowed to exchange web sessions for extension tokens       |
| `NEXT_PUBLIC_SUPABASE_URL`                     | Supabase project URL                                                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                | Supabase public key                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`                    | Admin operations (server only)                                                         |
| `ANTHROPIC_API_KEY`                            | Claude API                                                                             |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`        | Server and browser error tracking                                                      |
| `LOG_LEVEL`                                    | Pino log level — `debug` (dev default) / `info` (prod default)                         |
| `EXTENSION_DAILY_LIMIT`                        | Max generation requests per user per day (default: 30)                                 |
| `CREDIT_BILLING_ENABLED`                       | Enables credit debit enforcement for generation                                        |
| `CREDIT_BILLING_UNLIMITED_EMAILS`              | Comma-separated verified-auth emails that bypass credit debits for development/testing |

Copy `.env.local.example` → `.env.local` for local dev. Never commit secrets.

**Dev:** `npm run dev` — Next.js fast refresh, JSON logs to stdout.
**Prod:** Deployed to Vercel from `main` branch. Single Vercel project.

---

## Deployment

- **Platform:** Vercel. Single project — auto-deploys `main` to production.
- **CI pipeline:**
  - `ci.yml` — PR gate: lint + type-check + unit tests + guardrails + smoke build (triggers on `pull_request` to `main`)
  - Merge to `main` → Vercel deploys automatically. No staging environment.
- **Pre-commit:** lint-staged formats and fixes staged files before the hook runs repository lint, type-check, unit tests, guardrails, and a production build. Extension changes additionally run the version policy, extension CI target, and ZIP packaging.
- **Extension distribution:** Public installs go through the Chrome Web Store. `npm run build:extension` creates a local, gitignored upload artifact at `ascendia-extension/dist/aletheia-extension.zip`; it is not written to `public/` and is not served by Vercel. Version metadata at `/api/extension/version` reports app/extension versions and the configured Chrome Web Store URL.
- **Database migrations:** `supabase/migrations/` — apply via Supabase CLI or SQL Editor
- **No Docker** — Vercel-native deployment

---

## Dos and Don'ts

### DO

- Use `createClient()` (browser) and `createServiceClient()` (server/admin) — never mix
- Validate all API inputs with Zod at the route boundary — use `.trim()` before `.min()` on string fields
- Use `createLogger('module')` from `lib/logger.ts` for structured logging in API routes — no `console.log`
- Use `createLogger('module')` from `lib/logger.edge.ts` in `proxy.ts` — proxy-safe logger for the network boundary
- Use lazy factory functions for SDK clients — validate env vars exist at call time with clear error messages
- Keep sanitizer and fingerprint detector in `lib/ai/` — don't inline AI post-processing in routes
- Use `check_and_increment_rate_limit` RPC for extension rate limiting — don't reimplement
- Return errors with structured JSON `{ error: string, code?: string, details?: Array }` and correct HTTP status — include field-level Zod details on 400s
- Add security headers via proxy — don't add them ad hoc in individual routes
- Use Supabase RLS — never bypass it with service role for user-facing operations
- Reference only user-provided data in prompts — never invent metrics, projects, or achievements
- Use atomic RPCs for concurrent data operations (style merge, counters) — fall back to upsert only if RPC unavailable
- Add `.max()` limits on all Zod string/array fields to prevent memory exhaustion via oversized payloads
- Log full user IDs in telemetry spans (for audit trails) but truncate to 12 chars in log messages (for privacy)
- Write a test for every new feature or non-trivial code change. Co-locate the test file with the source (`sanitizer.test.ts` next to `sanitizer.ts`). Minor fixes (typos, config tweaks, copy changes, dependency bumps) are exempt. For any change touching `lib/ai/`, guardrail tests are mandatory and must pass before merge.
- Use `<ShaderBackground />` (from `components/ShaderBackground.tsx`) for every authenticated or landing surface that needs the brand background. Use `className="landing"` for the public editorial surface and `className="product-shell"` for authenticated product surfaces.
- Use DM Sans for body/UI copy, Cormorant Garamond for editorial display text, and Flaviotte only for the Aletheia brand mark. Body defaults are registered in `app/layout.tsx` and `app/globals.css`.
- Mirror the semantic Phthalo palette in the Chrome extension: `#020403` canvas, `#091814` raised surface, `#1E4938` elevated surface, `#285D49` action, `#367960` hover, `#78B49B` highlight/focus, `#F7FAF9` primary text, and `#AEBDB7` muted text. Import Flaviotte via `@font-face` from `ascendia-extension/assets/fonts/` for the extension brand treatment.

### DON'T

- Don't import `lib/supabase/server.ts` in client components
- Don't import `lib/logger.ts` in `proxy.ts`; use `lib/logger.edge.ts` instead
- Don't use `console.log` — use the Pino logger (`lib/logger.ts`) or edge logger (`lib/logger.edge.ts`)
- Don't skip Zod validation on any API input
- Don't add new Claude API calls without going through the sanitization pipeline
- Don't add new Claude API calls without a timeout — always pass `{ timeout: 30_000 }` as the second arg to `messages.create()`
- Don't hardcode model strings — update the single constant in the generate route if model changes
- Don't block the generate response with analytics/style processing — keep it fire-and-forget. The `user_feedback` row insert in the feedback route is the one allowed sync write (eval signal preservation).
- Don't commit `.env.local` or any file containing secrets
- Don't bypass RLS using service role key for user queries (only for admin/background jobs)
- Don't add module-level SDK instantiation (breaks Vercel edge cold starts)
- Don't install pino transports in proxy — keep proxy logging lightweight and runtime-safe
- Don't inject user-supplied content into prompt XML tags without escaping — always use `escapeForXmlTag()` from `lib/ai/prompts/linkedin-connection.ts`
- Don't make rate limiting fail-open — if the rate limit check fails, deny the request (fail-closed) to prevent unlimited API spend during outages
- Don't use non-null assertions (`!`) on environment variables — always validate with an explicit check and throw a clear error
- Don't log or expose `SUPABASE_SERVICE_ROLE_KEY` — read once into a local variable, never pass to logger
- Don't silently swallow non-text Claude response blocks — throw explicit errors with content type info
- Don't hardcode magic numbers — use env vars with fallback defaults (e.g. `EXTENSION_DAILY_LIMIT`)
- Don't return Zod 400 errors without field-level details — clients need `details: [{ field, message }]` to debug
- Don't use CORS wildcard `*` for null-origin requests — extensions must send `chrome-extension://` origin
- Don't reintroduce `AuroraBackground` on new pages — it is the legacy shard treatment. The current background is the restrained CSS gradient in `ShaderBackground`.
- Don't put a solid opaque background on hero/section wrappers — sections must stay translucent (`rgba(0,0,0,0.10)` / `var(--l-bg)`) so the fixed `ShaderBackground` (z-index `-1`) shows through.
- Don't render a `<GridBackground />` / dotted canvas overlay on top of the shader — the shader is the canonical hero backdrop.
- Keep the existing reduced-motion handling for the background drift and avoid introducing animation that bypasses it.

---

## Key API Contracts

### Resume Upload Pipeline (ALE-43, phased rollout)

The profile UI uses the Phase 4 direct-upload flow when
`NEXT_PUBLIC_RESUME_DIRECT_UPLOAD_ENABLED=true`. Keep the flag disabled until
the production migrations, RLS, and authenticated upload path are verified;
the disabled state preserves the previous multipart transport as a temporary
rollback path. Enabling or disabling this public build-time flag requires a
redeploy. Remove the rollback transport after the Phase 5 rollout gate.

- `POST /api/resumes/uploads` accepts JSON metadata only: a sanitized PDF/TXT
  file name, an allow-listed MIME type, and an integer size from 1 byte through
  5 MiB. It atomically reserves an owner-scoped, expiring path in the private
  `resume-quarantine` bucket and returns `upsert: false` upload options.
- `POST /api/resumes/uploads/{id}/finalize` accepts no request body. After
  cookie authentication and owner-scoped lookup, the server downloads the
  exact quarantine object with a timeout, validates its bytes, promotes an
  accepted object using a stateless service-role client, and atomically creates
  the ready `user_resumes` row. Terminal results are idempotent and partial
  Storage/database failures are compensated or returned with stable retryable
  codes.
- `DELETE /api/resumes/uploads/{id}` performs owner-scoped, repeat-safe
  cancellation and best-effort quarantine cleanup.
- `POST /api/resumes` preserves the authenticated multipart rollback path only
  while the direct-upload flag is disabled. Once enabled, it never reads
  multipart bodies and returns `LEGACY_RESUME_UPLOAD_DEPRECATED`; remove the
  rollback path in the final rollout phase.
- `GET /api/internal/resumes/cleanup` is a dynamic Node route invoked daily at
  `03:17` UTC by Vercel Cron, matching the Hobby plan's once-daily limit. It
  requires a `CRON_SECRET` Bearer token and processes at most five
  batches of 100 quarantine rows with a 15-minute lease, removes objects only
  from `resume-quarantine`, records completion, and reports saturation. Failed
  or interrupted batches become claimable again after the lease. Ready rows
  may be claimed only to remove a residual quarantine copy after an ambiguous
  promotion; the final `user-resumes` bucket is never targeted. Hobby execution
  may occur up to 59 minutes after the scheduled hour, and a failed or saturated
  run can extend retention into a later run. The accepted Vercel Hobby policy is
  bounded, best-effort daily cleanup with saturation monitoring rather than a
  strict 24-hour deletion guarantee.

The service-role client is created only after authentication and ownership are
established and is never exposed to browser code. Quarantine objects have no
authenticated read/update/delete policy; authenticated clients cannot write to
the final bucket. Logs and public errors must never include resume bytes,
parsed text, file names, storage paths, content hashes, or raw provider/parser
errors. Phase 4 owns browser direct upload, legacy multipart deprecation, and
expired/orphan cleanup. Phase 5 provides the protected, manually dispatched
`resume-production-gate` workflow and the operational runbook at
`docs/operations/resume-upload-production-gate.md`. The gate targets only an
explicitly confirmed isolated deployment/project with two test accounts; it
checks direct PDF/TXT upload, 1 MiB and exact-5-MiB behavior, cross-user denial,
stable rejection, destructive cleanup, and bounded timing evidence. Authenticated
Playwright traces are disabled so test artifacts do not retain session tokens.

Resume lifecycle telemetry uses `stage.start`/`stage.complete` with the stages
`resume_upload.reservation`, `resume_upload.acknowledgement`,
`resume_upload.validation`, `resume_upload.promotion`,
`resume_upload.rejection`, and `resume_upload.cleanup`. Exported logs must pass
`npm run audit:resume-logs` with synthetic canaries before production rollout.
Keep direct upload disabled until migration/RLS, integration, cleanup capacity,
and log-privacy evidence are approved. The production migration, live log audit,
and flag enablement remain controlled environment actions, not ordinary tests.

---

## First-Party Observability

Use only the existing Pino JSON stdout logger on Node routes, the edge JSON logger in `proxy.ts`, and the local extension logger. Do not add a remote telemetry transport or send extension diagnostics over the network.

Every side-effecting request, auth, database, model, sanitation, storage, or runtime-message boundary emits structured `event`, `stage`, `outcome`, `durationMs`, `status`, and `errorCode` fields when available. Carry validated UUID `requestId` and `operationId` values through first-party boundaries. The extension uses `X-Aletheia-Operation-Id`; the proxy returns `x-request-id` and preserves the operation ID.

Never log Authorization headers, cookies, tokens, secrets, session objects, request or response bodies, URLs with query strings, email addresses, prompts, source context, or generated drafts. `lib/logger.ts`, `lib/logger.edge.ts`, and `ascendia-extension/lib/logger-core.js` are the mandatory redaction boundary; callers must pass safe codes, counts, booleans, categories, and bounded identifiers only.

The extension diagnostic buffer is local-only in `chrome.storage.session`, capped at 80 redacted events with one-hour expiry. It is not readable by content pages through the logger, is never uploaded, and exists only to retain pre-request evidence across MV3 worker suspension. To correlate an operation, filter Chrome extension console/session diagnostics by `operationId`, then Vercel stdout by `operationId` and `requestId`.

**POST `/api/extension/generate`** — main generation endpoint
Auth: Bearer token (JWT) | Rate limit: `EXTENSION_DAILY_LIMIT` req/day/user (default 30, `extension_rate_limits` table)

Request body (Zod-validated — see `app/api/extension/generate/schema.ts`):

```typescript
{
  profileMarkdown: string   // trim().min(10).max(10000) — LinkedIn profile innerText
  resume?: string           // max 50000 chars
  jd?: string               // max 20000 chars
  category: 'linkedin_connection' | 'cold_email' | 'linkedin_inmail'
  intent?: 'networking' | 'referral' | 'mentorship' | 'job_inquiry'  // default 'networking'
  acceptedExamples?: string[]  // max 5 entries × max 5000 chars each
}
```

Response (LinkedIn connection):

```typescript
{
  success: true;
  body: string;
  category: string;
  character_count: number;
  usage: {
    (input_tokens, output_tokens);
  }
  processingTime: number;
  evalMetadata: {
    promptVersion: string; // PROMPT_VERSION constant — bump per prompt change
    model: string; // CLAUDE_MODEL
    temperature: number;
    category: string;
    intent: string;
    generationTimeMs: number;
    inputTokens: number;
    outputTokens: number;
  }
}
```

Response (cold_email / linkedin_inmail): same fields + `subject_line: string` + `word_count: number`.

`evalMetadata` is echoed by the client back to `POST /api/extension/feedback` and persisted in `user_feedback.metadata` for per-version eval / regression analysis.

Failure modes: 400 (Zod with `details[]`), 401 (auth), 429 (rate limit — local OR upstream Anthropic 429), 502 (upstream Anthropic 401 / JSON parse failure), 504 (`APIConnectionTimeoutError`).

---

## Testing Rules

### Unit Tests (Vitest)

- Files: `*.test.ts` / `*.spec.ts` co-located or in `__tests__/`
- Run: `npm run test` | `npm run test:coverage` (Currently scaling >87% global coverage)
- Must test: sanitizer logic, fingerprint detector patterns, complex route handlers, Zod schema validation
- Mock: Anthropic SDK, Supabase client using isolated `vi.mock()` factory in `__tests__/helpers`
- Do NOT test UI rendering — use Playwright for that

### E2E Tests (Playwright) — two tiers

**Mocked (`@smoke`) — safe locally with dummy env vars:**

- `e2e/health.spec.ts` — GET /api/health, no auth
- `e2e/ui-smoke.spec.ts` — landing page + login page load (tagged `@smoke`)
- Run: `make e2e-smoke` or `npx playwright test --grep "@smoke"`
- No real Supabase or Anthropic calls.

**Rules:**

- Tag E2E tests `@smoke`. No real-API E2E tier currently.
- `e2e/` is excluded from vitest.

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
