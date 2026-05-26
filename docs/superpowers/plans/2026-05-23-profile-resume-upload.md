# Profile Resume Upload (PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload a `.pdf` (or `.txt`) resume on `/profile`. Extract text server-side via `unpdf`, populate the existing resume textarea so users can review + Save through the already-built `updateProfile` server action.

**Architecture:** Add a single `POST /api/profile/parse-resume` endpoint that accepts FormData (file ≤ 5 MB), extracts text via `unpdf` for PDFs or reads raw bytes for `text/plain`, and returns `{ text: string }`. ProfileForm gains a `<input type="file" accept=".pdf,.txt">` + a small handler that POSTs the file and sets the local `resume` state on success. No DB schema change — text lands in the same `profiles.resume` column added in the 2026-05-21 migration. No storage bucket — file is parsed in memory and discarded.

**Tech Stack:** Next.js 14 App Router, `unpdf` (1.6.2 — modern serverless-friendly PDF parser), TypeScript strict, Vitest, Zod.

---

## Scope & Non-Goals

**In scope:**
- `.pdf` upload (parsed via `unpdf.extractText`)
- `.txt` upload (read directly)
- 5 MB max file size at API boundary
- Existing 50,000-char resume cap still enforced (truncate if extracted text exceeds it; warn user)
- Bearer or cookie auth (consistent with existing profile endpoints)
- Unit tests for the parse endpoint (happy path, oversize, unsupported type, parse failure, unauthenticated)

**Out of scope:**
- `.docx` parsing (deferred — add `mammoth` when first user asks)
- OCR for image-only PDFs (deferred — `tesseract.js` is 6 MB)
- Supabase Storage bucket / file artifact retention (deferred — text-only fits the moat: resumes ground prompts, originals aren't reused)
- Drag-and-drop UX (file input is enough for MVP)
- Resume preview / re-edit cycle UI (user edits in the textarea after upload)
- Multi-file batching / history

---

## Branch Strategy

New branch `feat/profile-resume-upload` off **main** (NOT off `fix/login-redirect-to-dashboard`). Sequence:

1. Push + merge `fix/login-redirect-to-dashboard` first (the sign-out + redirect fix).
2. `git checkout main && git pull --ff-only`.
3. `git checkout -b feat/profile-resume-upload`.
4. Execute this plan.

If both branches must run concurrently, rebase this one on top of the login fix later — file overlap is in `app/profile/ProfileForm.tsx` only, low risk.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `unpdf` dependency |
| `app/api/profile/parse-resume/route.ts` | Create | POST endpoint: FormData → text |
| `app/api/profile/parse-resume/route.test.ts` | Create | Unit tests (5 cases) |
| `app/profile/ProfileForm.tsx` | Modify | Add file input + upload handler |

Four files, one new dep, one new endpoint, no DB migration.

---

## Task 1 — Add `unpdf` dependency

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `package-lock.json` (auto-updated by `npm install`)

- [ ] **Step 1: Install**

Run:
```bash
npm install unpdf@1.6.2
```

Pin the version — `unpdf` is pre-1.0 maturity until 1.6.x. Avoid silent breaking changes.

- [ ] **Step 2: Verify install**

```bash
npm ls unpdf
```
Expected: `unpdf@1.6.2`.

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```
Expected: PASS (no usage yet — just verifying install didn't break anything).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add unpdf@1.6.2 for server-side PDF text extraction"
```

Pre-commit hook ~60s. Report new SHA.

---

## Task 2 — TDD the parse-resume endpoint

**Files:**
- Create: `app/api/profile/parse-resume/route.test.ts`

### Step 1: Write the failing test file

Create `app/api/profile/parse-resume/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
const mockAuthGetUser = vi.hoisted(() => vi.fn());
const mockExtractText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockAuthGetUser },
  })),
}));

vi.mock("unpdf", () => ({
  extractText: mockExtractText,
}));

vi.mock("@/lib/cors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cors")>();
  return {
    ...actual,
    getCorsHeaders: vi.fn(actual.getCorsHeaders),
  };
});

import { POST } from "./route";

// Build a FormData-backed Request the route handler can consume
function makeMultipartRequest(opts: {
  file?: { name: string; type: string; size: number; bytes?: Uint8Array };
  bearer?: boolean;
}): Request {
  const formData = new FormData();
  if (opts.file) {
    const blob = new Blob(
      [opts.file.bytes ?? new Uint8Array(opts.file.size)],
      { type: opts.file.type },
    );
    formData.append(
      "file",
      new File([blob], opts.file.name, { type: opts.file.type }),
    );
  }
  const headers: Record<string, string> = {};
  if (opts.bearer) headers.authorization = "Bearer test";
  return new Request("http://localhost:3000/api/profile/parse-resume", {
    method: "POST",
    headers,
    body: formData,
  });
}

describe("POST /api/profile/parse-resume", () => {
  beforeEach(() => {
    mockAuthGetUser.mockReset();
    mockExtractText.mockReset();
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const res = await POST(
      makeMultipartRequest({
        file: { name: "x.pdf", type: "application/pdf", size: 100 },
      }) as never,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file field", async () => {
    const res = await POST(makeMultipartRequest({ bearer: true }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/file/i);
  });

  it("returns 413 when file exceeds 5 MB", async () => {
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: {
          name: "huge.pdf",
          type: "application/pdf",
          size: 5 * 1024 * 1024 + 1,
        },
      }) as never,
    );
    expect(res.status).toBe(413);
  });

  it("returns 415 for unsupported MIME (e.g. image/png)", async () => {
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: { name: "x.png", type: "image/png", size: 100 },
      }) as never,
    );
    expect(res.status).toBe(415);
  });

  it("returns 200 with extracted text for valid PDF", async () => {
    mockExtractText.mockResolvedValueOnce({
      text: ["Page 1 content. ", "Page 2 content."],
      totalPages: 2,
    });
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: {
          name: "resume.pdf",
          type: "application/pdf",
          size: 1024,
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF magic
        },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Page 1 content. Page 2 content.");
  });

  it("returns 200 with raw text for .txt upload", async () => {
    const text = "Plain text resume\nLine 2\nLine 3";
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: {
          name: "resume.txt",
          type: "text/plain",
          size: text.length,
          bytes: new TextEncoder().encode(text),
        },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe(text);
  });

  it("truncates output to 50000 chars and flags it", async () => {
    const longText = "x".repeat(60_000);
    mockExtractText.mockResolvedValueOnce({
      text: [longText],
      totalPages: 1,
    });
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: {
          name: "long.pdf",
          type: "application/pdf",
          size: 1024,
        },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text.length).toBe(50_000);
    expect(body.truncated).toBe(true);
  });

  it("returns 422 when unpdf throws (corrupt PDF)", async () => {
    mockExtractText.mockRejectedValueOnce(
      new Error("Invalid PDF structure"),
    );
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: { name: "bad.pdf", type: "application/pdf", size: 100 },
      }) as never,
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/parse|extract|invalid/i);
  });
});
```

### Step 2: Run test — must FAIL

```bash
npm run test -- app/api/profile/parse-resume/route.test.ts --run
```
Expected: FAIL with `Failed to resolve import "./route"`.

### Step 3: Write the route

Create `app/api/profile/parse-resume/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { getCorsHeaders } from "@/lib/cors";

const log = createLogger("profile-parse-resume");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TEXT_LEN = 50_000; // matches profiles.resume column cap

const ACCEPTED_MIME = new Set(["application/pdf", "text/plain"]);

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "POST, OPTIONS",
  });

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // Parse multipart body
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart body" },
      { status: 400, headers: corsHeaders },
    );
  }

  const fileField = formData.get("file");
  if (!(fileField instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' field" },
      { status: 400, headers: corsHeaders },
    );
  }

  if (fileField.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 5 MB limit" },
      { status: 413, headers: corsHeaders },
    );
  }

  if (!ACCEPTED_MIME.has(fileField.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${fileField.type}` },
      { status: 415, headers: corsHeaders },
    );
  }

  try {
    let rawText: string;

    if (fileField.type === "text/plain") {
      rawText = await fileField.text();
    } else {
      // application/pdf — extract via unpdf
      const arrayBuf = await fileField.arrayBuffer();
      const result = await extractText(new Uint8Array(arrayBuf), {
        mergePages: false,
      });
      rawText = Array.isArray(result.text)
        ? result.text.join("")
        : String(result.text ?? "");
    }

    const truncated = rawText.length > MAX_TEXT_LEN;
    const text = truncated ? rawText.slice(0, MAX_TEXT_LEN) : rawText;

    log.info(
      {
        userId: user.id.substring(0, 12),
        mime: fileField.type,
        bytes: fileField.size,
        outputChars: text.length,
        truncated,
      },
      "Resume parsed",
    );

    return NextResponse.json(
      { text, truncated },
      { headers: corsHeaders },
    );
  } catch (err) {
    log.error({ err }, "Failed to extract resume text");
    return NextResponse.json(
      { error: "Failed to parse file" },
      { status: 422, headers: corsHeaders },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request, {
      allowCredentials: true,
      methods: "POST, OPTIONS",
    }),
  });
}
```

### Step 4: Re-run tests — must PASS

```bash
npm run test -- app/api/profile/parse-resume/route.test.ts --run
```
Expected: 8/8 PASS.

### Step 5: Type-check + lint

```bash
npm run type-check && npm run lint
```
Both PASS.

### Step 6: Commit

```bash
git add app/api/profile/parse-resume/
git commit -m "feat(api): POST /api/profile/parse-resume — extract resume text via unpdf, 8 unit tests"
```

Pre-commit ~60s. Report new SHA.

---

## Task 3 — Wire file picker into ProfileForm

**Files:**
- Modify: `app/profile/ProfileForm.tsx`

- [ ] **Step 1: Read current ProfileForm**

Use Read on `app/profile/ProfileForm.tsx`. Identify the resume textarea block (around the `htmlFor="resume"` label). The new file picker goes ABOVE the textarea.

- [ ] **Step 2: Edit — add file input + handler**

Inside the existing component:

1. Add new state for the upload status near the existing `useState` lines:

```tsx
const [uploadStatus, setUploadStatus] = useState<
  "idle" | "uploading" | "error"
>("idle");
const [uploadError, setUploadError] = useState<string | null>(null);
```

2. Add the upload handler near the existing `onSubmit`:

```tsx
const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setUploadStatus("uploading");
  setUploadError(null);

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/profile/parse-resume", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      setUploadStatus("error");
      setUploadError(data.error ?? "Upload failed");
      return;
    }
    setResume(data.text);
    setUploadStatus("idle");
    // Clear the input so the same file can be re-picked if needed
    e.target.value = "";
  } catch (err) {
    setUploadStatus("error");
    setUploadError(err instanceof Error ? err.message : "Network error");
  }
};
```

3. Insert the file picker UI ABOVE the resume textarea — find the resume label block:

```tsx
<div className="space-y-1.5">
  <label
    htmlFor="resume"
    className="block text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))]"
  >
    Resume <span className="lowercase opacity-60">(paste plain text — used to ground drafts)</span>
  </label>
```

Replace with:

```tsx
<div className="space-y-1.5">
  <label
    htmlFor="resume"
    className="block text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))]"
  >
    Resume <span className="lowercase opacity-60">(upload .pdf or .txt — or paste below)</span>
  </label>
  <div className="flex items-center gap-3">
    <label
      htmlFor="resume-file"
      className="cursor-pointer rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(var(--secondary))]"
    >
      {uploadStatus === "uploading" ? "Parsing…" : "Upload file"}
    </label>
    <input
      id="resume-file"
      type="file"
      accept=".pdf,.txt,application/pdf,text/plain"
      onChange={onFilePick}
      disabled={uploadStatus === "uploading"}
      className="sr-only"
    />
    {uploadStatus === "error" && uploadError && (
      <span className="text-xs text-red-400" role="alert">
        {uploadError}
      </span>
    )}
  </div>
```

(The `</div>` that closed the original label-wrapping div now closes the new file-picker block — keep the textarea and char-counter that follow it inside the same outer `<div className="space-y-1.5">`.)

- [ ] **Step 3: Type-check + lint**

```bash
npm run type-check && npm run lint
```
Both PASS.

- [ ] **Step 4: Manual smoke (dev server)**

Run `npm run dev` if not already running. Hit `localhost:3000/profile` (logged in). Verify:
- "Upload file" button visible above the resume textarea
- Click button → file picker opens
- Pick a PDF resume → button shows "Parsing…" → textarea populates with extracted text
- Pick a `.txt` file → textarea populates directly
- Pick an oversized PDF (>5 MB) → red error text "File exceeds 5 MB limit"
- Pick a `.docx` → red error text "Unsupported file type: …"
- Click Save → existing flow runs, "Saved." appears

If any step fails, fix before committing.

- [ ] **Step 5: Commit**

```bash
git add app/profile/ProfileForm.tsx
git commit -m "feat(profile): resume file upload (.pdf / .txt) — parses via /api/profile/parse-resume"
```

Pre-commit ~60s. Report new SHA.

---

## Task 4 — Commit the plan document

**Files:**
- Modify (already in tree): `docs/superpowers/plans/2026-05-23-profile-resume-upload.md`

- [ ] **Step 1: Stage + commit the plan**

```bash
git add docs/superpowers/plans/2026-05-23-profile-resume-upload.md
git commit -m "docs(plans): add 2026-05-23 profile resume upload plan"
```

Report new SHA.

---

## Verification — After All Tasks Land

- [ ] **Step 1: Full test suite**

```bash
npm run test -- --run
```
Expected: PASS. Test count up by 8 (the new parse-resume tests).

- [ ] **Step 2: Coverage gate**

```bash
npm run test:coverage -- --run
```
Expected: PASS. Coverage thresholds (lines 84, branches 87) maintained or improved.

- [ ] **Step 3: Guardrails**

```bash
npm run test:guardrails -- --run
```
Expected: PASS.

- [ ] **Step 4: Build**

```bash
npm run build
```
Expected: PASS. `unpdf` should not blow up the server bundle — verify the route appears in the output.

- [ ] **Step 5: Manual end-to-end**

Logged in, on `/profile`:
1. Click Upload file → pick a real PDF resume.
2. Confirm extraction completes < 3 seconds.
3. Confirm textarea contents look right (allow whitespace differences — PDF parsing isn't pixel-perfect).
4. Edit a line in the textarea to confirm it remains editable.
5. Click Save → "Saved." appears.
6. Hard refresh `/profile` → upload value persists.
7. Upload a `.txt` resume → identical happy path.
8. Try to upload a `.docx` → error toast "Unsupported file type".
9. Try to upload a `> 5 MB` PDF → error toast "File exceeds 5 MB limit".

- [ ] **Step 6: Push + PR**

```bash
git push -u origin feat/profile-resume-upload
gh pr create --fill --title "feat(profile): resume file upload (PDF + TXT)"
```

---

## Self-Review

- **Spec coverage:** Every Option-B requirement maps to a task:
  - `unpdf` dep → Task 1
  - PDF parsing endpoint → Task 2
  - TXT parsing → Task 2 (same endpoint)
  - 5 MB cap → Task 2 (`MAX_BYTES`)
  - 50,000-char output cap → Task 2 (`MAX_TEXT_LEN`)
  - Test coverage → Task 2 (8 cases)
  - File picker UI + handler → Task 3
  - Plan doc commit → Task 4
- **No placeholders.** Every code block is concrete and copy-paste ready.
- **Type consistency:** `text: string` (and `truncated: boolean` on the long-PDF branch) defined in Task 2 are consumed by Task 3's `setResume(data.text)`. Endpoint path `/api/profile/parse-resume` is identical in both the route file (Task 2) and the client fetch (Task 3).
- **YAGNI:** No DOCX, no OCR, no Storage bucket, no drag-and-drop, no resume-history feature. Single endpoint, single component change.
- **TDD:** Task 2 follows red → green → refactor explicitly. Task 3 is UI integration — relies on type-check + manual smoke (consistent with the codebase's existing UI test policy: "Do NOT test UI rendering — use Playwright for that").

---

## Execution Hand-off

Two options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review, ~45 min wall time.
2. **Inline Execution** — batch in this session, ~25 min, single context.

Plan saved. Pick approach to execute.
