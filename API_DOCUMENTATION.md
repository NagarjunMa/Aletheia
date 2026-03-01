# Aletheia — Comprehensive API & Integration Documentation

> **Last updated:** February 2026
> **Application:** Aletheia (formerly Ascendia) — AI-powered LinkedIn outreach platform
> **Stack:** Next.js 14 (App Router) + Supabase + Anthropic Claude + Chrome Extension (MV3)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Server API Endpoints](#2-server-api-endpoints)
3. [Server Actions](#3-server-actions)
4. [Middleware & Security Layer](#4-middleware--security-layer)
5. [Extension API Calls (Outbound)](#5-extension-api-calls-outbound)
6. [Web App API Calls (Outbound)](#6-web-app-api-calls-outbound)
7. [External Service Integrations](#7-external-service-integrations)
8. [Database Tables Accessed](#8-database-tables-accessed)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [Dependency Audit](#10-dependency-audit)
11. [Accountability Summary](#11-accountability-summary)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                              │
│                                                                         │
│  ┌──────────────────────┐          ┌──────────────────────────────┐    │
│  │  Chrome Extension    │          │  Next.js Web App (Client)    │    │
│  │  (MV3 Service Worker │          │  - Auth pages (login/reg)    │    │
│  │   + Popup + Content  │          │  - Dashboard, Profile,       │    │
│  │   Scripts)           │          │    Settings pages             │    │
│  └──────────┬───────────┘          └──────────────┬───────────────┘    │
│             │                                     │                    │
│             │ Bearer token auth                   │ Cookie-based auth  │
│             │ chrome.runtime messaging            │ Server Actions     │
└─────────────┼─────────────────────────────────────┼────────────────────┘
              │                                     │
              ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS SERVER (Vercel Edge + Node.js)             │
│                                                                         │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ Middleware   │  │ API Routes       │  │ Server Actions           │  │
│  │ - Auth      │  │ /api/health      │  │ ensureProfileAction()    │  │
│  │ - CSP       │  │ /api/extension/* │  │                          │  │
│  │ - CORS      │  │ /api/auth/me     │  │                          │  │
│  └─────────────┘  └────────┬─────────┘  └──────────────────────────┘  │
│                             │                                          │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Supabase   │  │  Anthropic   │  │  PostHog /   │
    │  (DB + Auth) │  │  Claude API  │  │  Sentry      │
    │              │  │              │  │  (Optional)  │
    └──────────────┘  └──────────────┘  └──────────────┘
```

### Component Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Web App (Client) | Next.js 14, React 18, Tailwind CSS | Auth UI, dashboard, settings, profile |
| Web App (Server) | Next.js API Routes, Server Actions | API endpoints, middleware, session management |
| Chrome Extension | Manifest V3, Service Worker | LinkedIn profile reading, message generation, auto-fill |
| Database | Supabase (PostgreSQL) | User data, rate limits, conversations, drafts |
| Auth | Supabase Auth | Email/password, Google OAuth, GitHub OAuth |
| AI | Anthropic Claude (claude-sonnet-4-20250514) | LinkedIn message generation + sanitization |
| Analytics | PostHog (optional) | Client-side product analytics |
| Error Tracking | Sentry (optional) | Client, server, and edge error reporting |

---

## 2. Server API Endpoints

### 2.1 `GET /api/health`

**File:** `app/api/health/route.ts`

**Purpose:** Simple health check endpoint for monitoring and uptime checks.

**Authentication:** None

**CORS:** None (no CORS headers set)

**Request:**
```
GET /api/health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-27T12:00:00.000Z"
}
```

**Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Service is healthy |

---

### 2.2 `GET /api/extension/config`

**File:** `app/api/extension/config/route.ts`

**Purpose:** Provides Supabase connection credentials to the Chrome extension for direct token refresh.

**Authentication:** None

**CORS:** Yes — origin-validated (see [CORS Policy](#cors-policy))

**Allowed Origins:** `chrome-extension://*`, `localhost:*`, `*.vercel.app`

**Request:**
```
GET /api/extension/config
```

**Response (200):**
```json
{
  "supabase_url": "https://xxx.supabase.co",
  "supabase_anon_key": "eyJ..."
}
```

**Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Config returned |

**CORS Preflight:**
```
OPTIONS /api/extension/config → 200 (empty body, CORS headers)
```

---

### 2.3 `GET /api/extension/session`

**File:** `app/api/extension/session/route.ts`

**Purpose:** Session bridge — validates the user's web app cookies server-side and returns session tokens for the Chrome extension to use as Bearer tokens.

**Authentication:** Supabase session cookies (set by the web app login flow)

**CORS:** Yes — origin-validated. Also allows `null` origin (service workers) and `X-Extension-Source: aletheia-extension` header.

**Special Headers:**
- `Access-Control-Allow-Credentials: true` (when origin matches)
- `X-Extension-Source: aletheia-extension` (optional, enables `*` origin fallback)

**Cache:** `export const dynamic = 'force-dynamic'` — never cached

**Request:**
```
GET /api/extension/session
Headers:
  Cookie: sb-xxx-auth-token=...
  X-Extension-Source: aletheia-extension  (optional)
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "xxx-refresh-token",
  "expires_at": 1709049600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  },
  "supabase_url": "https://xxx.supabase.co",
  "supabase_anon_key": "eyJ..."
}
```

**Error Responses:**

| Code | Body | Condition |
|------|------|-----------|
| 200 | Session JSON | Valid cookies with active session |
| 401 | `{ "error": "Not authenticated. Please log in to the Aletheia web app first." }` | No user found from cookies |
| 401 | `{ "error": "Session expired. Please log in again." }` | User valid but session gone |
| 403 | `{ "error": "Origin not allowed" }` | Origin fails CORS validation |
| 500 | `{ "error": "Internal server error" }` | Unexpected server error |

**CORS Preflight:**
```
OPTIONS /api/extension/session → 200
```

---

### 2.4 `POST /api/extension/generate`

**File:** `app/api/extension/generate/route.ts`

**Purpose:** The core AI generation endpoint. Accepts a LinkedIn profile + user context, generates a personalized outreach message using Anthropic Claude, sanitizes the output for AI fingerprint removal, and returns the result.

**Authentication:** Bearer token (Supabase access token in `Authorization` header)

**Rate Limiting:** 30 requests per user per 24-hour sliding window, persisted in Supabase `extension_rate_limits` table. Fails open (allows request) if the rate limit check encounters a DB error.

**CORS:** Yes — origin-validated (see [CORS Policy](#cors-policy))

**Request:**
```
POST /api/extension/generate
Headers:
  Authorization: Bearer <supabase_access_token>
  Content-Type: application/json
```

**Request Body (Zod-validated):**
```json
{
  "profile": {
    "name": "Jane Smith",
    "headline": "Senior Engineer at Google",
    "location": "San Francisco, CA",
    "about": "Passionate about distributed systems...",
    "experiences": [
      { "title": "Senior Engineer", "company": "Google" }
    ],
    "recentPosts": ["Excited about our new launch..."],
    "skills": ["Distributed Systems", "Go", "Kubernetes"],
    "profileUrl": "https://www.linkedin.com/in/janesmith"
  },
  "resume": "Optional user resume text",
  "jd": "Optional job description text",
  "category": "linkedin_connection",
  "intent": "networking",
  "acceptedExamples": ["Previously accepted message 1"]
}
```

**Request Validation Schema:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `profile.name` | string | Yes | |
| `profile.headline` | string | No | |
| `profile.location` | string | No | |
| `profile.about` | string | No | |
| `profile.experiences` | array of `{title, company}` | No | |
| `profile.recentPosts` | string[] | No | |
| `profile.skills` | string[] | No | |
| `profile.profileUrl` | string (URL) | Yes | Must be a valid URL |
| `resume` | string | No | Defaults to `""` |
| `jd` | string | No | Defaults to `""` |
| `category` | enum | Yes | `"linkedin_connection"` \| `"cold_email"` \| `"linkedin_inmail"` |
| `intent` | enum | No | `"networking"` \| `"referral"` \| `"mentorship"` \| `"job_inquiry"`. Defaults to `"networking"` |
| `acceptedExamples` | string[] | No | Defaults to `[]` |

**Response (200) — LinkedIn Connection:**
```json
{
  "success": true,
  "body": "Hi Jane, I noticed your work on distributed systems at Google...",
  "category": "linkedin_connection",
  "character_count": 245,
  "validation": {
    "character_limit_passed": true,
    "original_length": 245,
    "truncated": false,
    "sanitization_applied": true
  },
  "usage": {
    "input_tokens": 850,
    "output_tokens": 120
  },
  "processingTime": 2340
}
```

**Response (200) — Cold Email / InMail:**
```json
{
  "success": true,
  "subject_line": "Quick question about your team's approach",
  "body": "Hi Jane, ...",
  "category": "cold_email",
  "word_count": 98,
  "character_count": 542,
  "validation": {
    "word_limit_passed": true,
    "sanitization_applied": true,
    "ai_patterns_detected": false,
    "json_parsing_successful": true
  },
  "usage": {
    "input_tokens": 900,
    "output_tokens": 180
  },
  "processingTime": 3120
}
```

**Rate Limit Headers (on all responses):**
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1709136000000
```

**Error Responses:**

| Code | Body | Condition |
|------|------|-----------|
| 200 | Success JSON | Generated successfully |
| 400 | `{ "success": false, "error": "Invalid request data", "details": "..." }` | Zod validation failure |
| 401 | `{ "error": "Unauthorized", "message": "Valid Bearer token required" }` | Missing/invalid Bearer token |
| 429 | `{ "error": "Daily limit reached", "message": "You have exceeded the 30 requests per day limit...", "resetTime": ... }` | User hit 30/day rate limit |
| 429 | `{ "success": false, "error": "Rate limit exceeded, please try again later" }` | Anthropic API rate limited |
| 500 | `{ "success": false, "error": "Anthropic API authentication failed" }` | Anthropic API key invalid |
| 500 | `{ "success": false, "error": "Failed to generate content" }` | Generic server error |

**AI Processing Pipeline:**
1. Authenticate via Bearer token → Supabase `getUser()`
2. Check rate limit → Supabase `extension_rate_limits` table
3. Validate request body → Zod schema
4. Build prompt → `getSystemPrompt()` + `buildPrompt()` from `lib/ai/prompts/linkedin-connection.ts`
5. Call Anthropic Claude (`claude-sonnet-4-20250514`, max_tokens=600, temperature=0.8)
6. Basic sanitization → `sanitize()` from `lib/ai/sanitizer.ts`
7. Enhanced sanitization → `sanitizeForLinkedIn()` (AI fingerprint detection + removal)
8. Category-specific post-processing:
   - **linkedin_connection:** Character limit enforcement (300 chars, smart sentence-boundary truncation)
   - **cold_email / linkedin_inmail:** JSON parsing of subject+body, word limit enforcement (cold_email=150, inmail=120 words)
9. Return sanitized content with validation metadata

---

### 2.5 `GET /api/extension/generate` (Health Check)

**File:** `app/api/extension/generate/route.ts` (same file, GET handler)

**Purpose:** Authenticated health check for the extension to verify connectivity and token validity.

**Authentication:** Bearer token

**Request:**
```
GET /api/extension/generate
Headers:
  Authorization: Bearer <supabase_access_token>
```

**Response (200):**
```json
{
  "service": "Aletheia Extension API",
  "version": "2.0.0",
  "endpoints": {
    "generate": "POST /api/extension/generate"
  },
  "status": "healthy",
  "authenticated": true,
  "user": "user@example.com"
}
```

**Error Responses:**

| Code | Body | Condition |
|------|------|-----------|
| 200 | Health JSON | Token valid |
| 401 | `{ "error": "Unauthorized", "message": "Valid Bearer token required" }` | Missing/invalid token |
| 500 | `{ "error": "Internal server error" }` | Unexpected error |

---

### 2.6 `GET /api/auth/me`

**File:** `app/api/auth/me/route.ts`

**Purpose:** Returns the current user's identity and usage statistics. Supports both Bearer token auth (extension) and cookie-based auth (web app) with automatic fallback.

**Authentication:** Bearer token **OR** session cookies (tries Bearer first, falls back to cookies)

**CORS:** Yes — origin-validated

**Request:**
```
GET /api/auth/me
Headers:
  Authorization: Bearer <token>  (or Cookie-based)
```

**Response (200):**
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  },
  "usage": {
    "count": 12,
    "limit": 30,
    "reset_time": 1709136000000
  }
}
```

**Error Responses:**

| Code | Body | Condition |
|------|------|-----------|
| 200 | User + usage JSON | Authenticated |
| 401 | `{ "authenticated": false }` | No valid auth found |
| 500 | `{ "authenticated": false }` | Internal error |

**CORS Preflight:**
```
OPTIONS /api/auth/me → 200 (with Access-Control-Max-Age: 86400)
```

---

## 3. Server Actions

### 3.1 `ensureProfileAction()`

**File:** `app/auth/actions.ts`

**Directive:** `'use server'`

**Purpose:** Called after user signup/login to ensure a row exists in the `profiles` table. If the profile doesn't exist, it creates one using the authenticated user's data.

**Authentication:** Supabase session cookie (validated via `createClient()` → `getUser()`)

**Flow:**
1. Create Supabase server client (cookie-based)
2. Call `supabase.auth.getUser()` to validate session
3. Call `ensureUserProfile(user)` from `lib/supabase/server.ts`
4. Returns `{ success: true }` or `{ error: string }`

**Response:**
```typescript
// Success
{ success: true }

// Errors
{ error: 'Not authenticated' }
{ error: 'Failed to create profile' }
```

**Called By:** Auth pages (`app/auth/login/page.tsx`, `app/auth/register/page.tsx`) after successful login/registration

---

## 4. Middleware & Security Layer

**File:** `middleware.ts`

### Route Protection Matrix

| Route Pattern | Auth Required | Behavior When Unauthenticated |
|--------------|---------------|-------------------------------|
| `/dashboard/*` | Yes | Redirect to `/auth/login?redirectTo=...` |
| `/chat/*` | Yes | Redirect to `/auth/login?redirectTo=...` |
| `/settings/*` | Yes | Redirect to `/auth/login?redirectTo=...` |
| `/profile/*` | Yes | Redirect to `/auth/login?redirectTo=...` |
| `/auth/login` | No (redirects if authenticated) | Shows login page |
| `/auth/register` | No (redirects if authenticated) | Shows register page |
| `/auth/forgot-password` | No | Always accessible |
| `/auth/reset-password` | No | Always accessible |
| `/api/*` | Varies per route | Handled by individual route handlers |
| `/` | No | Landing page |

**Special Cases:**
- `?source=extension` on auth pages: Bypasses authenticated-user redirect (allows extension login flow)
- Server Action requests (`next-action` header): Bypasses authenticated-user redirect
- `refresh_token_already_used` error: Returns 401 for API routes, redirects to login for pages

### Security Headers

All responses through middleware receive:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | See below |

### Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.posthog.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: blob:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com;
media-src 'self' blob:;
worker-src 'self' blob:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
```

### CORS Policy

Three API route groups implement CORS with identical origin validation:

**Allowed Origin Patterns:**
1. `chrome-extension://*` — any Chrome extension
2. `http(s)://localhost(:port)` — local development
3. `https://*.vercel.app` — Vercel deployments

**Per-Route CORS Details:**

| Route | Allow-Methods | Allow-Headers | Allow-Credentials | Max-Age |
|-------|--------------|---------------|-------------------|---------|
| `/api/extension/config` | GET, OPTIONS | Content-Type | No | — |
| `/api/extension/session` | GET, OPTIONS | Content-Type, X-Extension-Source | true (when origin matches) | — |
| `/api/extension/generate` | GET, POST, OPTIONS | Content-Type, Authorization | true | 86400 |
| `/api/auth/me` | GET, OPTIONS | Content-Type, Authorization | true | 86400 |

### Middleware Matcher

Middleware runs on all paths **except:**
- `_next/static/*` (static files)
- `_next/image/*` (image optimization)
- `favicon.ico`
- Static assets (`*.svg`, `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.webp`)

---

## 5. Extension API Calls (Outbound)

The Chrome extension (`ascendia-extension/`) makes the following network requests:

### 5.1 Network Calls to Web App

| # | Endpoint | Method | Auth | Trigger | File |
|---|----------|--------|------|---------|------|
| 1 | `{apiUrl}/api/extension/generate` | POST | Bearer token | User clicks "Generate" | `background/service-worker.js:329` |
| 2 | `{apiUrl}/api/extension/generate` | GET | Bearer token | Health check / test connection | `background/service-worker.js:464` |
| 3 | `{apiUrl}/api/extension/session` | GET | Cookies (`credentials: 'include'`) + `X-Extension-Source` header | Auth needed, session fetch, login polling | `background/auth.js:65` |
| 4 | `{apiUrl}/api/extension/config` | GET | None | Token refresh setup, auth bridge session handling | `background/auth.js:141`, `auth.js:195`, `auth.js:393` |

### 5.2 Direct Supabase Calls

| # | Endpoint | Method | Auth | Trigger | File |
|---|----------|--------|------|---------|------|
| 5 | `{supabase_url}/auth/v1/token?grant_type=refresh_token` | POST | `apikey` header (anon key) | Token refresh (proactive every 20min + on-demand) | `background/auth.js:214-224` |

**Request:**
```
POST {supabase_url}/auth/v1/token?grant_type=refresh_token
Headers:
  Content-Type: application/json
  apikey: <supabase_anon_key>
Body:
  { "refresh_token": "<refresh_token>" }
```

### 5.3 Internal Chrome Messaging (`chrome.runtime`)

The extension uses `chrome.runtime.onMessage` for communication between popup/content scripts and the background service worker:

| Message Action | Direction | Purpose |
|---------------|-----------|---------|
| `generate` | Popup → Service Worker | Request AI content generation |
| `healthCheck` | Popup → Service Worker | Test API connectivity |
| `authenticate` | Popup → Service Worker | Initiate login flow |
| `logout` | Popup → Service Worker | Clear stored auth |
| `getAuthStatus` | Popup → Service Worker | Check if authenticated |
| `silentAuthCheck` | Popup → Service Worker | Auto-detect existing web session on popup open |
| `authBridgeSession` | Content Script → Service Worker | Forward Supabase session from login page |

### 5.4 Extension Token Lifecycle

```
1. User clicks "Connect" in popup
   ├── Try existing session: GET /api/extension/session (with cookies)
   ├── If no session: Open login tab → poll for session
   │   ├── Cookie listener watches for sb-*-auth-token cookies
   │   ├── auth-bridge.js content script injected into login page
   │   ├── Poll GET /api/extension/session every 3-15s (stepped backoff)
   │   └── Timeout after 5 minutes
   └── Store tokens in chrome.storage.local

2. Every 20 minutes (alarm: aletheia-token-refresh)
   ├── Check if token needs refresh (< 5 min until expiry)
   ├── POST {supabase_url}/auth/v1/token (refresh)
   └── Fallback: GET /api/extension/session

3. On generate request (401 recovery)
   ├── Attempt 0: Silent re-fetch (GET /api/extension/session)
   ├── Attempt 1: Interactive login (open tab + wait)
   └── Attempt 2: Fail with AUTH_FAILED
```

---

## 6. Web App API Calls (Outbound)

### 6.1 Supabase Auth Calls (per page)

| Page | Supabase Call | Purpose |
|------|--------------|---------|
| `app/auth/login/page.tsx` | `supabase.auth.signInWithPassword()` | Email/password login |
| `app/auth/login/page.tsx` | `supabase.auth.signInWithOAuth({ provider: 'google' })` | Google OAuth login |
| `app/auth/login/page.tsx` | `supabase.auth.signInWithOAuth({ provider: 'github' })` | GitHub OAuth login |
| `app/auth/register/page.tsx` | `supabase.auth.signUp()` | Email/password registration |
| `app/auth/forgot-password/page.tsx` | `supabase.auth.resetPasswordForEmail()` | Send password reset email |
| `app/auth/reset-password/page.tsx` | `supabase.auth.updateUser()` | Set new password |
| `middleware.ts` | `supabase.auth.getUser()` | Validate session on every request |
| `app/auth/actions.ts` | `supabase.auth.getUser()` | Validate before profile creation |

### 6.2 Supabase DB Queries (server-side)

| Route / Action | Table | Operation | Purpose |
|---------------|-------|-----------|---------|
| `POST /api/extension/generate` | `extension_rate_limits` | SELECT, INSERT, UPDATE | Rate limit check + increment |
| `GET /api/auth/me` | `extension_rate_limits` | SELECT | Get usage stats |
| `ensureProfileAction()` | `profiles` | SELECT, INSERT (upsert) | Ensure profile row exists |

### 6.3 Anthropic AI Calls

| Route | Model | max_tokens | temperature | Purpose |
|-------|-------|-----------|-------------|---------|
| `POST /api/extension/generate` | `claude-sonnet-4-20250514` | 600 | 0.8 | LinkedIn message generation |

**Outbound call:**
```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: <ANTHROPIC_API_KEY>
  anthropic-version: 2023-06-01
  Content-Type: application/json
```

---

## 7. External Service Integrations

### 7.1 Supabase (Database + Auth)

| Property | Value |
|----------|-------|
| **Status** | Active, Required |
| **Used By** | Web app (server + client), Extension (via session bridge) |
| **Connection** | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client) |
| **Service Role** | `SUPABASE_SERVICE_ROLE_KEY` (server-side rate limiting) |
| **Auth Methods** | Email/password, Google OAuth, GitHub OAuth |
| **Session Transport** | HTTP-only cookies (web app), Bearer tokens (extension) |
| **Realtime** | WebSocket connection allowed in CSP (`wss://*.supabase.co`) |

### 7.2 Anthropic Claude

| Property | Value |
|----------|-------|
| **Status** | Active, Required |
| **Used By** | Server-side only (`POST /api/extension/generate`) |
| **SDK** | `@anthropic-ai/sdk` v0.24.3 (direct SDK, not Vercel AI SDK) |
| **Model** | `claude-sonnet-4-20250514` |
| **Connection** | `ANTHROPIC_API_KEY` env var |
| **CSP** | `connect-src https://api.anthropic.com` |

### 7.3 PostHog (Product Analytics)

| Property | Value |
|----------|-------|
| **Status** | Optional, Feature-gated |
| **Gate** | `NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'` |
| **Used By** | Web app client only |
| **Config File** | `lib/posthog/provider.tsx` |
| **SDK** | `posthog-js` v1.194.4 |
| **Settings** | `person_profiles: 'identified_only'`, `capture_pageview: false`, `capture_pageleave: true` |
| **CSP** | `script-src https://app.posthog.com` |
| **Env Vars** | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |

### 7.4 Sentry (Error Tracking)

| Property | Value |
|----------|-------|
| **Status** | Optional, Feature-gated |
| **Gate** | `NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true'` (server/edge); always-on if DSN set (client) |
| **Used By** | Web app client, server, and edge runtimes |
| **SDK** | `@sentry/nextjs` v10.29.0 |
| **Instrumentation** | `instrumentation.ts` loads server/edge configs conditionally |
| **Config Files** | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` |

**Sentry Configuration by Runtime:**

| Runtime | DSN Source | Sample Rate | Replay | Feature Gate |
|---------|-----------|-------------|--------|-------------|
| Client | `NEXT_PUBLIC_SENTRY_DSN` | traces: 100%, replays: 10% (100% on error) | Yes | None (always inits if DSN set) |
| Server | `SENTRY_DSN` | traces: 10% (prod), 100% (dev) | No | `NEXT_PUBLIC_ENABLE_ERROR_REPORTING` |
| Edge | `SENTRY_DSN` | traces: 10% (prod), 100% (dev) | No | `NEXT_PUBLIC_ENABLE_ERROR_REPORTING` |

### 7.5 Google OAuth

| Property | Value |
|----------|-------|
| **Status** | Available |
| **Used By** | Web app auth (`signInWithOAuth({ provider: 'google' })`) |
| **Config** | Managed in Supabase dashboard |

### 7.6 GitHub OAuth

| Property | Value |
|----------|-------|
| **Status** | Available |
| **Used By** | Web app auth (`signInWithOAuth({ provider: 'github' })`) |
| **Config** | Managed in Supabase dashboard |

---

## 8. Database Tables Accessed

All tables are in the `public` schema of Supabase PostgreSQL. Full type definitions in `lib/database/types.ts`.

### Tables

| Table | Primary Key | Accessed By | Purpose |
|-------|-----------|-------------|---------|
| `profiles` | `id` (UUID, FK to auth.users) | Server action `ensureProfileAction()` | User profile data |
| `extension_rate_limits` | `user_id` (UUID) | `/api/extension/generate`, `/api/auth/me` | Per-user rate limiting (30/day) |
| `conversations` | `id` (UUID) | Web app (future) | Chat conversation threads |
| `messages` | `id` (UUID) | Web app (future) | Individual messages in conversations |
| `user_inputs` | `id` (UUID) | Web app (future) | User prompts/inputs |
| `generated_drafts` | `id` (UUID) | Web app (future) | AI-generated draft content |
| `user_feedback` | `id` (UUID) | Web app (future) | User ratings and feedback |
| `usage_analytics` | `id` (UUID) | Web app (future) | Event tracking |
| `user_preferences` | `id` (UUID) | Web app (future) | User settings and style preferences |
| `production_metrics` | `id` (UUID) | Web app (future) | System performance metrics |

### Enums

| Enum | Values |
|------|--------|
| `conversation_category` | `instagram_post`, `linkedin`, `medium_article`, `email`, `conversational` |
| `draft_type` | `grammar_fix`, `adaptive_polish` |

### Database Functions (RPC)

| Function | Purpose |
|----------|---------|
| `aggregate_style_analytics` | Aggregate writing style metrics for a user over a date range |
| `cleanup_old_security_violations` | Scheduled cleanup of security violation records |
| `find_similar_style_vectors` | Vector similarity search for writing style matching |
| `get_user_voice_stats` | Get user's writing voice statistics |
| `match_category_style_vectors` | Category-filtered vector similarity search |
| `match_similar_users_style_vectors` | Find users with similar writing styles |
| `match_user_style_vectors` | Match a user's own historical style vectors |
| `schedule_security_cleanup` | Trigger security data cleanup |
| `update_vector_retrieval_stats` | Update retrieval statistics for style vectors |

---

## 9. Environment Variables Reference

### Required

| Variable | Used By | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Web app + Extension (via config endpoint) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web app + Extension (via config endpoint) | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key (rate limiting, bypasses RLS) |
| `ANTHROPIC_API_KEY` | Server only | Anthropic API key for Claude |

### Optional (Feature-gated)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | `undefined` (disabled) | Set to `'true'` to enable PostHog |
| `NEXT_PUBLIC_POSTHOG_KEY` | — | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | — | PostHog API host URL |
| `NEXT_PUBLIC_ENABLE_ERROR_REPORTING` | `undefined` (disabled) | Set to `'true'` to enable Sentry (server/edge) |
| `NEXT_PUBLIC_SENTRY_DSN` | — | Sentry DSN for client-side |
| `SENTRY_DSN` | — | Sentry DSN for server/edge |
| `NEXT_PUBLIC_APP_ENV` | Falls back to `NODE_ENV` | Sentry environment tag |

---

## 10. Dependency Audit

### Active Dependencies (in use)

| Package | Version | Used By |
|---------|---------|--------|
| `@anthropic-ai/sdk` | ^0.24.3 | `app/api/extension/generate/route.ts` — AI generation |
| `@supabase/ssr` | ^0.8.0 | Middleware, session endpoint, server client |
| `@supabase/supabase-js` | ^2.45.4 | Rate limiting, auth validation, DB queries |
| `next` | ^14.2.35 | Framework |
| `react` / `react-dom` | ^18.3.1 | UI framework |
| `zod` | ^3.25.76 | Request validation in generate endpoint |
| `posthog-js` | ^1.194.4 | Client-side analytics (feature-gated) |
| `@sentry/nextjs` | ^10.29.0 | Error tracking (feature-gated) |
| `@opentelemetry/api` | ^1.9.0 | Sentry instrumentation dependency |
| `tailwind-merge` | ^2.5.2 | CSS utility merging |
| `class-variance-authority` | ^0.7.0 | Component variants |
| `clsx` | ^2.1.1 | Conditional classnames |
| `lucide-react` | ^0.562.0 | Icon library |
| `framer-motion` | ^12.26.2 | Animations |
| `next-themes` | ^0.4.6 | Dark/light mode |
| `react-hook-form` | ^7.68.0 | Form handling |
| `@hookform/resolvers` | ^3.10.0 | Zod resolver for react-hook-form |
| `zustand` | ^4.5.5 | State management |
| `isomorphic-dompurify` | ^2.36.0 | HTML sanitization |
| `@tanstack/react-query` | ^5.56.2 | Data fetching/caching |
| `cmdk` | ^1.1.1 | Command palette |
| `@radix-ui/*` | Various | UI primitives (dialog, dropdown, toast, etc.) |
| `three` / `@react-three/fiber` / `@react-three/drei` | Various | 3D graphics (landing page) |
| `@fortawesome/fontawesome-free` | ^7.1.0 | Icon library |
| `lottie-react` | ^2.4.1 | Lottie animations |
| `react-syntax-highlighter` | ^16.1.0 | Code block rendering |
| `react-intersection-observer` | ^10.0.0 | Scroll-triggered animations |
| `react-virtuoso` / `react-window` | Various | Virtualized lists |
| `pino` / `pino-pretty` | Various | Logging |
| `haikunator` | ^2.1.2 | Random name generation |

### Unused Dependencies (FLAGGED)

| Package | Version | Evidence | Verdict |
|---------|---------|----------|---------|
| `resend` | ^6.6.0 | No imports of `resend` found anywhere in the codebase | **UNUSED** — can be removed |
| `openai` | ^4.104.0 | No imports of `openai` found; Anthropic SDK is used instead | **UNUSED** — can be removed |
| `@instructor-ai/instructor` | ^1.7.0 | No imports or function calls found | **UNUSED** — can be removed |
| `instructor` | ^1.0.0 | No imports or function calls found | **UNUSED** — can be removed |
| `@ai-sdk/anthropic` | ^3.0.15 | No imports found; direct `@anthropic-ai/sdk` is used instead | **UNUSED** — can be removed |
| `ai` | ^3.3.30 | Vercel AI SDK — no imports found; direct Anthropic SDK used | **UNUSED** — can be removed |
| `buffer` | ^6.0.3 | Browser polyfill — may be needed for build, verify before removing | **LIKELY UNUSED** |
| `crypto-browserify` | ^3.12.1 | Browser polyfill — may be needed for build, verify before removing | **LIKELY UNUSED** |
| `stream-browserify` | ^3.0.0 | Browser polyfill — may be needed for build, verify before removing | **LIKELY UNUSED** |
| `process` | ^0.11.10 | Browser polyfill — may be needed for build, verify before removing | **LIKELY UNUSED** |
| `react-use-gesture` | ^9.1.3 | Deprecated in favor of `@use-gesture/react` (which is also installed) | **DUPLICATE** — can be removed |

### Unused Server Endpoints

**None.** All 5 server API route files are actively called by either the extension or the web app. No orphaned routes exist.

---

## 11. Accountability Summary

### Every Entry Point (data flowing INTO the system)

| # | Entry Point | Source | Auth | Data Received |
|---|------------|--------|------|---------------|
| 1 | `POST /api/extension/generate` | Chrome Extension | Bearer token | LinkedIn profile data, resume, JD, category, intent |
| 2 | `GET /api/extension/session` | Chrome Extension | Cookies | None (reads cookies) |
| 3 | `GET /api/extension/config` | Chrome Extension | None | None |
| 4 | `GET /api/extension/generate` | Chrome Extension | Bearer token | None |
| 5 | `GET /api/auth/me` | Web App / Extension | Bearer or Cookies | None |
| 6 | `GET /api/health` | Monitoring | None | None |
| 7 | `ensureProfileAction()` | Web App (Server Action) | Session cookie | None (reads auth internally) |
| 8 | Web App Auth Pages | User browser | None | Email, password, OAuth tokens |

### Every Exit Point (data flowing OUT of the system)

| # | Exit Point | Destination | Data Sent | Auth |
|---|-----------|-------------|-----------|------|
| 1 | Anthropic API | `api.anthropic.com` | System prompt + user prompt (contains LinkedIn profile data) | API key |
| 2 | Supabase Auth | `*.supabase.co` | User credentials, OAuth tokens, session refresh | Anon key / service key |
| 3 | Supabase DB | `*.supabase.co` | Rate limit queries, profile upserts | Service role key |
| 4 | PostHog (optional) | `app.posthog.com` | Page events, user identification | Project key |
| 5 | Sentry (optional) | Sentry ingest | Error reports, stack traces, session replays | DSN |
| 6 | Google OAuth | `accounts.google.com` | OAuth redirect | Supabase-managed |
| 7 | GitHub OAuth | `github.com` | OAuth redirect | Supabase-managed |

### Complete Data Flow Map

```
LinkedIn Profile Page
       │
       │ (content script reads DOM)
       ▼
Chrome Extension (popup)
       │
       │ chrome.runtime.sendMessage('generate', { profile, resume, jd, category, intent })
       ▼
Extension Service Worker
       │
       │ POST /api/extension/generate (Bearer token)
       ▼
Next.js API Route
       │
       ├── 1. Validate Bearer token → Supabase Auth
       ├── 2. Check rate limit → Supabase DB (extension_rate_limits)
       ├── 3. Validate request → Zod schema
       ├── 4. Build prompt → lib/ai/prompts/linkedin-connection.ts
       ├── 5. Generate → Anthropic Claude API
       ├── 6. Sanitize → lib/ai/sanitizer.ts (AI fingerprint removal)
       └── 7. Return sanitized message
              │
              ▼
Extension Service Worker
       │
       │ chrome.runtime.sendMessage(response)
       ▼
Extension Popup → Content Script → LinkedIn Page (auto-fill)
```

### Verdict on Unused Code

| Category | Finding |
|----------|---------|
| **Orphaned API Routes** | None — all 5 routes are actively consumed |
| **Unused Dependencies** | 6 confirmed unused packages (`resend`, `openai`, `@instructor-ai/instructor`, `instructor`, `@ai-sdk/anthropic`, `ai`), 4 likely unused polyfills, 1 duplicate (`react-use-gesture`) |
| **Dead Server Actions** | None — `ensureProfileAction` is called by auth pages |
| **Unreachable External Services** | None — all configured services are reachable and used |
| **Feature-gated Services** | PostHog and Sentry are properly gated and do not activate unless explicitly enabled |