# ALE-53 independent review evidence

Date: 2026-09-20 America/New_York (2026-09-21 UTC). Risk: Critical. Base: `61c89c3`. Branch: `ale-53/refund-review-workflow`. Reviewer: fresh-context independent agent `/root/ale53_review`; no cross-model claim. Two rounds used; local implementation review is not production release approval.

## Reviewed snapshots

- Round 1: 410 hashed source files; manifest SHA-256 `5ee18ea8058c5823aec414be6779cd69e0aa7adf6fe36bca50d88e6158402c97`.
- Round 2: 424 hashed source files; manifest SHA-256 `aa3062493094db8340d1e2c68e5b45ef4f7fbc7cbf047a336af4039a1282fc59`.
- Reviewer verified round-two hashes twice. Implementer compared current source against the round-two snapshot with no differences before final documentation updates. Subsequent changes are evidence/handoff documentation only.

## Finding and closure

**ALE53-R1 — P1, confirmed, closed.** Capture restricted to HTTP 5xx omitted provider-originated 429 failures after a charge when compensation failed. Capture now also recognizes the trusted MODEL_REQUEST_FAILED code on error responses, while ordinary local validation/auth/quota denials remain excluded. Added a regression exercising a charged provider 429 with failed compensation and original-debit linkage. Reviewer verified closure from source in round two.

Round-two verdict: no remaining material findings in reviewed implementation scope. A browser-observed heading-focus defect was separately corrected and its mocked real-browser test passed.

## Independent evidence and limits

Reviewer independently ran the disposable PostgreSQL harness, including original-debit ownership, concurrent automatic/manual recovery, receipt totals, exclusive leases, frozen payloads, stale completion and expired retry windows. Also independently verified profile deletion cascade. Reviewer inspected regression tests but did not independently run Vitest, build, browser or provider calls; implementer results are recorded in ale-53-implementation.md.

Resend documents a 24-hour idempotency window; local retries stop after 23 hours from first claim. Recipient lookup failures currently require manual recovery. Worker possiblyMore reports delivery saturation, not all outstanding reporting-period preparation; scheduler integration must account for both. Capture can miss process termination before persistence, and capture time is excluded from generation.timing but included in overall request duration.

Release prerequisites remain operator configuration, verified sender, anchor/cadence and backlog draining, bounded retention policy/cleanup, and hosted auth/database/email verification. Real email sending, hosted migrations, production mutations and deployment were not performed. No claim of full issue completion.

## Subsequent audit and corrections — 2026-09-20/21

The fresh evaluation after the initial implementation found two introduced, confirmed P2 defects; it supersedes the initial no-material-findings verdict for receipt completeness.

- **IND-1:** scheduled preparation advanced beyond late-committing refunds without revisiting them. Correction: scan valid, unassociated refunds behind the cursor on every scheduled preparation, including caught-up runs. Return a current count capped at 100 plus overflow indication. Frozen receipts and financial balances remain unchanged; explicit reconciliation is still required.
- **IND-2:** worker delivery saturation hid unfinished preparation. Correction: include preparationPending in possiblyMore. Treat reconciliation counts as snapshots, not additive deltas.

Red-to-green evidence: two new worker assertions failed before the fix; the real PostgreSQL late-commit regression failed before the SQL correction and now passes. SQL cases also cover 101 late refunds, users without an existing receipt, repeated caught-up detection, and clearing after explicit preparation. Four worker regressions added.

Fresh checks: make ci passed (1,033 tests / 90 files, 15 guardrails, lint with one existing declaration warning, type checks and build). Coverage passed: statements 88.65%, branches 81.75%, functions 88.75%, lines 90.06%. Disposable PostgreSQL harness passed. Earlier mocked browser evidence retained because UI and auth code are unchanged. No hosted or provider checks.

Correction review snapshot: ale53-fix-review-1ss00owa; 425 files, manifest SHA-256 0a7702fc27970edca60cce96269be15c9c5cb224ad625e8a9ff40009b04f175b. Fresh-context reviewer: /root/ale53_receipt_fix_review (model identity not independently asserted). Final reviewer disposition: no material findings; IND-1 and IND-2 closed. Reviewer independently passed the PostgreSQL harness and 13 worker/protected-route tests, traced SQL through the API response and verified all 425 hashes before/after. Review is limited to corrections, not full release approval. Documentation updated after snapshot; runtime/tests unchanged.
