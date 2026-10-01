# ALE-57 — LinkedIn shared output budget

## Execution context and problem

Source: [ALE-57](https://linear.app/aletheia-connection-builder/issue/ALE-57/fix-recurring-linkedin-connection-502s-with-shared-output-budgets-and), read 2026-10-01.
Base: remote `main`, `38089c3db3fc18dd3fc11739ed5b473ddf3f0d30`.
Branch: `fix/ale-57-linkedin-shared-output-budget`, isolated worktree.
Unrelated main-workspace and ALE-56 changes are excluded and preserved.

The current 96/112/72 section maxima reject otherwise valid notes. Production
diagnostics identify `too_big`, but cannot identify the exact nested field.
The previous model-declared character-count repair remains in place.

## Change contract

- Initial risk: **Significant**, server-owned model-output contract and shared logging.
- Documentation mode: Full; this record supplements the repository guide.
- Bound each raw text section by the canonical 300-character constant; enforce
  the final sanitized, whitespace-normalized body at 300 UTF-16 code units.
- Keep strict structure, exactly one bounded source ID, source validation,
  nonempty observation/CTA, explicit null relevance, existing compensation,
  legacy count tolerance, public response and extension compatibility.
- Emit bounded, fixed-path diagnostics with codes and numeric counts only.
- No SDK upgrade, migration, extra model call, extension/retry change,
  grounding redesign, admission-policy change, or production deployment.
  The later authorized exception is a development-only brace-expansion lockfile
  patch to unblock CI, documented in the publication handoff below.

## Code map and design

| Path                                                            | Role                                               |
| --------------------------------------------------------------- | -------------------------------------------------- |
| `modules/outreach/domain/outreach-draft.types.ts`               | Strict bounded composition                         |
| `modules/outreach/infrastructure/anthropic.repository.ts`       | Tool schema/parser                                 |
| `modules/outreach/application/render-linkedin-connection.ts`    | Final budget authority                             |
| `modules/outreach/application/extension-generate.service.ts`    | Sanitation/refunds/diagnostics                     |
| `lib/ai/prompts/linkedin-connection.ts`                         | Model instructions/version                         |
| `lib/logging-core.ts`                                           | Existing privacy boundary, retain safe diagnostics |
| Co-located tests and `app/api/extension/generate/route.test.ts` | Contract and integration regressions               |

Read root instructions and guide first, then this record, composition, tool,
renderer, service, prompt and logging callers/tests. Follow existing pure helper
and Zod patterns. The renderer remains the sole final-length authority; no
truncation or silent relevance downgrade. Cold-email/InMail/YC contracts remain
unchanged. Authentication, quota and billing state remain owned by the service.
No new retained personal data or remote telemetry. Raw model input, text, source
IDs and arbitrary keys must never enter diagnostics.

## Acceptance criteria and verification plan

- [ ] AC-1: 119-character note with observation 97, relevance >112 and CTA >72 accepted when final body fits.
- [ ] AC-2: Final 299/300 accepted, 301 rejected including normalization and Unicode; no clipping.
- [ ] AC-3: Missing/blank/nonstring/unknown fields and raw sections >300 fail.
- [ ] AC-4: One selected bounded source required; zero/multiple/unknown/overlength/unsupported references fail; null accepted.
- [ ] AC-5: Missing/wrong/legacy model counts ignored; server count/API unchanged.
- [ ] AC-6: Prompt/tool/domain consistent; version bumped; executable prompt-example tests.
- [ ] AC-7: Exact bounded nested diagnostics survive logger; privacy canaries absent.
- [ ] AC-8: Billing enabled/disabled success and failure preserve once-only compensation and one model call.
- [ ] AC-9: Mocked route pipeline and other channels/auth regressions pass.
- [ ] AC-10: Native checks and fresh-context independent review recorded with no unresolved material findings.
- [ ] AC-11: Authorized isolated-preview real-model evaluation: 24 synthetic calls, four intents × three grounding contexts × two repetitions, including long names/Unicode and held-out examples; human grounding/CTA review, zero format/length errors in sample, first-attempt latency/token/refund evidence and extension display.

Behavioral TDD: first assert formerly rejected valid inputs, safe diagnostics and
prompt examples fail for the intended reasons; then implement and rerun. Negative
tests must catch removing strictness, provenance, final limits or compensation.
No TDD exception. Unit/smoke tests mock all I/O.

Native commands under Node 24.x: focused `vitest run` for route, renderer, tool,
prompt, diagnostics and logging; `npm run test:coverage -- --run`,
`npm run test:guardrails -- --run`, `npm run test:resume-security`, lint,
type-check, changed-file Prettier, security audit, placeholder-environment build,
landing/health Playwright smoke and `make extension-ci`. Hosted PR CI remains a
separate required check, not implied by local results.

## Rollout, compatibility and rollback

Backend only; no extension release or migration. After checks and authorized
preview evaluation, deploy and monitor first-attempt validation codes, 502 rate,
prompt version, latency, tokens and refunds separately from client retries.
Rollback: revert backend commit and redeploy matching prompt/schema.
Remaining risks: heuristic grounding does not prove semantic entailment; existing
extension retries amplify failed calls; no empirical guarantee of model output.

## Implementation progress and evidence

2026-10-01: implemented locally with red-first regressions. Prompt is 3.3.0.
Raw section bounds replace fixed allocations; the renderer and compensation
logic remain unchanged. A pure domain helper and repository adapter supply safe
diagnostics; the existing logger retains them without weakening redaction.
ALE-57 is In Progress. No commit, push, deployment or live-model calls.

## Final local audit — 2026-10-01

Final risk: **Significant**. Complete diff/untracked files reviewed against the
verified merge base above. Reviewed correctness, architecture, security/privacy,
reliability, bounded memory/log output, unchanged call cost, performance,
compatibility and regressions. No dependencies, migrations, model configuration,
extension source, auth or admission policy changed.

All checks used Node 24.16.0 in this isolated worktree. Unit tests mock I/O;
build/smoke use CI placeholder variables, not production credentials.

| Native check                                                  | Result and scratch evidence                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Focused Vitest: outreach, generate, connection prompt, logger | 307 tests / 13 files passed; `/tmp/ale57-focused-final.log`                                                                     |
| `npm run test:coverage -- --run` after correction             | 1,129 tests / 92 files passed; statements 88.86%, branches 82.02%, functions 89.05%, lines 90.22%; `/tmp/ale57-coverage-r1.log` |
| `npm run test:guardrails -- --run`                            | 15 passed; `/tmp/ale57-guardrails.log`                                                                                          |
| `npm run test:resume-security`                                | 145 passed; `/tmp/ale57-resume.log`                                                                                             |
| `npm run type-check` after correction                         | Passed including native type generation; `/tmp/ale57-types-r1.log`                                                              |
| `npm run lint` after correction                               | Passed with inherited refund-admin warning; `/tmp/ale57-lint-r1.log`                                                            |
| `npm run security:audit`                                      | Passed, zero web advisories                                                                                                     |
| Placeholder-environment `npm run build` after correction      | Passed; `/tmp/ale57-build-r1.log`                                                                                               |
| Chromium landing-navigation and health smoke                  | 5 passed; `/tmp/ale57-smoke-r1.log`                                                                                             |
| Changed-file Prettier / `git diff --check`                    | Passed; final docs checked separately                                                                                           |
| `node scripts/check-extension-version.mjs origin/main`        | Passed, no packaged changes                                                                                                     |
| Separate extension tests/type-check/lint/build                | Passed, 230 tests / 23 files; `/tmp/ale57-extension-tests.log`                                                                  |
| `make extension-ci`                                           | **Failed** at audit on inherited high brace-expansion advisory; unchanged base lockfile; `/tmp/ale57-extension.log`             |
| Hosted PR CI                                                  | **Not run**, no PR/push requested                                                                                               |
| Authorized 24-call isolated-preview model evaluation          | **Not run**, no live-call/deployment authorization                                                                              |

AC-1–9 are verified locally by parser/schema, renderer, prompt, diagnostic/logger
and actual mocked route/credit tests. Tests cover old-budget valid notes, final
299/300/301 Unicode/normalization boundaries, sanitation expansion, raw bounds,
strict fields/source cardinality/provenance, legacy counts, literal prompt CTA
examples, exact safe diagnostics, and once-only success/failure compensation.
AC-10 remains blocked by extension audit and hosted CI. AC-11 remains open.
The checklist above intentionally remains unchecked as the original full gate;
this mapping distinguishes local code evidence from issue completion.

### TDD and independent review

Initial red checks: seven schema/renderer failures reproduced old allocations;
two route failures reproduced a valid 119-character note returning 502 and absent
nested diagnostics. All now pass. Three whitespace-diagnostic regression tests
failed before correcting the review finding (`/tmp/ale57-r1-red.log`).

Fresh-context read-only reviewer `/root/ale57_independent_review`, inherited model
with exact identity unknown; no cross-model claim. Two rounds of a three-round
budget. Round-one source snapshot:
`e43e5f5407394fa588c703917942fd7a4d18d81712f30bb4b69f72ce10a5aef9`.
Corrected reviewed snapshot:
`0dc8cf8fde2cff9d3c183703239ce9c00f4f6a6d88abbafa8805368d0d6da5a7`.
Freshness passed before/after both reviews; source writers paused. Later changes
only add this documentation/progress evidence and are structurally self-reviewed.

ALE57-R1: confirmed, introduced, low/nonmaterial diagnostic accuracy issue.
Whitespace-only sections reported raw rather than checked trimmed length.
Resolved on corrected snapshot with red-first observation/CTA/relevance tests.
Return reviewer independently passed 226 focused tests, TypeScript, changed-file
ESLint/Prettier, diff check and whitespace/padded-overlength reproductions through
logger sanitization. No unresolved material implementation findings. Overall
completion verdict remains **blocked**, not a release-readiness claim.

### Decisions, remaining risks and handoff

No scope deviation. Safe metadata emits at most eight fixed-path details and
numeric counts/bounds, never model wording, arbitrary keys or source IDs. Counts
match validation: raw oversized sections, trimmed empty sections/source IDs.

Extension dependency remediation is outside this backend-only fix. The advisory
is verified in the unchanged base lockfile and remains a required CI failure.
Owner: Unassigned. Next action: separately authorize remediation and rerun
extension CI, then hosted PR CI. Do not deploy until these checks and the approved
preview evaluation/human grounding review pass. Existing retries and lexical
grounding remain documented limitations; no model-conformance guarantee.

Lesson: enforce the final channel budget, not editorial allocations; diagnostics
must measure what the validator actually checked. Regression detection lives in
shared-budget, Unicode/normalization and privacy-safe diagnostic tests.
Status: **Implemented locally**; ALE-57 remains open.

## Requested pre-merge verification refresh — 2026-10-01

Re-read the complete live Linear issue and AC-1–11, refreshed `origin/main`, and
inspected all staged, unstaged and untracked changes. Remote main and the merge
base remain `38089c3db3fc18dd3fc11739ed5b473ddf3f0d30`; there are no staged changes.
Final risk remains **Significant**. No new material implementation finding or
source-code correction was required. The implementation is not a guarantee of
zero future model-format failures.

Fresh coordinator checks, Node 24.16.0, on reviewed snapshot
`6e4d14bd609ebf4137c831c30f97b8fc24beb60de95bdf9fe6d95f5c21c60a1b`:

| Check                                                       | Fresh result / evidence                                                                                                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused tests                                               | 307 / 13 files; `/tmp/ale57-premerge-focused.log`                                                                                                                                                                  |
| Coverage suite                                              | 1,129 / 92 files; unchanged 88.86/82.02/89.05/90.22% statements/branches/functions/lines; `/tmp/ale57-premerge-coverage.log`                                                                                       |
| Guardrails / resume-security                                | 15 / 145 passed; `/tmp/ale57-premerge-guardrails.log`, `/tmp/ale57-premerge-resume.log`                                                                                                                            |
| Native types / lint                                         | Passed, one inherited refund-admin unused-argument warning; `/tmp/ale57-premerge-types.log`, `/tmp/ale57-premerge-lint.log`                                                                                        |
| Web dependency audit                                        | Zero vulnerabilities; `/tmp/ale57-premerge-web-audit.log`                                                                                                                                                          |
| CI-placeholder production build                             | Passed; `/tmp/ale57-premerge-build.log`                                                                                                                                                                            |
| Chromium landing/health smoke                               | 5 passed on isolated port 3017; server stopped afterward; `/tmp/ale57-premerge-smoke.log`                                                                                                                          |
| Formatting / diff / extension version                       | Passed; `/tmp/ale57-premerge-format.log`, `/tmp/ale57-premerge-version.log`                                                                                                                                        |
| Separate extension types, lint, tests and CI esbuild bundle | Passed, 230 tests / 23 files; `/tmp/ale57-premerge-extension-types.log`, `/tmp/ale57-premerge-extension-lint.log`, `/tmp/ale57-premerge-extension-tests-corrected.log`, `/tmp/ale57-premerge-extension-bundle.log` |
| `make extension-ci`                                         | **Failed**, inherited high brace-expansion advisory; unchanged extension lockfile; `/tmp/ale57-premerge-extension-ci.log`                                                                                          |
| Hosted PR CI / authorized preview evaluation                | **Not run**; no PR/deployment/live-call authorization in this audit                                                                                                                                                |

An initial extension `test:run` invocation failed because that script does not
exist. It was corrected to the native `npm --prefix ascendia-extension test`,
which passed. This command-selection failure is not a product failure. The
repository coverage configuration includes `lib` and API files, not module
coverage metrics; focused/full tests do execute the changed outreach modules.

Third and final fresh-context review round: `/root/ale57_premerge_audit`, exact
model identity unknown, no cross-model claim. All changed source and consumers
reviewed read-only with writers paused; freshness passed before and after on the
snapshot above. Independently passed 307 focused tests, 1,129 coverage tests,
15 guardrails, 145 resume-security tests, native types/lint and formatting/diff
checks. Scratch evidence: `/tmp/ale57-r3-coverage.log`,
`/tmp/ale57-r3-guardrails.log`, `/tmp/ale57-r3-resume-security.log`.
ALE57-R1 remains resolved; no new material findings. Later changes only record
this audit and progress evidence and are structurally self-reviewed.

AC-1–9 pass locally; AC-10 is still blocked by the extension audit and outstanding
hosted CI. AC-11 still requires separately authorized isolated-preview calls,
verified SHA/configuration, human grounding/CTA review and real extension display.
Review reconfirmed unchanged authentication, persistence, cost-incurring call
settings, refunds, public API and extension package. Security/privacy, reliability,
bounded diagnostics, performance/memory/cost, compatibility and rollback are
covered above. Existing lexical-grounding and retry limitations remain.

Overall verdict: **not ready for completion or deployment** under the current
issue contract. Keep ALE-57 **In Progress**. Resolve the inherited dependency
gate separately, run hosted PR CI, and obtain the approved preview evidence.
Rollout/rollback remain unchanged; preserve the matching prompt/schema on revert.
No commit, push, PR, deployment, live model calls or unrelated edits in this audit.

## Publication handoff and dependency-gate resolution — 2026-10-01

The user applied the targeted patch in this ALE-57 worktree under Node 24.16.0:
`brace-expansion` 5.0.9 → 5.0.12. The extension lockfile diff changes only that
package's version, registry URL and integrity. Direct dependencies, extension
version/source, model SDK/settings, and backend implementation are unchanged.
This narrowly scoped development-tooling update is now included in the authorized
commit/push request; the original dependency failure above remains historical.

The user's Node 24 `make extension-ci` passed: zero audit vulnerabilities, types,
lint, 230 tests in 23 files and the esbuild bundle. A coordinator rerun before
commit also passed; evidence: `/tmp/ale57-publish-extension-ci.log`.
The Vite configuration-loader warning was non-blocking. Extension version policy
still reports no packaged changes; no Chrome Web Store release is required for
this lockfile patch.

The backend source is unchanged since the three-round independent review.
That review predates the dependency patch: do not describe its whole-repository
snapshot as current. The patch was inspected locally and its affected native
checks rerun; the three-round reviewer budget is exhausted, so no fourth review
is claimed. Historical backend checks remain applicable to unchanged backend
code, and hosted PR CI must evaluate the committed combined change.

Current handoff: implementation prepared for the user-authorized remote branch
push and manually created PR. The inherited dependency blocker is resolved
locally. Hosted PR CI and AC-11's separately authorized 24-generation preview,
human review and real-extension evidence remain pending. Keep ALE-57 In Progress;
publishing a branch is not completion, merge permission or production readiness.
Rollout and rollback remain as documented above. No live calls or production
deployment were performed as part of this handoff.
