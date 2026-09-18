# ALE-37 application-question contract

Frozen on 2026-09-12; revised and implemented on 2026-09-18. Branch:
`ale-37/application-batch-contracts`, based on main `d6d0cce`.

## Implementation decisions — 2026-09-18

Full implementation and testing is authorized on the existing branch. The
historical red-checkpoint sections below remain evidence, not the current scope.
These decisions supersede conflicting checkpoint text:

- Canonical output budget scales with question count and has a hard cap. Initial
  settings are tested engineering defaults, not a measured latency/cost promise.
- A validated delivered batch costs four credits. Failed delivery compensates
  the whole batch. Failed refunds report pending and are recorded for manual
  reconciliation through the existing idempotent credit reservation. Do not retry
  the non-idempotent daily-slot release blindly. No automatic recovery worker.
- New application feedback records approval or a bounded issue category and
  short user-authored summary, generation ID and evaluation metadata only. No
  model summarization call, raw complaint, full response or question persistence
  in feedback. Negative feedback does not regenerate or refund. Legacy clients
  remain compatible. This replaces the planned 15,008-character feedback increase.
- Last-generation and accepted local storage remain answer-only. Authentication
  handoff alone may temporarily store questions/JD in trusted extension session
  storage with a 15-minute expiry, consumption/cancellation/sign-out cleanup,
  and no backend upload or general input history. Signed-out application drafting
  is permitted; generation always requires authentication.
- Review uses expanded sections, safe bold question headings, copy-one/copy-all,
  accessible feedback modal and accurate credit-restoration status.

## Scope and risk

This delivery implements the additive contracts, grounded batch pipeline, billing
compensation, compact feedback and extension review/authentication handoff. The
parent issue stays In Progress for additional Critical review and release gates.
See `docs/operations/ale-37-implementation-2026-09-18.md` for current evidence.
Critical risk: independently deployed clients, private candidate data, untrusted
questions/model output, and credit/rate-limit compensation. Additional explicit
review is required before release; this self-review is not independent approval.

## Input and compatibility

- Keep API version 1 and internal category `yc_application`. Rename the user-facing
  workflow to Application Questions when implementing the UI.
- Legacy API `question` preserves NFKC normalization, CRLF/CR to LF conversion,
  surrounding trim, 10–1,000 UTF-16 code units, and the existing omitted-question
  default. An explicitly blank/null legacy question remains invalid. Do not split
  legacy strings into multiple questions.
- The new UI requires entered application-question data. It sends `questions`,
  even for one question, without silently substituting a default for blank input.
  A visible, editable prefilled question counts as entered data if retained.
- LinkedIn connection, cold email, and InMail do not require this question field.
  Their existing profile/context validation and payloads remain unchanged.
- `questions` is a strict array of 1–5 strings, each 10–500 normalized UTF-16 code
  units. The sum of normalized item lengths is at most 2,500, excluding separators.
  Reject empty entries, objects/client IDs, nulls, mixed `question`/`questions`,
  and extra application request fields. Never truncate or fall back to legacy
  limits for an invalid batch. Preserve the existing 80–20,000 JD bounds.
- The UI normalizes then splits on newlines, trims each line, and ignores blank
  separator lines. All-blank input is invalid. Periods are punctuation, not
  delimiters: preserve abbreviations, decimals, and multi-sentence questions.
  This interprets the user's “each line ... separated by '.'” as one question per
  line with optional trailing punctuation. Multiple sentences on one line form
  one question. Repeated question text remains separate entries, in order.
- The API does not split array items again. An embedded line break in a canonical
  item is rejected; multiline legacy strings remain supported.
- Validation errors use the existing 400 INVALID_REQUEST envelope and field-level
  details. New UI errors identify the offending question/count and make no request.

## Identity, ordering, and output validation

The server assigns `q1` through `qN` by normalized input position, stable within
the request, never as global identifiers. Each model answer includes its question
ID, body, and private claim ledger. Require exact one-to-one coverage of the
submitted IDs. Missing, duplicate, unknown, extra, or malformed answers fail the
whole batch. Reorder a complete valid set by the server's original question list.
Use the original normalized question for display, never model-generated labels.

Each answer independently satisfies 50–150 words and the existing 3,000-character
tool-body ceiling after sanitation. Preserve source ownership, readiness,
question-aware evidence selection, source/metric checks, excluded claims, injection
scanning, XML escaping, and claim-safe sanitation. A combined body never repairs
invalid structured output or proves correct question coverage.

## Public response and review

New server responses add `answers` entries with exactly these public fields:
`questionId`, `question`, `body`, `word_count`, `character_count`. IDs are sequential
in the final response. Question text is transient; no provenance, claim ledger,
source content, or per-answer token/time estimates are public. Legacy body-only
responses remain parseable for old stored results and single-question fallback.
Live multi-question requests require a matching answer collection; do not turn an
unstructured body into fabricated answer mappings.

- One answer: top-level `body` is exactly its answer text, with no heading. The
  existing body area displays that answer; keep the question available in the
  current review context. Copy-one and copy-all copy the answer text.
- Multiple answers: top-level `body` and copy-all plain text use the same format:

  ```text
  **First normalized question**
  First answer

  **Second normalized question**
  Second answer
  ```

  Escape Markdown punctuation in question headings (`\\`, backtick, `*`, `_`,
  braces, brackets, parentheses, `#`, `+`, `-`, `.`, `!`, `|`, `>`, `~`) so question
  text cannot inject formatting. The UI uses text nodes inside bold heading
  elements, not HTML or a general Markdown renderer. Plain-text clipboard output
  carries Markdown bold markers; actual rich-text clipboard support is out of scope.
  Each answer immediately follows its heading; one blank line separates pairs.
  Preserve the normalized question wording, including trailing punctuation.

- Bound the combined public body to 22,000 characters (five 3,000-character
  answers, escaped bounded questions, and separators fit). Per-answer counts
  describe answer text only; top-level counts describe the complete `body`,
  including headings. Do not apply the single-answer 150-word ceiling to a batch's
  combined document. Check counts and consistency between answers and body.
- Usage, processingTime, and evalMetadata retain request-level meaning. Existing
  generationTimeMs/processingTime are model-call measurements, not total client
  turnaround. `answers.length` supplies batch size without fabricated per-answer
  usage attribution. Any later metadata additions must update feedback validation.
- Show ordered question/answer sections within the review region, copy-one on
  each section, and copy-all. Keep keyboard, focus, overflow, loading/error states,
  and batch-level accept/reject/regenerate behavior accessible. No ATS automation.

## Storage and feedback

The compatibility body containing questions is in-memory display/clipboard data.
Never persist or submit it verbatim as feedback. Project a separate answer-only
body by joining ordered answer bodies with two newlines (one answer unchanged).
Apply this projection to lastGeneration and accepted-message storage. Store
permitted metadata and answer IDs/counts only;
omit question text, JD, raw request, provenance, and model-only fields. Avoid
spreading the original response into persisted objects. Answer prose is permitted
existing output data; this does not promise that prose cannot incidentally mention
words also present in a question.

Preserve all answer text in local answer storage: up to 15,008 characters for
five 3,000-character answers and four separators. New application feedback uses
`format: application_summary`, generation ID, approval status and bounded
allowlisted evaluation metadata. Rejection additionally requires one issue
category and a user-authored summary of 1–500 characters. Approval carries no
summary; neither sends a response body, question, JD, raw complaint or provenance.
The UI asks for a short account of what went wrong, without pasting source/output.
There is no extra model call to summarize feedback. Store reports as
`user_reported`, not verified diagnoses. Generation IDs provide correlation only;
this does not create a backend archive of the original request/answer.

Legacy feedback stays at 10,000 characters for all categories. Compact application
feedback bypasses answer-based style learning. It waits for persistence before
acknowledging success; failures retain the modal text for retry. Negative feedback
does not regenerate or refund; a separate Generate again action starts another
four-credit request. No database migration is needed.

Only authentication handoff may save the bounded unfinished questions/JD to trusted
extension `chrome.storage.session`, never sync/local/backend storage. A 15-minute
TTL is validated on read, with an expiry alarm for best-effort deletion; browser
suspension can delay deletion. Clear on consume, cancellation/failure and sign-out.
Existing-user drafts are account-bound; a guest draft is consumed by the account
that signs in. Reconnection restores the draft and requires Generate again,
preventing a chargeable request during a popup authentication reload.

Restored results retain answer order with generic Answer 1…N labels; do not invent
or restore deleted question labels. Explain that questions/JD must be re-entered
to regenerate. Review of original questions is available during the live session.
Copy-all after restoration uses the answer-only representation.

## Billing, failures, and performance follow-up

One batch makes one SDK generation call, with four credits and one daily slot
reserved once (existing unlimited-developer exemption preserved). SDK retries may
make multiple provider attempts; one call is not one HTTP attempt. Any answer
failure returns no partial success and attempts whole-batch credit and daily-slot
compensation. Repeated cleanup must not duplicate refunds. Preserve stable failure
codes and record compensation failures accurately; never claim confirmed repayment
from an attempted refund alone. Inspect both resolved RPC errors and rejected
cleanup promises. Failed credit restoration returns `refund_pending` with the
original debit reference and records a server-owned marker in existing ledger
metadata, with a safe log fallback if the database is unavailable. Manual recovery
uses the existing idempotent refund RPC against that debit; never blindly retry
daily-slot release because its RPC is not idempotent. See the implementation
runbook. Provider charges are not reversed by restoring application credits.

Canonical output tokens use `min(8000, 500 + 1500 * questionCount)`:
2,000 / 3,500 / 5,000 / 6,500 / 8,000 for one through five questions. Legacy calls
retain 1,000. These are initial tested ceilings, not measured cost/latency promises.
Truncated tool output fails the batch. Keep the 30-second SDK per-attempt timeout
and existing SDK retries; neither is an end-to-end deadline. The application
client uses one transport attempt with a 120-second wait, avoiding automatic
repeat charges when a response is lost. A connection loss after server success
remains ambiguous and needs ledger/log investigation, not an assumed refund.

**Follow-up after regular usage (ALE-38/ALE-52):** compare 1–5-question cohorts for
turnaround, stage/model durations, input/output tokens, retries, failures,
truncation, and cost. Use representative approved exports and record sample sizes;
do not claim five-question latency/cost targets from mocks. Offline reports are
on demand, not continuous monitoring. No automation, paid traffic, or production
sampling was scheduled by this contract. Usage evaluation does not block development;
representative batch evidence remains pending before release performance claims.

## Test and implementation sequence

1. Freeze this contract and execute red tests through existing schema/popup/storage
   boundaries. Keep passing legacy tests and replace only UI expectations explicitly
   superseded by required canonical input. Do not use skipped tests or expected-fail
   wrappers to make CI green.
2. Implement additive request/response/feedback schemas and popup pure helpers until
   these tests pass, then test request-aware exact coverage and server-owned IDs.
3. Implement grounded model batches, independent sanitation/validation, and atomic
   reservation/compensation orchestration with mocked failures and regressions.
4. Implement the review UI, storage/feedback integration, and accessibility checks.
5. Run full repository gates and additional explicit Critical review before release.

Runtime implementation and the native test gates now pass. Extension source version
is 1.0.16; no ZIP, Store submission, deployment, or schema migration was performed.
Deploy the backward-compatible server before distributing the new extension; roll
back the extension before removing server batch support. Preserve unrelated
ALE-38/ALE-52 audit notes. Additional release review remains pending.

## Historical red checkpoint evidence — 2026-09-12

The following records the earlier tests-only delivery, not the current status.
The later user decision superseded its planned feedback-capacity increase.

Node 24.16.0; all external I/O mocked. Added 67 tests and revised two existing
new-UI payload expectations explicitly superseded by this contract. Existing
legacy API/default and body-only response tests remain intact.

| Check                                                                           | Result                                                           |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Before edits: generation contracts, route, application-answer subsystem         | 156 passed / 9 files                                             |
| Before edits: entire extension suite                                            | 173 passed / 19 files                                            |
| After edits: generation contracts/route, feedback, application-answer subsystem | 212 passed, 8 deliberately failed / 10 files                     |
| After edits: entire extension suite                                             | 176 passed, 22 deliberately failed / 19 files                    |
| Root and extension lint/type-check                                              | Passed                                                           |
| Extension version policy against main                                           | Passed; no packaged changes                                      |
| Changed-file formatting and diff whitespace                                     | Passed                                                           |
| Full root coverage, guardrails, production build, E2E, packaging                | Not run: red-test checkpoint only, no runtime or package changes |
| Live provider/traffic, rollout, independent Critical review                     | Not performed; later gates                                       |

The 30 failures are behavioral assertions/schema rejections from missing batch
support, required input, formatting/order, feedback capacity, and private storage
projection. No import/compilation failures, fabricated production measurements,
skips, or expected-failure wrappers. Negative batch schema fixtures currently pass
because the entire new field is unsupported; they are not evidence of implemented
batch validation until positive acceptance tests also pass.

Evidence logs: `/tmp/ale37-baseline-root.log`,
`/tmp/ale37-baseline-extension.log`, `/tmp/ale37-red-root.log`,
`/tmp/ale37-red-extension.log`, `/tmp/ale37-types.log`, `/tmp/ale37-lint.log`,
`/tmp/ale37-extension-lint.log`. Logs are local and may be removed by the OS.

Review: inspected the complete change diff. Architecture stays within existing
schema and popup boundaries; test fixtures allocate bounded local strings only.
No auth/RLS/permissions, concurrency, billing algorithm, runtime memory/cost, or
deployment behavior changed. Public compatibility, untrusted output validation,
private storage, and downstream feedback bounds are explicitly covered or assigned
to later phases. Source-extracted popup boundary tests reuse the repository's VM
test pattern; if functions gain imported helpers during implementation, wire those
real helpers into the sandbox rather than accepting ReferenceErrors as red evidence.
Server/model request-aware exact coverage, refund-failure behavior, restored UI,
copy-one/copy-all DOM behavior and accessibility still need integration tests in
their implementation phases. This checkpoint completes the requested contract/test
step only; none of those remaining feature requirements is claimed complete.
