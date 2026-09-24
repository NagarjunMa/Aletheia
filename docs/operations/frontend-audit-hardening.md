# Unassigned — frontend audit hardening

Date: 2026-09-24. Branch: `fix/landing-founder-note-layout`. This follow-up
comes from the requested visual audit of the landing, public, auth, and extension
surfaces; it is not a new Linear issue. The adjacent founder-note and demo work
is recorded in `landing-founder-note-layout.md`.

## Execution context and contract

Risk: **Significant**. Shared public navigation changes across routes, and
extension typography changes packaged Chrome UI. Full record; no auth logic,
permissions, API behavior, or user data changes.

The next step is full affected-subsystem validation and a fresh review of the
complete dirty worktree. The affected entry points are `Navbar` and `Footer`,
`/status`, `app/auth/layout.tsx`, extension popup/settings styles, and their
browser/unit checks. `app/demo` and the founder note are already being changed
on this branch; preserve their behavior and resolve the demo test regression.

Acceptance criteria:

1. From `/install`, `/privacy`, and `/terms`, desktop/mobile header and footer
   section links reach the corresponding section on `/`; landing-page anchors
   still work. A hash change on the secondary route without navigation fails.
2. `/demo` still identifies the scenario as fictional, and its smoke test
   resolves one meaningful disclosure element.
3. `/status` uses the shared landing navigation/background and Cormorant display
   type without hiding version or error content.
4. Each public auth form has exactly one main landmark without changing login,
   registration, or recovery behavior.
5. Extension consent and settings UI text uses bundled DM Sans; Flaviotte
   remains reserved for the Aletheia wordmark. The font loads offline. Both
   extension versions rise together for changed packaged files.
6. Affected browser, extension, static, and version-policy checks pass; no
   unresolved material review finding remains.

## Design and boundaries

Keep section IDs and `Navbar`'s observer ownership unchanged. Resolve shared
section links as root-relative fragments so the same link works from the
landing route and other public routes. Keep route links in `Footer` as routes.
Use the established `ShaderBackground`, `Navbar`, and `Footer` components for
status. Change only the auth form-panel element to `main`; the children own form
logic. Bundle the same DM Sans Latin variable font used by the web build under
the extension's local assets with its SIL OFL notice; no remote font requests.
Maintain existing color tokens and reduced-motion behavior.

Security/privacy: no new network request, permission, secret, logging, or data
flow. The `@font-face` URL is a packaged relative asset. Compatibility: older
published extensions are unchanged; `1.0.19` is a new upload candidate only.
Rollout requires ordinary web merge/deploy and a separately authorized Chrome
Web Store upload. Rollback is revert/redeploy for web and withholding the new
extension version; no migration or data recovery is needed.

## TDD and verification mapping

| Criterion | Wrong implementation rejected                  | Check                                                                                |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1         | `/install#product` without a target            | `e2e/landing-navigation.spec.ts`, secondary-page navigation                          |
| 2         | Duplicate broad text locator fails strict mode | `e2e/demo.spec.ts`, fictional disclosure                                             |
| 3         | Status retains old font or lacks shared chrome | `e2e/ui-smoke.spec.ts`, status editorial surface                                     |
| 4         | Form panel remains a `div`                     | `e2e/ui-smoke.spec.ts`, auth main landmark                                           |
| 5         | Flaviotte remains the UI variable              | `ascendia-extension/test/design-typography.test.ts` plus unpacked-browser font check |
| 6         | Version drift or packaged edit without bump    | `scripts/check-extension-version.mjs` and affected native checks                     |

The new browser cases failed on the pre-fix isolated copy for the expected
route, landmark, and status presentation failures. The extension typography
test failed on both original CSS variables. The demo failure was observed in
the preceding audit. After the first footer correction, the browser test
exposed that the patch had changed route links rather than scroll links; the
branch source was corrected before final validation. These are historical red
results, not final verification.

## Progress and final gate

Implemented locally: root-relative section links, status shared presentation,
auth main landmark, bundled extension UI font, version `1.0.19`, and focused
regressions. Existing founder-note/demo edits remain intact. No commit, push,
deployment, Store upload, or Linear mutation occurred during this local audit.

## Local verification — 2026-09-24

The source is the dirty worktree on this branch, including its pre-existing
founder-note/demo edits. An isolated copy with the same affected sources and
symlinked installed dependencies was used for commands that generate `.next`,
coverage, or extension `dist`. Its scratch ZIP was labelled `untracked` because
the copy has no Git metadata; it is **not** a release artifact.

Passed:

- Root lint (one unrelated existing `refund-admin.ts` warning), type-check,
  production webpack build, 91 files/1,094 unit tests, 2 files/15 guardrails,
  12 files/145 resume security tests, and the coverage thresholds. Root audit
  at high severity reported zero vulnerabilities.
- 27/27 affected Chromium tests against the isolated production build with
  canonical production origin configuration. A prior dev-server run failed one
  crawler assertion only because the scratch server used a localhost canonical
  origin; the same assertion passed with production configuration. An earlier
  auth-landmark run timed out while navigating four pages under a shared
  30-second limit; waiting for DOM readiness and allowing 60 seconds for that
  four-route test resolved the harness timing without dropping any route.
- Extension type-check, lint, 22 files/217 tests, build, and moderate-level
  dependency audit (zero vulnerabilities). The version policy passes from
  `main` (1.0.17) to candidate 1.0.19. The scratch ZIP includes the DM Sans
  WOFF2 and its OFL notice. An unpacked Chromium extension loaded the font
  locally in popup and settings, with no page errors or horizontal overflow;
  settled desktop screenshots were inspected.
- Changed-file Prettier and `git diff --check` pass. The status page was
  inspected at 1440px and 390px, with Cormorant heading, shared navigation,
  and no overflow.

Fresh independent reviewer round 1 found one material gate gap (FAH-R1): PR
CI selected only `landing-navigation.spec.ts`, leaving new demo/status/auth
browser cases unprotected. The existing smoke job now selects the four affected
spec files. The 2026-09-24 return review confirmed FAH-R1 resolved with no new
material finding; local Playwright discovery listed all 27 selected cases.
Hosted PR CI remains pending.

Not run: authenticated dashboard/profile/settings visual flows and admin
surfaces (no safe test account in this isolated review); hosted PR CI; Chrome
Web Store publication. These are not implied passes. The static source diff
does not change those protected screens or their data paths. No migration or
production mutation is required. Status: **implemented and verified locally**,
pending hosted CI and merge/deployment decisions.

## Final pre-merge local audit — 2026-09-24

Audited the complete branch diff against local `main` (merge base
`1d6e41fc`), including committed hero/logo changes and all staged, unstaged,
and untracked work. Final tier remains **Significant**. A fresh-context,
read-only reviewer inspected the full diff and affected consumers at source
snapshot `9648f2181a1c44ada26a48c989c6b98e57b953197c1ce3c10775f71c93dc2214`;
the reviewer found no material issue. The evidence helper confirmed that
snapshot remained current after local checks. The reviewer could not run
Playwright in the dependency-free worktree; the coordinator ran the browser
checks from the source-matched disposable copy. This is independent source
review plus local execution, not hosted CI approval.

Passed again from that source-matched copy: web lint (one pre-existing
`refund-admin.ts` warning), type-check, production webpack build, 91 files /
1,094 coverage-gated unit tests, 15 guardrails, 145 resume security tests,
high-severity dependency audit, and 27/27 Chromium tests from the four public
UI spec files. Extension audit at moderate severity, type-check, lint, 22
files / 217 tests, build, and source ZIP packaging passed. The ZIP includes the
DM Sans font and OFL notice but is marked `untracked` in the disposable copy;
it is not a release artifact. Version policy passed from `main` 1.0.17 to
candidate 1.0.19. Changed-file Prettier and diff whitespace checks passed.

Security/privacy/data review: no new user-data flow, permission, credential,
or remote font request. Reliability and compatibility review: public section
links now resolve from secondary routes; demo disclosure and count remain
stable; prior extension clients are unchanged. The UI changes add no
performance-sensitive work, persistent state, or new paid service. Rollout is
web merge/deploy followed by a separately authorized extension release;
rollback is web revert/redeploy and withholding the new ZIP. Hosted PR CI,
authenticated dashboard/profile/settings and admin visual flows, and Chrome
Web Store publication remain **not run**. The Next build emitted an existing
Sentry `onRequestError` configuration warning; it did not fail the build and
is outside this frontend change. No Linear issue is assigned to this audit.
