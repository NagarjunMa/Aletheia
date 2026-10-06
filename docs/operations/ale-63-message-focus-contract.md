# ALE-63 — Message focus API foundation

## 1. Issue summary

[ALE-63](https://linear.app/aletheia-connection-builder/issue/ALE-63) is Stage 1
of [ALE-58](https://linear.app/aletheia-connection-builder/issue/ALE-58).
The current parser drops a focus preference and can generate/charge without
honoring it. Establish a bounded additive contract, not enabled generation.

## 2. Scope

Initial risk: **Significant** (public API/independently deployed consumers).
Full documentation mode: this execution record supplements the complete
15-section Linear contract. User authorized implementation 2026-10-04.

In scope: canonical normalization, active and compatibility request schemas,
always-false capability, early safe 409, existing 400 field errors, and tests.
Out of scope: ranking, prompts/model limits, extension UI/version, migrations,
auth/billing/admission policy, paid calls, deployment and issue completion.

## 3. Existing system context

Current base/main/origin main: `24ea99b98fb79f0e1f8ec5e403ed55c9c213bee5`.
Original implementation/audit base: `a9dffaffb889a521944cb29ab2bfa7cef4e4f81a`.
Branch: `feat/ale-63-message-focus-contract`, dedicated managed worktree.
The dirty primary checkout and uncommitted ALE-46 work are excluded/preserved.

The generate route re-exports the outreach service. It authenticates, dispatches
strict YC requests, then parses outreach before private context, quota and
credits. Config already exposes additive API/extension metadata. Existing
request timing and failure-capture boundaries accept no raw input.

## 4. Relevant files / execution context

Verified production locations:

- `modules/outreach/domain/message-focus.ts`: new pure bounded Zod policy and
  hard-disabled capability, shared by active API/config consumers.
- `app/api/extension/generate/schema.ts`: canonical outreach fields shared by
  active parser and compatibility contract; strict YC unchanged.
- `modules/outreach/application/extension-generate.service.ts`: deny populated
  focus after authentication/parsing but before all costly/private work.
- `modules/outreach/api/extension-generate.mapper.ts` and
  `modules/outreach/domain/extension-generate.types.ts`: fixed typed 409 response.
- `app/api/extension/config/route.ts`: additive `capabilities.messageFocus=false`.
- `lib/generation-timing.ts`: allowlisted unavailable code, no private metrics.
- `lib/sentry-scrubbers.ts` and its test: redact the new private field from
  object-shaped event/context/breadcrumb data using the existing shared policy.

Tests: domain `message-focus.test.ts`; generate
`message-focus-contract.test.ts`, `route.test.ts`, `route.credits.test.ts`,
`yc-application-contract.test.ts`; config `route.test.ts`.
No extension, provider, database or dependency files need changes.

## 5. Dependencies and constraints

Node 24 and locked Zod/Vitest; use existing route/cors/error/timing patterns.
ALE-46/54 are later selection prerequisites, not blockers for this disabled
contract. ALE-60 must implement generation before support may become true.
No source/character/token budget change, model call, or extra database query.

## 6. Security and privacy contract

- Optional string only; null, arrays, objects, booleans and numbers fail 400.
- At most 500 UTF-16 units both **before** and after NFKC, CRLF/CR-to-LF and trim.
- Empty/whitespace-only normalizes to absent; old requests retain behavior.
- Populated valid focus returns 409 `MESSAGE_FOCUS_UNAVAILABLE`; no context
  read, quota mutation, credit debit/refund, model call or persistence.
- Auth/version checks remain first; YC rejects any supplied focus field.
- Static error text and safe timing code only; never raw notes in logs/errors.
- `MESSAGE_FOCUS_ENABLED=true` cannot enable this unfinished stage.
- No new strictness for unrelated legacy outreach fields; client weights never
  become policy. No pretend focus success/selection metadata.

## 7. Implementation / TDD plan

Baseline native route/config/YC/credit suite: **176 tests passed** before edits.
Added behavioral tests against existing parsers and routes (no missing-import
red scaffold). Red: **44 failed, 127 passed** across four files; missing focus
normalization/validation, no capability and model-reaching ignored-focus paths.
Evidence: `/tmp/ale63-red.log`. Implementation follows these expected outcomes.

## 8. Implementation order

Read complete issue/parent/guides → clean main/branch → baseline → red boundary
tests → pure schema + HTTP mapping/gate → green/full checks → independent review
→ updated evidence. No later stage or release is authorized by this task.

## 9. Acceptance and evaluation mapping

| Criterion                                   | Test / plausible mistake caught                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| AC1: omit/blank retains old behavior        | Serialized baseline equality and successful route; catches accidental blocking                                 |
| AC2: raw and normalized 500/501             | Both actual/compatibility parsers, surrogate pairs, expanding ligatures, whitespace; catches trim-first bypass |
| AC3: populated focus never silently ignored | All three outreach routes return 409 with no context/RPC/provider calls; catches updating only unused schema   |
| AC4: cannot enable prematurely              | Config/route with env true; catches flag-only activation                                                       |
| AC5: auth, API/CORS, YC unchanged           | Auth-first, legacy fields, YC single/1–5 batch fixtures and existing regressions                               |
| AC6: no cost/private leak                   | Billing-on deny/invalid tests, fixed errors and log canary assertions                                          |
| AC7: checks/review recorded                 | Native checks, fresh review, remaining gaps below; not a release approval                                      |

## 10. Implementation progress

2026-10-04 America/New_York (2026-10-05 UTC): Stage 1 implemented locally.
Focused 236 contract tests and final 1,191-test coverage suite pass. Independent
review found no material issues; the inherited dependency-audit gate fails.
2026-10-05: requested final pre-merge audit executed against the complete
merge-base diff, including all untracked files. No introduced material source
finding. All behavioral/build checks pass; root dependency audit still fails.
No commit/push/deployment; issue remains In Progress.

## 11. Session handoff

### Resumption — 2026-10-06

User authorized resuming ALE-63 after the dependency PR merged. Re-read the
complete current Linear stage and parent; Stage 1 contract is unchanged and
Significant risk. Local main and the existing issue branch fast-forwarded to
verified origin/main 24ea99b. Existing work was preserved in a scoped recovery
stash `9ccecb31381c29dc0b47a6b6e98ed493d3372a14`, restored without conflicts;
15 source/test/evidence files verified byte-identical to that stash. The progress
record auto-merged both histories. Other dirty worktrees were not changed.

No fresh feature code is necessary: the bounded disabled contract is already
implemented with prior red/green evidence. Reuse the existing policy, mapper,
service and privacy tests; do not redo them or start downstream focus behavior.
Clean dependency installs and fresh checks on the new baseline are complete;
the inherited audit blocker is resolved locally. The requested final audit below
is complete. Next: separately authorized publication and hosted CI.
Prior reviews/checks below remain
dated history, not fresh passes for the changed tooling. Keep ALE-63 In Progress;
no commit, push, PR, deployment or Done action is authorized by this resumption.

Historical handoff (superseded by the resumption above):

Next: resolve the inherited dependency-audit gate in dependency-maintenance
scope, rerun affected checks and update this gate disposition. The requested
pre-merge source audit is executed; no repeat audit of unchanged code is needed.
Commit/push/PR/rollout are separate next steps.
Read this record and current Linear issue before changing the contract. Do not
redo ALE-46 or depend on its uncommitted code. Preserve unrelated worktrees.
Known baseline gate: seven high dependency entries from the `braces` advisory
chain (GHSA-vfj7-8cjw-p6xm); manifests/lockfiles unchanged. Baseline evidence:
`/tmp/ale63-baseline-audit.json`; failing gate: `/tmp/ale63-audit.log`.
Do not apply breaking audit auto-fixes as an incidental feature change.

### Dependency remediation investigation — 2026-10-05

User authorized fixing the audit blocker. Contract: remove the vulnerable
dependency without suppressing audit findings, preserve existing UI and lint
coverage, and keep ALE-63 behavior unchanged. A same-major dependency-only fix
would be Standard risk; a framework/toolchain migration is Significant and
requires a separate bounded contract and browser-regression evidence.

Fresh registry and advisory checks show `braces` latest 3.0.3 has no patched
release ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)).
Tailwind 3.4.19 still uses chokidar 3/micromatch 4/fast-glob 3; Next ESLint
16.3.8 still uses fast-glob 3. Same-major `npm audit fix --dry-run
--ignore-scripts` still reports seven high entries. No manifest or lockfile
was changed. Logs: `/tmp/ale63-dependency-before.json` and
`/tmp/ale63-dependency-dry-run.log`.

The automated suggestion crosses to Tailwind 4 and suggests downgrading Next
ESLint to 14.2.35; neither was applied. Tailwind 4 changes PostCSS/configuration,
utility defaults and browser requirements; upgrading it alone does not remove
the separate Next ESLint chain. A safe full remediation needs an explicitly
scoped styling migration plus a compatible lint-chain solution, not removal of
lint rules or arbitrary cross-major overrides. Implementation is paused at that
scope decision. Audit remains failed; no completion or readiness claim.

## 12. Decisions / deviations

- A hard-disabled constant is more truthful than wiring an enable flag before
  generation exists. Future Stage 3 must replace the capability and integration
  together; an environment change alone is insufficient.
- Zod infers normalized request types at the existing service boundary; a
  redundant hand-maintained request DTO is unnecessary. Fixed failure response
  type lives beside current generate types and HTTP mapping beside other errors.
- No extension changes: missing/false capability handling in the **future** UI
  is ALE-62's responsibility, not claimed implemented here.
- Review observation `ALE63-R1-O1` prompted narrow privacy defense-in-depth:
  recognize `messageFocus` in the existing Sentry sensitive-field set. Two new
  canary tests failed before the correction and passed afterward; no reachable
  leak in the normal 400/409 paths was established. Lesson: map a new private
  request field through existing scrubbers as well as application logs.

## 13. Validation results

### Final publication audit — 2026-10-06

Re-read current Linear acceptance criteria; inspect the complete tracked and
untracked change against merge base 24ea99b98fb79f0e1f8ec5e403ed55c9c213bee5.
Final risk **Significant**: additive public contract, independently deployed
clients; no changed authentication, billing, persistence or migration policy.
Reviewed correctness, canonical schema/mapper/service ownership, security and
privacy, error/compensation reliability, bounded normalization memory/work,
cost, compatibility and regression. No material introduced findings or required
runtime corrections. No performance improvement or enabled-focus claim.

Fresh `make ci` passes root audit (zero), lint/types/build, 1,202 tests/95 files
and 15 guardrails. `npm run test:coverage -- --run` passes unchanged thresholds:
89% statements, 82.14% branches, 89.29% functions, 90.36% lines.
`npm run test:resume-security` passes 145 tests. `make extension-ci` passes audit
(zero), types/lint/build and 230 tests/23 files; version policy against main
reports no packaged change. Production-build Chromium theme/navigation/health
passes 29 tests, with synthetic runtime capability false/API v1/auth-first 401
and no-error-echo probes passing. Changed-file formatting/diff whitespace pass.

`npm run format:check` fails for 19 unrelated files, all individually verified
byte-identical to merge base. No ALE-63 file fails; no formatter or gate was
weakened. Hosted CI, live auth/model/storage, production logs, authenticated
browser journeys and Safari/Firefox are not run. Later focus UI, selection and
generation/latency evaluations remain out of Stage 1 scope. Inherited unused
status and Vite-config warnings remain nonblocking.

User explicitly authorized one additional review beyond the original three
rounds. Fresh-context reviewer `/root/ale63_publication_review` independently
passed 330 tests/14 files, actual legacy config consumer compatibility, whitespace
and before/after provenance; no material findings. Model identity unknown,
no cross-model or host-enforced sandbox claim. Reviewed snapshot
`89edce306ffad900dcbaa1b050fb8ce1993521a61a2953ae68215393721751ce`;
source remained frozen during review. Report `/tmp/ale63-publication-review.md`,
packet `/tmp/ale63-publication-review-before-20261006.json`; checks logged in
`/tmp/ale63-publication-audit-*.log`. Final changes only update evidence/progress.
The previous audit finding `ALE63-FPR-G1` is resolved by merged dependency
remediation plus the current clean audits. All local Stage 1 acceptance checks
pass; new-client UI enforcement remains ALE-62, not claimed delivered here.

Ready for authorized commit/push of Stage 1, not automatic merge or enabled
rollout. Hosted PR CI must pass before merge. ALE-63 remains In Progress per
the implementation/handoff instruction; parent ALE-58 stays open. Backend-only
rollout retains capability false; rollback reverts this additive contract before
client release, or retains explicit unavailable handling after focus-aware
clients exist. No migration, release, commit, push or live call in this audit.

### Resumed integration checks — 2026-10-06

Node 24.16.0; branch HEAD/integration base 24ea99b plus the preserved ALE-63
dirty/untracked implementation. No new runtime/test correction was required.

| Fresh check                                                                    | Result                                                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Root/extension `npm ci` and audits                                             | Passed; zero vulnerabilities in both trees                                                   |
| `make ci`                                                                      | Passed: lint/types, 1,202 tests/95 files, 15 guardrails, production build                    |
| Coverage                                                                       | Passed unchanged thresholds: 89% statements, 82.14% branches, 89.29% functions, 90.36% lines |
| Resume security                                                                | Passed 145 tests/12 files                                                                    |
| `make extension-ci` / version policy against main                              | Passed: audit/types/lint/build, 230 tests/23 files; no packaged change                       |
| New-build Chromium theme/navigation/health                                     | Passed 29 tests                                                                              |
| Local synthetic runtime probes                                                 | Passed config capability false/200 and auth-first focus 401                                  |
| Changed-file Prettier and diff whitespace                                      | Passed                                                                                       |
| Hosted CI, live auth/model/storage, Safari/Firefox, full-repository formatting | Not run; earlier full-format baseline failure remains historical                             |

Only inherited unused-status lint and Vite config-loader warnings remain;
no check was bypassed. Logs `/tmp/ale63-resume-*.log`. Local API probes and
browser checks use placeholder services, not private inputs or paid calls.
Prior fresh-context reviews remain historical source reviews; no new independent
review was dispatched on this resumption. The three-round original review budget
has already been used; any newly required reviewer round needs an explicit budget
extension. Preserved runtime/test source was verified byte-identical before
checking the new toolchain. This is integration revalidation, not a new final
pre-merge audit or release authorization. `ALE63-FPR-G1` (inherited audit failure)
is resolved locally; hosted PR checks still require publication. Risk remains
Significant for the additive disabled contract; ALE-63/ALE-58 remain open.

Historical evidence before the dependency merge follows:

Node 24.16.0; local evidence dated 2026-10-04 America/New_York.

| Check                                           | Result                                                                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline / red / focused green                  | Passed baseline 176; expected red 44 failed/127 passed; green 236/6 files                                                                                                                         |
| Privacy correction TDD                          | Expected red 2 failed/13 passed; then 30 scrubber/logger/client-instrumentation tests passed                                                                                                      |
| `npm run test:coverage -- --run`                | Passed after correction: 1,191 tests/94 files; 88.95% statements, 82.14% branches, 89.05% functions, 90.31% lines                                                                                 |
| `npm run test:guardrails -- --run`              | Passed 15; unchanged AI paths after privacy-only correction                                                                                                                                       |
| `npm run test:resume-security`                  | Passed 145; unchanged resume paths                                                                                                                                                                |
| `npm run lint`, `npm run type-check`            | Passed after correction; one inherited unused `status` lint warning in `lib/auth/refund-admin.ts`                                                                                                 |
| `npm run build`                                 | Passed after correction with CI placeholder Supabase variables, `NEXT_PUBLIC_APP_ENV=dev`                                                                                                         |
| Chromium landing/health                         | Passed after correction: 5 tests on owned production server, `PLAYWRIGHT_BASE_URL=http://localhost:3163 npx playwright test e2e/landing-navigation.spec.ts e2e/health.spec.ts --project=chromium` |
| Production-server API probes                    | Passed after correction: config false/200, unauthenticated focus request 401; no live auth/provider                                                                                               |
| `make extension-ci`                             | Passed: audit zero, types/lint, 230 tests/23 files, build                                                                                                                                         |
| `node scripts/check-extension-version.mjs main` | Passed: no packaged changes                                                                                                                                                                       |
| Changed-file Prettier / `git diff --check`      | Passed; final documentation-only edits rechecked at handoff                                                                                                                                       |
| `npm run security:audit`                        | **Failed**: inherited seven high entries from braces advisory chain; no dependency edits or bypass                                                                                                |
| Hosted PR CI                                    | **Not run**: no push/PR authorized; audit would currently block its first job                                                                                                                     |
| Live model/Supabase/production telemetry        | **Not run**: no live call or deployment authorized; disabled contract does not require paid generation                                                                                            |
| Future focus UI / selection / latency           | **Deferred** to later stages, not Stage 1 implementation evidence                                                                                                                                 |

Logs: `/tmp/ale63-final-{coverage,lint,types,build,smoke}.log`,
`/tmp/ale63-{guardrails,resume,extension-ci,audit,privacy-red}.log`.
All routine tests mock I/O; synthetic browser checks use placeholder settings.
Only this task's temporary server was stopped after verification.

Fresh independent review: `/root/ale63_independent_review`, fresh context,
model identity not exposed (no cross-model claim). Round 1 inspected the full
diff/consumers and ran 266 tests; round 2 inspected the privacy correction and
ran 30 tests plus independent mixed-case canary probes. No material findings;
`ALE63-R1-O1` resolved. Reports: `/tmp/ale63-review-r1.md` and
`/tmp/ale63-review-r2.md`. Final reviewed source snapshot:
`81d1b2f7f028db9544a598be17b158943bddd48a9397d78e02af9d017d4ca33a`;
base `a9dffaffb889a521944cb29ab2bfa7cef4e4f81a`. Before/after provenance checks
passed; no host-enforced read-only sandbox, source manifest verified instead.
Subsequent edits are only this evidence document and `docs/progress.txt`;
the implementation/tests/dependencies remain the reviewed snapshot.

### Final pre-merge audit — 2026-10-05

Re-read the complete current ALE-63 issue and acceptance criteria through the
`linear_aletheia` connection; scoped audit to Stage 1. Inspected the full tracked
diff and all four nonignored untracked files against merge base
`a9dffaffb889a521944cb29ab2bfa7cef4e4f81a`, including real schema/service,
config/auth/error consumers, timing/projection/failure capture and Sentry
registrations. Source snapshot before audit:
`bbc1c8ce063d10e83f1295c7abcd79ac2740434675104fadf3fd2ff99f751263`.
No source/test/dependency correction was necessary or made during this audit.

| Check executed on 2026-10-05                                                | Result                                                                                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:coverage -- --run`                                            | Passed 1,191 tests / 94 files; 88.95% statements, 82.14% branches, 89.05% functions, 90.31% lines                                  |
| `npm run test:guardrails -- --run`                                          | Passed 15 tests                                                                                                                    |
| `npm run test:resume-security`                                              | Passed 145 tests                                                                                                                   |
| `npm run lint` / `npm run type-check`                                       | Passed; one unchanged unused `status` lint warning                                                                                 |
| CI-placeholder `npm run build`                                              | Passed                                                                                                                             |
| Chromium landing/health command above                                       | Passed 5 tests on this task's production server                                                                                    |
| Local production-server API probe                                           | Passed config false/API version `"1"`, auth-first 401, configured synthetic-extension CORS and default production localhost denial |
| `make extension-ci` / version check against main                            | Passed: zero audit findings, 230 tests / 23 files, lint/types/build; no packaged changes                                           |
| Changed-file Prettier / `git diff --check`                                  | Passed; documentation-only final edits checked again                                                                               |
| `npm run security:audit`                                                    | **Failed**: same seven inherited high entries from the braces advisory chain                                                       |
| `npm run format:check`                                                      | **Failed**: 21 files; every reported file is byte-identical to main, no ALE-63 file fails                                          |
| Hosted PR CI                                                                | **Not run**; no PR exists for uncommitted changes; root audit blocks its first job                                                 |
| Live provider/auth/database, production telemetry, enabled focus UI/latency | **Not run / outside Stage 1**; no deployment or enabled pipeline                                                                   |

Logs: `/tmp/ale63-premerge-{coverage,guardrails,resume,lint,types,build,smoke,extension-ci,extension-version,audit,format-all,format-changed}.log`
and `/tmp/ale63-premerge-runtime-final.log`. Two preliminary manual probes had
incorrect harness assumptions (API version is a string; production localhost
CORS is denied by default). Corrected the probe against the existing contracts;
the final probe passes, with no application changes. Only owned test servers
were stopped.

Fresh final reviewer: `/root/ale63_final_premerge_review`, new context, model
identity unknown; no cross-model claim. Independently passed **299 tests across
15 files**, inspected the complete change/consumers and verified provenance
before/after. Report: `/tmp/ale63-premerge-review.md`. Source verdict: no material
introduced findings. Overall readiness: blocked by `ALE63-FPR-G1`, the inherited
required dependency-audit failure; optional prior scrubber observation remains
resolved. The reviewer did not access live services or edit source. No
host-enforced read-only sandbox; instruction plus whole-source hashes verified
immutability. Final evidence-document/progress updates follow this review;
implementation, tests and dependencies remain unchanged.

Behavioral acceptance is verified: omitted/blank compatibility, both length
bounds, safe 400/409, auth/API/CORS, all outreach categories, strict YC exclusion,
no cost/private-context work and safe diagnostics. Existing extensions read
known config keys and ignore additive metadata; new focus-client UI enforcement
is explicitly owned by ALE-62. The overall native-check acceptance criterion
does **not** pass while the required root audit fails. Formatting debt is
recorded separately and is not an added CI bypass or runtime defect.

## 14. Completion, rollout and rollback

Current handoff, 2026-10-06: final publication audit and explicitly authorized
additional independent review pass on synchronized main. Stage 1 is ready for
authorized commit/push, remains disabled, and needs hosted CI before merge.
No new feature code was required. Keep In Progress as requested; no automatic
completion/publication or deployment. Parent ALE-58 is not complete.
The older audit failure/readiness statements below describe the historical
2026-10-05 snapshot, not the newly synchronized branch.

Local Stage 1 implementation and independent source review complete; overall
issue remains **In Progress**, not released or merge-ready while audit fails.
Final implementation-review risk: **Significant**. Public API/independent-client
compatibility is affected; auth, billing, migrations and persistence are not.
Final pre-merge risk remains **Significant** after the 2026-10-05 audit and fresh
independent review. The tier is based on changed behavior, not missing hosted
evidence. Root audit failure still blocks completion independently of the tier.
Correctness/boundaries, architecture, privacy/security, reliability,
memory/performance/cost, compatibility and regressions were reviewed. Work is
bounded by raw length before normalization, adds no query/model call, and
retains existing shared schema/mapper/service ownership. No measured latency
improvement or live telemetry privacy guarantee is claimed.
New files/changes are mapped above. The final audit is executed, with the
required gate failed; ALE-63 and parent ALE-58 remain open. No commit, push,
merge or release was requested or performed during verification.
Backend-only rollout keeps capability false. Rollback: revert this additive
backend contract before UI release; after new clients exist retain explicit
unavailable handling, never silently discard populated focus. No data migration.

## 15. Continuation instructions

Follow AGENTS.md and production-engineering-loop. Verify current branch/diff,
all mapped consumers, and evidence freshness; run affected checks after changes.
Final audit re-reads Linear, inspects full merge-base diff, records risk,
correctness/design/security/privacy/reliability/performance/memory/cost/
compatibility/regression review, fixes material findings, and records dated
failed/blocked/not-run checks plus rollout/rollback. Keep ALE-63/ALE-58 open.

## Engineering Loop Completion Gate

- [x] $engineering-loop final audit executed
- [x] Acceptance criteria verified
- [x] Final risk tier recorded
- [x] Relevant checks passed
- [x] Failed, blocked, and not-run checks recorded
- [x] Security/privacy/data review completed
- [x] Compatibility and rollback reviewed
- [x] Remaining risks documented
- [x] Completion evidence dated

Gate records local Stage 1 verification on 2026-10-06, not deployment approval.
The inherited audit failure is resolved; all required local checks pass. The
full-repository format failure is unchanged baseline debt, recorded above.
Hosted PR CI remains required before merge; later-stage feature behavior and
UI are not part of this contract-only completion evidence.
