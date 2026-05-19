# 07 — Testing

Three test suites + a separate extension suite. Co-located with source unless they need a setup file (then `__tests__/`).

| Suite | Runner | Config | Files | Count |
|-------|--------|--------|-------|-------|
| Unit | Vitest | `vitest.config.ts` | `**/*.test.ts`, `**/*.spec.ts` (excl. guardrails, e2e, extension) | 235 |
| Guardrails | Vitest | `vitest.guardrails.config.ts` | `**/*.guardrails.test.ts` | 13 |
| E2E (`@smoke`) | Playwright | `playwright.config.ts` | `e2e/health.spec.ts`, `e2e/ui-smoke.spec.ts` | 3 |
| Extension | Vitest | `ascendia-extension/vitest.config.ts` | `ascendia-extension/**/*.test.{ts,js}` | 94 |

Run via:
```bash
make test         # unit (235)
make guardrails   # guardrails (13)
make e2e-smoke    # @smoke (3)
make test-ext     # extension (94)
make ci           # full local: lint + type-check + test + guardrails + build
```

## Unit suite (`vitest.config.ts`)

Key settings:
- `environment: 'node'`
- `globals: true`
- `setupFiles: ['__tests__/setup.ts']`
- `include: ['**/*.test.ts', '**/*.spec.ts']`
- `exclude`: guardrails files, `e2e/**`, `ascendia-extension/**`, `__tests__/helpers/**`, `.next/`, `node_modules/`
- Coverage: V8, includes `lib/**/*.ts` + `app/api/**/*.ts`, excludes generated types + thin Supabase wrappers
- Alias: `@` → repo root

`__tests__/setup.ts` — global test hooks.
`__tests__/helpers/` — shared module mocks:
- `makeRequest()` — boundary factory for building `NextRequest` instances in route tests.
- Isolated `vi.mock()` factories for `@supabase/supabase-js` and `@anthropic-ai/sdk`.

## Tested files (representative)

| Source | Test |
|--------|------|
| `lib/ai/sanitizer.ts` | `lib/ai/sanitizer.test.ts` |
| `lib/ai/ai-fingerprint-detector.ts` | `lib/ai/ai-fingerprint-detector.test.ts` |
| `lib/ai/style-analyzer.ts` | `lib/ai/style-analyzer.test.ts` |
| `lib/ai/prompts/linkedin-connection.ts` | `lib/ai/prompts/connection.test.ts` |
| `lib/cors.ts` | `lib/cors.test.ts` |
| `lib/logger.ts` | `lib/logger.test.ts` |
| `app/api/extension/generate/route.ts` | `app/api/extension/generate/route.test.ts` |
| `app/api/extension/feedback/route.ts` | `app/api/extension/feedback/route.test.ts` |
| `app/api/extension/session/route.ts` | `app/api/extension/session/route.test.ts` |
| `app/api/extension/config/route.ts` | `app/api/extension/config/route.test.ts` |
| `app/api/auth/me/route.ts` | `app/api/auth/me/route.test.ts` |
| `app/api/settings/route.ts` | `app/api/settings/route.test.ts` |
| `app/api/feedback/route.ts` | `app/api/feedback/route.test.ts` |
| `app/api/health/route.ts` | `app/api/health/route.test.ts` |

UI components are **not** unit tested — Playwright covers landing + auth shell.

## Guardrails suite (`vitest.guardrails.config.ts`)

Separate runner for adversarial security tests. Mandatory before any PR that touches `lib/ai/`.

| Source | Test | Asserts |
|--------|------|---------|
| `lib/ai/sanitizer.ts` | `lib/ai/sanitizer.guardrails.test.ts` | Blocks XSS (`<script>`, `javascript:`), SQL injection (`UNION SELECT`, `DROP TABLE`), command injection (`\| rm -rf`), PII (SSN, CC), hate speech (incl. leet-speak `n@zi`, `k1ll`) |

13 tests today. Add cases here when expanding `HARMFUL_PATTERNS` or `BLOCKED_CONTENT_PATTERNS`.

## E2E suite (Playwright)

`playwright.config.ts`:
- `testDir: './e2e'`
- `baseURL`: `process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'`
- `webServer`: spawns `npm run build && npm run start` **only when no remote URL**. (Spread used to avoid `undefined` assignment under `exactOptionalPropertyTypes`.)
- Chromium only.

Specs:
- `e2e/health.spec.ts` — `GET /api/health` returns 200 + `status: 'ok'`. No auth.
- `e2e/ui-smoke.spec.ts` — landing page + login page load. `@smoke` tagged.

No real Supabase / Anthropic calls. Safe with dummy env vars (`ci.yml` uses placeholders).

The previous `e2e/generate.spec.ts` (real Anthropic, staging) was deleted in Phase 24 along with the CD pipeline.

## Extension suite (`ascendia-extension/vitest.config.ts`)

Node env. Setup file injects `globalThis.chrome` with `test/setup.ts` mocks.

| Source | Test | Count |
|--------|------|-------|
| `background/auth-core.js` | `background/auth-core.test.ts` | 44 |
| `content/profile-extractor.js` | `content/profile-extractor.test.ts` | 22 |
| `popup/popup-core.js` | `popup/popup-core.test.ts` | 26 |
| End-to-end flow with chrome.* mocks | integration spec | ~8 (subset) |

`test/chrome-mocks.ts` provides in-memory `chrome.{runtime, storage, tabs, alarms, cookies, scripting}` + `wireMessagePassing()` for cross-module integration tests.

Run from extension dir or via `make test-ext`. Root `vitest.config.ts` excludes `ascendia-extension/**` so it has to be invoked separately.

## Schema-in-`schema.ts` pattern

Next.js App Router route files (`route.ts`) **only allow HTTP method exports** (`GET`, `POST`, `PATCH`, `OPTIONS`, etc.) — any other named export at the top level breaks the build.

So Zod schemas live in a sibling `schema.ts`:

```
app/api/extension/generate/
  schema.ts       export const generateRequestSchema = z.object(...)
  route.ts        import { generateRequestSchema } from './schema'
  route.test.ts   import { generateRequestSchema } from './schema'
```

Tests import the schema directly (no Next.js routing involved). Route imports it too — single source of truth.

Existing `schema.ts` files:
- `app/api/extension/generate/schema.ts`
- `app/api/extension/feedback/schema.ts`
- `app/api/settings/schema.ts`

Adding a route → create `schema.ts` first, then `route.ts`, then `route.test.ts`.

## Mocking conventions

| What | How |
|------|-----|
| Anthropic SDK | `vi.mock('@anthropic-ai/sdk', () => ({ ... }))` — return canned `messages.create()` response. Inject `Anthropic.APIError` / `Anthropic.APIConnectionTimeoutError` for failure branches. |
| Supabase | `vi.mock('@supabase/supabase-js', ...)` — fake `auth.getUser()`, `from().select()`, `.rpc()` |
| Next.js cookies | Tests that hit cookie-auth routes use `next/headers` mocks — already wired in `__tests__/setup.ts` |
| `next/server` `NextRequest` | Build via `__tests__/helpers/request.ts → makeRequest()` |
| `chrome.*` (extension) | `ascendia-extension/test/setup.ts` + `chrome-mocks.ts` |

## Coverage policy

| Layer | Target | Source |
|-------|--------|--------|
| `lib/ai/**` | ~95% | Phase 9 + 11 |
| `app/api/**` | ~90% | Phase 11 |
| Routes | every handler + every Zod error branch + every CORS / auth guard | — |
| Mandatory | Sanitizer + fingerprint detector + style analyzer + prompt builder + every route schema | — |

`tsconfig.json` has `"strict": true`. Type errors block CI.

## Cross-references

- The routes being tested → `02-web-app-routes.md`
- AI pipeline functions under test → `03-ai-pipeline.md`
- Extension modules under test → `04-extension.md`
- CI invocation of these suites → `06-infrastructure.md#cicd-pipeline`
