# 08 — Conventions and Security

Condensed from `/CLAUDE.md`. If anything here contradicts `/CLAUDE.md`, the latter wins — update this file in the same PR.

## Hard conventions (DO)

| # | Rule | Why |
|---|------|-----|
| 1 | `createClient()` browser, `createServiceClient()` server/admin — never mix | Service role bypasses RLS — limit blast radius |
| 2 | Validate every API input with Zod at the boundary; `.trim()` before `.min()` on strings | Catch malformed payloads before they reach business logic |
| 3 | `createLogger('module')` from `lib/logger.ts` (or `logger.edge.ts` in middleware) — no `console.log` | Structured JSON to Vercel logs |
| 4 | Lazy SDK factories (`getAnthropic()`, `getSupabaseService()`) | Module-level instantiation breaks Vercel edge cold starts |
| 5 | AI post-processing stays in `lib/ai/` — never inline in routes | Single source of truth + guardrail tests cover it |
| 6 | `check_and_increment_rate_limit` RPC for extension rate limiting — don't reimplement | Atomic. Fail-closed. Already tested. |
| 7 | API errors return structured JSON `{ error, code?, details? }` with correct HTTP status; 400 Zod responses include `details: [{ field, message }]` | Clients can debug + status semantics correct |
| 8 | Security headers via `middleware.ts` only — not ad-hoc per route | One place to audit |
| 9 | Supabase RLS is the user-facing security boundary — never bypass with service role | Defense in depth |
| 10 | Reference only user-provided data in prompts. Never invent metrics, projects, or achievements. | Trust + brand |
| 11 | Atomic RPCs for concurrent ops (style merge, counters); upsert fallback only if RPC missing | Race-free |
| 12 | `.max()` limits on every Zod string / array | DoS via oversized payload |
| 13 | Full user IDs in telemetry spans, truncate to 8–12 chars in log messages | Audit + privacy |
| 14 | Test every new feature; co-locate `*.test.ts` next to source | Tests are part of "done" |
| 15 | `lib/ai/` changes require guardrail tests to pass | Security regression gate |

## Hard conventions (DON'T)

| # | Rule | Why |
|---|------|-----|
| 1 | Don't import `lib/supabase/server.ts` in client components | Breaks tree-shaking + leaks server config |
| 2 | Don't import `lib/logger.ts` in `middleware.ts` (use `lib/logger.edge.ts`) | Pino uses Node streams → crashes Edge Runtime |
| 3 | No `console.log` | Use Pino. Structured logs only. |
| 4 | Don't skip Zod validation on any API input | — |
| 5 | Don't add Claude API calls without going through sanitization pipeline + without `{ timeout: 30_000 }` | Hung request = stuck worker |
| 6 | Don't hardcode the model string — single `CLAUDE_MODEL` constant in `generate/route.ts` | Phase 21 fix #14 |
| 7 | Don't block the generate response with analytics / style processing | Fire-and-forget |
| 8 | Don't commit `.env.local` or any file containing secrets | — |
| 9 | Don't add module-level SDK instantiation | Cold start regressions |
| 10 | Don't install Pino transports using Node streams in middleware | — |
| 11 | Don't inject user content into prompt XML tags without `escapeForXmlTag()` | Prompt injection — Phase 19 fix #5 |
| 12 | Don't make rate limiting fail-open — if check fails, deny | Phase 19 fix #1 |
| 13 | Don't use non-null assertions (`!`) on env vars — validate explicitly with a clear error | Phase 22 |
| 14 | Don't log or expose `SUPABASE_SERVICE_ROLE_KEY` | Phase 22 |
| 15 | Don't silently swallow non-text Claude response blocks — throw with content type info | Phase 22 |
| 16 | Don't hardcode magic numbers — use env vars with sensible fallbacks (`EXTENSION_DAILY_LIMIT` default 30) | Phase 22 |
| 17 | Don't return Zod 400s without field-level `details` array | Phase 21 fix #13 |
| 18 | Don't use CORS wildcard `*` for null-origin requests — extensions must send `chrome-extension://` origin | Phase 21 fix #11 |

## 28 production-readiness fixes (by tier)

Full audit trail in `/.claude/production-readiness-evaluation.md`. Phase entries in `/.claude/claude-progress.txt`.

### Tier 1 — Critical security (Phase 19)

| # | Fix | File | Behavior |
|---|-----|------|----------|
| 1 | Rate limit fail-open → fail-closed | `app/api/extension/generate/route.ts:94` | RPC error → `allowed: false`, 1 min retry window |
| 2 | Claude API 30 s timeout | `app/api/extension/generate/route.ts:222` | `{ timeout: 30_000 }` + `APIConnectionTimeoutError` → 504 |
| 3 | Session endpoint rate limit | `app/api/extension/session/route.ts` | In-memory sliding window, 20 req/min/IP, stale entries purged every 5 min |
| 4 | DOMPurify hardening | `lib/ai/sanitizer.ts` (Phase 24 superseded — DOMPurify removed entirely, HTML strip via regex; safe because AI output never rendered as HTML) | — |
| 5 | Prompt-injection defense — `escapeForXmlTag()` | `lib/ai/prompts/linkedin-connection.ts` | Every user input escaped before `<user_input>` injection |

### Tier 2 — Security and quality (Phase 20)

| # | Fix | File |
|---|-----|------|
| 6 | Nonce-based CSP (drop `unsafe-inline`/`unsafe-eval` in prod) | `middleware.ts`, `app/layout.tsx`, `app/providers.tsx` |
| 7 | Robust JSON extraction (balanced brace tracking) → superseded by Phase 24 single-pass parse + 502 retry | `app/api/extension/generate/route.ts` |
| 8 | Anthropic 401 returns 502 (correct upstream-failure semantics) | `route.ts` |
| 9 | Context-aware email redaction (preserved in cold email, redacted in LinkedIn) | `lib/ai/sanitizer.ts` |
| 10 | `isAIGenerated` flag uses AND, not OR (removed in Phase 24 — scoring deleted) | — |

### Tier 3 — Hardening (Phase 21)

| # | Fix | File |
|---|-----|------|
| 11 | CORS no `*` wildcard for null-origin requests | `lib/cors.ts` |
| 12 | Remove forced period in `cleanupSanitizedContent` | `lib/ai/ai-fingerprint-detector.ts` |
| 13 | Zod 400 errors include `details: [{ field, message }]` | `app/api/extension/generate/route.ts` |
| 14 | Model string → single `CLAUDE_MODEL` constant | `route.ts` |
| 15 | Schema input limits: `profileUrl.max(2048)`, `resume.max(50000)`, `jd.max(20000)`, `acceptedExamples.max(5)` × `max(5000)` | `schema.ts` |

### Phase 22 — Remaining sweep

- Full user ID in telemetry spans, truncated only in log messages
- Service role key: explicit null-check, never passed to logger
- Style merge: atomic RPC with upsert fallback
- Cache hash: djb2 → FNV-1a 64-bit (cache code later removed in Phase 24)
- Non-null assertion `!` on env vars → explicit check + thrown error
- `DAILY_LIMIT` → `EXTENSION_DAILY_LIMIT` env var, default 30
- Dead `email: ""` field → real `user.email`
- Silent non-text response → explicit error with content-type log
- Profanity: 8 individual terms → 5 pattern groups
- Blocked content: leet-speak variants added (`n@zi`, `k1ll`)
- Perfect paragraph break flag: only when 3+ consecutive uppercase-starts
- Schema whitespace bypass: `.trim().min(10)` on `profileMarkdown`
- `stripMarkdownCodeFences`: drop `^` anchor — find fence anywhere

### Phase 23 — Extension testing

100 tests added (later trimmed to 94 in Phase 24). Pure-function extraction (auth-core, profile-extractor, popup-core). esbuild added for ES-module → IIFE bundling. Full chrome.* API mock in `test/setup.ts` + `chrome-mocks.ts`.

### Phase 24 — Strategic deletion (MVP right-sizing)

- AI pipeline LoC: 1,688 → ~1,097 (−35%).
- 16 packages removed (`zustand`, `@tanstack/react-query`, `posthog-js`, `@vercel/otel`, `@opentelemetry/api`, `pino-pretty`, `isomorphic-dompurify`, `crypto-browserify`, `stream-browserify`, `buffer`, `process`, plus loki / OTel deps).
- CI workflows: 3 → 1 (deleted `cd.yml`, `staging.yml`).
- Vercel projects: 2 → 1 (staging removed).
- Sanitizer: deleted `quickSanitize`, `sanitizeForExport`, `validateForStorage`, `sanitizeResponseMetadata`, `sanitizeWithCaching`, `hashContent`, DOMPurify dynamic import + fallback path.
- Fingerprint detector: removed scoring (`calculateAuthenticityScore`, `isLikelyAIGenerated`, `analyzeContentAuthenticity`) — strip-only now.
- Generate response: dropped `authenticityScore`, `isAIGenerated`, `modificationsApplied`, `validation` from response.
- Popup: removed score-meter UI.
- JSON parse: 3-pass extraction → 1 attempt + 502 retry instruction.
- Style learning threshold: `approved_message_count >= 3` → `>= 1`.

What's preserved (the moat): prompt grounding, 3 system prompts, `escapeForXmlTag` injection defense, `sanitizeForLinkedIn` / `sanitizeForEmail`, 21 fingerprint patterns, `analyzeStyle` + `mergeStylePatterns` learning loop, scraper, fail-closed rate limit, 30 s Claude timeout, full Zod validation with `.max()` ceilings.

### Phase 25 — Eval Metadata + Doc Sync (2026-05-19)

- `PROMPT_VERSION = "1.0.0"` exported from `lib/ai/prompts/linkedin-connection.ts` — bump on every prompt change.
- `evalMetadata` blob `{ promptVersion, model, temperature, category, intent, generationTimeMs, inputTokens, outputTokens }` returned on every generate response.
- Extension echoes `evalMetadata` back via `POST /api/extension/feedback`.
- Feedback route now **synchronously inserts** the `user_feedback` row (with `feedback_type`, `rating`, `comment`, full metadata) before returning 200. Style merge stays fire-and-forget. Reason: eval signal must survive worker crash after response.
- `evalMetadataSchema.strict()` added to `app/api/extension/feedback/schema.ts`.
- `app/api/auth/me/route.ts:11` — `DAILY_LIMIT = 30` → `Number(process.env.EXTENSION_DAILY_LIMIT) || 30` to match Phase 22 #6 in `generate/route.ts`.
- Test count: 232 → 235 (3 new tests cover `evalMetadata` round-trip + sync insert path).
- Doc sync: CLAUDE.md request body shape corrected to flat `profileMarkdown` + `profileUrl` (was still showing pre-Phase-15 nested `profile` object). Schema maxes corrected: `resume` 8000→50000, `jd` 4000→20000. Failure mode 402→429. Active tables list expanded 5→8 in README.

## Adding a feature — minimal checklist

1. Create `schema.ts` next to the route with the Zod schema.
2. Create `route.ts` — import schema, use lazy SDK factories, add `{ timeout: 30_000 }` for any Claude call, return structured error JSON.
3. Create `route.test.ts` — schema validation + every handler branch including failure modes.
4. If touching `lib/ai/*`: add cases to `*.test.ts` AND `*.guardrails.test.ts`.
5. `make ci` locally → must pass before opening PR.
6. Open PR to `main`. CI gate runs lint + type-check + tests + guardrails + smoke build. Merge → Vercel auto-deploys.

## Cross-references

- Which fix corresponds to which DON'T → tables above
- Routes the security work hardened → `02-web-app-routes.md`
- AI pipeline changes (Tier 1 #5 escape, Tier 2 #9 email context, Phase 24 deletions) → `03-ai-pipeline.md`
- CSP nonce flow (Tier 2 #6) → `06-infrastructure.md#csp-nonce-flow`
- Guardrail test contract (Tier 1 + adversarial inputs) → `07-testing.md#guardrails-suite`
- Full per-tier evaluation with severity scoring → `/.claude/production-readiness-evaluation.md`
- Tier 1 detailed before/after → `/.claude/tier1-security-fixes.md`
- Phase 24 deletion rationale → `/.claude/phase-24-strategic-deletion.md`
