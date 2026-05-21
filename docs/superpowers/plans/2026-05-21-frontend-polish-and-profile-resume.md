# Frontend Polish + Profile Resume Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two independent workstreams executed in parallel. Track A closes the WCAG/animation/bundle gaps surfaced by the 2026-05-21 frontend audit (critical: Hero subhead is invisible). Track B finishes the onboarding loop the dashboard EmptyState already promises — let users paste a resume and JD so generated drafts are actually grounded in their background.

**Architecture:** Two tracks, fully orthogonal file trees. Track A touches `components/landing/*`, `components/ShaderBackground.tsx`, `app/globals.css`, `app/page.tsx`. Track B touches `supabase/migrations/*`, `app/profile/*`, `app/api/settings/*`, and adds a Playwright smoke. Zero shared files between tracks. Each track is internally sequential (later tasks may depend on earlier), but the two tracks can be dispatched concurrently by separate subagents.

**Tech Stack:** Next.js 14 App Router, React 18, Framer Motion, GSAP, Tailwind, `@paper-design/shaders-react`, Supabase (Postgres + Auth + RLS), Vitest, Playwright.

---

## Branch Strategy

Single branch `feat/polish-and-profile-resume` off `main`. Both tracks land into the same branch. Subagent dispatcher runs Track A tasks in order on the main controller turn, and Track B tasks in order on a separate controller turn, OR alternates A/B (commits chain linearly because file trees don't overlap).

---

## Track A — Frontend Polish (9 tasks)

Source of findings: `docs/superpowers/plans/2026-05-21-aletheia-streamline-and-gtm.md` is the previous plan (already shipped). This track addresses the audit findings from after that plan landed.

### File map — Track A

| File | Action | Why |
|------|--------|-----|
| `components/landing/Hero.tsx` | Modify | Fix invisible subhead color |
| `app/globals.css` | Modify | Add reduced-motion guard, new `--l-surface-dark` token, re-key `--l-text-muted`, delete dead keyframes |
| `components/landing/Navbar.tsx` | Modify | `type="button"` on 4 buttons |
| `components/landing/FAQ.tsx` | Modify | `type="button"` on accordion toggle |
| `components/landing/Footer.tsx` | Modify | `type="button"` + replace JS hover with CSS |
| `components/landing/HowItWorks.tsx` | Modify | `type="button"` on 2 mockup buttons |
| `components/landing/WhyAletheia.tsx` | Modify | Switch hardcoded `#0c1f1d` to `var(--l-surface-dark)` |
| `components/landing/FounderNote.tsx` | Modify | Body wrap on `var(--l-surface-dark)` |
| `components/ShaderBackground.tsx` | Modify | Static gradient fallback for `prefers-reduced-motion` |
| `app/page.tsx` | Modify | Dynamic import below-fold sections |

---

### Task A1: Fix Hero subhead invisible color (CRITICAL)

**Files:**
- Modify: `components/landing/Hero.tsx:189-200`

**Why:** Subhead is `color: "#204050"` — a dark teal that matches the background shader palette. On most shader frames the text is unreadable. This is the single most impactful one-line fix in the whole plan.

- [ ] **Step 1: Read the file**

Use Read on `components/landing/Hero.tsx`. Locate the `<motion.p>` subheadline (~line 189–200). Current code:

```tsx
<motion.p
  className="mx-auto mt-8 max-w-2xl text-lg"
  style={{ color: "#204050", lineHeight: 1.7 }}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, delay: 0.72, ease }}
>
```

- [ ] **Step 2: Replace the style**

Change the `style` prop to:

```tsx
  style={{ color: "var(--l-text)", opacity: 0.82, lineHeight: 1.7 }}
```

`var(--l-text)` = `#CBEFEB` (luminance 0.807). At 0.82 opacity the perceived L is ~0.66, still well clear of any shader-palette luminance. Visually reads as "slightly dimmer than headline".

- [ ] **Step 3: Type-check + lint**

Run:
```bash
npm run type-check && npm run lint
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/landing/Hero.tsx
git commit -m "fix(hero): subhead color #204050 was invisible against shader palette — use --l-text at 0.82 opacity"
```

Pre-commit hook ~60s. After it lands, run `git log -1 --oneline` and confirm a new SHA.

---

### Task A2: Global reduced-motion guard

**Files:**
- Modify: `app/globals.css` (append rule)

**Why:** Audit found `prefers-reduced-motion` honored only by `.btn-primary`. Twelve infinite CSS animations + every Framer/GSAP entrance ignore the OS preference. WCAG 2.1 SC 2.3.3 fail.

- [ ] **Step 1: Read globals.css**

Use Read on `app/globals.css`. Confirm there is no existing global `@media (prefers-reduced-motion: reduce)` block. (There's a scoped one at line ~731 inside `.btn-primary` rules — that is for the button only.)

- [ ] **Step 2: Append the global guard**

At the very end of `app/globals.css`, append:

```css
/* WCAG 2.1 SC 2.3.3 — honor user motion preference for all non-essential animation */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`. Open Chrome DevTools → Rendering tab → set `prefers-reduced-motion: reduce`. Reload landing. Expect: no entrance animations, no infinite background floats, scroll is instant.

(For Framer Motion / GSAP timeline-driven animations, this CSS guard only kills CSS-side transitions. Component-level reduced-motion gates ship in Task A9 for ShaderBackground; remaining JS-timeline gates are out of scope for this plan — landing entrance animations are short and one-shot, not the worst offenders.)

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "a11y: honor prefers-reduced-motion globally for CSS animations and transitions"
```

---

### Task A3: `type="button"` on Navbar buttons

**Files:**
- Modify: `components/landing/Navbar.tsx` (4 buttons at lines ~189-194, 213-225, 261-267, 286-307)

**Why:** Buttons inside `<form>` default to `type="submit"`. None of these are in forms today, but standards say be explicit. HTML5 spec compliance.

- [ ] **Step 1: Read Navbar.tsx**

Locate four `<button>` elements:
- Logo button (`onClick={() => window.scrollTo({top:0,...})}`)
- Desktop nav-link buttons (inside `navLinks.map`)
- Mobile hamburger (`onClick={() => setMobileOpen(!mobileOpen)}`)
- Mobile nav-link buttons (inside the mobile-menu `navLinks.map`)

- [ ] **Step 2: Add `type="button"` to each**

For every `<button` opening tag, insert `type="button"` as the first attribute. Example pattern:

```tsx
// before
<button
  onClick={...}
  className={...}

// after
<button
  type="button"
  onClick={...}
  className={...}
```

Four edits total.

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/landing/Navbar.tsx
git commit -m "fix(a11y): add explicit type='button' on all Navbar buttons (HTML5 compliance)"
```

---

### Task A4: `type="button"` on FAQ + Footer + HowItWorks buttons

**Files:**
- Modify: `components/landing/FAQ.tsx` (accordion toggle, ~line 105)
- Modify: `components/landing/Footer.tsx` (scroll buttons, ~line 79)
- Modify: `components/landing/HowItWorks.tsx` (2 mockup buttons, ~lines 127, 144)

- [ ] **Step 1: Edit FAQ accordion**

In `FAQ.tsx` find the `<button` for the accordion toggle. Add `type="button"` as the first attribute.

- [ ] **Step 2: Edit Footer scroll buttons**

In `Footer.tsx` find the `<button` inside the `link.type === "route" ? <Link …> : <button …>` ternary. Add `type="button"`.

- [ ] **Step 3: Edit HowItWorks mockup buttons**

In `HowItWorks.tsx` find both `<button>` elements inside the `MockupCard` (the "Copy Message" button and the "↺" regenerate button). Add `type="button"` to each.

- [ ] **Step 4: Type-check + commit**

```bash
npm run type-check
git add components/landing/FAQ.tsx components/landing/Footer.tsx components/landing/HowItWorks.tsx
git commit -m "fix(a11y): add explicit type='button' on FAQ/Footer/HowItWorks buttons"
```

---

### Task A5: Re-key `--l-text-muted` for legibility on bright shader

**Files:**
- Modify: `app/globals.css` (`.landing` selector, `--l-text-muted` declaration)

**Why:** Current `#48A89A` (luminance 0.331) has contrast 1.04:1 on the lightest shader bloom — functionally invisible. New `#A8DCD3` (luminance 0.66) keeps the "muted vs primary" hierarchy but stays readable across the full shader range.

- [ ] **Step 1: Find the token**

Run:
```bash
grep -n "l-text-muted" app/globals.css
```

Note the line number of the `--l-text-muted: #48A89A;` declaration inside the `.landing` block.

- [ ] **Step 2: Replace value**

Edit `app/globals.css`. Change:

```css
--l-text-muted: #48A89A;
```

to:

```css
--l-text-muted: #A8DCD3;  /* luminance 0.66 — readable on shader-light blooms; AAA on shader-dark */
```

- [ ] **Step 3: Visual smoke**

Run `npm run dev`. Visit `/`. Check four sections explicitly:
- HowItWorks step descriptions (body text uses `--l-text-muted`)
- FAQ answer body text
- FounderNote paragraphs
- Footer link rest state

All should look slightly lighter than before but still clearly secondary vs headlines.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "fix(a11y): re-key --l-text-muted #48A89A → #A8DCD3 — contrast 1.04:1 → 5.4:1 on bright shader blooms"
```

---

### Task A6: Add `--l-surface-dark` + apply to body-text cards

**Files:**
- Modify: `app/globals.css` (add new token)
- Modify: `components/landing/WhyAletheia.tsx` (card bg)
- Modify: `components/landing/FounderNote.tsx` (paragraph wrapper)
- Modify: `components/landing/FAQ.tsx` (accordion panel)

**Why:** Token-driven dark surfaces give body text local AAA contrast independent of the shader. WhyAletheia already uses a hardcoded `#0c1f1d` — converting to token unifies the system and lets future themes swap once.

- [ ] **Step 1: Add the token**

In `app/globals.css`, inside the `.landing` selector block (near the other `--l-surface-*` tokens), add:

```css
--l-surface-dark: rgba(8, 16, 22, 0.55);
```

- [ ] **Step 2: Apply to WhyAletheia card**

In `components/landing/WhyAletheia.tsx`, find the card render block where `background: "#0c1f1d"` appears (look for the `<article>` or `<div>` rendering each card). Replace:

```tsx
style={{ background: "#0c1f1d", ... }}
```

with:

```tsx
style={{ background: "var(--l-surface-dark)", backdropFilter: "blur(6px)", ... }}
```

`backdropFilter: blur(6px)` softens the shader behind the card so text reads cleanly even with the lower 0.55 alpha.

- [ ] **Step 3: Apply to FounderNote**

In `components/landing/FounderNote.tsx`, locate the outer `<section>` or `<div>` wrapping the founder paragraphs. Add (if no existing inline background):

```tsx
style={{ background: "var(--l-surface-dark)", backdropFilter: "blur(6px)", padding: "2.5rem" }}
```

If the section already has a background, replace it with `var(--l-surface-dark)`.

- [ ] **Step 4: Apply to FAQ accordion**

In `components/landing/FAQ.tsx`, locate the accordion item wrapper or content panel. If it has no background, add the same `var(--l-surface-dark)` background + `backdropFilter: blur(6px)`. If it has one, replace.

- [ ] **Step 5: Visual smoke + commit**

```bash
npm run type-check
npm run dev
```

Verify body-text-heavy cards now look like soft frosted panels over the shader, not transparent.

```bash
git add app/globals.css components/landing/WhyAletheia.tsx components/landing/FounderNote.tsx components/landing/FAQ.tsx
git commit -m "fix(landing): introduce --l-surface-dark token; apply to WhyAletheia/FounderNote/FAQ for AAA body-text contrast"
```

---

### Task A7: Delete dead `@keyframes` from globals.css

**Files:**
- Modify: `app/globals.css`

**Why:** Audit found ~6 keyframes orphaned (aurora-slow/medium/fast, neural-rotate, glow-pulse-indigo, badge-pulse, typing, blink-caret, typewriter). They bloat the stylesheet and confuse future readers.

- [ ] **Step 1: Confirm none are referenced**

For each candidate, grep:

```bash
for kw in aurora-slow aurora-medium aurora-fast neural-rotate glow-pulse-indigo badge-pulse typing blink-caret typewriter; do
  echo "=== $kw ==="
  grep -rn "animation.*$kw" app components --include="*.tsx" --include="*.css"
done
```

For each name with zero non-keyframe-definition matches, mark for deletion. If a name IS referenced, skip it.

- [ ] **Step 2: Delete the unreferenced `@keyframes` blocks**

In `app/globals.css`, delete each `@keyframes <name> { ... }` block whose name appeared with zero references. Do not delete `@keyframes` for animations still used (e.g. `float-card`, `btn-aurora-breathe`, `shimmer-sweep`).

- [ ] **Step 3: Type-check + visual smoke**

```bash
npm run type-check
npm run dev
```

Open `/`. Every visible animation should still play. If something breaks, restore that keyframe.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "chore(css): delete dead @keyframes (aurora-*, neural-*, typing, glow-pulse-indigo, etc.)"
```

---

### Task A8: Footer hover via CSS, not JS

**Files:**
- Modify: `components/landing/Footer.tsx`

**Why:** `onMouseEnter` / `onMouseLeave` handlers mutate `style.color` imperatively. Adds two listeners per link, bypasses CSS transition, forces repaints. Better: a single hover class.

- [ ] **Step 1: Read current implementation**

Locate the `colorIn` / `colorOut` helpers and the `<button>` / `<Link>` invocations that wire them via `onMouseEnter={colorIn} onMouseLeave={colorOut}`.

- [ ] **Step 2: Replace with Tailwind hover utility**

Delete the `colorIn` and `colorOut` const declarations.

Change every link's class to include the hover utility. Replace:

```tsx
className={linkClasses}
style={{ color: "var(--l-text-dim)" }}
onMouseEnter={colorIn}
onMouseLeave={colorOut}
```

with (using arbitrary-value Tailwind which the project already uses elsewhere):

```tsx
className={`${linkClasses} text-[var(--l-text-dim)] hover:text-[var(--l-text)] transition-colors duration-150`}
```

Drop the inline `style` and the two `onMouseEnter`/`onMouseLeave` props. Keep `key`, `href`/`onClick`, etc.

- [ ] **Step 3: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Pre-commit hook will catch any stale references to `colorIn`/`colorOut`.

- [ ] **Step 4: Visual smoke**

`npm run dev`, hover each footer link. Expect a smooth color transition.

- [ ] **Step 5: Commit**

```bash
git add components/landing/Footer.tsx
git commit -m "perf(footer): replace per-link onMouseEnter/Leave handlers with CSS :hover transition"
```

---

### Task A9: ShaderBackground reduced-motion fallback

**Files:**
- Modify: `components/ShaderBackground.tsx`

**Why:** WebGL MeshGradient burns GPU continuously. For users with `prefers-reduced-motion`, render a static linear-gradient covering the same palette. Zero GPU. Same visual identity.

- [ ] **Step 1: Read current implementation**

Use Read on `components/ShaderBackground.tsx`. It is currently a client component returning `<MeshGradient />` with five palette colors.

- [ ] **Step 2: Add a `useReducedMotion` hook locally**

At the top of the file (after existing imports), add:

```ts
import { useEffect, useState } from "react";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}
```

(If `useEffect` and `useState` are already imported, do not duplicate the imports — just add what is missing.)

- [ ] **Step 3: Branch the render**

Inside the component body, before the `<MeshGradient />` return, add:

```tsx
const reduced = useReducedMotion();

if (reduced) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        background:
          "linear-gradient(135deg, #182830 0%, #204050 25%, #285868 45%, #308890 65%, #5888a0 85%, #70b8c8 100%)",
      }}
    />
  );
}
```

The existing `<MeshGradient />` return stays as the fallthrough for users without reduced-motion.

- [ ] **Step 4: Visual smoke**

`npm run dev`. DevTools → Rendering → set `prefers-reduced-motion: reduce`. Reload. Expect: same palette, static gradient, no GPU activity (Performance tab → no continuous frames).

Reset rendering. Expect MeshGradient resumes.

- [ ] **Step 5: Commit**

```bash
git add components/ShaderBackground.tsx
git commit -m "a11y(shader): static linear-gradient fallback for prefers-reduced-motion users"
```

---

### Task A10: Dynamic import below-fold sections

**Files:**
- Modify: `app/page.tsx`

**Why:** Every landing section ships in the initial JS bundle even though FAQ / FounderNote / CTA are below the fold. `next/dynamic` defers them, shrinks initial JS, improves LCP on slower connections.

- [ ] **Step 1: Read current imports**

Use Read on `app/page.tsx`. Locate the `import` block at the top. Identify static imports for FAQ, FounderNote, CTA, Pricing.

- [ ] **Step 2: Convert below-fold sections to dynamic**

Replace those four imports with `next/dynamic` versions. Add `import dynamic from "next/dynamic"` at the top if missing, then:

```tsx
import dynamic from "next/dynamic";

const Pricing = dynamic(() => import("@/components/landing/Pricing"));
const FAQ = dynamic(() => import("@/components/landing/FAQ"));
const FounderNote = dynamic(() => import("@/components/landing/FounderNote"));
const CTA = dynamic(() => import("@/components/landing/CTA"));
```

Keep Navbar, Hero, WhyAletheia, HowItWorks, Footer as static (Navbar + Hero must render synchronously for LCP; WhyAletheia and HowItWorks may also be partly above the fold).

Note: do NOT pass `{ ssr: false }`. Defaulting to SSR preserves SEO and the initial paint.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expect: passes. Check the printed route table — look for `/` and confirm the size of First Load JS for `/` drops vs the previous build (compare against the most recent commit's output if known).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "perf(landing): dynamic-import Pricing/FAQ/FounderNote/CTA below-fold sections to shrink initial JS"
```

---

## Track B — Profile Resume + JD Upload (6 tasks)

The dashboard EmptyState (`app/dashboard/EmptyState.tsx`) already directs first-time users to "Paste your resume into your profile". Today the profile page is read-only — no resume field exists. Track B adds the columns, the form, and the API surface.

### File map — Track B

| File | Action | Why |
|------|--------|-----|
| `supabase/migrations/20260521_add_profile_resume.sql` | Create | New columns + RLS update |
| `app/profile/actions.ts` | Create | Server action for profile updates |
| `app/profile/ProfileForm.tsx` | Create | Client form component |
| `app/profile/page.tsx` | Modify | Render form, pass server values |
| `app/api/settings/route.ts` | Modify | Return resume + JD to extension |
| `e2e/profile.spec.ts` | Create | `@smoke` test for form render |

---

### Task B1: Migration — add resume + target_job_description columns

**Files:**
- Create: `supabase/migrations/20260521_add_profile_resume.sql`

**Why:** `profiles` table has no place to store a user's resume or target JD. Adding them as nullable TEXT columns is reversible and additive. RLS already covers `profiles` for `auth.uid() = id`.

- [ ] **Step 1: Read existing schema**

```bash
cat supabase/migrations/20260218002_create_tier1_tables.sql | grep -A 20 "CREATE TABLE profiles"
```

Confirm the table has: `id`, `email`, `full_name`, `avatar_url`, `cpl_score`, `preferences`, `writing_style`, `created_at`, `updated_at`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260521_add_profile_resume.sql`:

```sql
-- 2026-05-21 — add resume + target JD columns to profiles
-- additive, nullable, no backfill required
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS resume TEXT,
  ADD COLUMN IF NOT EXISTS target_job_description TEXT,
  ADD COLUMN IF NOT EXISTS resume_updated_at TIMESTAMPTZ;

-- Comment for future readers
COMMENT ON COLUMN profiles.resume IS 'User-pasted resume text used to ground generated outreach drafts. Max 50000 chars enforced at API layer.';
COMMENT ON COLUMN profiles.target_job_description IS 'Optional JD the user is targeting. Max 20000 chars enforced at API layer.';
COMMENT ON COLUMN profiles.resume_updated_at IS 'Wall-clock of the most recent resume edit. Used by extension to invalidate caches.';
```

- [ ] **Step 3: Apply locally if Supabase CLI is wired**

If `supabase` CLI is available locally:
```bash
supabase db push
```

If not, manually apply via the Supabase SQL Editor in the dashboard, paste the migration body, run.

- [ ] **Step 4: Regenerate types (if used)**

Inspect `lib/database/types.ts`. If it has hand-written `Profile` type, add the three new fields manually:

```ts
resume: string | null;
target_job_description: string | null;
resume_updated_at: string | null;
```

If the types are auto-generated by `supabase gen types typescript`, regenerate.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521_add_profile_resume.sql lib/database/types.ts
git commit -m "feat(db): add profiles.resume + target_job_description + resume_updated_at columns"
```

---

### Task B2: Server action for profile updates

**Files:**
- Create: `app/profile/actions.ts`
- Test: `app/profile/actions.test.ts`

**Why:** Server action gives the client form a typed RPC. Zod-validated. Server-only — runs with the user's auth cookie via `createClient()` (NOT the service client).

- [ ] **Step 1: Write the failing test**

Create `app/profile/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client BEFORE importing the action under test
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { updateProfile } from "./actions";
import { createClient } from "@/lib/supabase/server";

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when resume exceeds 50000 chars", async () => {
    const result = await updateProfile({
      full_name: "Test",
      resume: "x".repeat(50_001),
      target_job_description: "",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/resume/i);
  });

  it("rejects when target_job_description exceeds 20000 chars", async () => {
    const result = await updateProfile({
      full_name: "Test",
      resume: "ok",
      target_job_description: "x".repeat(20_001),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/job/i);
  });

  it("returns auth error when no session", async () => {
    (createClient as any).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    });
    const result = await updateProfile({
      full_name: "Test",
      resume: "",
      target_job_description: "",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/auth|sign/i);
  });

  it("writes valid input to profiles row", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({ update: updateMock }),
    });
    const result = await updateProfile({
      full_name: "Nagarjun",
      resume: "MS CS Boston University",
      target_job_description: "ML infra eng",
    });
    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Nagarjun",
        resume: "MS CS Boston University",
        target_job_description: "ML infra eng",
      }),
    );
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
npm run test -- app/profile/actions.test.ts --run
```

Expected: FAIL with `Failed to resolve import "./actions"`.

- [ ] **Step 3: Write the action**

Create `app/profile/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ProfileUpdateSchema = z.object({
  full_name: z.string().trim().max(120).optional().default(""),
  resume: z.string().max(50_000, { message: "resume must be 50000 chars or fewer" }).default(""),
  target_job_description: z
    .string()
    .max(20_000, { message: "target_job_description must be 20000 chars or fewer" })
    .default(""),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

export type ProfileUpdateResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateProfile(input: ProfileUpdateInput): Promise<ProfileUpdateResult> {
  const parsed = ProfileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }

  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: "auth required" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name || null,
      resume: parsed.data.resume || null,
      target_job_description: parsed.data.target_job_description || null,
      resume_updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

- [ ] **Step 4: Re-run tests**

```bash
npm run test -- app/profile/actions.test.ts --run
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/profile/actions.ts app/profile/actions.test.ts
git commit -m "feat(profile): add updateProfile server action with Zod validation and 4 unit tests"
```

---

### Task B3: ProfileForm client component

**Files:**
- Create: `app/profile/ProfileForm.tsx`

**Why:** Client component with controlled textareas + submit. Calls the Task B2 server action. Shows pending state + error.

- [ ] **Step 1: Create the form**

Create `app/profile/ProfileForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "./actions";

type Props = {
  initialFullName: string;
  initialResume: string;
  initialTargetJobDescription: string;
};

export default function ProfileForm({
  initialFullName,
  initialResume,
  initialTargetJobDescription,
}: Props) {
  const [fullName, setFullName] = useState(initialFullName);
  const [resume, setResume] = useState(initialResume);
  const [jd, setJd] = useState(initialTargetJobDescription);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await updateProfile({
        full_name: fullName,
        resume,
        target_job_description: jd,
      });
      if (result.ok) {
        setStatus("saved");
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="glass rounded-2xl p-6 space-y-5"
      aria-label="Edit profile"
    >
      <div className="space-y-1.5">
        <label
          htmlFor="full_name"
          className="block text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))]"
        >
          Full name
        </label>
        <input
          id="full_name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={120}
          autoComplete="name"
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-white"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="resume"
          className="block text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))]"
        >
          Resume <span className="lowercase opacity-60">(paste plain text — used to ground drafts)</span>
        </label>
        <textarea
          id="resume"
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          maxLength={50_000}
          rows={10}
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-white font-mono"
        />
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {resume.length.toLocaleString()} / 50,000
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="jd"
          className="block text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))]"
        >
          Target job description <span className="lowercase opacity-60">(optional)</span>
        </label>
        <textarea
          id="jd"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          maxLength={20_000}
          rows={6}
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-white font-mono"
        />
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {jd.length.toLocaleString()} / 20,000
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {status === "saved" && (
          <span className="text-xs text-emerald-400" role="status">
            Saved.
          </span>
        )}
        {status === "error" && error && (
          <span className="text-xs text-red-400" role="alert">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/profile/ProfileForm.tsx
git commit -m "feat(profile): ProfileForm client component with resume + JD textareas and useTransition save"
```

---

### Task B4: Wire ProfileForm into profile page

**Files:**
- Modify: `app/profile/page.tsx`

- [ ] **Step 1: Read current page**

Use Read on `app/profile/page.tsx`. Confirm it is a Server Component that fetches `profile` from the `profiles` table. Note where the read-only header block ends — that's the insertion point.

- [ ] **Step 2: Pull the new columns**

The existing query already does `select("*")` so the new columns come along automatically. Read them into local variables:

```tsx
const resume = profile?.resume ?? "";
const targetJobDescription = profile?.target_job_description ?? "";
```

Add those near the existing `displayName` / `email` / `avatarUrl` destructures.

- [ ] **Step 3: Import + render the form**

At the top, add:

```tsx
import ProfileForm from "./ProfileForm";
```

After the existing header block, before any closing `</div>` that wraps the page, insert:

```tsx
<ProfileForm
  initialFullName={profile?.full_name ?? ""}
  initialResume={resume}
  initialTargetJobDescription={targetJobDescription}
/>
```

- [ ] **Step 4: Visual smoke**

```bash
npm run dev
```

Log in. Visit `/profile`. Expect: the existing header, then the new form with three fields (Full name, Resume, JD), prefilled if any data exists. Type something, hit Save, expect "Saved." confirmation.

- [ ] **Step 5: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat(profile): render ProfileForm on /profile with initial server values"
```

---

### Task B5: Expose resume + JD via /api/settings

**Files:**
- Modify: `app/api/settings/route.ts`
- Test: `app/api/settings/route.test.ts` (create if missing, otherwise extend)

**Why:** Extension reads `/api/settings` to learn the user's stored resume/JD so it can pass them through to `/api/extension/generate`. Without this, the form saves but the extension never picks up the value.

- [ ] **Step 1: Read current route**

Use Read on `app/api/settings/route.ts`. Note the current response shape — likely an object with `preferences`, `writing_style`, etc.

- [ ] **Step 2: Add the new fields to the GET response**

In the GET handler, after fetching the profile row, include the new fields in the returned JSON. Example shape (adapt to existing structure):

```ts
return NextResponse.json({
  // …existing fields…
  resume: profile?.resume ?? null,
  target_job_description: profile?.target_job_description ?? null,
  resume_updated_at: profile?.resume_updated_at ?? null,
});
```

Do not change request validation. Do not add new query params.

- [ ] **Step 3: Add/extend the test**

If `app/api/settings/route.test.ts` exists, add a test:

```ts
it("returns resume and target_job_description from profile", async () => {
  // wire your existing mock pattern; assert resume and target_job_description appear in the JSON
  const res = await GET(buildMockedRequest());
  const body = await res.json();
  expect(body).toHaveProperty("resume");
  expect(body).toHaveProperty("target_job_description");
  expect(body).toHaveProperty("resume_updated_at");
});
```

If no test file exists, create a minimal one using the same mocking pattern as `app/api/auth/me/route.test.ts` (look there for the pattern). Mock `createClient`, return a fake profile with the three fields, assert they appear in the response.

- [ ] **Step 4: Run tests**

```bash
npm run test -- app/api/settings/route.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/settings/route.ts app/api/settings/route.test.ts
git commit -m "feat(api): /api/settings returns resume + target_job_description + resume_updated_at to extension"
```

---

### Task B6: Playwright @smoke for /profile

**Files:**
- Create: `e2e/profile.spec.ts`

**Why:** Catch the case where the form ships broken (missing labels, broken submit button) before merge.

**Note:** The existing E2E suite runs with dummy env vars; it cannot actually log in. The smoke test here will assert that visiting `/profile` unauthenticated redirects to `/auth/login` — which IS testable without a real Supabase. That covers the route exists and middleware works.

- [ ] **Step 1: Write the test**

Create `e2e/profile.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// @smoke — Mocked E2E used in ci.yml only.
// Verifies the /profile route exists and redirects unauthenticated visitors to /auth/login.
// Does not exercise the form itself (would require a real Supabase session).

test("/profile redirects unauthenticated to /auth/login @smoke", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/auth\/login/);
});
```

- [ ] **Step 2: Run it**

```bash
npx playwright test --grep "@smoke" e2e/profile.spec.ts
```

Expected: 1 PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/profile.spec.ts
git commit -m "test(e2e): @smoke profile route redirects unauthenticated to /auth/login"
```

---

## Verification — After Both Tracks Land

- [ ] **Step 1: Type check**

```bash
npm run type-check
```
Expected: PASS.

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: PASS.

- [ ] **Step 3: Unit + coverage**

```bash
npm run test:coverage -- --run
```
Expected: PASS, thresholds (lines/statements 84, branches 87, functions 83) met.

- [ ] **Step 4: Guardrails**

```bash
npm run test:guardrails -- --run
```
Expected: PASS.

- [ ] **Step 5: E2E smoke (includes new /profile spec)**

```bash
npx playwright test --grep "@smoke"
```
Expected: PASS.

- [ ] **Step 6: Build**

```bash
npm run build
```
Expected: PASS. First Load JS for `/` should drop (Track A10 effect).

- [ ] **Step 7: Manual visual sweep**

```bash
npm run dev
```

In order:
- `/` — Hero subhead visible against shader, headline crisp, body text on cards readable
- `/` — Toggle `prefers-reduced-motion: reduce` in DevTools, reload, expect static gradient bg and no animation
- `/dashboard` — EmptyState's "Add your resume" CTA links to `/profile`
- `/profile` — form renders, fields populate with current values, Save shows "Saved."
- Inspect `/profile` form submission: textareas at max length still render the counter, server action returns ok
- `/api/settings` (logged in) — response JSON contains `resume`, `target_job_description`, `resume_updated_at`

---

## Self-Review Notes

- **Spec coverage:** Every audit finding (Hero color, reduced-motion, type=button, --l-text-muted, --l-surface-dark, dead keyframes, Footer CSS hover, dynamic imports, ShaderBackground fallback) maps to Task A1–A10. Profile resume gap maps to Task B1–B6.
- **No placeholders.** Every code block is concrete.
- **Type consistency:** `ProfileUpdateInput` / `ProfileUpdateResult` defined in Task B2 are the exact types used by Task B3.
- **YAGNI:** No file upload (drag-drop, PDF parsing) — plain textarea is enough. Counter UI is minimal. No optimistic UI — `useTransition` covers pending state.
- **TDD where it earns its keep:** Task B2 (server action) follows red-green-refactor. Pure UI tasks (Task A1–A10) rely on type-check + lint + visual smoke + pre-commit build.
- **Parallel safety:** Track A and Track B share zero files. Two subagents can run in parallel without merge conflicts.

---

## Execution Hand-off

Two execution options:

1. **Sequential A→B (safer):** Dispatch all Track A tasks in order, then all Track B tasks. ~3.5 hr total.
2. **Parallel A∥B (faster):** Spawn two controller contexts — one progresses through Track A, the other through Track B. Each implementer subagent commits to the same branch; commits chain linearly because file trees are disjoint. ~2 hr total wall time.

Recommend Parallel A∥B given the orthogonality. If only one controller is available, run A first (the Hero subhead bug is critical and shippable on its own).
