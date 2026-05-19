# 02 — Web App Routes

All routes live under `app/`. Next.js 14 App Router. Server components by default; client components opt in with `'use client'`.

## Page routes

| Path | File | Type | Auth |
|------|------|------|------|
| `/` | `app/page.tsx` | Server (landing) | Public |
| `/auth/login` | `app/auth/login/page.tsx` | Client | Public (redirect if signed in via middleware) |
| `/auth/register` | `app/auth/register/page.tsx` | Client | Public |
| `/auth/forgot-password` | `app/auth/forgot-password/page.tsx` | Client | Public |
| `/auth/reset-password` | `app/auth/reset-password/page.tsx` | Client | Public |
| `/auth/callback` | `app/auth/callback/route.ts` | Route handler (OAuth) | Public |
| `/dashboard` | `app/dashboard/page.tsx` | Server | Protected (middleware redirects) |
| `/profile` | `app/profile/page.tsx` | Server | Protected |
| `/settings` | `app/settings/page.tsx` + `_settings-content.tsx` | Server shell + client island (`next/dynamic({ ssr: false })`) | Protected |

Landing page composition (`app/page.tsx`) renders 10 landing components from `components/landing/`: `Navbar`, `Hero`, `Features`, `HowItWorks`, `Pricing`, `FAQ`, `CTA`, `Footer`, `FloatingSidebar`, plus `GridBackground`.

Layouts: `app/layout.tsx` (root, reads `x-nonce` from middleware → passes to `Providers`), `app/providers.tsx` (wraps `ThemeProvider` from `next-themes`, applies nonce to inline scripts), `app/auth/layout.tsx` (auth shell).

Server action: `app/auth/actions.ts` — `ensureProfileAction()` creates `profiles` row after sign-in.

## API routes

Each route's Zod schema lives in a sibling `schema.ts` (see `07-testing.md` for the why). Routes export only `GET`/`POST`/`PATCH`/`OPTIONS` handlers — never schemas, never helpers as named exports.

### `POST /api/extension/generate`

| Property | Value |
|----------|-------|
| **File** | `app/api/extension/generate/route.ts` |
| **Schema** | `app/api/extension/generate/schema.ts` (`generateRequestSchema`) |
| **Auth** | Bearer token (JWT). `authenticateRequest()` calls `getSupabaseAuth().auth.getUser(accessToken)` |
| **Rate limit** | `check_and_increment_rate_limit` RPC, `EXTENSION_DAILY_LIMIT` env (default 30/day/user), **fail-closed** on RPC error |
| **Body fields** | `profileMarkdown` (trim, 10–10000), `profileUrl` (≤2048), `resume?` (≤50000), `jd?` (≤20000), `category` (3 enum), `intent?` (4 enum, default networking), `acceptedExamples?` (≤5 × ≤5000 chars) |
| **Deps** | `lib/ai/prompts/linkedin-connection` (`getSystemPrompt`, `buildPrompt`, `sanitize`, `PROMPT_VERSION`), `lib/ai/sanitizer` (`stripSurrogates`, `sanitizeForLinkedIn`), `lib/cors`, `lib/logger`, `@anthropic-ai/sdk`, `@supabase/supabase-js` |
| **Model** | `claude-sonnet-4-6`, 600 tokens, temp 0.8, `{ timeout: 30_000 }` |
| **Response (linkedin_connection)** | `{ success, body, category, character_count, usage, processingTime, evalMetadata }` |
| **Response (cold_email \| linkedin_inmail)** | adds `subject_line`, `word_count`. Body parsed from JSON; on parse failure → 502 |
| **`evalMetadata`** | `{ promptVersion, model, temperature, category, intent, generationTimeMs, inputTokens, outputTokens }` — echoed by extension into the feedback payload for per-version eval analysis |
| **Failure modes** | 400 Zod (with `details: [{field,message}]`), 401 auth, 429 rate limit / Anthropic 429, 500 unknown, 502 upstream Anthropic 401 / JSON parse failure, 504 `Anthropic.APIConnectionTimeoutError` |
| **CORS** | `allowCredentials: true`, methods `GET, POST, OPTIONS` |
| **GET / OPTIONS** | GET returns health JSON with auth check. OPTIONS returns preflight. |

### `POST /api/extension/feedback`

| Property | Value |
|----------|-------|
| **File** | `app/api/extension/feedback/route.ts` |
| **Schema** | `app/api/extension/feedback/schema.ts` (`feedbackSchema`) |
| **Auth** | Bearer token |
| **Body** | `message`, `approved` (bool), `category`, `subjectLine?`, `rejectionReason?` (`too_formal` / `too_generic` / `wrong_tone`), `evalMetadata?` (validated via `evalMetadataSchema.strict()`) |
| **Side effect (sync)** | INSERT into `user_feedback` with `feedback_type` = `approved` \| `rejected`, `rating` 5/1, `comment` = rejection reason, `metadata` = `{ category, message_length, has_subject, ...evalMetadata }` — sync write protects eval signal against worker crash after response |
| **Side effect (fire-and-forget)** | `analyzeStyle()` → `mergeStylePatterns()` → atomic `increment_approved_count` / `increment_rejected_count` RPC (upsert fallback if RPC missing) |
| **Response** | `{ success: true }` |

### `GET /api/extension/config`

| Property | Value |
|----------|-------|
| **File** | `app/api/extension/config/route.ts` |
| **Auth** | None (public anon key) |
| **Response** | `{ supabase_url, supabase_anon_key }` for extension client init |

### `GET /api/extension/session`

| Property | Value |
|----------|-------|
| **File** | `app/api/extension/session/route.ts` |
| **Auth** | Cookie (Supabase SSR). Skipped by `middleware.ts` to avoid `refresh_token_already_used` race |
| **Rate limit** | In-memory sliding window, **20 req/min/IP**. Stale entries pruned every 5 min via `setInterval` |
| **Origin check** | Either CORS-whitelisted origin OR `x-extension-source: aletheia-extension` header (service-worker fetch sends no Origin) |
| **Response** | `{ access_token, refresh_token, expires_at, user, supabase_url, supabase_anon_key }` |
| **Failure modes** | 429 rate limit, 403 origin not allowed, 401 no session / `refresh_token_already_used`, 500 internal |

### `GET /api/auth/me`

| Property | Value |
|----------|-------|
| **File** | `app/api/auth/me/route.ts` |
| **Auth** | Dual: Bearer header → fallback to cookie |
| **Response** | `{ authenticated: true, user, usage: { count, limit, reset_time } }` or `{ authenticated: false }` on 401 |
| **Reads** | `extension_rate_limits` for daily usage count |

### `PATCH /api/settings`

| Property | Value |
|----------|-------|
| **File** | `app/api/settings/route.ts` |
| **Schema** | `app/api/settings/schema.ts` (`settingsSchema`) |
| **Auth** | Cookie session (`createClient()` from `lib/supabase/server`) |
| **Body** | `formality_level?` (casual/neutral/formal), `theme?` (light/dark/system), `share_analytics?` (bool), `reset_style?` (bool — wipes `style_patterns` + counters) |
| **Response** | `{ success: true, preferences }` |

### `POST /api/feedback`

| Property | Value |
|----------|-------|
| **File** | `app/api/feedback/route.ts` |
| **Auth** | None — public form. Honeypot field check. |
| **Body** | `name` (2–100), `email` (≤320), `message` (10–5000), `rating?` (1–5), `honeypot?` |
| **Side effect** | INSERT into `feedback` table via service-role client |
| **Response** | Always `{ success: true }` (silent on honeypot trigger) |

### `GET /api/health`

| Property | Value |
|----------|-------|
| **File** | `app/api/health/route.ts` |
| **Auth** | None |
| **Response** | `{ status: 'ok', timestamp: ISO8601 }` |
| **Used by** | Uptime monitors, CI smoke test (`ci.yml`), Playwright `e2e/health.spec.ts` |

### `GET /auth/callback`

| Property | Value |
|----------|-------|
| **File** | `app/auth/callback/route.ts` |
| **Purpose** | OAuth code exchange. Calls `ensureUserProfile()` (idempotent, retries once). Redirects to `redirectTo` query param or `/`. |
| **Special case** | `?source=extension` signups redirect to `/auth/login?source=extension` so the extension auth bridge auto-closes the tab on subsequent login |

## Middleware (`middleware.ts`)

Runs at Edge Runtime on every request matching the matcher (excludes `_next/static`, `_next/image`, `favicon.ico`, images).

| Responsibility | Detail |
|----------------|--------|
| Request ID | Reads or generates `x-request-id` (`crypto.randomUUID()`), forwards as request + response header |
| Session refresh | `supabase.auth.getUser()` runs on every request **except** `/api/extension/session` (which does its own check to avoid double-refresh race) |
| `refresh_token_already_used` recovery | If detected: API requests get 401 JSON with `Retry-After: 2`; HTML routes get a redirect that clears all `sb-*-auth-token` cookies, then lands on `/auth/login` |
| Protected redirect | `/dashboard`, `/chat`, `/settings`, `/profile` → unauthenticated users redirected to `/auth/login?redirectTo=...` |
| Already-authed redirect | `/auth/login` and `/auth/register` → redirected to `redirectTo` or `/`. Skipped if `?source=extension` or `next-action` header (server action) |
| Security headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin` |
| CSP (nonce-based) | `script-src 'self' 'nonce-{nonce}' 'strict-dynamic'` (prod) or with `'unsafe-eval'` (dev for HMR). `style-src 'self' 'unsafe-inline'`. Nonce is `Buffer.from(crypto.randomUUID()).toString('base64')`, passed via `x-nonce` header for `layout.tsx` to inject |
| `connect-src` | `'self'` + Supabase (`*.supabase.co` ws + https) + `api.anthropic.com`. Dev adds `127.0.0.1:*` and `ws://localhost:*` |

Uses `lib/logger.edge.ts` only (Node-stream-based Pino crashes Edge Runtime — see `06-infrastructure.md`).

## Cross-references

- AI pipeline detail (`buildPrompt`, sanitizer, fingerprint detector) → `03-ai-pipeline.md`
- Extension client side of session/generate/feedback → `04-extension.md`
- Tables and RPCs touched by these routes → `05-database.md`
- CORS / logger / Supabase factory details → `06-infrastructure.md`
- Schemas / test pattern → `07-testing.md`
- Security fix history per route → `08-conventions-and-security.md`
