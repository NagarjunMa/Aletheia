# Extension Session Null-Origin Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix extension login failing with `403 Origin not allowed` (and, past that gate, a missing `access_token`) on `GET /api/extension/session`, caused by Chrome never attaching an `Origin` header to fetches covered by the extension's `host_permissions`.

**Architecture:** Add one exported helper, `isApprovedExtensionRequest(request)`, to `lib/cors.ts` as the single source of truth for "is this a legitimate extension call" across both the Origin-present and Origin-absent cases. Wire it into `getCorsHeaders()`'s ACAO/credentials computation and into `session/route.ts`'s token-exchange gate, replacing the two places that currently key off `Origin` alone.

**Tech Stack:** Next.js 16 App Router route handlers, Vitest, `NextRequest`/`Headers`.

**Design doc:** `docs/superpowers/specs/2026-08-19-extension-session-null-origin-design.md`

---

### Task 1: Add `isApprovedExtensionRequest` helper to `lib/cors.ts`

**Files:**

- Modify: `lib/cors.ts` (add new exported function after `isAllowedExtensionOrigin`, currently ending at line 27)
- Test: `lib/cors.test.ts` (add new top-level `describe` block after the existing `describe("getCorsHeaders", ...)` block, which currently closes at line 264)

- [ ] **Step 1: Write the failing tests**

Add this new top-level `describe` block at the end of `lib/cors.test.ts`, after the closing `});` of the existing `describe("getCorsHeaders", ...)` block (i.e. after line 264):

```ts
describe("isApprovedExtensionRequest", () => {
  afterEach(() => {
    delete process.env.CHROME_EXTENSION_ID;
    delete process.env.CHROME_EXTENSION_IDS;
  });

  it("returns true when Origin matches the configured extension origin", () => {
    process.env.CHROME_EXTENSION_ID = EXTENSION_ID;
    const req = mockRequest({ origin: `chrome-extension://${EXTENSION_ID}` });
    expect(isApprovedExtensionRequest(req)).toBe(true);
  });

  it("returns false when Origin is present but not configured", () => {
    process.env.CHROME_EXTENSION_ID = EXTENSION_ID;
    const req = mockRequest({
      origin: "chrome-extension://badbadbadbadbadbadbadbadbadbadba",
    });
    expect(isApprovedExtensionRequest(req)).toBe(false);
  });

  it("returns true when Origin is null and X-Extension-Source is aletheia-extension", () => {
    const req = mockRequest({
      origin: null,
      extensionSource: "aletheia-extension",
    });
    expect(isApprovedExtensionRequest(req)).toBe(true);
  });

  it("returns false when Origin is null and X-Extension-Source is missing", () => {
    const req = mockRequest({ origin: null });
    expect(isApprovedExtensionRequest(req)).toBe(false);
  });

  it("returns false when Origin is null and X-Extension-Source has the wrong value", () => {
    const req = mockRequest({
      origin: null,
      extensionSource: "some-other-source",
    });
    expect(isApprovedExtensionRequest(req)).toBe(false);
  });
});
```

Also update the import at the top of `lib/cors.test.ts` (line 2) to pull in the new function:

```ts
import { getCorsHeaders, isApprovedExtensionRequest } from "./cors";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/cors.test.ts --run`
Expected: FAIL — `isApprovedExtensionRequest` is not exported from `./cors` (TypeScript/import error, or `undefined is not a function`).

- [ ] **Step 3: Implement the helper**

In `lib/cors.ts`, insert this new exported function directly after `isAllowedExtensionOrigin` (after line 27, before `function buildAllowedPatterns()`):

```ts
export function isApprovedExtensionRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) return isAllowedExtensionOrigin(origin);
  // host_permissions-covered fetches from the extension's service worker
  // never carry an Origin header — Chrome exempts them from CORS entirely.
  // X-Extension-Source is the only identity signal available for those.
  return request.headers.get("x-extension-source") === "aletheia-extension";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/cors.test.ts --run`
Expected: PASS (all tests in the file, including the 5 new ones)

- [ ] **Step 5: Commit**

```bash
git add lib/cors.ts lib/cors.test.ts
git commit -m "feat(cors): add isApprovedExtensionRequest helper for null-origin extension calls"
```

---

### Task 2: Wire the helper into `getCorsHeaders()`'s ACAO/credentials logic

**Files:**

- Modify: `lib/cors.ts:63-90` (the `getCorsHeaders` function)
- Test: `lib/cors.test.ts` (update 2 existing tests, add 1 new edge-case test)

- [ ] **Step 1: Update the failing/soon-to-be-wrong tests first**

In `lib/cors.test.ts`, replace this existing test (currently around line 131-136):

```ts
it("returns empty for null origin with extension source header (no wildcard bypass)", () => {
  const headers = getCorsHeaders(
    mockRequest({ origin: null, extensionSource: "aletheia-extension" }),
  );
  expect(headers["Access-Control-Allow-Origin"]).toBe("");
});
```

with:

```ts
it("echoes the configured extension origin for null-origin extension requests", () => {
  process.env.CHROME_EXTENSION_ID = EXTENSION_ID;
  const headers = getCorsHeaders(
    mockRequest({ origin: null, extensionSource: "aletheia-extension" }),
  );
  expect(headers["Access-Control-Allow-Origin"]).toBe(
    `chrome-extension://${EXTENSION_ID}`,
  );
});

it("returns empty ACAO for null-origin extension requests when no extension ID is configured", () => {
  // Fail-closed: a misconfigured deployment (no CHROME_EXTENSION_ID set)
  // must not accidentally echo an empty/undefined origin string.
  const headers = getCorsHeaders(
    mockRequest({ origin: null, extensionSource: "aletheia-extension" }),
  );
  expect(headers["Access-Control-Allow-Origin"]).toBe("");
});
```

Leave the adjacent test unchanged (still correct, no code change needed):

```ts
it("does not grant CORS for null origin without extension header", () => {
  const headers = getCorsHeaders(mockRequest({ origin: null }));
  expect(headers["Access-Control-Allow-Origin"]).toBe("");
});
```

Then replace this existing test in the `credentials handling` describe block (currently around line 235-241):

```ts
it("does NOT set credentials for null-origin extension requests", () => {
  const headers = getCorsHeaders(
    mockRequest({ origin: null, extensionSource: "aletheia-extension" }),
    { allowCredentials: true },
  );
  expect(headers["Access-Control-Allow-Credentials"]).not.toBe("true");
});
```

with:

```ts
it("sets credentials for null-origin extension requests when an extension ID is configured", () => {
  process.env.CHROME_EXTENSION_ID = EXTENSION_ID;
  const headers = getCorsHeaders(
    mockRequest({ origin: null, extensionSource: "aletheia-extension" }),
    { allowCredentials: true },
  );
  expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  delete process.env.CHROME_EXTENSION_ID;
});

it("does NOT set credentials for null-origin extension requests when no extension ID is configured", () => {
  const headers = getCorsHeaders(
    mockRequest({ origin: null, extensionSource: "aletheia-extension" }),
    { allowCredentials: true },
  );
  expect(headers["Access-Control-Allow-Credentials"]).not.toBe("true");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/cors.test.ts --run`
Expected: FAIL on the two new/updated ACAO and credentials assertions (current code still returns `""` and never `"true"` for the null-origin+header case).

- [ ] **Step 3: Implement the change**

In `lib/cors.ts`, replace the body of `getCorsHeaders` (lines 63-90) with:

```ts
export function getCorsHeaders(
  request: NextRequest,
  options: { allowCredentials?: boolean; methods?: string } = {},
): Record<string, string> {
  const origin = request.headers.get("origin");
  const isAllowedOrigin = origin
    ? buildAllowedPatterns().some((p) => p.test(origin))
    : false;

  // host_permissions-covered fetches from the extension's service worker
  // never carry an Origin header — Chrome exempts them from CORS entirely.
  // Treat a verified null-origin extension request as allowed too, echoing
  // a real configured extension origin — never a '*' wildcard.
  const isNullOriginExtension = !origin && isApprovedExtensionRequest(request);
  const treatAsAllowed = isAllowedOrigin || isNullOriginExtension;

  let acao = "";
  if (isAllowedOrigin && origin) {
    acao = origin;
  } else if (isNullOriginExtension) {
    acao = getAllowedExtensionOrigins()[0] ?? "";
  }

  return {
    "Access-Control-Allow-Origin": acao,
    "Access-Control-Allow-Methods": options.methods ?? "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Extension-Source, X-Aletheia-API-Version, X-Aletheia-Extension-Version",
    "Access-Control-Expose-Headers":
      "X-Aletheia-API-Version, X-Aletheia-Minimum-Extension-Version",
    "Access-Control-Allow-Credentials":
      options.allowCredentials && treatAsAllowed && acao ? "true" : "",
    Vary: "Origin",
  };
}
```

Note: `treatAsAllowed && acao` guards the fail-closed edge case — if `isNullOriginExtension` is true but no extension ID is configured, `acao` stays `""`, so credentials are never set on an empty-ACAO response.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/cors.test.ts --run`
Expected: PASS (all tests, including Task 1's and Task 2's)

- [ ] **Step 5: Commit**

```bash
git add lib/cors.ts lib/cors.test.ts
git commit -m "fix(cors): allow null-origin extension requests through ACAO/credentials logic"
```

---

### Task 3: Wire the helper into `session/route.ts`'s token-exchange gate

**Files:**

- Modify: `app/api/extension/session/route.ts:4` (import) and `:184-185` (the `isApprovedExtension` gate)
- Test: `app/api/extension/session/route.test.ts` (replace 1 test, add 1 test)

- [ ] **Step 1: Update the tests first**

In `app/api/extension/session/route.test.ts`, replace this test in the `CORS Security` describe block (currently around line 108-119):

```ts
it("returns 403 for null-origin requests even with the extension source header", async () => {
  const res = await GET(
    makeRequest({
      origin: null,
      headers: { "X-Extension-Source": "aletheia-extension" },
    }),
  );

  expect(res.status).toBe(403);
  const body = await res.json();
  expect(body.error).toBe("Origin not allowed");
});
```

with:

```ts
it("returns 403 for null-origin requests without the extension source header", async () => {
  // Regression guard: a null-origin request with no identifying header
  // must still be rejected. This is what keeps the fix from reopening
  // the old wildcard CORS bypass.
  const res = await GET(makeRequest({ origin: null }));

  expect(res.status).toBe(403);
  const body = await res.json();
  expect(body.error).toBe("Origin not allowed");
});
```

Then add this new test to the `Happy Path` describe block (after the existing `"returns tokens to the configured chrome-extension:// origin"` test, currently ending around line 227):

```ts
it("returns tokens for null-origin requests carrying the extension source header", async () => {
  // Chrome never attaches Origin to fetches covered by the extension's
  // host_permissions — this is the actual path the shipped extension
  // uses. X-Extension-Source is the only identity signal available.
  const res = await GET(
    makeRequest({
      origin: null,
      headers: { "X-Extension-Source": "aletheia-extension" },
    }),
  );
  expect(res.status).toBe(200);

  const body = await res.json();
  expect(body.access_token).toBe("test-access");
  expect(body.refresh_token).toBe("test-refresh");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- app/api/extension/session/route.test.ts --run`
Expected: FAIL — the renamed 403 test should still pass (no header case is unaffected by Task 3), but the new "returns tokens for null-origin requests..." test fails because `isApprovedExtension` still evaluates `isAllowedExtensionOrigin("")`, which is `false`, so `access_token`/`refresh_token` are omitted from the 200 response.

- [ ] **Step 3: Implement the change**

In `app/api/extension/session/route.ts`, update the import on line 4:

```ts
import { getCorsHeaders, isApprovedExtensionRequest } from "@/lib/cors";
```

Then replace lines 184-185:

```ts
const origin = request.headers.get("origin") || "";
const isApprovedExtension = isAllowedExtensionOrigin(origin);
```

with:

```ts
const isApprovedExtension = isApprovedExtensionRequest(request);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- app/api/extension/session/route.test.ts --run`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Run the full test suite and guardrails**

Run: `npm run test -- --run`
Expected: PASS (all suites — this change touches a shared helper used by other extension routes' response headers, so confirm nothing else broke)

Run: `npm run test:guardrails -- --run`
Expected: PASS (unaffected by this change, but required before merging anything touching auth/CORS-adjacent code per project convention)

- [ ] **Step 6: Commit**

```bash
git add app/api/extension/session/route.ts app/api/extension/session/route.test.ts
git commit -m "fix(session): use isApprovedExtensionRequest for token-exchange gate"
```

---

### Task 4: Manual verification against the real extension

**Files:** none (verification only)

- [ ] **Step 1: Build and load the extension locally**

Run: `npm --prefix ascendia-extension run build` (or the project's existing extension build script — check `ascendia-extension/package.json` `scripts` if the exact name differs)

Load the unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked → point at `ascendia-extension/dist` or the built output directory) pointed at a preview/local deployment of the fixed branch.

- [ ] **Step 2: Confirm the previously-broken login path now works**

Log into the web app in a normal tab, then open the extension popup and trigger a session check (or wait for its periodic poll). Confirm no error is shown and the popup reflects a logged-in state.

- [ ] **Step 3: Confirm via network inspection that Origin is genuinely absent**

Open `chrome://inspect/#service-workers`, find the extension's service worker, open its DevTools, go to the Network tab, trigger a session check, and inspect the `GET /api/extension/session` request headers. Confirm `Origin` is indeed absent (validates the root-cause diagnosis one more time against the real browser) and the response is `200` with a JSON body containing `access_token`.
