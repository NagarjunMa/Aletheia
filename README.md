# Aletheia — AI-Powered LinkedIn Outreach Platform

## Overview

Aletheia is a personalized voice agent (PVA) that generates authentic LinkedIn connection requests, cold emails, and InMails. It reads a target's LinkedIn profile, combines it with the user's resume and intent, then produces a sanitized, human-sounding message — complete with AI fingerprint detection and removal.

**Key value props:**
- One-click outreach message generation from any LinkedIn profile
- AI fingerprint detection and removal (21 patterns, authenticity scoring)
- Learning mechanism: accepted messages improve future output
- Chrome Extension with seamless web-app session bridging
- Per-user rate limiting (30/day) with persistent tracking

---

## Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | Next.js (App Router) | 14.x | SSR, API routes, middleware, edge support |
| UI | React, Tailwind CSS, Radix UI, shadcn/ui | 18.x | Component primitives, responsive design |
| State | Zustand, TanStack Query | 4.x / 5.x | Client state + server state caching |
| Database | Supabase (PostgreSQL) | — | Auth, RLS, realtime, RPC functions |
| AI | Anthropic Claude (claude-sonnet-4-20250514) | — | Message generation with prompt engineering |
| Auth | Supabase Auth | — | Email/password, Google OAuth, GitHub OAuth |
| Extension | Chrome Manifest V3 | — | Service worker, content scripts, popup |
| Logging | pino + pino-pretty | 8.x | Structured JSON logging (prod), pretty-printed (dev) |
| Validation | Zod | 3.x | Runtime schema validation for API inputs |
| Analytics | PostHog (optional) | — | Product analytics, feature-gated |
| Error Tracking | Sentry (optional) | — | Client, server, edge error reporting |
| 3D Graphics | Three.js, React Three Fiber | — | Landing page visuals |
| Animations | Framer Motion, Lottie | — | Page transitions, micro-interactions |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                              │
│                                                                     │
│  ┌──────────────────────┐        ┌──────────────────────────────┐  │
│  │  Chrome Extension    │        │  Next.js Web App (Client)    │  │
│  │  (MV3 Service Worker │        │  - Auth pages (login/reg)    │  │
│  │   + Popup + Content  │        │  - Dashboard, Settings       │  │
│  │   Scripts)           │        │  - Profile management        │  │
│  └──────────┬───────────┘        └──────────────┬───────────────┘  │
│             │ Bearer token auth                 │ Cookie-based auth │
└─────────────┼───────────────────────────────────┼──────────────────┘
              │                                   │
              ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                NEXT.JS SERVER (Vercel Edge + Node.js)               │
│                                                                     │
│  ┌───────────┐  ┌────────────────┐  ┌────────────────────────┐    │
│  │ Middleware │  │ API Routes     │  │ Server Actions         │    │
│  │ - Auth    │  │ /api/health    │  │ ensureProfileAction()  │    │
│  │ - CSP     │  │ /api/extension │  │                        │    │
│  │ - CORS    │  │ /api/auth/me   │  │                        │    │
│  └───────────┘  │ /api/feedback  │  └────────────────────────┘    │
│                 │ /api/docs      │                                  │
│                 └───────┬────────┘                                  │
└─────────────────────────┼──────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Supabase   │  │  Anthropic   │  │  PostHog /   │
│  (DB + Auth) │  │  Claude API  │  │  Sentry      │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Core Workflow

1. User navigates to a LinkedIn profile in Chrome
2. Content script reads the target's profile data (name, headline, experience, posts, skills)
3. User clicks "Generate" in the extension popup
4. Extension sends profile data + user's resume/JD + intent to `POST /api/extension/generate`
5. Server authenticates via Bearer token, checks rate limit (30/day)
6. Prompt is built from system template + user context using `buildPrompt()`
7. Anthropic Claude generates the message (claude-sonnet-4-20250514, temp 0.8, max 600 tokens)
8. Output passes through 3-stage sanitization: basic lexicon → platform-specific → AI fingerprint detection
9. Sanitized message is returned to the extension and auto-filled into LinkedIn's message field

---

## AI Pipeline

**Prompt engineering:** Category-specific system prompts for linkedin_connection (270 char limit), cold_email (150 word limit), and linkedin_inmail (120 word limit). Each prompt includes banned phrase lists, grounding rules, and tone guidelines.

**Model config:** `claude-sonnet-4-20250514`, temperature 0.8, max_tokens 600

**Category constraints:**

| Category | Format | Limit | Structure |
|----------|--------|-------|-----------|
| linkedin_connection | Plain text | 270 chars | Acknowledgment → Intro → CTA |
| cold_email | JSON (subject + body) | 150 words | WHO → WHY COMPANY → WHY YOU → ASK |
| linkedin_inmail | JSON (subject + body) | 120 words | Compressed cold email format |

---

## Sanitization Layer

3-stage pipeline applied to all AI output:

1. **Basic sanitization** (`sanitize()` in `lib/ai/prompts/linkedin-connection.ts`): Removes AI vocabulary fingerprints from a negative lexicon (22 words/phrases like "delve", "leverage", "I'm reaching out")

2. **Platform-specific sanitization** (`sanitizeForLinkedIn()` in `lib/ai/sanitizer.ts`): HTML stripping, DOMPurify sanitization, profanity filtering, harmful pattern redaction (SSN, credit cards, injection attempts), blocked content detection (hate speech, violence)

3. **AI fingerprint detection** (`detectAIFingerprints()` in `lib/ai/ai-fingerprint-detector.ts`): 21 patterns scored with confidence weighting. Content above threshold is humanized automatically. Returns authenticity score and detected pattern list.

---

## Guardrails

- **Content blocking**: Hate speech, violence, and illegal content patterns blocked entirely
- **Harmful pattern redaction**: SSN, credit card numbers, email addresses, script/SQL/command injection patterns replaced with `[REDACTED]`
- **Rate limiting**: 30 requests per user per 24-hour sliding window, persisted in Supabase. Fails open on DB error.
- **CORS whitelist**: Only `chrome-extension://*`, `localhost:*`, `*.vercel.app` origins allowed
- **Zod validation**: All API request bodies validated with strict schemas
- **Honeypot spam prevention**: Feedback endpoint includes invisible field that bots fill

---

## Learning Mechanism

- **`acceptedExamples`**: When a user accepts a generated message, it's stored and included in future prompts (up to 3 examples). The AI matches the rhythm and style of previously accepted messages.
- **`generated_drafts.is_accepted`**: Tracks which drafts were accepted for analytics and writing style vector computation.
- **Writing style vectors**: 9 Supabase RPC functions enable vector similarity search across a user's historical style, category-filtered matching, and cross-user style comparison.

---

## Extension Architecture

- **Manifest V3**: Service worker-based background script (no persistent background page)
- **Auth flow**: Extension fetches session tokens via `GET /api/extension/session` (cookie bridge), stores in `chrome.storage.local`, refreshes via alarm every 20 minutes
- **Content scripts**: `profile-reader.js` reads LinkedIn DOM, `auth-bridge.js` detects login page sessions
- **Service worker**: Handles `generate`, `healthCheck`, `authenticate`, `logout`, `getAuthStatus` messages from popup
- **Token lifecycle**: Automatic proactive refresh, silent re-fetch on 401, interactive login fallback

---

## API Documentation

- **Interactive**: Visit `/docs` for Swagger UI (development only, or set `ENABLE_API_DOCS=true`)
- **JSON spec**: `GET /api/docs` returns the OpenAPI 3.0 specification
- **Detailed reference**: See [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) for complete endpoint documentation including request/response schemas, error codes, CORS policy, and data flow diagrams

---

## Environment Setup

### Prerequisites
- Node.js 18+ or 20+
- npm
- Supabase project (for database and auth)
- Anthropic API key

### Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional — Logging
LOG_LEVEL=debug                    # debug | info | warn | error (default: debug in dev, info in prod)

# Optional — Analytics & Monitoring
NEXT_PUBLIC_ENABLE_ANALYTICS=true  # Enables PostHog
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_ENABLE_ERROR_REPORTING=true  # Enables Sentry
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_DSN=your_sentry_dsn

# Optional — API Docs
ENABLE_API_DOCS=true               # Enable Swagger UI in production
```

### Installation

```bash
git clone <repository-url>
cd aletheia
npm ci
cp .env.example .env.local   # Edit with your values
npm run dev
```

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript type checking |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run test:ui` | Vitest UI |
| `npm run test:guardrails` | Run guardrail-specific tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:e2e:debug` | Playwright debug mode |
| `npm run analyze` | Bundle analysis |
| `npm run validate` | Startup validation script |

---

## Testing Framework

### Unit Testing (Vitest)
- React Testing Library for component tests
- 80% coverage threshold for branches, functions, lines, statements
- AI service testing utilities and streaming tests

### End-to-End Testing (Playwright)
- Cross-browser: Chromium, Firefox, WebKit
- Mobile viewports: iPhone 12, Pixel 5
- Auth flows, AI generation workflows, visual regression, accessibility

### Security Testing
- Input validation: SQL injection, XSS, prompt injection
- Rate limiting: user-based limits
- Content sanitization: HTML, JSON, plain text

---

## Deployment

### Vercel
- Next.js 14 with App Router
- Edge function support, automatic HTTPS, global CDN

### CI/CD Pipeline (GitHub Actions)
- Full test suite: unit, integration, E2E, security, accessibility
- Performance: Lighthouse CI, bundle analysis
- Security: dependency scanning, CodeQL
- Automated staging (develop branch) and production (main branch) deployments

---

## Monitoring

| System | Purpose | Gate |
|--------|---------|------|
| **Sentry** | Error tracking (client, server, edge), session replay | `NEXT_PUBLIC_ENABLE_ERROR_REPORTING=true` |
| **PostHog** | Product analytics, user behavior, feature usage | `NEXT_PUBLIC_ENABLE_ANALYTICS=true` |
| **Structured logging (pino)** | JSON logs in production, pretty-printed in development | Always on |
| **Health check** | `GET /api/health` or `/healthz` | Always on |

---

## License

MIT
