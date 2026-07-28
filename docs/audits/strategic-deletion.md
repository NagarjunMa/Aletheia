# Strategic Deletion Audit (Phase 24)

> **Historical snapshot:** this document records a completed May 2026 cleanup and is not the current implementation guide.

**Goal:** Keep moat. Cut theater. Reduce LoC ~50%, ops surface ~70%.

**Moat (keep, do not touch):**

- Prompt engineering — `lib/ai/prompts/linkedin-connection.ts` (grounding, banned phrases, no-fabrication)
- Style learning — `lib/ai/style-analyzer.ts` + `acceptedExamples` injection
- LinkedIn scraper — `ascendia-extension/content/linkedin-reader.js`
- Auth + RLS (Supabase)
- Rate limit (Postgres RPC, fail-closed)
- Zod validation
- XML escape for prompt injection
- Claude 30s timeout
- DOMPurify path (only if HTML is rendered anywhere — verify in §2)

**Theater (cut/trim):**

- Authenticity score UI + scoring math
- 5 unused sanitizer exports
- 3 unused fingerprint exports
- Sanitization caching + 64-bit hash
- Triple-tier parsing fallback (collapse to one retry)
- Loki + OTel observability stack
- 3-stage CD (collapse to PR gate + direct prod deploy)
- 4+ unused npm deps

---

## §1 — Observability Trim

Remove Grafana Loki, OTel, PostHog. Keep Sentry (errors) + Pino stdout (Vercel logs).

- [ ] Delete Loki HTTP push stream code in `lib/logger.ts`. Pino → stdout only.
- [ ] Delete `@vercel/otel` instrumentation. Remove `instrumentation.ts` if it only does OTel.
- [ ] Delete `@opentelemetry/api` trace/span mixin in logger.
- [ ] Delete `lib/posthog/provider.tsx`. Remove PostHog provider from `app/providers.tsx`.
- [ ] Delete `lib/logger.edge.ts` IF middleware can use `console.log` (Edge-safe). Otherwise keep.
- [ ] `package.json`: `npm uninstall @vercel/otel @opentelemetry/api posthog-js pino-pretty`.
  - Keep `pino` for structured JSON to stdout.
  - Update `npm run dev` script — remove `| pino-pretty` pipe.
- [ ] Remove `LOKI_HOST`, `LOKI_USERNAME`, `LOKI_PASSWORD`, `NEXT_PUBLIC_POSTHOG_KEY` from `.env.local.example` + CLAUDE.md env table.
- [ ] Vercel: delete Loki + PostHog env vars from project settings (manual after merge).

**Net:** ~200 LoC gone. $0–50/mo Grafana saved. 4 env vars gone.

---

## §2 — Sanitizer Trim (`lib/ai/sanitizer.ts`: 585 → ~250 LoC)

### Delete (verified dead — only imported from `lib/ai/README.md` or tests):

- [ ] `quickSanitize()` (lines 354–369)
- [ ] `sanitizeForExport()` (lines 407–420)
- [ ] `validateForStorage()` (lines 422–435)
- [ ] `sanitizeResponseMetadata()` + `AIResponseMetadata` interface (lines 437–526)
- [ ] `sanitizeWithCaching()` + `hashContent()` + `cleanupCache()` + `sanitizationCache` Map + `CACHE_TTL` (lines 528–585)

### Verify before deleting DOMPurify path:

- [ ] `grep -r "innerHTML\|dangerouslySetInnerHTML" app components` → if zero hits, message output is never rendered as HTML. Then drop DOMPurify entirely (lines 26–56, 213–233).
- [ ] If HTML render exists somewhere, keep DOMPurify but only when `allowHtml=true` (no caller uses it today, so still removable).

### Keep:

- `stripSurrogates()` — needed for Anthropic JSON serialization
- `sanitizeAIOutput()` core — strip blocked content, harmful patterns, profanity, email redaction (platform-aware), AI fingerprint humanization, whitespace
- `sanitizeForLinkedIn()`, `sanitizeForEmail()` — used by generate route

### Test updates:

- [ ] Delete `lib/ai/sanitizer.test.ts` tests for removed functions (~12 cases).
- [ ] Keep guardrail tests intact (XSS, SQL inj, hate speech, PII).
- [ ] Delete `lib/ai/README.md` (or trim to current API).

**Net:** ~335 LoC gone, ~12 tests gone, no behavior change for users.

---

## §3 — Fingerprint Detector Trim (`lib/ai/ai-fingerprint-detector.ts`: 515 → ~200 LoC)

### Strategy: Keep the **stripper**, drop the **scorer**.

### Delete:

- [ ] `calculateAuthenticityScore()` (lines 320–376) — arbitrary weights, no empirical basis (per audit)
- [ ] `calculateInformalityScore()` (lines 380–410)
- [ ] `calculateVariation()` (lines 414–424)
- [ ] `PLATFORM_AUTHENTICITY_RULES` (lines 204–231) — only consumed by deleted scoring
- [ ] `isLikelyAIGenerated()` (lines 453–460) — unused
- [ ] `sanitizeAIFingerprints()` (lines 464–471) — unused
- [ ] `analyzeContentAuthenticity()` (lines 475–515) — unused
- [ ] `authenticityScore` and `confidence` fields from `AIFingerprintResult` interface

### Keep:

- `AI_FINGERPRINT_PATTERNS` array — the actual moat. All 21 patterns stay.
- `detectAIFingerprints()` — but trimmed: apply patterns, return `{ sanitizedContent, detectedPatterns, modifications, warnings }` only. No scoring. No `isAIGenerated` boolean — always treat output as needing humanization pass.
- `cleanupSanitizedContent()` — whitespace fix-up after pattern strip

### Test updates:

- [ ] Update `ai-fingerprint-detector.test.ts` — delete score-related assertions (~7 tests). Keep pattern-replacement tests.

**Net:** ~315 LoC gone, ~7 tests gone, output strip behavior identical.

---

## §4 — Remove Score UI from Extension + Generate Response

### Generate route (`app/api/extension/generate/route.ts`):

- [ ] Remove `authenticityScore` from all 4 response branches (lines ~351, 363, 393–397, 437, 466–467, 500, etc.)
- [ ] Remove `isAIGenerated` from response branches
- [ ] Keep `modificationsApplied` array (useful for debug logging) but DON'T return to client — log only
- [ ] Simplify response shape to: `{ message: string, subjectLine?: string }`
- [ ] Update generate route Zod response inference + `route.test.ts` (~5 test branches)

### Extension popup (`ascendia-extension/popup/popup.js`):

- [ ] Remove score meter rendering (lines ~447–470 — animated bar, color thresholds)
- [ ] Remove "Voice authenticity: X/100" text
- [ ] Remove collapsible detected-patterns list
- [ ] Keep rejection-reason quick-select on regenerate (real feedback signal)
- [ ] Update `popup-core.js` `parseGenerateResponse()` — drop score/patterns fields
- [ ] Update `popup-core.test.ts` (~4 cases tied to score)

### Web settings (`app/settings/_settings-content.tsx`):

- [ ] Voice Profile card stays (shows learned style) — but only show if `approved_message_count >= 1`, not `>=3`
- [ ] Reset style button stays

**Net:** ~120 LoC gone across route + popup. User-facing surface simpler.

---

## §5 — Triple-Tier Parsing Collapse (`app/api/extension/generate/route.ts` + `utils.ts`)

### Current: JSON parse → sanitize+retry → regex extract → raw text fallback.

### Target: JSON parse → retry once with stricter prompt → return error.

- [ ] In `route.ts`, delete the regex-extract branch (~lines ~430–500 region, the third fallback).
- [ ] Delete `extractJsonFromText()` in `app/api/extension/generate/utils.ts`.
- [ ] Keep `stripMarkdownCodeFences()` — Claude wraps in ```json fences sometimes.
- [ ] On parse failure: log warn, return 502 to client with `{ error: "Generation format error, please retry" }`. User clicks regenerate (single human action) instead of fragile auto-recovery.
- [ ] Update `route.test.ts` — delete regex-fallback tests, add a single "parse fail → 502" test.

**Net:** ~150 LoC gone. Real-world Claude JSON failure rate likely <1% — user retry is cheaper than maintaining 3-tier branching.

---

## §6 — Style Learning Threshold Lowered (Keep Moat, Make It Active Earlier)

- [ ] `app/api/extension/generate/route.ts` line 156: change `>= 3` to `>= 1`. One approval = personalization starts.
- [ ] `app/settings/_settings-content.tsx`: change "Approve 3 messages to start" copy to "Approve 1 message to start".
- [ ] No DB migration needed.

**Net:** ~2 LoC change. Activates moat for 10–50 user cohort who otherwise never hit threshold.

---

## §7 — CD Pipeline Simplification

### Current: `main` → `cd.yml` → `staging` branch → `staging.yml` → `production` branch. Two Vercel projects, 6 secrets, real Anthropic E2E on staging.

### Target: PR gate + direct deploy to one Vercel project.

- [ ] Delete `.github/workflows/staging.yml` entirely.
- [ ] Delete `.github/workflows/cd.yml` entirely.
- [ ] Keep `.github/workflows/ci.yml` as the PR gate (lint + type + test + guardrails + smoke build).
- [ ] In Vercel: delete `aletheia-staging` project. Point `aletheia` (prod) project at `main` branch.
- [ ] Delete `e2e/generate.spec.ts` (real-Anthropic test that ran on staging). Keep `e2e/health.spec.ts`, `e2e/ui-smoke.spec.ts` for `npm run test:e2e` local-only.
- [ ] Delete 6 GitHub secrets: `STAGING_*` set. Keep `ANTHROPIC_API_KEY` and `NEXT_PUBLIC_SUPABASE_*` for prod build.
- [ ] Delete `staging` and `production` branches after merge to `main`.
- [ ] Update CLAUDE.md "Deployment" section — single-stage flow.
- [ ] Update Makefile: remove `e2e-staging` target. Keep `e2e-smoke`.

**Net:** 2 workflows gone, 1 Vercel project gone, 6 secrets gone, 2 branches gone, ~$0–20/mo Vercel saved, big mental-overhead drop.

---

## §8 — Dependency Removal

Verified unused (grep returned zero non-test, non-self imports):

- [ ] `npm uninstall zustand` — not used anywhere in app code
- [ ] `npm uninstall @tanstack/react-query @tanstack/react-query-devtools` — not used in app code
- [ ] `npm uninstall posthog-js` — covered by §1
- [ ] `npm uninstall @vercel/otel @opentelemetry/api` — covered by §1
- [ ] `npm uninstall pino-pretty` — covered by §1

Re-evaluate (decide during cut):

- [ ] `crypto-browserify`, `stream-browserify`, `buffer`, `process` — check `next.config.js` webpack fallbacks. Remove if no longer referenced after observability cut.
- [ ] `framer-motion` — heavy use on landing + auth pages. **Keep** (sales surface).
- [ ] `react-intersection-observer` — landing only. Keep.
- [ ] `next-themes` — used by Providers. Keep.
- [ ] `isomorphic-dompurify` — drop if §2 verification shows no HTML render.

**Net:** ~5–9 packages gone, smaller bundle, faster cold starts on Vercel.

---

## §9 — Test Suite Pruning

After §2, §3, §4, §5 cuts:

- [ ] Run `npm run test -- --run`. Delete failing tests for now-removed functions.
- [ ] Target: ~150–180 tests total (currently 286). Quality > quantity.
- [ ] `npm run test:guardrails -- --run` must still pass — guardrails are non-negotiable.
- [ ] Extension tests (100 in `ascendia-extension/`) — keep, but drop the ~4 popup score-meter tests after §4.
- [ ] Remove coverage threshold enforcement from CI if it was added. Coverage % is vanity; passing tests is what matters.

---

## §10 — Documentation Sync

After all cuts, single-pass update:

- [ ] `CLAUDE.md` — update Tech Stack table (drop OTel/Loki/PostHog rows), update Deployment section, update Dos/Don'ts (drop "don't install pino-loki" rule etc.), update env var table.
- [ ] `README.md` — same.
- [ ] `FUNCTIONS.md` — regenerate or hand-trim deleted functions.
- [ ] `.env.local.example` — strip removed vars.
- [ ] Update `.claude/claude-progress.txt` — add Phase 24 entry summarizing what was cut, with status `[x] COMPLETE`.

---

## Execution Order (low-risk → high-risk)

1. §1 Observability trim — isolated, easy revert
2. §8 Dep removal (the ones confirmed dead: zustand, react-query, otel) — package.json only
3. §2 Sanitizer dead-code removal — pure dead-code, no behavior change
4. §3 Fingerprint scorer removal — keep stripper, drop math
5. §5 Triple-parse collapse — touches generate route logic, retest carefully
6. §4 Score UI removal — touches API contract + extension popup, version-aware
7. §6 Style threshold 3→1 — trivial
8. §7 CD pipeline collapse — DO LAST, after everything green on main
9. §9 Test pruning — continuous through above
10. §10 Docs sync — final pass

After each step: `make ci` (lint + type-check + test + guardrails + build) must pass.

---

## Risk Notes

- **DO NOT cut prompt engineering files.** `prompts/linkedin-connection.ts` is the moat.
- **DO NOT cut style-analyzer.** Feedback loop runs through it.
- **DO NOT cut acceptedExamples injection in prompt builder** (line 382).
- **DO NOT cut scraper.** Phase 15 rewrite was right; LinkedIn DOM-fragility risk is real.
- **DO NOT cut Zod validation, XML escape, fail-closed rate limit, 30s Claude timeout.** These are real security/resilience, not theater.

---

## Acceptance Criteria

- `make ci` green
- LoC count under `lib/ai/` < 1,000 (currently 1,688)
- `package.json` deps count down by ≥5
- One Vercel project, one CI workflow
- User-visible: extension popup is simpler, no score meter. Generated message quality identical (same prompt + same strip patterns).
- Style learning active after first approval, not third.
