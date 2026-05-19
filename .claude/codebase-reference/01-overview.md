# 01 — Overview

## What

Aletheia is an AI-powered LinkedIn outreach platform. It generates LinkedIn connection requests, cold emails, and InMails that sound like the user, not like an AI assistant. Differentiator: a learning loop — every approved message updates the user's voice profile, which is re-injected into the next generation.

## Why (positioning)

- Not a humanizer (no "rewrite this AI text" angle).
- Not a generic chatbot.
- A personalized outreach tool that grounds output strictly in: (a) the target's LinkedIn profile, (b) the user's resume/JD/projects, (c) a per-user style profile built from prior approvals. No fabricated metrics, no invented projects.

## Where (two surfaces)

| Surface | Lives in | Purpose |
|---------|----------|---------|
| **Next.js web app** | `app/`, `lib/`, `components/`, `middleware.ts` | Auth, dashboard, settings, landing, and all API routes (Vercel deploy) |
| **Chrome MV3 extension** | `ascendia-extension/` (separate package) | Scrapes LinkedIn profile, opens popup/side panel, calls API, auto-fills compose box |

They communicate through a stable HTTP API — see `02-web-app-routes.md`.

## End-to-end user journey

1. **Install extension** → log in once via the web app. Extension fetches a Bearer token via `GET /api/extension/session` (cookie auth bridge) and stores it in `chrome.storage.local`. Service worker refreshes it every 20 min via `chrome.alarms`.
2. **Open a LinkedIn profile** → `content/linkedin-reader.js` extracts `name` (from `document.title`) and `profileMarkdown` (from `mainEl.innerText`, no CSS selectors).
3. **Open popup/side panel** → user picks category (`linkedin_connection` / `cold_email` / `linkedin_inmail`) and intent (`networking` / `referral` / `mentorship` / `job_inquiry`).
4. **Click Generate** → `POST /api/extension/generate` with profile + resume + optional JD + acceptedExamples. Bearer auth, persistent rate limit (`check_and_increment_rate_limit` RPC, default 30/day/user, fail-closed).
5. **Server pipeline:**
   - Auth → fetch learned style (`user_preferences.style_patterns`, only if `approved_message_count >= 1`) → rate-limit check.
   - Zod validate → `stripSurrogates` → build prompt with `escapeForXmlTag()` on every user input → Claude (`claude-sonnet-4-6`, temp 0.8, 600 tokens, 30 s timeout).
   - Sanitize: `sanitize()` lexicon filter → `sanitizeForLinkedIn()` (HTML strip, harmful patterns, profanity, context-aware email redaction) → `detectAIFingerprints()` strips 21 AI-tell patterns.
   - Smart truncate: LinkedIn 270 chars at sentence boundary; cold email/InMail to word limit.
6. **Response** returned: `{ success, body, [subject_line, word_count], category, character_count, usage, processingTime, evalMetadata }`.
7. **User feedback** in popup → `POST /api/extension/feedback`. Inserts row, returns 200 immediately. **Fire-and-forget** background task: on approval, `analyzeStyle()` + `mergeStylePatterns()` blend into `user_preferences.style_patterns` via atomic RPC (`increment_approved_count`).
8. **Auto-fill** (optional) — `content/auto-filler.js` writes the generated message into LinkedIn compose box or Apollo sequence.

## Tech stack (condensed — full table in `/CLAUDE.md`)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router (SSR + API routes + middleware) |
| UI | React 18, Tailwind, Radix, shadcn/ui, Framer Motion |
| Forms | React Hook Form + Zod |
| DB / Auth | Supabase (Postgres + Auth + RLS) |
| AI | Anthropic Claude `claude-sonnet-4-6` |
| Extension | Chrome MV3 (service worker, content scripts, side panel) |
| Logging | Pino → stdout (Node) / console (Edge) |
| Errors | Sentry (client + server + edge configs) |
| Tests | Vitest (unit + guardrails), Playwright (`@smoke`), Vitest in extension dir |
| Deploy | Vercel single project, auto-deploys `main` |

## Core design patterns

| Pattern | Where | Why |
|---------|-------|-----|
| Lazy SDK factories (`getAnthropic`, `getSupabaseService`) | `app/api/extension/generate/route.ts` | Avoid module-level instantiation — breaks Vercel edge cold start |
| Fire-and-forget feedback | `app/api/extension/feedback/route.ts` | Never block user response on style merge |
| Single-pass JSON parsing | `route.ts` cold_email branch | JSON.parse → on fail return 502 with "retry". No regex fallback. |
| Smart sentence-boundary truncation | LinkedIn branch in `route.ts` | LinkedIn 300-char limit enforced gracefully, not cut mid-word |
| Fail-closed rate limit | `checkRateLimit()` in `route.ts` | RPC error → deny request (prevents unlimited API spend during DB outage) |
| Prompt-injection escape | `escapeForXmlTag()` in `lib/ai/prompts/linkedin-connection.ts` | Every user-input field escaped before injection into `<user_input>` tags |
| Atomic RPC + upsert fallback | feedback route + style merge | Use SECURITY DEFINER RPC; fall back to non-atomic upsert only if RPC missing |
| Schema-in-`schema.ts` sibling | every `app/api/**/route.ts` | Next.js routes only allow HTTP-method exports — tests import schema from sibling |
| Logger split Node vs Edge | `lib/logger.ts` vs `lib/logger.edge.ts` | Pino uses Node streams → crashes Edge Runtime. Middleware uses edge variant only. |

## What this codebase is *not*

- Not a chat product. The `messages` / `conversations` tables were dropped in Phase 3 (2026-04-01). Generation is one-shot per request.
- Not multi-tenant. Single Vercel project. Single Supabase project. RLS isolates users on a shared DB.
- Not real-time. No websockets. No streaming response from Claude in current build.
- Not analytics-heavy. PostHog, OpenTelemetry, Loki shipping all removed in Phase 24 (2026-05-11) — Vercel function logs cover the 10–50 user MVP tier.
