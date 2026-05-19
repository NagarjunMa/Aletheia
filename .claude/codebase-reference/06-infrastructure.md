# 06 — Infrastructure (Middleware, CSP, CORS, Logger, Sentry, CI/CD)

## Middleware (`middleware.ts`)

Edge Runtime. Runs on every non-asset request (matcher excludes `_next/static`, `_next/image`, favicon, images).

| Responsibility | How |
|----------------|-----|
| Request ID | Generate or pass through `x-request-id` (`crypto.randomUUID()`) — forwarded to downstream routes for log correlation |
| Session refresh | `createServerClient(@supabase/ssr).auth.getUser()` runs on every request **except** `/api/extension/session` (which does its own auth — running both = `refresh_token_already_used` race) |
| Stale token recovery | On `error.code === 'refresh_token_already_used'`: API requests → 401 JSON + `Retry-After: 2`. HTML → redirect to current URL, clear all `sb-*-auth-token` cookies inline (avoiding `signOut()` which can crash Next.js routing) |
| Protected redirect | Paths `/dashboard`, `/chat`, `/settings`, `/profile` → unauthenticated users sent to `/auth/login?redirectTo=...` |
| Already-authed redirect | `/auth/login` / `/auth/register` → bounce to `redirectTo` or `/`. Bypassed when `?source=extension` or `next-action` header present (server action call) |
| Security headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin` |
| CSP (nonce-based) | Per-request nonce = `Buffer.from(crypto.randomUUID()).toString('base64')`. Header `x-nonce` set on response so `app/layout.tsx` can read via `headers()` and pass into `Providers`. `script-src 'self' 'nonce-{nonce}' 'strict-dynamic'` (prod) / `+ 'unsafe-eval'` (dev for React refresh). `style-src 'self' 'unsafe-inline'`. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`. |
| `connect-src` | `'self'` + `*.supabase.co` (https + wss) + `api.anthropic.com`. Dev: also `127.0.0.1:*`, `ws://localhost:*`. |

Uses `lib/logger.edge.ts` exclusively. Pino imports Node streams (`process.stdout`, `setImmediate`) which crash Edge Runtime.

## CSP nonce flow

1. `middleware.ts` generates nonce, sets `x-nonce` response header.
2. `app/layout.tsx` (root server component) reads `headers().get('x-nonce')`.
3. Passes nonce as prop to `<Providers nonce={nonce}>`.
4. `app/providers.tsx` applies the nonce to inline scripts (theme detection, etc.) via `next-themes` config.
5. Browser sees `<script nonce="...">` matches CSP `nonce-{nonce}` directive → executes. Other inline scripts (e.g. injected by a third-party CDN) lack nonce → blocked.

## CORS (`lib/cors.ts`)

```ts
getCorsHeaders(request, { allowCredentials?, methods? }) => Record<string, string>
```

Allowed origin patterns:
- `^chrome-extension://`
- `^https?://localhost(:\d+)?$`
- `^<NEXT_PUBLIC_APP_URL>$` (only if env var set)

If origin not in list → `Access-Control-Allow-Origin: ""` (empty — browser blocks). **No `*` fallback.** Previously a `x-extension-source` header would trigger `*` — that was a CORS bypass risk and is gone.

`Access-Control-Allow-Credentials: true` only if origin matched AND `allowCredentials: true` passed.

Always sets `Vary: Origin` so CDN doesn't cache cross-origin response.

## Logger split

| File | Runtime | What |
|------|---------|------|
| `lib/logger.ts` | Node only | Pino → stdout (Vercel function logs). JSON output. `createLogger(module)` returns Pino child. `createRequestLogger(module, request, extra)` adds `requestId`, `method`, `path`, `origin`. |
| `lib/logger.edge.ts` | Edge / Node | Plain `console.*` wrapper, same API shape (`{ debug, info, warn, error }`). Used **only by `middleware.ts`**. |

Phase 16 added Grafana Cloud Loki shipping; Phase 24 removed it. Vercel function logs cover the 10–50 user MVP tier. If higher retention is needed: extend `lib/logger.ts` with a custom Pino stream (see `CLAUDE.md`).

## Supabase client factories (`lib/supabase/`)

### `server.ts` (cookies + SSR + admin)

| Function | Purpose |
|----------|---------|
| `createClient()` | SSR client — reads cookies via `next/headers`. Use in server components, server actions, route handlers (cookie auth). |
| `createServiceClient()` | Admin client — `SUPABASE_SERVICE_ROLE_KEY`. Bypasses RLS. Only for background jobs / admin / `extension_rate_limits` RPC. |
| `getUser()` | Helper wrapping `supabase.auth.getUser()` |
| `getUserProfile(userId?)` | Read `profiles` row |
| `ensureUserProfile(user)` | Idempotent insert; retries once on failure. Called from `/auth/callback`. |
| `getServerTables()` / `getServiceTables()` | Type-safe table accessors keyed to active tables (profiles, generated_drafts, user_feedback, user_preferences, extension_rate_limits) |

### `client.ts`

| Function | Purpose |
|----------|---------|
| `createClient()` | Browser client (anon key). Use in client components only. |

## Sentry

Three configs, all opt-in via env vars:

| File | Where it runs | DSN |
|------|---------------|-----|
| `sentry.client.config.ts` | Browser | `NEXT_PUBLIC_SENTRY_DSN` |
| `sentry.server.config.ts` | Node runtime | `SENTRY_DSN` |
| `sentry.edge.config.ts` | Edge runtime (middleware) | `SENTRY_DSN` |
| `instrumentation.ts` | Hook for Sentry register | — |
| `instrumentation-client.ts` | Hook for client + `onRouterTransitionStart` export | — |

`@vercel/otel` and OpenTelemetry were removed in Phase 24.

## `next.config.js`

- Sentry plugin wrapper (`withSentryConfig`) — uploads sourcemaps on prod build.
- Image domains (none external beyond Supabase storage).
- Webpack overrides minimal — `crypto-browserify` / `stream-browserify` polyfills were removed in Phase 24 (only OTel needed them).
- Cache-Control headers for static assets.

CSP is **not** in `next.config.js`. It's owned by `middleware.ts` (per-request nonce requires that).

## CI/CD pipeline

Single workflow: `.github/workflows/ci.yml`. Three sequential jobs.

| Job | Steps | Purpose |
|-----|-------|---------|
| `lint-and-typecheck` | `npm ci` → `npm run type-check` → `npm run lint` | Zero-warning gate |
| `test` (needs lint) | `npm ci` → `npm run test -- --run` → `npm run test:guardrails -- --run` | 232 unit + 13 guardrail tests |
| `smoke-test` (needs test) | `npm ci` → `npm run build` (with placeholder `NEXT_PUBLIC_SUPABASE_*` so `createBrowserClient` doesn't throw during prerender) → `npm run start &` → `curl /api/health` with 30 s wait | Build + boot + health check |

Trigger: `pull_request` to `main` only. Push to `main` triggers Vercel deploy directly — no GitHub Actions involved.

Required GitHub Secrets (none needed for `ci.yml` because of placeholder URLs):
- Runtime secrets live in Vercel project env: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SENTRY_DSN`, `EXTENSION_DAILY_LIMIT`.

Staging / CD workflows (`cd.yml`, `staging.yml`) were deleted in Phase 24. There is no staging environment.

## Local hooks (Husky + lint-staged)

`.husky/pre-commit` runs `lint-staged`. Config in `.lintstagedrc.json`:
- `eslint --fix`
- `prettier --write`
- `vitest related --run --passWithNoTests` against modified files only

Husky init: `npm install` triggers `husky install` via `prepare` script.

## Deployment

Single Vercel project. Auto-deploys `main` to production. No preview gating beyond `ci.yml`. No staging.

| Env var | Where it's set |
|---------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel project env (Production + Preview + Dev) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel project env |
| `NEXT_PUBLIC_APP_URL` | Vercel project env — CORS allowlist anchor |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel project env (server only) |
| `ANTHROPIC_API_KEY` | Vercel project env |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Vercel project env |
| `EXTENSION_DAILY_LIMIT` | Vercel project env (defaults to 30 if absent) |
| `LOG_LEVEL` | Vercel project env (`debug` dev / `info` prod) |

## Makefile (`/Makefile`)

22 self-documented targets — `make help` lists all. Highlights:

| Target | Wraps |
|--------|-------|
| `make dev` | `npm run dev` |
| `make build` | `npm run build` |
| `make lint` | `npm run lint` |
| `make type-check` | `npm run type-check` |
| `make test` | `npm run test -- --run` |
| `make guardrails` | `npm run test:guardrails -- --run` |
| `make e2e-smoke` | Playwright `@smoke` tests, local server |
| `make ci` | Full local pipeline: lint → type-check → test → guardrails → build |
| `make test-ext` | `(cd ascendia-extension && npx vitest --run)` |
| `make build-ext` | esbuild → `ascendia-extension/dist/` |

## Cross-references

- Routes guarded by middleware → `02-web-app-routes.md`
- Supabase RPCs called through these clients → `05-database.md#rpc-functions`
- Test runner config → `07-testing.md`
- Why CSP is nonce-based, why CORS dropped wildcard → `08-conventions-and-security.md`
