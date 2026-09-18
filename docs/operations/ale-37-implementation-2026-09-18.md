# ALE-37 implementation evidence — 2026-09-18

Local implementation and mocked validation are complete on
`ale-37/application-batch-contracts`, merge base `d6d0cce`.
ALE-37 remains **In Progress**. This is implementation evidence, not independent
Critical approval, production verification, or authorization to publish.

The user authorized implementation and testing after resolving the product
decisions. The earlier red-test checkpoint and unrelated ALE-38/ALE-52 notes are
preserved. The current contract is
`docs/superpowers/specs/2026-09-12-ale-37-batch-contract.md`.

## PR handoff preparation — 2026-09-18

The user authorized committing and pushing ALE-37 for a PR and will perform
hands-on application testing after merge. ALE-53 separately owns the proposed
refund queue, administrator UI and weekly emails; it does not block this PR.
The earlier no-commit/no-push/no-ZIP statements below describe the implementation
checkpoint, not the later authorized handoff.

Packaging verification found that the source ZIP omitted `lib/`, including the
new authentication-draft helper and existing logging modules. The package builder
now includes that runtime directory. `scripts/extension-package.test.ts` reproduced
the missing helper before the fix and now checks the actual archive's relative
module imports and exclusion of test files. Local ZIP creation is a repository
pre-commit step; it is not a Chrome Web Store submission.

Existing live auth/ownership, metered refund, installed-extension/accessibility
and representative batch calibration checks remain unverified. A locally loaded
extension still targets production, and the default developer account is exempt
from credit deductions; controlled financial failure tests require an appropriate
metered account and isolated setup. Additional Critical review is still pending.

## Implemented behavior

| Requirement             | Implementation / evidence                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Additive input contract | Legacy single `question` retains omitted default, multiline behavior and 10–1,000 normalized UTF-16 bounds. New `questions` accepts 1–5 items, 10–500 each. Mixed/empty/oversized input is rejected with field paths. UI ignores separator blanks; periods remain punctuation.                               |
| Grounded batch          | One caller-scoped context load, bounded round-robin evidence selection, one forced tool call and separate claim ledgers. Exact q1..qN coverage precedes ordering; each answer independently passes sanitation, 50–150-word/3,000-character and grounding checks.                                             |
| Review                  | Original questions appear as safe text headings in input order; copy-one and Markdown-heading copy-all. A live batch must match the submitted questions. Single-answer body stays plain text; older body-only stored results remain supported.                                                               |
| Billing                 | One four-credit reservation and one daily slot per batch; no partial success. Failed validation/generation attempts whole-batch compensation. Resolved RPC errors and rejected promises are inspected. Failed restoration reports pending with a debit reference.                                            |
| Output budget           | Canonical `min(8000, 500 + 1500 * count)`: 2,000 / 3,500 / 5,000 / 6,500 / 8,000 tokens. Legacy remains 1,000. Truncation is rejected. SDK retries and 30-second per-attempt timeout remain unchanged.                                                                                                       |
| Transport               | Application requests use one client transport attempt with a 120-second wait. Automatic network/5xx retries cannot submit another chargeable batch. Interactive reconnection restores the draft and waits for Generate again.                                                                                |
| Feedback                | Approval or issue category plus a 1–500-character user-authored summary, generation ID and allowlisted metadata. No answer/request body or summarization model call. Reports are `user_reported`; failed persistence keeps the modal text. Reporting does not regenerate/refund.                             |
| Local persistence       | Answer-only projection for last-generation and accepted records. Original question labels are memory-only; restored answers use generic labels and require re-entered inputs to regenerate. Last-generation restoration checks account ownership.                                                            |
| Authentication handoff  | Questions/JD may temporarily use trusted extension session storage for 15 minutes. Validate expiry/owner, consume once, and clear on cancellation/sign-out. Failed expiry scheduling removes the saved draft. Guest drafting is available behind existing consent; generation still requires authentication. |
| Evaluation              | Numeric `itemCount` is included in safe generation timing and offline cohorts for 1–5 questions; old exports use an unknown cohort. No automatic collection, recurring report or alert was created.                                                                                                          |

## Risk and engineering review

**Critical**: authentication handoff, private candidate data, untrusted model
output, billing and independently deployed clients. Reviewed the runtime diff,
affected callers, new files and existing compatibility tests against the merge
base. No new dependency, migration, ATS permission, autofill or submission path.
Domain grounding/validation stays in the application module; provider and billing
I/O stay in repositories; popup transformations stay in pure helpers. Shared
auth-draft storage logic avoids divergent popup/worker TTL and access rules.

Concrete findings corrected during implementation:

- `generate-yc-application.service.ts` and the billing repository previously
  treated attempted cleanup as success. They now inspect RPC outcomes and expose
  pending restoration, with a manual reconciliation marker and log fallback.
- `validate-yc-application-output.ts` now rejects numeric claims omitted from the
  claim ledger; previously a model could bypass numeric checking by omitting them.
- The application transport no longer automatically repeats a chargeable POST
  after an ambiguous network failure. Existing non-application retry behavior is
  preserved. Interactive auth recovery stops before a chargeable retry/reload.
- Application storage/feedback no longer copies the question-bearing public body.
  Compact feedback bypasses answer-based style processing; unrelated legacy
  feedback retains its existing 10,000-character contract.
- Popup review now checks request coverage, keeps copy controls visible, and
  checks word limits per answer instead of warning on the combined batch length.
  Field validation has visible status text and `aria-invalid`; the modal restores
  focus and retains unsaved reports. Draft expiry scheduling failure cleans up.
- Explicit schema dispatch preserves `questions.0`-style error paths and prevents
  malformed canonical requests/reports falling through to legacy validation.

No known material implementation finding remains from this review. This does not
establish semantic truth of generated answers: existing source/metric/exclusion
checks are bounded heuristics and users must review claims. No independent
reviewer or live financial/identity environment was exercised.

## Validation

Node 24.16.0. External provider/database/auth APIs were mocked; no paid generation
or production mutation. TDD evidence includes the original 30 red cases and fresh
failures for batch orchestration, compact feedback, refund outcomes, client retry,
field paths, draft cleanup and live response coverage, followed by passing checks.
The superseded 15,008-character feedback proposal was replaced by the user's
compact-summary decision; legacy capacity tests remain intact.

| Command / check                                                                                    | Result                                                                                                                |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run test:coverage -- --run`                                                                   | **975 passed**, 78 files; statements 88.59%, branches 81.74%, functions 88.50%, lines 90.02%; coverage gates passed   |
| `npm run test:guardrails -- --run`                                                                 | **15 passed**                                                                                                         |
| `npm run test:resume-security`                                                                     | **145 passed**; unchanged resume boundary regression suite                                                            |
| `npm run lint`; `npm run type-check`                                                               | Passed                                                                                                                |
| Explicit ESLint for changed evaluation scripts and browser test                                    | Passed, no errors; two existing-rule false-positive unused TypeScript declaration warnings in the new browser fixture |
| `npm run build` with CI placeholder public Supabase environment                                    | Passed                                                                                                                |
| `make extension-ci`                                                                                | **207 passed**, 20 files; audit zero findings, lint, JS type-check and unpacked esbuild bundle passed                 |
| `node scripts/check-extension-version.mjs origin/main`                                             | Passed, extension 1.0.15 → 1.0.16                                                                                     |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:45678 npx playwright test e2e/extension-application.spec.ts` | **3 passed**, Chromium, all network/API/storage surfaces mocked; no server at that URL is contacted                   |
| Changed-file Prettier and `git diff --check`                                                       | Passed                                                                                                                |

Browser evidence covers five ordered answers, copy-one/all, feedback failure and
retry without generation, privacy projection, restored answers, signed-out draft
handoff/consumption, modal Escape/focus and input-error recovery at 400px width.
Reviewed `/tmp/ale37-application-review.png`. This is DOM/keyboard and visual
verification, not an installed-extension OAuth/service-worker or screen-reader
assistive-technology test. Unit/integration tests cover the worker/auth boundaries.

Local logs: `/tmp/ale37-final-{coverage,guardrails,resume,lint,types,extra-lint,build,extension-ci,e2e,format}.log`.
Temporary logs/screenshots are not durable release artifacts. Build warnings about
stale Browserslist data and existing configuration were non-blocking; no dependency
updates were introduced. Root dependency advisories previously recorded in the
ALE-38/ALE-52 audit remain separate security triage; this run did not re-audit them.

## Manual credit reconciliation

The initial recovery mechanism is manual, without a new worker or migration.
`recordApplicationRefundFailure` marks the existing debit's metadata with
`refund_status: pending_manual_review` and a bounded internal reason. It scopes
reads/writes by debit ID, owner and `generation_debit`; clients cannot write the
ledger. The safe `billing.refund_pending` event is emitted even if the database
marker fails. Metadata reads/writes each have a three-second deadline.

An authorized operator must:

1. Find pending debit markers and `billing.refund_pending` log events. Deduplicate
   using the debit/reservation UUID. A user-provided reference alone is not proof
   of eligibility; match it to the server's failure evidence.
2. Read the original debit: confirm owner, `reason = generation_debit`, application
   category and actual negative delta. Check for an existing `generation_refund`
   with `related_ledger_id` equal to that debit. If present, credit restoration is
   already settled even if the pending marker remains.
3. For a verified unrefunded failure, invoke the existing service-only
   `refund_generation_credits(p_user_id, p_amount, p_reservation_id, p_metadata)`
   using the original owner, exact debit amount and original UUID. Record a safe
   reconciliation reason. Never update balances directly or invent a new debit.
4. Verify the refund ledger entry and account balance. An RPC result
   `refunded: false` indicates the reservation was already refunded; do not issue
   another credit. Row locking and the unique refund relation prevent duplicate
   credits for concurrent/repeated calls against the same reservation.
5. Investigate `RATE_LIMIT_RELEASE_FAILED` separately. Its decrement RPC is not
   idempotent; an ambiguous outcome must not trigger a blind retry. This does not
   undo provider charges or promise daily-slot restoration after a DB outage.

No reconciliation was executed in this task. The application owner must arrange
operator access and a review cadence before release. If marker storage and log
retention both fail, there is no durable recovery queue; stronger automatic
recovery is explicitly outside this release. Lost connections after a successful
server response also require investigation rather than assuming no charge.

## Rollout, rollback and outstanding gates

1. Obtain an additional explicit Critical review of auth/privacy, debit/refund
   behavior and client/server compatibility. The engineering-loop skill requires
   this at high-risk boundaries; this self-review is not that approval.
2. In an explicitly authorized isolated environment, verify caller ownership/RLS,
   real sign-in/cancellation/account switching in a loaded extension, forced
   compensation failure and manual recovery, and keyboard/screen-reader behavior.
   Review the hosting execution deadline against SDK retries and cleanup time.
3. Use approved representative one-through-five-question runs to calibrate output
   ceilings against truncation, quality, total turnaround, p50/p95 latency, tokens,
   retries and cost. Include long questions, mixed topics and claim-heavy answers.
   No five-question latency/cost target has been demonstrated by mocks. Regular
   usage comparison remains ALE-38/ALE-52 follow-up, not a development blocker.
4. Deploy the backward-compatible server before distributing extension 1.0.16.
   Confirm current Store-review state and explicit publication authorization.
   No ZIP, push, PR, merge, deployment or Store action was performed here.
5. Roll back the extension first if necessary and retain the additive server until
   installed new clients are accounted for. Removing batch support while those
   clients remain would break canonical requests. No DB migration rollback is
   needed; existing ledger refunds and reconciliation metadata must be retained.

Authoritative behavior references checked during implementation (2026-09-18):
[Chrome session storage](https://developer.chrome.com/docs/extensions/reference/api/storage),
[Anthropic stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons),
[Supabase RPC results](https://supabase.com/docs/reference/javascript/rpc).
The shipped SDK/source and repository migration define the actual retry and
credit-idempotency behavior tested here.
