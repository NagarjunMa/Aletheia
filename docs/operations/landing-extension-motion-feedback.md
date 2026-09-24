# Landing and extension motion feedback

Date: 2026-09-23. Branch: `feat/landing-extension-motion-feedback`.

## Change contract

Risk: **Significant**. This spans the public landing page and a separately
packaged Chrome extension, but changes no API, permissions, billing, or stored
private data. Use a compact record because each change stays inside an existing
UI boundary.

1. At narrow mobile widths, a closed navigation menu must not enlarge the fixed
   header or cover anchored content. The open menu remains keyboard-accessible.
2. At intermediate widths, navigation labels and CTAs must not overlap or wrap
   into one another. Existing destinations stay unchanged.
3. Landing and extension buttons use a restrained Phthalo-green border-beam
   treatment without replacing text, focus indication, or disabled styling.
   Motion must stop under reduced-motion preference and must not run continuously
   on every resting control.
4. Extension generation replaces the spinner with the Thinking Orbs canvas
   engine. The UI must name only observable phases, show elapsed time, explain
   that timing varies, and clear the timer/orb on success or failure. It must not
   invent percentages or backend stages.
5. Existing extension generation, authentication, and packaged-version behavior
   remain unchanged. No publication or deployment is part of this task.

## Evaluation plan

- Regression-first Playwright checks for closed mobile header height, anchored
  heading visibility, and tablet navigation geometry.
- Pure extension tests for elapsed-time labels, phase selection, and long-wait
  wording; built-popup/browser check for the actual canvas and failure cleanup.
- Inspect CSS for consistent tokens, keyboard focus, disabled state, and
  reduced-motion fallback; run root and extension native checks, extension
  version policy, and inspect packaged output.

Wrong implementations these checks should reject: a clipped but still tall
mobile menu; moving links only by hiding overflow; a fake percentage or
stage-specific server claim; a timer that persists after failure; a package
import omitted from the extension bundle; an always-running beam on every
button.

Rollout: merge the web UI normally; package/publish extension version only in
a separate authorized release. Rollback: revert this UI commit and redeploy;
existing published extension remains compatible because the API contract does
not change.

## Final local audit — 2026-09-23

Final risk tier: **Significant**. The landing page and independently published
extension both change, but neither changes an API, permission, persistence, or
server-side processing contract.

- Regression-first landing tests reproduced the mobile fixed-header overlay and
  the 900px navigation/hero squeeze before repair. Three landing Playwright
  tests now pass, including keyboard-focus beam and reduced-motion checks.
- The extension source-popup browser suite passes (5/5): the vendored Thinking
  Orbs renderer paints during a held generation request, elapsed time advances,
  and success/failure clear the progress UI. Reduced motion keeps the orb still
  and stops the border animation. Extension unit tests pass (21 files, 214
  tests); the full web suite passes (91 files, 1,094 tests); guardrails pass
  (2 files, 15 tests).
- Root and extension type checks, lint, production Next.js build, extension
  build, both dependency audits, extension version policy, changed-file
  Prettier, and `git diff --check` pass. Root lint retains one unrelated
  pre-existing warning in `lib/auth/refund-admin.ts`. The original settings
  HTML formatting is preserved, so repository-wide Prettier still has its
  existing baseline; all other changed files pass scoped Prettier.
- The Chrome Web Store ZIP build succeeds at version 1.0.17 and includes the
  browser-resolvable renderer and its MIT license. The package contract test
  verifies both. The current artifact is marked `-dirty` because this work is
  uncommitted; do not upload it. Rebuild from a clean commit before release.
- The first independent review found a missing extension build prerequisite in
  browser tests and an unresolved bare-module import in the source ZIP. Both
  were corrected by vendoring only the renderer as relative browser ESM,
  including its license, and testing the ZIP source layout. The independent
  return review reported no remaining material findings.

Correctness/architecture: existing generation payloads, response handling,
authentication, and output controls are unchanged. The two displayed phases
are locally observable, while the time is elapsed and the two-minute wording
is explicitly variable—not a percent-complete or guaranteed deadline.
Security/privacy: no context or secrets are sent to the orb; no new permissions
or external runtime fetches are introduced. Reliability/memory: the timer and
animation listeners are cleared on success and failure; the orb pauses when
hidden or reduced motion is preferred, and text remains usable if canvas fails.
Performance/cost: the renderer is a small local asset, canvas device-pixel
ratio is capped at 2, and no additional backend request occurs. Compatibility:
the code is targeted to the extension's Chrome 120+ floor; responsive landing
layout was checked at 375px, 900px, and desktop widths.

Not run: an authenticated live generation request and Chrome Web Store review.
Those require deployment/release authority and real account context, and do
not block local implementation validation. Rollout remains a normal web merge
followed by a separate clean extension package/release. Rollback is reverting
the UI change and redeploying web; the previously published extension remains
untouched until an authorized release.

## 2026-09-23 — Intermediate-width hero follow-up

Risk: **Significant** for final review because the fix also adds the focused
landing browser check to the shared PR smoke job; the CSS correction itself is
Standard. No extension, API, authentication, or data behavior changes. The
approved editorial evergreen design, headline, copy, and navigation
destinations remain intact.

Contract:

1. Around a 1257 CSS-pixel viewport, the hero copy and context ledger appear
   side by side, without horizontal overflow, clipping, or overlap with the
   fixed navigation. The compact navigation may remain until its links fit.
2. Narrow tablet/mobile widths retain a readable stacked hero; full desktop
   widths retain the existing two-column arrangement.
3. Existing keyboard navigation and reduced-motion behavior remain unchanged.

Evaluation: add a regression-first Playwright check for the reported width and
both sides of the responsive transition, asserting visible geometry and no
horizontal overflow. A simple breakpoint reduction without scaling the type
and spacing could still squeeze the columns; include that case in the check.
Inspect representative screenshots and run the relevant web checks. Rollout is
the normal web merge/deploy; rollback is a revert and redeploy. No Store package
change is required.

### Local result — 2026-09-24

The new Playwright geometry assertion failed against the deployed pre-fix CSS
at 1257px, confirming the reported stacked hero. The candidate CSS moves the
stacked layout to 1023px and below, with narrower typography and spacing for
the 1024–1279px two-column range. Injecting the exact candidate stylesheet into
the live page passed browser geometry assertions at 390, 900, 1023, 1024,
1120, 1257, 1279, 1280, and 1440px: expected stack/columns, no horizontal
overflow, clipped card, or header/heading overlap. Representative 1024,
1120, and 1257px screenshots were inspected. The compact menu remains visible
at 1257px.

Root lint, type-check, 1,094 unit tests (91 files), 15 guardrail tests, scoped
ESLint/Prettier, and `git diff --check` passed on the final source. Lint retains
one unrelated existing warning in `lib/auth/refund-admin.ts`. The CI YAML
parses and Playwright discovers all four landing checks. The PR smoke job now
installs Chromium and runs that suite against its built local server. The
repository-native local Playwright run did not complete: this disk-constrained
isolated checkout could not install its own dependencies; the symlink fallback
conflicted with the default Next dev bundler, while the alternate bundler
lacked this checkout's Supabase environment configuration and could not serve
`/`. Browser stylesheet injection verifies layout but is not a substitute for
the CI end-to-end run.

No security/privacy/data behavior or dependencies changed. The CI addition
increases PR execution time but uses existing Playwright dependencies and no
new secrets. Merge only after the new landing browser check passes in PR CI.
Rollout: merge and deploy web; rollback: revert this CSS/test/CI change and
redeploy. No extension release needed.

Fresh-context review found one CI setup defect: the new server-side browser
check inherited none of the build-only Supabase placeholders, so the health
route could pass while `/` failed. Moving those placeholders to smoke-job scope
resolved the mismatch for both build and server. The reviewer found no further
material source issue on the corrected diff. The CI browser result remains
pending until a pull request runs; the review is not a substitute for it.
