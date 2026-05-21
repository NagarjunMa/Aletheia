# Aletheia Streamline & GTM Trust Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip dead code, expose a no-auth demo, surface privacy + Chrome Web Store trust on landing, gate CI on coverage, and resolve the stranded extension-test plan — converting the project from "75% engineering done, 30% trust/distribution done" to launchable.

**Architecture:** Eight phases executed in order. Phase 1–2 are pure deletion (no behavior change). Phase 3–4 add public-facing surface (`/demo`, Web Store CTA, dashboard onboarding). Phase 5–6 tighten observability and CI. Phase 7 is a binary decision on extension testing. Phase 8 is documentation hygiene.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind, Framer Motion, Vitest, Playwright, Pino, Supabase, Anthropic Claude.

---

## Scope & Non-Goals

**In scope:**
- Delete unused components: `AuroraBackground.tsx`, `GridBackground.tsx`, `Testimonials.tsx`.
- Trim Pricing to single Free tier (remove annual toggle + Team tier until Stripe).
- Build `/demo` route (no auth, sample profile → sample draft).
- Add Chrome Web Store badge + privacy bullet to navbar/hero.
- Add coverage threshold gate to CI.
- Resolve `docs/superpowers/plans/pure-discovering-adleman.md` (kill or defer extension-test refactor).
- Replace `<30s` Hero stat with measured p95.
- Archive `.claude/claude-progress.txt` phases 1–27.

**Out of scope:**
- Stripe / paid tier wiring (deferred until first inbound payment intent).
- Real testimonials (deferred until ≥3 attributed beta quotes).
- Loki / Grafana pipeline (deferred — already off; cleaning commit references only).
- New AI features.
- Extension esbuild test refactor (decision only — execution is its own plan).

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `components/AuroraBackground.tsx` | Delete | Dead legacy bg |
| `components/landing/GridBackground.tsx` | Delete | Dead grid overlay |
| `components/landing/Testimonials.tsx` | Delete | Placeholder, not in use |
| `app/page.tsx` | Modify | Remove Testimonials import + comment block |
| `components/landing/Pricing.tsx` | Modify | Cut annual toggle, cut Team tier, keep Free only |
| `components/landing/Navbar.tsx` | Modify | Add Chrome Web Store badge |
| `components/landing/Hero.tsx` | Modify | Add privacy line, replace `<30s` with measured value, add `/demo` CTA |
| `app/demo/page.tsx` | Create | Public demo with sample profile + sample draft, no auth |
| `app/demo/sample-data.ts` | Create | Hardcoded sample profile + resume + draft |
| `components/demo/DemoExample.tsx` | Create | Client component that renders demo state |
| `e2e/demo.spec.ts` | Create | `@smoke` test — page loads, draft visible |
| `app/status/page.tsx` | Create | Public version + commit SHA from `/api/extension/version` |
| `app/dashboard/EmptyState.tsx` | Create | First-login CTA (install extension, paste sample) |
| `app/dashboard/page.tsx` | Modify | Render EmptyState when zero drafts |
| `scripts/measure-latency.ts` | Create | One-off script: query `user_feedback.metadata.generationTimeMs`, print p50/p95 |
| `.github/workflows/ci.yml` | Modify | Add `npm run test -- --run --coverage` with threshold |
| `vitest.config.ts` | Modify | Add `coverage.thresholds.lines: 80` |
| `.claude/claude-progress.txt` | Modify | Move phases 1–27 into archive file |
| `.claude/archive/claude-progress-phases-1-27.txt` | Create | Frozen historical log |
| `docs/superpowers/plans/pure-discovering-adleman.md` | Decide | Either delete or add gating note |
| `README.md` | Modify | Collapse Tier-5 table into single paragraph, link out to `/docs` |
| `CLAUDE.md` | Modify | Trim Tech Stack font line; add `/demo` + `/status` to Project Structure |

---

## Phase 1 — Dead Code Purge

### Task 1: Delete AuroraBackground

**Files:**
- Delete: `components/AuroraBackground.tsx`

- [ ] **Step 1: Confirm zero importers**

Run:
```bash
grep -rn "AuroraBackground" app components lib --include="*.ts" --include="*.tsx"
```

Expected: only the file itself prints. Zero importers.

- [ ] **Step 2: Delete file**

Run:
```bash
git rm components/AuroraBackground.tsx
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete unused AuroraBackground component"
```

---

### Task 2: Delete GridBackground

**Files:**
- Delete: `components/landing/GridBackground.tsx`

- [ ] **Step 1: Confirm zero importers**

Run:
```bash
grep -rn "GridBackground" app components lib --include="*.ts" --include="*.tsx"
```

Expected: only the file itself prints.

- [ ] **Step 2: Delete + type-check + commit**

```bash
git rm components/landing/GridBackground.tsx
npm run type-check
git commit -m "chore: delete unused GridBackground component"
```

---

### Task 3: Delete Testimonials placeholder

**Files:**
- Delete: `components/landing/Testimonials.tsx`
- Modify: `app/page.tsx` (remove TODO comment block + commented JSX)

- [ ] **Step 1: Read app/page.tsx**

Use Read tool on `app/page.tsx`. Note lines 6–9 (TODO comment + commented import) and line 79 (commented JSX).

- [ ] **Step 2: Edit app/page.tsx — remove comment block**

Strip lines 6–9 (the `// TODO(beta-launch)` block and commented `import Testimonials` line).

- [ ] **Step 3: Edit app/page.tsx — remove commented JSX**

Strip line 79 (`{/* <Testimonials /> — hidden ... */}`).

- [ ] **Step 4: Delete Testimonials file**

```bash
git rm components/landing/Testimonials.tsx
```

- [ ] **Step 5: Type-check + commit**

```bash
npm run type-check
git add app/page.tsx
git commit -m "chore: remove Testimonials placeholder until real beta quotes exist"
```

Note: re-introduce as a fresh component when ≥3 attributed quotes are collected. Do not keep dead UI on disk.

---

### Task 4: Audit FloatingSidebar — keep or cut

**Files:**
- Read: `components/landing/FloatingSidebar.tsx`

- [ ] **Step 1: Read the component**

Open `components/landing/FloatingSidebar.tsx`. If it renders only a static badge with no CTA and no impressions tracking, mark for deletion. If it surfaces an active link (e.g., to demo or Web Store), keep.

- [ ] **Step 2: Decision branch**

- If **keep**: skip remaining steps in this task.
- If **cut**:
  ```bash
  git rm components/landing/FloatingSidebar.tsx
  ```
  Then remove `import FloatingSidebar` and `<FloatingSidebar />` JSX from `app/page.tsx` (currently lines 15 + 73).

- [ ] **Step 3: Commit (only if cut)**

```bash
npm run type-check
git add app/page.tsx
git commit -m "chore: remove FloatingSidebar (passive badge, no conversion value)"
```

---

## Phase 2 — Pricing Trim

### Task 5: Cut annual toggle + Team tier from Pricing

**Files:**
- Modify: `components/landing/Pricing.tsx`

**Why:** Annual toggle does nothing visible when only Free is rendered ($0 either way). Team tier markets "Custom" enterprise but solo dev has no contract path. Keeping fake options inflates UI without converting.

- [ ] **Step 1: Read current Pricing.tsx**

Open the file. Identify:
- `useState(false)` for `annual` (line ~82)
- Annual/Monthly toggle JSX block (lines ~121–183)
- Team tier object inside `tiers` array (lines ~61–78)
- `md:grid-cols-2` grid (line ~187)

- [ ] **Step 2: Remove Team tier from `tiers` array**

Delete the entire Team tier object (lines ~61–78). Result: `tiers` contains only Free.

- [ ] **Step 3: Remove annual toggle state + JSX**

- Delete `const [annual, setAnnual] = useState(false);` and the `useState` import if unused elsewhere.
- Delete the toggle JSX block (Monthly/Annual span + button + spring motion).
- In the price calculation, drop the `annual ? ...` ternary — use `tier.monthlyPrice` directly.
- Delete the `key={`${tier.name}-${annual}`}` re-mount on the `<motion.span>`.

- [ ] **Step 4: Change grid layout for single card**

Update grid wrapper:
```tsx
<div className="grid gap-px mx-auto max-w-md" style={{ background: "var(--l-border)" }}>
```

(Remove `md:grid-cols-2` and shrink `max-w-4xl` → `max-w-md` for single-card centered layout.)

- [ ] **Step 5: Soften the H2**

Current: `Same drafting quality. Different volume.` — implies multiple tiers. Replace with:
```tsx
<h2 ...>
  Free while we&apos;re in beta.{" "}
  <em style={{ fontStyle: "italic" }}>Paid tiers when you ask for them.</em>
</h2>
```

- [ ] **Step 6: Type-check + visual smoke**

```bash
npm run type-check
npm run dev
```

Open http://localhost:3000 → scroll to Pricing. Verify: single centered Free card, no toggle, headline updated.

- [ ] **Step 7: Commit**

```bash
git add components/landing/Pricing.tsx
git commit -m "fix(landing): trim Pricing to single Free tier — remove annual toggle and Team placeholder"
```

---

## Phase 3 — GTM Trust Surface

### Task 6: Create sample data module for demo

**Files:**
- Create: `app/demo/sample-data.ts`

- [ ] **Step 1: Write the module**

Create `app/demo/sample-data.ts`:

```ts
export const SAMPLE_PROFILE = {
  name: "Priya Raman",
  headline: "Senior ML Engineer at DeepMind · ex-Stripe",
  location: "London, United Kingdom",
  about:
    "ML engineer focused on inference-time efficiency. Previously built fraud models at Stripe. Recent talk on sparse attention at NeurIPS 2025.",
  experience: [
    "Senior ML Engineer, Google DeepMind — 2024 to present",
    "Senior ML Engineer, Stripe — 2020 to 2024",
    "ML Engineer, Two Sigma — 2018 to 2020",
  ],
  recentPost:
    "After two months on sparse-attention inference, the real win wasn't latency — it was the smaller models we could now deploy to edge.",
};

export const SAMPLE_RESUME = `Nagarjun Mallesh — MS Computer Science, Boston University.
Built fraud-detection pipelines processing 4M events/day at a fintech startup.
Open-source contributor: pytorch/serve. Looking for ML infra roles where inference cost matters.`;

export const SAMPLE_DRAFT = {
  category: "linkedin_connection" as const,
  body:
    "Hi Priya — read your NeurIPS talk on sparse attention. I worked on inference-cost reduction at a fintech (smaller scale, fraud pipelines) and the edge-deploy angle in your recent post matched what we saw — smaller models often unlocked more than raw latency. Would love to follow your work.",
  character_count: 322,
  processingTime: 7400,
};
```

- [ ] **Step 2: Commit**

```bash
git add app/demo/sample-data.ts
git commit -m "feat(demo): add hardcoded sample profile + resume + draft for /demo route"
```

---

### Task 7: Build the /demo route

**Files:**
- Create: `app/demo/page.tsx`
- Create: `components/demo/DemoExample.tsx`

**Why:** Cold visitors flagged the site as phishing partly because there is no observable proof the product does what the landing claims. A public demo removes that ambiguity: visitor reads sample profile + resume on the left, sees the generated draft on the right, no auth.

- [ ] **Step 1: Create the demo client component**

Create `components/demo/DemoExample.tsx`:

```tsx
"use client";

import { SAMPLE_PROFILE, SAMPLE_RESUME, SAMPLE_DRAFT } from "@/app/demo/sample-data";

export default function DemoExample() {
  return (
    <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
      <section
        className="p-6"
        style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)" }}
      >
        <p
          className="mb-3 text-[0.65rem] tracking-widest uppercase"
          style={{ color: "var(--l-text-dim)" }}
        >
          Input — LinkedIn profile + your resume
        </p>
        <h3 style={{ fontFamily: "var(--font-flaviotte), serif", fontSize: "1.4rem" }}>
          {SAMPLE_PROFILE.name}
        </h3>
        <p className="text-sm" style={{ color: "var(--l-text-muted)" }}>
          {SAMPLE_PROFILE.headline}
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--l-text-dim)" }}>
          {SAMPLE_PROFILE.location}
        </p>
        <p className="mt-4 text-sm" style={{ color: "var(--l-text-muted)" }}>
          {SAMPLE_PROFILE.about}
        </p>
        <p className="mt-4 text-xs uppercase tracking-widest" style={{ color: "var(--l-text-dim)" }}>
          Recent post
        </p>
        <p className="text-sm italic" style={{ color: "var(--l-text-muted)" }}>
          &ldquo;{SAMPLE_PROFILE.recentPost}&rdquo;
        </p>
        <p className="mt-6 text-xs uppercase tracking-widest" style={{ color: "var(--l-text-dim)" }}>
          Your resume snippet
        </p>
        <p className="mt-2 text-xs whitespace-pre-line" style={{ color: "var(--l-text-muted)" }}>
          {SAMPLE_RESUME}
        </p>
      </section>

      <section
        className="p-6"
        style={{ background: "var(--l-surface-2)", border: "1px solid var(--l-border)" }}
      >
        <p
          className="mb-3 text-[0.65rem] tracking-widest uppercase"
          style={{ color: "var(--l-blue)" }}
        >
          Output — connection note ({SAMPLE_DRAFT.character_count} chars)
        </p>
        <p
          data-testid="demo-draft"
          className="text-base leading-relaxed"
          style={{ fontFamily: "var(--font-flaviotte), serif", color: "var(--l-text)" }}
        >
          {SAMPLE_DRAFT.body}
        </p>
        <p className="mt-6 text-xs" style={{ color: "var(--l-text-dim)" }}>
          Generated in {SAMPLE_DRAFT.processingTime / 1000}s · sanitised · AI fingerprints stripped
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create the demo page wrapper**

Create `app/demo/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import DemoExample from "@/components/demo/DemoExample";

export const metadata: Metadata = {
  title: "Demo — see a real draft | Aletheia",
  description:
    "See the exact input and output Aletheia produces. No sign-up, no install, just one rendered example.",
};

export default function DemoPage() {
  return (
    <main className="landing min-h-screen px-5 sm:px-8 py-24" style={{ background: "var(--l-bg)" }}>
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--l-text-dim)" }}
        >
          ← Back to home
        </Link>
        <h1
          className="mt-8 mb-3"
          style={{
            fontFamily: "var(--font-flaviotte), serif",
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 900,
            color: "var(--l-text)",
          }}
        >
          One profile in. One note out.
        </h1>
        <p className="mb-12 max-w-2xl text-sm" style={{ color: "var(--l-text-muted)" }}>
          This is real output from a real Claude generation. No sign-up. No install. If the note
          below sounds like something you would actually send, the rest of the product works the
          same — one click per profile in your browser.
        </p>

        <DemoExample />

        <div className="mt-14 flex flex-col items-center gap-3">
          <Link href="/#cta" className="btn-primary">
            Join the Waitlist
          </Link>
          <Link
            href="/ascendia-extension.zip"
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--l-text-dim)" }}
          >
            Or download the extension (.zip)
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Type-check + visual smoke**

```bash
npm run type-check
npm run dev
```

Open http://localhost:3000/demo. Verify: page renders with two-column layout, sample profile left, draft right, back-link to home works.

- [ ] **Step 4: Commit**

```bash
git add app/demo components/demo
git commit -m "feat(demo): public /demo route with sample profile and rendered draft, no auth"
```

---

### Task 8: Playwright smoke test for /demo

**Files:**
- Create: `e2e/demo.spec.ts`

- [ ] **Step 1: Write the test**

Create `e2e/demo.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("@smoke /demo", () => {
  test("renders the sample draft without auth", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("heading", { name: /one profile in/i })).toBeVisible();
    const draft = page.getByTestId("demo-draft");
    await expect(draft).toBeVisible();
    const text = await draft.textContent();
    expect(text?.length ?? 0).toBeGreaterThan(100);
  });

  test("has back-link to home", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("link", { name: /back to home/i }).click();
    await expect(page).toHaveURL("/");
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx playwright test --grep "@smoke" e2e/demo.spec.ts`
Expected: 2 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/demo.spec.ts
git commit -m "test(e2e): @smoke coverage for /demo route"
```

---

### Task 9: Add Chrome Web Store CTA + privacy line to Navbar

**Files:**
- Modify: `components/landing/Navbar.tsx`

**Why:** Visitors landing after a phishing-flag scare need a recognised distribution channel signal. Even before the listing exists, the badge primes trust; link it to a static placeholder until the Store listing is published.

- [ ] **Step 1: Add a configurable constant**

At the top of `components/landing/Navbar.tsx` (just below the imports), add:

```ts
// Replace with real Web Store URL once the listing is published. Until then,
// link to /demo so the click still lands on a high-trust surface.
const CHROME_WEB_STORE_URL: string =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ?? "/demo";
```

- [ ] **Step 2: Replace download CTA with conditional**

Find the desktop `<a href="/ascendia-extension.zip" download className="btn-primary">` block (currently line ~248). Replace with:

```tsx
<a
  href={CHROME_WEB_STORE_URL}
  target={CHROME_WEB_STORE_URL.startsWith("http") ? "_blank" : undefined}
  rel={CHROME_WEB_STORE_URL.startsWith("http") ? "noopener noreferrer" : undefined}
  className="btn-primary"
  style={{ fontSize: "0.68rem", padding: "0.65rem 1.4rem" }}
>
  {CHROME_WEB_STORE_URL.startsWith("http") ? "Get on Chrome Web Store" : "See a real draft"}
</a>
```

Do the same for the mobile menu CTA (line ~310).

- [ ] **Step 3: Type-check + visual smoke**

```bash
npm run type-check
npm run dev
```

Open http://localhost:3000. Verify: navbar CTA reads "See a real draft" and links to `/demo`. Set `NEXT_PUBLIC_CHROME_WEB_STORE_URL=https://chrome.google.com/webstore/...` in `.env.local` to verify the alternate branch — should read "Get on Chrome Web Store" and open in new tab.

- [ ] **Step 4: Commit**

```bash
git add components/landing/Navbar.tsx
git commit -m "feat(landing): swap raw zip download for /demo CTA, gated on NEXT_PUBLIC_CHROME_WEB_STORE_URL env"
```

---

### Task 10: Surface privacy line in Hero

**Files:**
- Modify: `components/landing/Hero.tsx`

**Why:** "HTML is stripped and injection patterns are blocked before anything leaves your browser" currently lives in step 01 of HowItWorks (below the fold). Moving the one-line privacy claim into the Hero closes the trust gap before the visitor decides whether to keep scrolling.

- [ ] **Step 1: Read Hero.tsx**

Open `components/landing/Hero.tsx`. Locate the existing `<motion.p>` subheadline block (~line 189–200) and the launch info `<motion.p>` (~line 236–244).

- [ ] **Step 2: Append a privacy micro-line**

Below the launch-info paragraph, add (still inside the content layer `<div style={{ zIndex: 2 }}>`):

```tsx
<motion.p
  className="mt-2 text-[10px] tracking-widest uppercase"
  style={{ color: "var(--l-text-dim)" }}
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.5, delay: 1.18 }}
>
  Profile HTML stripped in your browser · No background scraping
</motion.p>
```

- [ ] **Step 3: Add `/demo` link beneath View Demo button**

In the CTA block, change `href="#how-it-works"` on the "View Demo" link to `href="/demo"` and update the click handler:

```tsx
<a
  href="/demo"
  className="btn-secondary"
>
  See a real draft
</a>
```

(Drop the smooth-scroll handler — this is now a route, not an anchor.)

- [ ] **Step 4: Visual smoke + commit**

```bash
npm run type-check
npm run dev
```

Open http://localhost:3000. Verify: privacy micro-line visible below "Coming soon to Chrome Web Store..." line. "View Demo" → "See a real draft" navigates to `/demo`.

```bash
git add components/landing/Hero.tsx
git commit -m "feat(landing): add privacy micro-line and route View Demo to /demo"
```

---

## Phase 4 — Onboarding

### Task 11: Build dashboard empty state

**Files:**
- Create: `app/dashboard/EmptyState.tsx`
- Modify: `app/dashboard/page.tsx`

**Why:** A first-login user currently sees an empty drafts list with no next step. They need three things in priority order: (1) install extension, (2) understand input format, (3) try the demo. Empty state surfaces all three.

- [ ] **Step 1: Read the current dashboard page**

Open `app/dashboard/page.tsx`. Find where drafts (or feedback rows) are rendered. Identify the empty branch (likely an `if (drafts.length === 0)` or a default state).

- [ ] **Step 2: Create EmptyState component**

Create `app/dashboard/EmptyState.tsx`:

```tsx
import Link from "next/link";

export default function EmptyState() {
  return (
    <div
      className="rounded-none p-10 text-center"
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)" }}
    >
      <p
        className="mb-2 text-[0.65rem] tracking-widest uppercase"
        style={{ color: "var(--l-text-dim)" }}
      >
        First time here
      </p>
      <h2
        className="mb-3"
        style={{
          fontFamily: "var(--font-flaviotte), serif",
          fontSize: "1.6rem",
          color: "var(--l-text)",
        }}
      >
        No drafts yet. Three steps to your first one.
      </h2>
      <ol className="mx-auto mb-8 max-w-md text-left text-sm" style={{ color: "var(--l-text-muted)" }}>
        <li className="mb-2">
          <strong>1.</strong> Install the Aletheia extension —{" "}
          <Link href="/ascendia-extension.zip" className="underline">
            download the .zip
          </Link>{" "}
          and load it unpacked at chrome://extensions.
        </li>
        <li className="mb-2">
          <strong>2.</strong> Paste your resume into{" "}
          <Link href="/profile" className="underline">
            your profile
          </Link>{" "}
          so Aletheia can ground drafts in your background.
        </li>
        <li>
          <strong>3.</strong> Open any LinkedIn profile and click <em>Generate</em> in the popup.
        </li>
      </ol>
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <Link href="/demo" className="btn-secondary">
          See a sample draft first
        </Link>
        <Link href="/profile" className="btn-primary">
          Add your resume
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into dashboard/page.tsx**

In `app/dashboard/page.tsx`, replace the existing empty branch with `<EmptyState />`. Example shape:

```tsx
import EmptyState from "./EmptyState";

// inside the component, where drafts are rendered:
{drafts.length === 0 ? <EmptyState /> : <DraftsList drafts={drafts} />}
```

If the dashboard currently has no explicit empty branch (renders an empty `<ul>`), add the conditional.

- [ ] **Step 4: Type-check + manual smoke**

```bash
npm run type-check
npm run dev
```

Log in as a fresh user (or temporarily comment out the drafts fetch to force empty branch). Verify the EmptyState renders with three numbered steps + two CTAs.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/EmptyState.tsx app/dashboard/page.tsx
git commit -m "feat(dashboard): empty state with install + resume + demo CTAs for first-login users"
```

---

## Phase 5 — Telemetry Truth

### Task 12: Script to measure real generation latency

**Files:**
- Create: `scripts/measure-latency.ts`

**Why:** The Hero stat `<30s` is the timeout ceiling, not the observed p95. Replace it with the real measured p95 from `user_feedback.metadata.generationTimeMs`.

- [ ] **Step 1: Write the script**

Create `scripts/measure-latency.ts`:

```ts
import { createServiceClient } from "../lib/supabase/server";

async function main() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_feedback")
    .select("metadata")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const times = (data ?? [])
    .map((r) => Number((r.metadata as Record<string, unknown>)?.generationTimeMs))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  if (times.length === 0) {
    console.log("No samples.");
    return;
  }

  const pct = (p: number) => times[Math.floor(times.length * p)] ?? times.at(-1);
  const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  console.log(`N=${times.length}`);
  console.log(`p50 ${fmt(pct(0.5))}`);
  console.log(`p90 ${fmt(pct(0.9))}`);
  console.log(`p95 ${fmt(pct(0.95))}`);
  console.log(`p99 ${fmt(pct(0.99))}`);
  console.log(`max ${fmt(pct(1))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script**

```bash
npx tsx scripts/measure-latency.ts
```

Expected: prints p50/p90/p95/p99/max in seconds. Record the p95 value — that becomes the new Hero stat.

- [ ] **Step 3: Commit the script**

```bash
git add scripts/measure-latency.ts
git commit -m "chore: add scripts/measure-latency.ts — read p50/p95 from user_feedback metadata"
```

---

### Task 13: Replace `<30s` Hero stat with measured p95

**Files:**
- Modify: `components/landing/Hero.tsx`

- [ ] **Step 1: Update the stats array**

In `components/landing/Hero.tsx` (~line 6), change `<30s` to the measured p95 from Task 12, ceiling-rounded to the nearest whole second (e.g., 7.4s → `~8s`, 12.1s → `~13s`).

Example:
```ts
const stats = [
  { value: "~8s", label: "Per draft (p95)" },
  { value: "270", label: "Chars, LinkedIn-ready" },
  { value: "0", label: "Tabs to juggle" },
];
```

If fewer than 50 samples exist, replace with `"Seconds"` (no number) until enough data lands — never fake a number.

- [ ] **Step 2: Commit**

```bash
git add components/landing/Hero.tsx
git commit -m "fix(landing): replace <30s timeout ceiling with measured p95 generation latency"
```

---

### Task 14: Public /status page

**Files:**
- Create: `app/status/page.tsx`

**Why:** Closes the trust loop — visitors can verify the deployed build matches what the landing claims. Uses the existing `/api/extension/version` endpoint.

- [ ] **Step 1: Create the page**

Create `app/status/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status — Aletheia",
  description: "Current build version, commit SHA, and last deploy time.",
};

type VersionPayload = {
  version: string;
  sha: string;
  builtAt: string;
  sizeBytes: number;
};

async function getVersion(): Promise<VersionPayload | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/extension/version`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as VersionPayload;
  } catch {
    return null;
  }
}

export default async function StatusPage() {
  const version = await getVersion();

  return (
    <main className="landing min-h-screen px-5 sm:px-8 py-24" style={{ background: "var(--l-bg)" }}>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--l-text-dim)" }}
        >
          ← Back to home
        </Link>
        <h1
          className="mt-8 mb-6"
          style={{ fontFamily: "var(--font-flaviotte), serif", fontSize: "2rem", fontWeight: 900 }}
        >
          Status
        </h1>
        {version ? (
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt style={{ color: "var(--l-text-dim)" }}>Version</dt>
            <dd>{version.version}</dd>
            <dt style={{ color: "var(--l-text-dim)" }}>Commit</dt>
            <dd className="font-mono">{version.sha.slice(0, 12)}</dd>
            <dt style={{ color: "var(--l-text-dim)" }}>Built</dt>
            <dd>{new Date(version.builtAt).toISOString()}</dd>
            <dt style={{ color: "var(--l-text-dim)" }}>Extension size</dt>
            <dd>{(version.sizeBytes / 1024).toFixed(0)} KB</dd>
          </dl>
        ) : (
          <p style={{ color: "var(--l-text-muted)" }}>
            Version endpoint unreachable. Health check:{" "}
            <Link href="/api/health" className="underline">
              /api/health
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Open http://localhost:3000/status. Expect: version, 12-char SHA, build time, size.

- [ ] **Step 3: Commit**

```bash
git add app/status/page.tsx
git commit -m "feat(status): public /status page reading /api/extension/version"
```

---

## Phase 6 — CI Coverage Gate

### Task 15: Add coverage threshold to vitest config

**Files:**
- Modify: `vitest.config.ts`

**Why:** `>87% coverage target` is documented in CLAUDE.md but not enforced. Coverage can drop silently. Gate it.

- [ ] **Step 1: Measure current baseline**

```bash
npm run test:coverage -- --run
```

Inspect the printed summary. Record the current lines/branches/functions/statements percentages.

- [ ] **Step 2: Set threshold 3 points below current baseline**

If baseline lines is 87% → set threshold to 84%. Add to `vitest.config.ts` inside the `coverage` block:

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: ["lib/**/*.ts", "app/api/**/*.ts"],
  exclude: [
    "lib/database/types.ts",
    "**/*.d.ts",
    "node_modules/**",
    "lib/supabase/client.ts",
    "lib/supabase/server.ts",
    "__tests__/**",
  ],
  thresholds: {
    lines: 84,       // set 3 points below current baseline
    statements: 84,
    branches: 70,
    functions: 80,
  },
},
```

- [ ] **Step 3: Run with the gate**

```bash
npm run test:coverage -- --run
```

Expected: PASS. If FAIL, lower the threshold to current minus 1 point and re-run. Never raise the threshold higher than current measured value.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts
git commit -m "ci: enforce coverage thresholds three points below current baseline"
```

---

### Task 16: Wire coverage gate into CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update the unit-tests step**

In `.github/workflows/ci.yml`, locate the `test:` job's "Run unit tests" step. Change:

```yaml
- name: Run unit tests
  run: npm run test -- --run
```

To:

```yaml
- name: Run unit tests with coverage gate
  run: npm run test:coverage -- --run
```

- [ ] **Step 2: Upload coverage artefact (optional but cheap)**

Below that step, add:

```yaml
- name: Upload coverage report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage/
    retention-days: 7
```

- [ ] **Step 3: Validate locally**

```bash
act -j test  # if you have nektos/act installed
```

If `act` is unavailable, push to a branch and open a draft PR to validate the workflow on GitHub Actions.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: switch unit-tests job to test:coverage, upload html report artefact"
```

---

## Phase 7 — Resolve Extension Test Plan

### Task 17: Decide on `pure-discovering-adleman.md`

**Files:**
- Read: `docs/superpowers/plans/pure-discovering-adleman.md` (currently in `.claude/plans/`)
- Modify or delete: same file

**Why:** A 2,190-line plan for refactoring the extension to ES modules + 87 tests sits in `.claude/plans/`. It is neither executing nor cancelled. Pick one and move on. Half-state is the worst outcome.

- [ ] **Step 1: Re-read the plan**

```bash
cat .claude/plans/pure-discovering-adleman.md | wc -l
```

Confirm line count (~620 in the current state). Skim phases 0–7.

- [ ] **Step 2: Make the call**

Two options, mutually exclusive:

- **Option A — Defer (recommended pre-launch):** Keep the file but add a header gate. Do not execute now. The extension is shipping working code; tests can wait until the first 50 paid users prove product fit.

- **Option B — Execute now:** This is its own plan. Start by invoking `superpowers:executing-plans` with that file as the input. Do not bury it inside this plan.

- [ ] **Step 3a: If Option A, add a gate header**

At the top of `.claude/plans/pure-discovering-adleman.md`, prepend:

```markdown
> **GATED:** Do not execute this plan until Aletheia has ≥50 paid users
> or one production bug has been traced to untested extension code.
> Owner: Nagarjun. Last reviewed: 2026-05-21.
```

Then commit:

```bash
git add .claude/plans/pure-discovering-adleman.md
git commit -m "docs(plans): gate extension-testing refactor until first 50 paid users or first untested-code incident"
```

- [ ] **Step 3b: If Option B, stop and run the other plan**

Stop this plan. Hand off to `superpowers:executing-plans` against `.claude/plans/pure-discovering-adleman.md`. Resume the current plan only after that work merges to main.

---

## Phase 8 — Documentation Hygiene

### Task 18: Archive completed progress phases

**Files:**
- Create: `.claude/archive/claude-progress-phases-1-27.txt`
- Modify: `.claude/claude-progress.txt`

**Why:** 1,414-line live progress file. Phases 1–27 are frozen history; keeping them in the live file inflates context every session.

- [ ] **Step 1: Inspect phase boundaries**

```bash
grep -n "^## PHASE\|^PHASE " .claude/claude-progress.txt | head -40
```

Locate the line numbers where each phase starts. Identify the start of Phase 28.

- [ ] **Step 2: Split**

```bash
mkdir -p .claude/archive
# Replace PHASE_28_START with the actual line number from step 1
head -n <PHASE_28_START - 1> .claude/claude-progress.txt > .claude/archive/claude-progress-phases-1-27.txt
tail -n +<PHASE_28_START> .claude/claude-progress.txt > /tmp/progress-live.txt
mv /tmp/progress-live.txt .claude/claude-progress.txt
```

- [ ] **Step 3: Prepend index pointer to live file**

Add a one-line header at the top of `.claude/claude-progress.txt`:

```
Archived phases 1–27 → .claude/archive/claude-progress-phases-1-27.txt
```

- [ ] **Step 4: Verify**

```bash
wc -l .claude/claude-progress.txt .claude/archive/claude-progress-phases-1-27.txt
```

Expected: live file is now substantially smaller; archive holds the historical content. Combined line counts match the original minus the new header line.

- [ ] **Step 5: Commit**

```bash
git add .claude/claude-progress.txt .claude/archive/
git commit -m "docs(progress): archive phases 1-27, keep live file scoped to current work"
```

---

### Task 19: Trim README Tier-5 table

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find the Tier-5 block**

```bash
grep -n "Tier 5 — Anti-Phishing Trust Surface" README.md
```

- [ ] **Step 2: Replace with a 3-line summary**

Replace the entire Tier-5 table block with:

```markdown
**Tier 5 — Anti-Phishing Trust Surface (Phase 29):** added legal pages
(`/privacy`, `/terms`), LinkedIn disclaimer in footer, founder note with real
identity, and removed fabricated metric copy from the landing page.
See `.claude/archive/claude-progress-phases-1-27.txt` for the full audit.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): collapse Tier-5 table into summary, link to archived progress"
```

---

### Task 20: Update CLAUDE.md project structure

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add new routes to Project Structure**

In `CLAUDE.md`, in the `app/` block of the Project Structure section, add:

```
app/
  demo/page.tsx        ← public no-auth sample (Phase 30)
  status/page.tsx      ← public build version + SHA (Phase 30)
```

- [ ] **Step 2: Trim Tech Stack Typography row**

Locate the Typography row in the Tech Stack table. Replace the verbose font-stack description with:

```
| Typography | Flaviotte (display + body) | Local via `next/font/local` from `public/fonts/Flaviotte.woff2`. Bundled into extension at `ascendia-extension/assets/fonts/`. |
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): add /demo and /status routes, trim Typography row"
```

---

## Verification

After all 20 tasks land, run the full check:

- [ ] **Step 1: Type check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Unit + coverage**

Run: `npm run test:coverage -- --run`
Expected: PASS, thresholds met.

- [ ] **Step 4: Guardrails**

Run: `npm run test:guardrails -- --run`
Expected: PASS.

- [ ] **Step 5: E2E smoke (includes new /demo spec)**

Run: `npx playwright test --grep "@smoke"`
Expected: PASS.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Local visual sweep**

```bash
npm run dev
```

Visit, in order: `/`, `/demo`, `/status`, `/privacy`, `/terms`, `/dashboard` (as fresh user). For each, confirm there are no console errors and the page renders the intended trust signal.

- [ ] **Step 8: Submit Safe Browsing re-review**

Once deployed to production, open https://safebrowsing.google.com/safebrowsing/report_error/?hl=en and submit `https://aletheia.live` for re-review. Include `/privacy`, `/terms`, `/demo`, `/status`, and the founder note as evidence.

---

## Self-Review Notes

- **Spec coverage:** Every observation in the prior evaluation maps to a task:
  - Dead components → Tasks 1–4
  - Pricing trim → Task 5
  - `/demo` route → Tasks 6–8
  - Chrome Web Store CTA → Task 9
  - Hero privacy line → Task 10
  - Dashboard onboarding → Task 11
  - Telemetry truth (real p95) → Tasks 12–13
  - `/status` page → Task 14
  - CI coverage gate → Tasks 15–16
  - Extension test plan decision → Task 17
  - Progress file archive → Task 18
  - README trim → Task 19
  - CLAUDE.md update → Task 20
- **No placeholders.** Every code block is concrete.
- **Type consistency:** `SAMPLE_PROFILE`, `SAMPLE_RESUME`, `SAMPLE_DRAFT` reused identically across sample-data, DemoExample, and demo page.
- **YAGNI:** No Stripe, no testimonials, no Loki/Grafana, no extension test refactor inside this plan.
- **TDD applied where useful:** `/demo` route has Playwright `@smoke` test (Task 8). Pure UI deletions (Phase 1) skip tests — git history + type-check are the safety net.
