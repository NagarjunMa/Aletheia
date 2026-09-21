# Failed-generation credit review — ALE-53

## Current delivery state

Local implementation, not deployed. Automatic restoration remains the default. The queue records server-observed failures; quality complaints and browser disconnections alone are not failures. Provider failures mapped to HTTP 429 are distinct from local quota rejection and are captured.

Administrator queue: `/admin/refunds`. Case read/review endpoints live under `/api/admin/refunds`. Only a server-verified account UUID in `REFUND_ADMIN_USER_IDS` may access them; billing exemptions and editable account metadata do not grant access. Empty/invalid configuration denies access. Never configure a public environment variable for this allowlist.

## Rollout

1. Review `20260921012453_refund_review_queue.sql` and execute the local database harness. Verify the migration and role restrictions against an authorized isolated hosted Supabase project before production rollout.
2. Apply the additive migration before setting `REFUND_REVIEW_ENABLED=true`. Existing generation and automatic compensation work with capture disabled.
3. Set `REFUND_ADMIN_USER_IDS` to the operator's trusted Supabase account UUID. Set `NEXT_PUBLIC_APP_URL` to the exact application origin for write protection.
4. Test regular-user denial, operator access, failure capture, a pending refund, repeat approval, and restoration on the isolated project.
5. Enable capture and watch safe `REFUND_CAPTURE_FAILED` events. Do not assume all process crashes can be captured: a worker can terminate before recording failure.

No hosted migration, real credits or emails were exercised during local implementation.

## Operator workflow

- **Pending + pending review:** inspect failure code, original debit and account. Add a bounded internal note, then approve or reject. Do not paste generation inputs/outputs or private resume data into notes.
- **Approved + pending credits:** approval exists but execution is unconfirmed. Refresh before retrying. Retry uses the original debit; it cannot create another refund for an already-settled debit.
- **Credited:** ledger confirms a refund; do not issue another. Existing automatic refunds appear here without operator action.
- **Uncharged:** no deduction was attempted or reserved; informational only.
- **Charge unconfirmed:** the reservation acknowledgement was lost. Do not manually grant credits by amount. Investigate the ledger/logs first; the UI deliberately cannot approve an unlinked debit.
- **Rejected:** retains the decision and note; comment remains available. Reopening is not implemented.

Comments do not change balances. Approval commits before execution, so a failed credit call cannot erase the approval. The ledger remains financial truth; a provider request may still have incurred a cost even when application credits are restored.

Queries return 50 cases per page, with user UUID/category/status/date filters. Each detail view shows the latest 100 chronological review events and indicates when older events exist. No automatic purge is installed; a bounded retention policy/cleanup design remains a release prerequisite. Account deletion cascades case/receipt data; review actors are retained as identifiers until their cases are deleted.

## Failure capture and recovery limits

Capture uses a server-generated attempt UUID and a unique debit association. Only allowlisted codes/category/identifiers are stored. It runs after existing compensation, at most 3.5 seconds on the response path with a 3-second database abort signal. No additional work runs on successful requests or while the flag is disabled.

Existing `generation.timing` is finalized before capture; its duration excludes this added failed-request capture delay. The encompassing request lifecycle includes it. Use that full request duration when evaluating failed-request turnaround.

A timeout does not prove a database write failed. Capture retries using the same attempt/debit deduplicate. If persistence is unavailable, safe request/user/debit identifiers remain in logs; application failures also retain ALE-37's pending marker when that write succeeds. Operator recovery must match an actual server failure and original debit. This version has no automatic log importer or recovery for a worker killed before emitting any evidence.

## Weekly receipts — delivery disabled by default

The protected `/api/admin/refunds/receipts` API supports:

- `POST` JSON `{ "start": "2026-09-07T00:00:00Z", "end": "2026-09-14T00:00:00Z" }` to prepare one closed seven-day period. Requires the same administrator cookie, same-origin request and JSON content type as case mutations.
- `GET ?offset=0` to inspect the prepared records, 50 per page.

Preparation includes only ledger-confirmed refunds matching their original user/debit/amount. It creates at most 100 user receipts per call; repeat the same period while `possiblyMore` is true. Duplicate runs preserve frozen content and uniquely associate each refund. Nothing sends email or changes credit balances. Explicit preparation reports late refunds in that period. Scheduled preparation also reconciles valid unassociated refunds across all previously processed periods, even after catch-up, so late commits cannot silently fall behind the cursor. Its `lateRefunds` is a current snapshot capped at 100, with `lateRefundsMore=true` indicating additional records. These require operator reconciliation rather than automatic changes to frozen receipts. Do not prepare overlapping windows.

The implementation includes an opt-in Resend adapter, based on the existing Resend configuration placeholder; this is an implementation assumption, not a selected paid service or authorization to send. Sender, reporting anchor and exact weekly schedule/timezone must be configured before activation. No Cron schedule was added and existing resume cleanup is untouched.

`GET /api/internal/refunds/weekly-digest` requires the existing `CRON_SECRET` and `REFUND_RECEIPT_DELIVERY_ENABLED=true`. Configure `RESEND_API_KEY`, a bare verified email address in `REFUND_RECEIPT_FROM`, and an ISO timestamp in `REFUND_RECEIPT_ANCHOR`. Anchor is immutable after the first run and defines fixed seven-day periods (UTC elapsed time, not DST-adjusted calendar weeks). Selecting a local-time/DST schedule needs explicit configuration/design before rollout.

Each call prepares at most two closed periods (100 users per preparation pass), recovers up to 100 expired leases and processes at most three emails concurrently. Repeat invocations until `possiblyMore=false`; this signal includes both preparation catch-up and delivery saturation, including empty earlier weeks. A weekly trigger alone does not drain a saturated backlog. The caller/scheduler must inspect `lateRefunds`/`lateRefundsMore`, pending records and errors; these reconciliation warnings do not keep `possiblyMore` true indefinitely. A subsequent periodic run is still needed to discover transactions committed after the latest run. The scheduling integration is a release prerequisite.

Delivery uses a two-minute lease and a maximum of three attempts, with one-minute backoff. Recipient is read from server-verified Auth data and must have a confirmed email. Recipient, sender and message are frozen before the first send. Each attempt uses `refund-receipt/<receipt-id>` as its provider key. Resend documents a 24-hour deduplication window; this implementation stops automatic retries after 23 hours from the first claim. Do not switch provider accounts while uncertain sends remain. See [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

“Sent” means the provider returned an accepted message identifier, not confirmed inbox delivery. Stored recipient/message payload is removed on confirmed acceptance. A lost provider response, lost database acknowledgement or expired lease stays uncertain; refresh before recovery. A finish from an old lease cannot overwrite a newer lease. Email code has no credit-mutation dependency.

Recovery: inspect the service-only `refund_receipt_delivery` row by receipt ID (`attempts`, `first_attempt_at`, `next_attempt_at`, `lease_until`, `last_code`, `provider_id`). Within 23 hours and below three attempts, rerunning the protected worker reuses the frozen payload/key. Outside that window, do not clear attempt counters or create another receipt: reconcile using the provider key/logs, record acceptance only after confirmation, or leave uncertain. For `RECIPIENT_UNAVAILABLE`, verify the account/email before an operator-controlled reset; no provider request was made on that path. Manual recovery controls beyond the stored state/runbook are not exposed as a public API. Prepared status never means sent. No actual email was sent in development.

## Validation and rollback

`REFUND_TEST_PG_BIN=/path/to/postgresql/bin node scripts/test-refund-review-db.mjs` creates a disposable socket-only cluster, applies the relevant real migrations, runs SQL checks and races automatic/manual restoration, then stops and removes that cluster. It never reads `.env` or `DATABASE_URL`. Requires local PostgreSQL binaries; it does not contact production.

Relevant suites: `lib/auth/refund-admin.test.ts`, `modules/refund-review`, `app/api/admin/refunds`, generation service/route regressions, `app/admin/refunds/RefundReviewPanel.test.tsx`, and mocked Playwright `e2e/refund-review.spec.ts`. Browser fixture uses the extension's existing esbuild installation and mocks every request; this is not live authentication or financial verification.

Rollback: disable capture and clear the admin allowlist, or roll back the application. Preserve the additive tables, audit events and credit ledger. Do not undo issued refunds or drop financial/audit data as a rollback shortcut. Existing resume cron and extension protocols are unchanged.

### Late-refund reconciliation

When the worker reports late refunds, inspect valid generation-refund ledger rows with no `refund_receipt_items` association, with timestamps from the schedule anchor up to (exclusive) its `next_start`. Match original debit/user/amount, and inspect the canonical reporting week. Preparing that exact week can create a missing receipt if that user has none. If a receipt is already frozen or sent, retain the warning for explicit investigation; do not mutate its payload, create overlapping replacement windows or re-credit the user. Supplemental receipts remain outside this correction. The warning repeats until the missing association is resolved; it is not proof an email was sent. The scan returns at most 100 records' count plus an overflow flag and uses the existing database request deadline; failure is reported as an unconfirmed run, not an empty backlog.
