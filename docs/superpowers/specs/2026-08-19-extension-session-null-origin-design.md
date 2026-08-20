# Extension session null-Origin design

Date: 2026-08-19
Branch: fix/extension-dashboard-access

## Problem

Extension login intermittently (in practice, deterministically) fails with `403 Origin not allowed` from `GET /api/extension/session`, and would separately return `200` with no `access_token`/`refresh_token` even past that gate. Confirmed via Vercel logs: `request.headers.get("origin")` is `null` on every sampled request from the extension's service worker.

## Root cause

`ascendia-extension/manifest.json` grants `host_permissions` for `https://www.aletheia.live/*` and `https://aletheia.live/*`. Chrome exempts host-permission-covered fetches from CORS entirely, and does not attach an `Origin` header to them. This is expected Chrome behavior for MV3 extensions, not a bug in the extension's fetch code.

`lib/cors.ts` and `app/api/extension/session/route.ts` both gate on a recognized `Origin` header:

1. `getCorsHeaders()` only sets `Access-Control-Allow-Origin` when `request.headers.get("origin")` matches an allowed pattern. No Origin → empty ACAO → `session/route.ts`'s `hasAllowedOrigin` check fails → `403`.
2. Even past that, `session/route.ts`'s token-exchange gate (`isApprovedExtension = isAllowedExtensionOrigin(origin)`) also requires a matching Origin, so it would stay `false` and the response would omit `access_token`/`refresh_token` — the proximate cause of `auth-core.js`'s `"Server returned session without access_token"` error.

Git history shows a prior version of `lib/cors.ts` handled null-origin extension requests via an `X-Extension-Source` header check, but a security-hardening pass removed it (wildcard `Access-Control-Allow-Origin: '*'` combined with credentials was flagged as a CORS bypass risk) without providing a safe replacement. The removal's justifying comment — "chrome extension service workers send origin: chrome-extension://<id>" — is incorrect for extensions with matching `host_permissions`.

"Redeploy fixes it" is very likely a false correlation, not causal — the Origin-absence is deterministic (host_permissions strips it on every call), so this should fail 100% of the time regardless of deployment, independent of whatever else coincides with a redeploy (extension reload, fresh cookies, etc).

## Design

Single source of truth for "is this a legitimate extension call," covering both the Origin-present and Origin-absent cases, added to `lib/cors.ts`:

```ts
export function isApprovedExtensionRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) return isAllowedExtensionOrigin(origin);
  // host_permissions-covered fetches never carry Origin — Chrome exempts
  // them from CORS. X-Extension-Source is the only identity signal we get.
  return request.headers.get("x-extension-source") === "aletheia-extension";
}
```

**`getCorsHeaders()`:** Origin present → unchanged (echo origin if matched against `buildAllowedPatterns()`). Origin absent and `isApprovedExtensionRequest(request)` true → set `Access-Control-Allow-Origin` to the first configured extension origin from `getAllowedExtensionOrigins()` (a real value, never `'*'`), and allow `Access-Control-Allow-Credentials: true` on the same terms as the matched-origin path. Origin absent and the check fails → ACAO stays empty, same as current behavior — this is what keeps the original wildcard vulnerability closed; there's no blanket allow for arbitrary null-origin callers, only ones carrying the specific header value.

**`session/route.ts`:**

- `hasAllowedOrigin` (the outer 403 gate) needs no direct code change — it already derives from `corsHeaders["Access-Control-Allow-Origin"]`, which the `getCorsHeaders()` fix makes non-empty for legitimate null-origin extension calls.
- `isApprovedExtension` (the token-exchange gate) changes from `isAllowedExtensionOrigin(origin)` to `isApprovedExtensionRequest(request)`.

## Scope

In scope: `lib/cors.ts`, `app/api/extension/session/route.ts`.

Out of scope: `app/api/extension/generate/route.ts` doesn't import `lib/cors.ts` (Bearer-token auth, no cookies, unaffected). `app/api/extension/config/route.ts` and `app/api/extension/feedback/route.ts` only consume `getCorsHeaders()`'s output for response headers and have no separate hard-gate logic — they inherit the fix automatically once `getCorsHeaders()` is corrected.

## Data flow (fixed)

Extension SW fetch (no Origin, `X-Extension-Source: aletheia-extension`) → `getCorsHeaders` sees no Origin, checks header, sets real ACAO + credentials → route's 403 gate passes → cookie/session auth proceeds unchanged → `isApprovedExtensionRequest` passes → tokens returned.

Non-extension caller with no Origin and no/wrong header → ACAO stays empty → 403, unchanged from today.

## Error handling

No new error paths. Existing 401 (`refresh_token_already_used`, no session), 429 (rate limit), 500 paths are untouched by this change.

## Testing

- `lib/cors.test.ts`: (a) no Origin + correct `X-Extension-Source` → real ACAO + `Access-Control-Allow-Credentials: true`; (b) no Origin + missing/wrong header → empty ACAO (regression guard against reopening the wildcard hole).
- `app/api/extension/session/route.test.ts`: no-Origin request with valid session cookie + `X-Extension-Source: aletheia-extension` → `200` with `access_token` present (currently would return `200` with tokens omitted — the actual login-breaking bug).
