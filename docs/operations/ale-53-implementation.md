# ALE-53 execution context

Full documentation mode; Critical risk. Canonical acceptance criteria and 15-section plan: [ALE-53](https://linear.app/aletheia-connection-builder/issue/ALE-53/add-failed-generation-refund-review-queue-admin-console-and-weekly).

## Current checkpoint — 2026-09-20

- User authorized implementation with production-engineering-loop v0.5.0.
- Local main synchronized with origin/main at 61c89c3; feature branch: ale-53/refund-review-workflow.
- ALE-37 is merged. Its prior uncommitted-status description in the issue is historical.
- Pre-existing ALE-38/ALE-52 notes and progress changes are preserved.
- Confirmed user policy: preserve automatic refunds; manually review unresolved restorations only.
- Local implementation now covers bounded capture, service-only case/review RPCs, operator API/UI, frozen receipt preparation, and disabled-by-default delivery. No remote schema mutation, production credit mutation, email send, deployment or push performed.

## Design basis and verified locations

- Existing project map: docs/agents/engineering-guide.md.
- lib/billing/credits.ts owns original reservation/refund RPC calls and category prices; do not duplicate pricing in admin actions.
- modules/application-answer/application/generate-yc-application.service.ts: releaseReservations attempts compensation, exposes pending restoration, and records failed compensation.
- modules/outreach/application/extension-generate.service.ts: several parse-error exits and outer catch attempt refunds; capture must cover these paths, not just the outer catch.
- modules/outreach/infrastructure/extension-generate.repository.ts: refundCreditReservation returns a boolean; recordApplicationRefundFailure records a bounded pending marker for application failures.
- lib/supabase/server.ts: createClient and auth.getUser validate cookie callers; createStatelessServiceClient is the existing privileged boundary and must only be constructed after authorization.
- app/api/internal/resumes/cleanup/route.ts: existing bounded authenticated scheduled-work pattern; preserve its schedule.
- vitest.config.ts and **tests**/setup.ts: unit checks use mocked external services.

## Implementation checkpoint

Capture/authorization contracts and generation integration implemented; repository checks and two rounds of independent review completed locally. Opt-in Resend delivery, frozen payloads, leased attempts and bounded recovery are now implemented locally. Sender/anchor/schedule configuration and final retention policy remain release prerequisites. Do not claim full ALE-53 completion.

New paths: `modules/refund-review/`, `lib/auth/refund-admin.ts`, `app/api/admin/refunds/`, `app/admin/refunds/`, `supabase/migrations/20260921012453_refund_review_queue.sql`, `supabase/tests/refund-review.sql`, `scripts/test-refund-review-db.mjs`. Existing generation services pass server-owned failure identity/debit linkage to bounded capture. Capture defaults off until migration rollout; existing automatic compensation remains unchanged.

Database financial status is derived from the ledger. Approval is recorded before restoration; timeouts leave approved/pending cases recoverable. Unknown reservation outcomes are explicitly unconfirmed and cannot be approved. No client amount is accepted. Uncharged and already-credited cases are informational. Receipt preparation is a protected operator API for explicit closed seven-day periods; sending defaults disabled and no cron is configured. Frozen receipt contents cannot be changed by reruns; late commits are counted for manual reconciliation rather than silently omitted.

Administrator access can use a server-configured account UUID allowlist, denying access when empty; do not infer authority from the billing unlimited-email list or user-editable metadata. Exact account configuration remains a rollout prerequisite.

Provider, verified sender and weekly timezone/schedule are pending. An opt-in Resend adapter is implemented as a stated assumption; keep actual delivery disabled until configured. No real messages are authorized by this implementation task.

## Evaluation map

| Requirement                  | Wrong implementation to reject                                       | Planned evidence                                                    |
| ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Automatic failure capture    | Only outer exceptions create cases; parse-return failures disappear  | Generation branch integration tests for both services               |
| Original-debit credit safety | Client amount accepted; concurrent approvals credit twice            | Atomic database tests plus sandbox concurrency/retry checks         |
| Operator-only access         | UI hides controls but API accepts regular users                      | Route denial tests with no privileged client or writes              |
| Accurate review state        | Approval reported as credited before ledger confirmation             | Timeout/failure/retry tests with distinct execution state           |
| Private bounded capture      | Raw model error or input stored; outage blocks response indefinitely | Canary rejection and timeout tests                                  |
| Weekly receipts              | Pending/rejected cases counted; email retry credits again            | Closed-period multi-user aggregation and independent delivery tests |

## Baseline evidence

2026-09-20, source 61c89c3 with unrelated documentation edits:

- Passed: Node 24.16.0, npx vitest run lib/billing/credits.test.ts modules/outreach/infrastructure/application-refund.test.ts modules/application-answer/application/generate-yc-application.service.test.ts — 38 tests, three files.
- These are existing behavior checks, not evidence that ALE-53 is implemented.
- Red-to-green evidence includes contract/auth checks, generation capture, provider-429 regression, email adapter and real-browser focus behavior.
- Final `make ci`: lint (zero errors, one declaration warning), type check, 1,029 tests across 90 files, 15 guardrails and production build passed on Node 24.16.0.
- Coverage passed: statements 88.65%, branches 81.75%, functions 88.75%, lines 90.06%.
- Mocked Playwright browser flow passed: keyboard approval, heading focus, disabled repeat approval and exactly one mutation. No live authentication exercised.
- Disposable socket-only PostgreSQL 14 harness passed real migration, role denial, ownership, deduplication, concurrent automatic/manual restoration, receipt totals, exclusive leases, immutable payload, stale completion and expired retry-window checks. No hosted Supabase verification.
- Independent fresh-context review completed in two rounds; one provider-429 capture finding fixed with a regression test, no remaining material findings in the reviewed local scope. See [review evidence](ale-53-review.md).
- Extension code was unchanged; extension-specific checks were not repeated.
- Production verification: not run; no isolated target configured.

## Delivery boundaries

Keep ALE-53 In Progress. Use additive migrations and disabled delivery configuration for rollout; rollback disables new entry points/capture without deleting ledger/audit records. Exact schema and rollback procedure must be reviewed with implementation. No completion or release claim at this checkpoint.

## Audit corrections — 2026-09-20/21

The subsequent evaluation found two P2 receipt-completeness defects, superseding the earlier no-findings checkpoint for these paths: IND-1 (late commits behind the forward cursor) and IND-2 (false empty backlog after two empty preparation periods).

Both are corrected locally. Scheduled preparation independently detects unassociated historical refunds, including on caught-up runs; reports a bounded count/overflow warning for manual reconciliation; never rewrites frozen receipts or credits. Worker backlog includes preparation state and uses the latest reconciliation snapshot without double-counting across passes. Added a partial refund timestamp index to the still-unreleased additive migration.

Red evidence: two worker assertions failed against the old implementation; real PostgreSQL concurrent late-commit test failed with “Late refund silently lost after cursor advance.” Green database tests include separate uncommitted/refund transaction, no-existing-receipt cases, 101-record warning cap, repeated caught-up detection, manual preparation resolution and unchanged balances/frozen receipts. Fresh final CI/review evidence is recorded in ale-53-review.md. Unchanged UI browser evidence remains the preceding audit's passing run. Release prerequisites remain unchanged.
