# Landing founder note layout

Date: 2026-09-24. Branch: `fix/landing-founder-note-layout`.

Risk: **Standard**. This is a local public-page layout correction. The founder
copy, links, data handling, and motion behavior do not change. Compact record.

## Contract and design

The current shared section-heading rule overrides the founder heading's inline
size and stretches a narrow, stacked note beyond a desktop viewport. Use an
editorial two-column composition on desktop: statement at left, letter and
signature at right. Stack in reading order on smaller screens. Keep the current
typefaces, evergreen palette, and complete first-person copy.

1. At 1716×1180 CSS pixels, the heading and note are side by side and the
   signature is visible after scrolling the section to its start. A merely
   smaller heading that still leaves the signature below the fold fails.
2. At phone/tablet widths the note remains in natural reading order, with no
   clipped text or horizontal scrolling. Forcing two columns at phone width
   fails.
3. Existing semantic heading and signature content remain accessible; no new
   animation or external request is introduced.

Evaluation: add a regression-first browser test for desktop geometry and
section-height visibility, plus a narrow-viewport overflow/reading-order case.
Inspect representative desktop and mobile screenshots, then run focused
format, lint, type, and browser checks. Rollout is the normal web merge/deploy;
rollback is reverting this layout and redeploying.

## Local evaluation — 2026-09-24

The regression test failed against the deployed pre-fix layout for the intended
reason: the note began in the same column as the heading. At 1716×1180, the
old section measured 1476px tall and the signature ended at 1273px, below the
viewport. The scoped heading rule now overrides the shared `h2` size, and the
new grid keeps the statement and letter side by side from 1024px upward.

The exact updated component was server-rendered into the current landing page
and paired with the updated stylesheet for a browser layout probe. At 1716×1180
the full signature block ended at 772px; at 1440×900, 1279×900, and 1024×800
it ended at 772px, 710px, and 775px respectively. All four widths showed two
columns without horizontal overflow. At 900px and 390px, the content stacked
in reading order without overflow. Desktop and phone screenshots were visually
inspected. This probe does not substitute for the full local app test.

Root lint and type-check passed (one unrelated pre-existing lint warning), as
did 1,094 unit tests and 15 guardrails. The focused E2E test is discoverable
by Playwright and runs in the PR smoke job. A native local Next.js browser run
was not completed in this disk-constrained isolated checkout; the PR browser
job must pass before merge. No authenticated flows, APIs, extension package,
or external services changed.

## Illustrative example refresh — same branch

The user also requested aligning "/demo" with the current landing design before
publication. Keep the fictional scenario, public/no-auth route, review-first
disclosure, and navigation destinations intact. Apply the established Cormorant
display / DM Sans content / Flaviotte brand-only rule and evergreen palette.
At desktop the selected context and review draft appear side by side; at phone
width they stack without horizontal overflow. The displayed character count
must equal the sample draft length. This is Standard risk and compact scope.

The new Playwright style regression failed on the deployed baseline because
the heading resolved to Flaviotte. The stale character count was also found
to be 298 for a 291-character draft; it now derives from the draft string.
The updated page and component were server-rendered into the settled live page
with the updated stylesheet for a browser probe at 1440px, 1024px, and 390px.
Computed typefaces matched the intended roles, the two panels sat side by
side above 768px and stacked at 390px, and none of the widths overflowed.
Desktop and mobile screenshots were visually inspected. A native Next browser
test in this isolated worktree was attempted but blocked by the local proxy's
missing dummy Supabase configuration and webpack/Tailwind module mismatch;
the PR smoke browser job remains required before merge. No API, sample output
text, data collection, or external integration changed. Rollback is a revert
and web redeploy.

Final local checks for this extension (2026-09-24): TypeScript, root ESLint
with one unrelated existing warning, focused E2E lint, Prettier for changed
code and Markdown, diff whitespace, 1,094 unit tests, and 15 guardrails all
passed. The server-rendered browser probe passed typography, panel order,
overflow, exact character count, and disclosure assertions at 1440px, 1024px,
and 390px. The native app E2E suite remains unverified locally and must pass
in PR CI. No new dependency, auth, privacy, or API boundary is involved.

## Native browser follow-up — 2026-09-24

The earlier isolated-checkout limitation has been resolved with a disposable
copy and a Node 24 production build. The founder-note and illustrative-demo
browser checks passed as part of 27/27 affected Chromium tests. The broad
fictional-example locator initially failed because the refreshed page has two
matching disclosures; it now targets the review notice, with the disclosure
itself preserved. See `frontend-audit-hardening.md` for the full latest
configuration, CI coverage, and remaining protected-page limitations.
