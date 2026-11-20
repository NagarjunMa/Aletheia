# ALE-30 — Grounding-aware feedback and reporting

## 1. Execution context

[Issue](https://linear.app/aletheia-connection-builder/issue/ALE-30/42-add-grounding-aware-rejection-taxonomy-and-telemetry), 2026-11-19.
Branch `feat/ale-30-grounding-feedback`, isolated worktree from synchronized main
`bbd6578`. User requires preserving the generation fixes already delivered.
Full record because this crosses API/extension serialization and private reports.
Next: complete latest-main verification and return review for ALE30-R1.
Keep ALE-30 In Progress; publication and hosted acceptance are separate.

## 2. Problem and existing coverage

ALE-30's August plan is stale. ALE-51 already supplies seven quality reasons,
strict summary feedback, caller-owned idempotent receipts, safe quality metadata,
three-approval style readiness, retention and consent-gated reporting. ALE-27
already projects final-used-source grounding classes/counts and its cohort option.
Do not reimplement these or alter their generation/auth/learning behavior.

Remaining gaps: no distinct weak-evidence reason; the feedback projector drops
already-supported emailMode; the report lacks mode/rejection/claim-kind breakdowns.
Outreach unsupported reports already use unsupported_feeling. Keep that wire code
and clarify its user-facing label rather than adding an equivalent taxonomy.

## 3. Goal

Users distinguish wrong evidence from wrong target relevance and unsupported
claims. Operators compare existing safe metadata by channel, email mode, prompt,
grounding/fallback and coarse source/claim kind, with rejection counts. Reports
remain user reports, never an attestation that generation happened or a basis for
an automatic rollout.

## 4. Scope and non-goals

One additive reason, existing feedback boundary/projector, one fixed extension
button, existing canonical SQL report, tests and operating notes. No new schema,
store, API route, provider/model call, migration, dependency or automatic learning.
No generation prompt/selector/finalizer/limits/refund/admission/auth changes.
No production flags, dashboard redesign or raw-source collection. Project-story
kinds are not captured by current final metadata; do not fabricate them from
atomic claim kinds. Name existing coarse fields accurately.

## 5. Locations and callers

| Verified path                                                  | Responsibility                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `lib/ai/generation-quality.ts`                                 | Canonical fixed reason list; its generation metadata builder remains unchanged                               |
| `app/api/extension/feedback/schema.ts`                         | New reason via shared enum; retain legacy valid payloads and strict summary consistency                      |
| `lib/ai/feedback-quality.ts`                                   | Existing allowlist projector; keep emailMode only when in existing EMAIL_MODES                               |
| `app/api/extension/feedback/route.ts`, `persist-feedback.ts`   | Reuse ownership, PK deduplication, style processing, safe persistence; inspect only unless tests prove a gap |
| `ascendia-extension/popup/popup.html`, `popup.js`              | Fixed choices and existing account-safe feedback transport                                                   |
| `docs/evals/quality-feedback-cohorts.sql`                      | Single existing validity/consent/cap policy; optional new report breakdown                                   |
| `scripts/test-quality-feedback-db.mjs`                         | Existing socket-only PostgreSQL integration and report/privacy assertions                                    |
| `e2e/extension-evidence-picker.spec.ts`                        | Packaged popup keyboard/payload checks with intercepted I/O                                                  |
| `modules/dashboard/domain/dashboard-metrics.ts`, dashboard SQL | Inspect compatibility: unknown new reason uses existing Other aggregation; no product change                 |

Read ALE-51's operational record and engineering guide first; expand inspection
on failed checks. Existing generations (including ALE-77), source IDs, feedback
cleanup, RLS and style readiness are protected regression surfaces.

## 6. Invariants and compatibility

Retain every existing reason/code, payload format and approved-message flow.
Legacy approvals with an optional reason remain accepted as before; the strict
quality summary continues rejecting them. SQL reason counters include rejected
receipts only, so a legacy approval cannot become a rejection count.
Unknown/free-form metadata and reasons fail at the boundary or are dropped by the
canonical projector. Feedback authentication, owner lookup, duplicate/conflict
semantics and counters remain unchanged. No private source or generated text in
new metadata, logs or SQL output. Existing legacy outreach message remains transient
input to private style processing, not telemetry storage.
SQL keeps the existing first eleven aggregate columns/meaning; new optional
columns are additive. Off/default preserves the existing cohorts/counts.
Older missing mode/reason values are unreported, never guessed as initial outreach.
The dashboard keeps its existing Other bucket for a new unrecognized reason.

## 7. Risk

Risk: Critical — private feedback data and cross-account aggregate reporting.
No authorization/RLS changes; enforce current consent, retention, ten-outcome
user contribution cap, quality validation and 200-outcome/30-user/14-day floor.
Fresh independent review plus real disposable PostgreSQL evidence are required.
No new public reporting endpoint or broader cohort access is introduced.

## 8. Design decisions

Reuse QUALITY_REASONS, EMAIL_MODES, projectFeedbackMetadata, persistFeedback and
the canonical quality cohort query. Keep existing unsupported_feeling code and
add only weak_evidence. New fixed UI labels are user allegations, not verified
security/grounding failures. Extend the canonical SQL with an optional feedback
breakdown: mode and normalized claim kinds identify cohorts; fixed allowlisted
rejection counters share the same denominator as approvals. Unknown text becomes
an unreported counter, not a grouping label. Keep row_number partition unchanged
so added dimensions cannot multiply a user's allowed contribution.
No new helper/interface/store is justified. Backend accepts the new code before
publishing extension 1.0.35, which follows merged ALE-78 1.0.34 without changing
its logging fix.

## 9. Acceptance and evaluations

| ID  | Criterion / plausible wrong implementation                                                                                 | Detecting check                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 | Distinct weak-evidence report, existing unsupported code retained / duplicate or rename legacy codes                       | Schema reason matrix and packaged button/payload                                                                                     |
| AC2 | Modes survive only from allowlist / store private or missing mode as guessed initial                                       | Projector and HTTP insertion/negative tests                                                                                          |
| AC3 | Strict summary approval/rejection with legacy valid support / reject accepted old clients or count approvals as rejections | Schema/route tests across old/new formats, unknown enums/private extras                                                              |
| AC4 | Existing owner/PK/style behavior retained / duplicate feedback increments or changes success                               | Existing receipt/auth/style tests; no runtime generation/auth diff                                                                   |
| AC5 | Safe mode/claim-kind/reason report under original validity/consent/cap/floor / clone query policy or expose comments/IDs   | Execute modified canonical query in disposable PostgreSQL with canaries, withdrawals, malformed records and unchanged default counts |
| AC6 | Grounding/candidate-source truth and channel policies unchanged / change generation to satisfy feedback                    | Full route/renderer/selection/refund/guardrail suites; inspected diff protects paths                                                 |
| AC7 | Accessible fixed choice travels over real package boundary / static-only label never submitted                             | Keyboard Playwright against built ZIP with all external requests intercepted                                                         |
| AC8 | Native gates and independent review pass; no release claims                                                                | Exact source receipts, named pending hosted/Store checks                                                                             |

Behavioral validation: observe intended failures before implementation. SQL output
append-only assertions may change for new null columns, retaining old columns and
all original count/consent/ownership assertions. No valid control/test is removed.

## 10. Implementation plan

1. Read issue/dependencies/current implementation and preserve unrelated work.
2. Run existing focused baseline; add schema/projector/report/UI red cases.
3. Add missing reason/mode and consistent validation; preserve current handlers.
4. Extend the existing query, test actual SQL with synthetic rows, update docs.
5. Package extension, verify popup transport/keyboard, run repository gates.
6. Freeze source and obtain independent review; resolve material findings only.
7. Update evidence/Linear and keep In Progress until applicable hosted checks pass.

## 11. Security and privacy

No keys, sessions, profile, resume, drafts, evidence IDs/excerpts or comments in
new output. Reports project fixed enums/counts only; current Share Analytics opt-in
is mandatory and withdrawal removes old records. Missing/null consent stays out.
Raw client metrics remain client_reported_unverified. Schema and owner-RLS are
reused. SQL is an operator-only read-only query, not a new view/function/grant.

Official Supabase [changelog](https://supabase.com/changelog.md) and
[RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
checked 2026-11-19; no relevant SDK/RLS change needed for this additive local work.
No CLI upgrade, live project connection or production mutation is necessary.

## 12. Checks and limits

Node 24.16.0; focused API/projection and extension suites, PostgreSQL 17 socket-only
`QUALITY_TEST_PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:quality-feedback:db`.
Root coverage/guardrails/types/lint/policy/build, extension audit/types/lint/tests,
version policy and ZIP packaging. Packaged browser assertions mock external I/O.
Existing generation and receipt/style tests establish regression boundaries.
No paid/provider, production, hosted JWT, human VoiceOver or Store test is claimed.
No performance/cost improvement claimed; no added generation I/O/model attempts.

## 13. Rollout and rollback

Deploy backend additive acceptance before publishing the versioned extension.
An older server can reject the new reason; preserve draft/retry guidance. All
old reason codes stay valid. Revert feedback/report/UI changes to roll back;
retain existing quality-v1 cleanup and historical receipts. Do not rewrite reasons,
reset counters, remove metadata or enable production flags. No data migration.
Hosted receipt/consent/access and installed-package acceptance remain separate.

## 14. Progress and pre-merge evidence

Implemented locally from main bbd6578. Actual runtime changes are one additive
QUALITY_REASONS member, a two-line allowlisted emailMode projection, one fixed
popup choice/clearer existing unsupported label and package metadata 1.0.35.
No handler/schema/auth/persistence/style or generation policy change was needed.
The existing dashboard continues mapping unknown reasons to Other. Retired unsafe
historical Q1–Q6 example queries in favor of the one canonical cohort query and
updated the existing evaluation log; historical Nordnet evidence is retained.

Baseline: 55 focused web tests and the original disposable PostgreSQL suite passed.
Initial red: seven web assertions exposed missing reasons/mode and the proposed
legacy approval tightening. Inspection of an existing compatibility test showed
that tightening would reject an accepted legacy shape, so it was intentionally
omitted; strict summary validation and rejected-only counters provide consistency.
The SQL red returned one cohort instead of the required three mode cohorts. Two
packaged UI tests failed because the missing reason button was not available.

Initial green: 3,347 web tests / 154 files with coverage (91.17% statements, 85.82% branches,
91.82% functions, 92.22% lines), 15 guardrails, 344 extension tests / 25 files, root and
extension types/lint, policy, version policy, high-threshold root audit and
extension audit (zero vulnerabilities),1.0.35 ZIP and two real packaged Chromium
feedback tests. One inherited root lint warning and12 moderate root advisories
remain. First build compiled but exited 1 with an inherited Next.js security
notice; normal repeat and final smoke evidence are recorded separately. No
security-control bypass, dependency upgrade or production action was taken.

Disposable PostgreSQL 17 executes the actual report and canonical owner/PK tests:
current consent/withdrawal/default-null denial, contribution cap/floor, all four
grounding levels, normalized kinds, approved-vs-rejected denominators, safe
unknown mode/reason buckets and malformed-source rejection. A test assumption
that removing one row must reduce the total was corrected: the unchanged cap can
admit the next eligible row. The stronger assertion checks that a malformed
follow-up cannot enter that mode's count. No eligibility rule was changed.

Protected-path diff against bbd6578 is empty for generation services/routes,
prompts, selectors, finalization, output budgets, admission/refunds, account flows,
receipt handler/deduplication, migrations and style analyzer. Generation metadata
builder is unchanged; only its existing reason-list constant is extended.

Round 1 fresh review confirmed ALE30-R1: the report enumerated only two of six
existing EMAIL_MODES, collapsing founder/CEO, clarification, role-fit and referral
modes to unreported. Actual PostgreSQL and canonical-enum parity regressions were
red before correction. The SQL now accepts all six; API/projector tests use the
canonical mode set and the database test executes each mode. No generation-mode
implementation or limits changed. Corrected-source coverage passes 3,355 tests in
154 files (91.17% statements, 85.82% branches, 91.82% functions, 92.22% lines);
the actual native PostgreSQL17 full suite passes all six modes and original
owner/consent/cap/floor controls. Root lint/types/policy and protected-path diff
checks pass again. Return review is required on the new snapshot.

The unchanged normal build repeat passed, followed by all 73 Chromium smoke
cases. Own local dummy-env server was stopped. Later disk exhaustion blocked two
validation attempts (not passes); only this task's generated build/dependency copy
was removed, retaining exact matching shared dependencies. Once space recovered,
native PostgreSQL17 and Vitest reproduced ALE30-R1 without the resource failure.
No unrelated caches, worktrees, source or installed shared dependencies were removed.


Latest-main integration: rebased uncommitted ALE-30 onto bbd6578 (merged ALE-78).
Preserved both progress entries, its expected-diagnostic runtime/tests unchanged,
and extension 1.0.34 -> 1.0.35. Saved pre-rebase patch, stash and backup ref.
On this integrated source: 3,355 root tests/154 files with unchanged coverage,
15 guardrails, 371 extension tests/25 files, root/extension lint and types,
policy, audits, version policy and ZIP packaging pass. Native PostgreSQL17 passes
all six modes with owner/consent/retention/cap/floor controls. Protected runtime
paths match bbd6578. Integrated production build and 75-case Chromium smoke are
being verified; their exact outcomes and return review are external receipts in
/tmp/ale30-main-build.log, /tmp/ale30-main-smoke.log,
/tmp/ale30-review-report-2.md and Linear. No hosted acceptance claim.

Final correction checks and review receipts are recorded in
`/tmp/ale30-review-report-2.md` and Linear. This source record stays
stable before capture. No hosted/provider/production/Store acceptance, commit or
push. Keep ALE-30 In Progress.

## 15. Handoff and scoped learning

Use this branch. Do not treat historical issue text as evidence of missing code.
Reconcile ALE-51/ALE-27 first; extend their canonical gates, not a parallel stack.
Protect committed generation fixes and distinguish claim/source class from
project-story kind. Final evidence belongs in Linear and external review receipts.
