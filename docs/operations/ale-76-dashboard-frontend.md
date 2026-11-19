# ALE-76 dashboard frontend

## Change contract

Risk: Significant — authenticated dashboard data, profile readiness, charts and
motion cross the ALE-75 contract. This branch starts at ALE-75 `580575b`, which
includes main `5a10d2c`. Keep the backend and frontend PRs separate and merge
ALE-75 first. Preserve ALE-28 and all unrelated worktrees.

Replace the oversized summary with the user's identity and an actual staged
completion beam. Then show compact credits, four-category generation activity
and review health; résumé information immediately follows. Keep candidate editing
and place recent messages last. Remove archive/reviewed-count summary tiles.
Retain the existing black, Phthalo green, mint and white palette and typography.

Use ALE-75's authenticated server loader and `DashboardMetrics` type. Do not
calculate activity from feedback, billing or saved drafts. Display requests and
outputs separately, label the UTC period and historical coverage, and show no-data
for null rates. Failed sections stay visibly unavailable. Credits use the existing
API with abortable account-keyed state; never turn a failure into zero balance.
Candidate editing and résumé permissions remain unchanged. No source text or IDs
belong in chart data, tooltips, logs or animation attributes.

Use existing components and dependencies. Glass is limited to the overview's
panels, with fixed modest blur, illuminated edges and solid-surface fallbacks.
Only the decorative beam sweep loops. It can be paused, respects reduced motion,
pauses in hidden tabs and cleans up on unmount. Chart labels and numbers remain
readable without animation, color or graphical bars.

## Acceptance and evaluation

- Pure boundary tests reject malformed credit responses and preserve zero balance.
- Server-loader tests distinguish empty data from failures and enforce caller scope.
- Browser checks exercise the real components/styles with synthetic fixtures only
  in the test harness: populated/new/unavailable data, metered/unlimited/failed
  credits, both account keys, refreshed readiness and résumé removal, chart counts,
  latest messages last, keyboard navigation, motion pause/reduction/visibility,
  reduced transparency and responsive sizes. The 720px viewport checks the layout
  equivalent of 200% zoom on 1440px; actual browser zoom remains a manual check.
- Inspect desktop/mobile/rest/focus/paused screenshots and contrast over the lightest
  background. Synthetic fixtures are never installed as a production route.
- Run focused tests, native coverage/guardrails, lint/types/policy/build and browser
  smoke. Obtain a fresh-context read-only independent review of the final snapshot.

## Execution context

Implemented: `load-dashboard.ts` composes owner-scoped independent server reads;
`DashboardView.tsx` renders the layout; `ProfileBeam.tsx` owns only its decorative
motion and refresh; `CreditsPanel.tsx` validates and projects the existing billing
response. Presentation enums/schema and scoped glass CSS stay in the dashboard.
The existing editor and its permissions remain intact. No new dependency or
production fixture route was added. `test:dashboard:ui` runs in the existing
Chromium CI job after the build and browser installation.

Next step: independent return review of the corrected snapshot. Packets and
review receipts stay outside source in `/tmp/ale76-review-*.json` and reports.
Existing editor actions revalidate `/dashboard`; keep account-keyed editor state.
Actual hosted two-account and assistive-technology checks remain separate from
synthetic browser tests. No live key/model call or production mutation is needed.

## Local verification — 2026-11-18

Passed: the original credits card failed the browser regression for a 503 balance
response before implementation. New credit/loader tests were red before their
modules existed; all 11 focused boundary tests now pass.

Passed: 3,309 tests with coverage (91.02% statements, 85.62% branches), 15
guardrails, policy, lint and TypeScript. Lint retains the existing refund-admin
unused-variable warning. Production build passed on the unchanged confirmation
run after Next.js's existing security-advisory notice stopped the first compiled
build. The high-severity audit passes with 12 existing moderate advisories; no
dependency versions changed.

Passed: 19 browser component scenarios with real CSS/components and synthetic
owners. They cover late credit-response isolation, zero/unlimited/outage/401
balances, readiness after removing the sole background résumé, refreshed/no-data
and unavailable metrics, chart counts/labels, document order, keyboard controls,
hidden-tab pause, reduced motion/transparency and 375/720/900/1440px layouts.
Existing fact-review editor browser checks pass at 375/900/1440px.

Review finding ALE76-R1-001 (P2) was confirmed with the real page/editor: a failed
résumé read became false for `hasPrimaryResume`, incorrectly producing missing
background/Not ready. This inherited behavior violates the unavailable contract.
The page now mounts the editor only when both application and résumé context are
known. An unavailable résumé is not treated as absent; a known empty résumé list
still allows the normal optional-résumé path. New real-page browser regressions
failed before this correction and now pass for outage and role-only cases.
The existing editor/actions and canonical readiness rules were not changed.

Passed: 69 existing Chromium smoke tests, plus the new built-app signed-out
dashboard guard. Its first assertion incorrectly disallowed the existing
`redirectTo` query; the corrected check confirms the login path, no private
dashboard and no credit request. No application authentication code changed.

Desktop/mobile/paused/solid/unavailable renders were inspected at
`/tmp/ale76-screenshots`. The defined text palette has contrast of at least 5.21:1
against the brightest panel color; this is a color calculation, not an exhaustive
accessibility certification. A test harness font read raced a concurrent build;
the sequential build-then-browser run passed. Do not run those two checks together.

Passed: the corrected-source production build and focused lint checks. The
confirmation build exited zero after the same existing security advisory notice.
Pending: independent return review.
Not run: real hosted two-account integration, VoiceOver, actual browser 200%
zoom, Safari and measured low-end animation performance. ALE-75's migration/type
and hosted gates remain open. Local fixtures are not hosted-auth evidence.

## Delivery

Apply ALE-75's migration and backend before this frontend. If metrics are not yet
available, show the explicit unavailable state while preserving profile actions.
Rollback restores the previous dashboard code; do not remove recorded activity.
Keep ALE-76 In Progress until backend integration and applicable acceptance pass.
