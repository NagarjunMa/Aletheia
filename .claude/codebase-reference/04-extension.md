# 04 — Chrome Extension (`ascendia-extension/`)

Manifest V3. Separate `package.json`. Built with `esbuild` to `dist/` (IIFE format for Chrome compat). Has its own Vitest test suite (94 tests) with chrome.* API mocks.

## `manifest.json`

| Field | Value |
|-------|-------|
| `manifest_version` | 3 |
| `version` | 1.0.0 |
| `permissions` | `storage`, `activeTab`, `contextMenus`, `sidePanel`, `alarms`, `scripting`, `cookies` |
| `host_permissions` | `linkedin.com`, `app.apollo.io`, `aletheia.live` + `www.aletheia.live`, `localhost:3000`, `*.vercel.app` |
| `side_panel.default_path` | `popup/popup.html` |
| `options_page` | `settings/settings.html` |
| `background.service_worker` | `background/service-worker.js` |
| `content_scripts[0]` | `content/linkedin-reader.js` on `linkedin.com/in/*`, `document_idle` |
| `content_scripts[1]` | `content/auto-filler.js` on `linkedin.com/*` + `app.apollo.io/*`, `document_idle` |
| `web_accessible_resources` | `lib/pdf.min.js`, `lib/pdf.worker.min.js` (PDF.js for resume parsing in settings) — accessible from LinkedIn + Apollo origins |

## Directory layout

```
ascendia-extension/
  manifest.json
  package.json
  build.mjs              esbuild config, IIFE bundles → dist/
  vitest.config.ts       Node env, chrome.* mocks
  background/
    service-worker.js    main entry — message router, alarms, install handler
    auth-core.js         pure functions (20 exports) for token lifecycle
    auth.js              legacy module (kept for some flows)
    auth-core.test.ts    44 tests
  content/
    linkedin-reader.js   selector-free profile scraper
    auto-filler.js       compose-box auto-fill (LinkedIn + Apollo)
    profile-extractor.js extracted pure DOM helpers
    profile-extractor.test.ts  22 tests
    auth-bridge.js       page-context bridge for cookie session detection
  popup/
    popup.html
    popup.css
    popup.js             UI driver (auth check, generate, feedback, render)
    popup-core.js        pure helpers (response parsing, char counts, payload build)
    popup-core.test.ts   26 tests
  settings/
    settings.html
    settings.css
    settings.js          resume upload (PDF.js), personal info, API URL override
  test/
    setup.ts             chrome.* runtime/storage/tabs/alarms/cookies/scripting mocks
    chrome-mocks.ts      in-memory implementations + wireMessagePassing helper
  lib/                   pdf.js bundle (vendored)
  icons/                 16/48/128 PNGs
```

## Background — `service-worker.js` + `auth-core.js`

### `service-worker.js` (entry)

| Responsibility | Detail |
|----------------|--------|
| Install / update | Re-inject content scripts into open LinkedIn tabs (`chrome.scripting.executeScript`) — Chrome auto-inject doesn't fire on update |
| Context menu | "Generate message with Aletheia" entry on text selection (only on LinkedIn/Apollo) |
| Message router | Handles `chrome.runtime.onMessage`: `generate`, `getAuthStatus`, `triggerAuth`, `logout`, `getUsage`, `profileUpdated` |
| Alarm refresh | `chrome.alarms.create('refreshToken', { periodInMinutes: 20 })` — proactive refresh 5 min before 1 hr JWT expiry |
| Pending login recovery | `recoverPendingLogin()` survives service-worker restart during login flow — retries `fetchSessionFromServer()` after alarm fires |
| In-flight guard | `authenticatePromise` module-level singleton — prevents duplicate auth tabs if user clicks "Connect" twice |

### `auth-core.js` (pure, importable, testable)

| Function | Purpose |
|----------|---------|
| `isTokenValid(authData)` | Check JWT not yet expired |
| `needsRefresh(authData)` | True if within 5 min of expiry |
| `getStoredAuth()` / `storeAuth(data)` / `clearAuth()` | `chrome.storage.local` accessors keyed `aletheia_auth` |
| `parseChunkedCookies(cookies)` | Reassemble Supabase `sb-*-auth-token.{0,1,...}` cookies (chunked when >4KB), supports base64-prefixed or URL-encoded payloads |
| `fetchSessionFromServer(url)` | `GET /api/extension/session` with `credentials:'include'` + `x-extension-source` header. Handles 401 → triggers re-auth |
| `refreshToken(authData)` | Calls `/api/extension/session` to swap expired access token |
| `fetchUsage(authData)` | `GET /api/auth/me` → returns `{ count, limit, reset_time }` |
| `filterAcceptedExamples(examples)` | Trim/dedupe/limit to last 3 approved messages for prompt injection |
| `isAuthError(error)` | Pattern-match common auth failure messages from API responses |
| Constants | `AUTH_STORAGE_KEY = 'aletheia_auth'`, `SESSION_ENDPOINT = '/api/extension/session'` |

Total: 20 named exports — see `auth-core.test.ts` (44 tests).

## Content scripts

### `content/linkedin-reader.js`

| Aspect | Detail |
|--------|--------|
| Match | `https://www.linkedin.com/in/*` |
| Extraction | **Selector-free.** Name from `document.title` (format `"Name - Role \| LinkedIn"`), body from `mainEl.innerText` (or `document.body.innerText` fallback), truncated to 8000 chars |
| Why selector-free | LinkedIn rotates CSS class names continuously — selectors break weekly. `innerText` is immune. |
| Mutation observer | Watches `<main>` for SPA navigation; debounces `profileUpdated` message to service worker on change |
| Output | `{ name, profileMarkdown, profileUrl, extractedAt }` posted via `chrome.runtime.sendMessage` |
| Pure helpers | Extracted to `profile-extractor.js` (importable for tests — 22 tests) |

### `content/auto-filler.js`

| Aspect | Detail |
|--------|--------|
| Match | LinkedIn + Apollo |
| Platform detection | LinkedIn connection note (`textarea[name="message"]`), LinkedIn InMail (subject + body fields), LinkedIn DM (`contenteditable`), Apollo compose, Apollo sequence (`data-testid` based) |
| Trigger | Receives `autoFill` message from popup |
| Fill technique | Native `value` setter + `input` event dispatch (works around React-controlled inputs) |
| Feedback | Brief visual highlight on filled field |

### `content/auth-bridge.js`

Injected into `aletheia.live` pages. Reads Supabase session from `localStorage` in the page context (extension can't read site `localStorage` directly without injection). Posts session back to extension via `chrome.runtime.sendMessage`. Used by the "Connect to web app" flow in settings.

## Popup (`popup/`)

### `popup.html` + `popup.js`

UI shell. On open:
1. `initializePopup()` — `getStoredAuth()` + silent web-session detection (via `auth-bridge.js`).
2. `checkLinkedInProfile()` — requests profile via content-script message.
3. Render: profile banner (or warning), category radio, intent dropdown, generate button.

On Generate click:
1. `buildGeneratePayload()` (pure, from `popup-core.js`).
2. `chrome.runtime.sendMessage({ action: 'generate', payload })` → service worker fetches `/api/extension/generate`.
3. Response → `parseGenerationResponse()` (handles cold_email/InMail JSON, strips markdown backticks).
4. Display + `calculateCharCount()` per category (LinkedIn 270, InMail 1800, email 1500 indicator).
5. Feedback buttons → `chrome.runtime.sendMessage({ action: 'feedback', ... })`.

### `popup-core.js` (pure, testable — 26 tests)

| Function | Purpose |
|----------|---------|
| `parseGenerationResponse(response)` | Pull subject + body out of JSON-encoded fields, strip ```` ``` ```` fences |
| `calculateCharCount(text, category)` | Returns `{ count, limit, exceeded }` per category limit |
| `buildGeneratePayload({ profile, resume, jd, category, intent, acceptedExamples })` | Shape request body to match `generateRequestSchema` |
| `isAuthError(errorObj)` | Detect auth-failure shape from API JSON |

## Settings (`settings/`)

`settings.html` + `settings.js`. Opens via Chrome's options-page handler.

| Feature | Implementation |
|---------|---------------|
| Resume upload | Drag-drop PDF → PDF.js worker parses text → stored in `chrome.storage.sync` |
| Personal info | Free text, 1000-char cap |
| Job description (default) | Stored, sent with every generate request |
| API URL override | Dropdown: production / custom / `localhost:3000`. `chrome.storage.sync` (syncs across user's Chrome installs) |
| Connect / disconnect | Opens `aletheia.live/auth/login?source=extension`. Service worker handles return-tab flow + `auth-bridge` session capture |
| Usage display | Reads from `getUsage()` (auth-core) — shows `count/limit` and daily reset time |

## Build (`build.mjs`)

`esbuild` config:
- Entry points: `background/service-worker.js`, `background/auth-core.js`, `content/linkedin-reader.js`, `content/auto-filler.js`, `content/auth-bridge.js`, `popup/popup.js`, `popup/popup-core.js`, `settings/settings.js`.
- Format: `iife` (Chrome service workers don't load `type=module` reliably across versions).
- Target: `chrome120`.
- Sourcemaps inline (dev) / external (prod).
- Output: `ascendia-extension/dist/`.

Scripts: `npm run build:ext` → one-shot; `npm run dev:ext` → watch mode. Run from repo root via `make build-ext` / `make test-ext`.

## Test infrastructure (`test/`)

- `setup.ts` — wires `globalThis.chrome` to the mock object on every test file.
- `chrome-mocks.ts` — in-memory `chrome.runtime`, `chrome.storage.{local,sync}`, `chrome.tabs`, `chrome.alarms`, `chrome.cookies`, `chrome.scripting`. Plus `wireMessagePassing()` helper that lets two modules send `chrome.runtime.sendMessage` to each other for integration tests.
- Tests are co-located: `auth-core.test.ts`, `profile-extractor.test.ts`, `popup-core.test.ts`, integration spec (8 tests for full generate flow including expired-token → refresh → retry).

Test counts (from `claude-progress.txt` Phase 24):
- Auth core: 44
- Profile extractor: 22
- Popup core: 26
- Integration: ~8 (route-trip flow)
- Total: 94

## How it talks to the server

| Extension action | API endpoint |
|------------------|--------------|
| First-time login | `aletheia.live/auth/login?source=extension` → `auth-bridge.js` captures session |
| Token fetch / refresh | `GET /api/extension/session` (cookie-auth bridge) |
| Generate | `POST /api/extension/generate` (Bearer) |
| Feedback | `POST /api/extension/feedback` (Bearer) |
| Usage stats | `GET /api/auth/me` (Bearer fallback to cookie) |
| Boot config | `GET /api/extension/config` (no auth) |

All requests include header `x-extension-source: aletheia-extension` so the server can identify null-origin requests from the service worker.

## Cross-references

- Server-side route detail for each endpoint → `02-web-app-routes.md`
- AI pipeline this extension feeds → `03-ai-pipeline.md`
- DB tables holding session / preferences / usage → `05-database.md`
- CSP / CORS that gates extension requests → `06-infrastructure.md`
