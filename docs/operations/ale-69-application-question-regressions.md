# Application question regression matrix

## November 15, 2026 verification

The rerun used all changes on `main` at `6965c4e` and the local ALE-68
answer-option fix. The expanded ALE-69 tests were brought forward from their
older local branch. The local Store ZIP was built from extension `1.0.28`.
The packaged browser cases intercepted HTTP. The ALE-68 replay used the nine
reviewed excerpts and live Claude through the local service.

| Case  | Result on the current candidate                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AQ-01 | Passed normalization, batch and legacy limits, indexed invalid input, emoji/UTF-16 minima, and ordered platform pastes. [ALE-72] is present on the base.                                                                             |
| AQ-02 | Passed the reviewed one- and five-answer fixtures, two projects with sufficient facts, sparse coverage, and missing first, fourth, last, or multiple slots before admission.                                                         |
| AQ-03 | Passed sizes 1–5, repeated identical questions, shared relevant facts, the shorter direct-match regression, and distinct complete sets across different questions. The strict tool only offers distinct sets across question groups. |
| AQ-04 | Passed word and UTF-16 boundaries, malformed and misbound options, atomic rejection, 30/45-second provider deadlines, and real SDK behavior with a stubbed upstream 429. [ALE-70] is present on the base.                            |
| AQ-05 | Passed the extension clipboard, tab order, visible focus, Escape/focus return, narrow recovery, duplicate-click guard and identifying question four. [ALE-67] is present on the base.                                                |
| AQ-06 | Passed expired-session and account-switch protections, private data canaries, and owner RLS on a disposable database.                                                                                                                |
| AQ-07 | Passed one reservation and one provider attempt for sizes 1–5, exact local compensation, reconciliation and disposable SQL concurrency checks.                                                                                       |
| AQ-08 | Passed legacy and canonical compatibility, the existing outreach suites, and ordered request/response mapping through the local Store ZIP.                                                                                           |
| AQ-09 | Passed local timeout and compensation controls. Live Claude returned grounded 1/3/5 answers in 1.518 / 1.495 / 2.069 s through the local service, one attempt per size.                                                              |

The final run passed 3,171 web tests, 310 extension tests, 15 guardrails,
10 Chromium popup cases, 26 packaged Chromium cases, both disposable PostgreSQL
harnesses, and the fact-review browser checks at 375/900/1440px. Independent
return review found no material issue after the direct-match and exact-key fixes.
Web and extension lint and type checks, policy, the offline grounding
preflight, and a local Next.js production build and smoke probe passed.

The user moved the remaining installed-extension and manual acceptance to
real-user follow-up. Live production timings remain with [ALE-38] and metered
billing and account isolation with [ALE-56]. These local results do not establish
a production pass.

## November 14, 2026 historical checkpoint

2026-11-14. The local matrix runs against the uncommitted test changes on
`test/ale-69-application-question-regressions`, based on merged main `9fdddab`.
The local extension version is `1.0.27`. The popup suite mocks Chrome and the
API. The packaged suite runs the actual extension worker with intercepted HTTP
responses. [ALE-68] owns installed and hosted receipts.

This issue covers the regression tests and result reporting. Its Critical risk
tier reflects the grounded output, account isolation, and billing release gates
being tested. Product fixes are tracked by their owning issues. Local tests use
synthetic data and disposable databases.

| Case                                       | Automated checkpoint                                                                                                                                                                                                                                                                                                                                                                                                                                             | Remaining evidence                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AQ-01.1 · Normalization and request bounds | Passed canonical counts 0–6, canonical 9/10/11 and 499/500/501 after length-changing Unicode normalization, legacy 9/10/11 and 999/1000/1001 plus the default, and job description 79/80/81 and 19,999/20,000/20,001. Wrong types, mixed and unknown fields, blanks, and embedded canonical newlines reject. Indexed Q4 rejection does not dispatch, and YC, Greenhouse and Ashby-style pastes retain order.                                                     | **Failed:** [ALE-72] tracks minimum-length input with emoji or other astral characters. See the local run results.                                                                                                                                                   |
| AQ-02.1 · Reviewed evidence                | Passed unsupported first, fourth, last, and multiple slots before admission, reservations or dispatch. Two projects with five distinct reviewed facts support the full batch. Two short excerpts mentioning all five topics still return INSUFFICIENT_GROUNDING before quota, credit or provider work. Existing tests cover resume background, stale explicit selections, exclusions, and revoked reviews.                                                       | [ALE-67] owns identifying the affected question in the extension. [ALE-68] owns the deployed sparse control.                                                                                                                                                         |
| AQ-03.1 · Grounding and diversity          | Passed one through five ordered answers, scoped prompt sources, deterministic ranking ties, literal repetition, and distinct questions that share a relevant fact. Reordered copies reproduce a 200 on old base `059e9a3` and return 502 on the candidate with full compensation and no partial output.                                                                                                                                                          | [ALE-68] owns live one- and five-answer quality with reviewed fixtures.                                                                                                                                                                                              |
| AQ-04.1 · Output and provider boundaries   | Passed adjacent word bounds, mixed Unicode at 2,999/3,000 UTF-16 units, and the 3,001 ASCII control. Existing validators cover malformed, missing, extra, duplicate and misbound output, formatting and claim preservation, timeout, and invalid items in a batch. An upstream 429 through the real SDK with a stubbed transport makes one attempt, refunds the exact four-credit reservation and daily slot, releases the attempt lease, and delivers no draft. | **Failed:** the public schema accepted a structured answer containing emoji at 3,001 UTF-16 units. Reproduced separately by adding a mixed 3,001-unit variant of the ASCII boundary fixture with expected rejection. [ALE-70] owns the fix and permanent regression. |
| AQ-05.1 · Popup recovery                   | Passed Tab order and computed focus outline, first/middle/last Copy Answer, exact escaped Markdown in ordered Copy All, Escape and focus return, reload, and clipboard failure with retry at 340px. Both 422s preserve inputs and allow one successful retry with an identical payload. A duplicate click during generation sends one request.                                                                                                                   | [ALE-67] owns question-level guidance. [ALE-68] owns checks on fresh answers in the installed extension, including browser zoom and real screen-reader announcements.                                                                                                |
| AQ-06.1 · Auth and privacy                 | Passed route authentication, expired session and account-switch handling in the packaged worker, response discard, owner-scoped cache, input/report canaries, and disposable PostgreSQL ownership and revision checks. Application output has no auto-fill control in the packaged browser.                                                                                                                                                                      | [ALE-68] owns hosted owner and separate-account verification.                                                                                                                                                                                                        |
| AQ-07.1 · Accounting                       | Successful sizes 1–5 use one quota and one credit reservation and one provider dispatch. Existing service tests check exact compensation for invalid batches, and disposable PostgreSQL exercises unique releases, rollover, and concurrency.                                                                                                                                                                                                                    | [ALE-56] owns hosted metered receipts and abuse-limit evidence, linked from [ALE-68].                                                                                                                                                                                |
| AQ-08.1 · Compatibility                    | Passed legacy defaults, the current 1–5 contract, and outreach API compatibility. One and five questions traverse the Store ZIP worker in submission order, and the UI restores the exact question/body mapping by ID. The packaged suite also covers existing evidence settings and LinkedIn controls.                                                                                                                                                          | [ALE-68] owns the installed candidate and deployed SHA match.                                                                                                                                                                                                        |
| AQ-09.1 · Reliability and performance      | Service tests check one dispatch per accepted batch, timeout compensation, and fail-closed admission.                                                                                                                                                                                                                                                                                                                                                            | [ALE-38] and [ALE-68] own comparable hosted wall times, tokens and provider-attempt receipts.                                                                                                                                                                        |

## Local run results

- Passed on Node 24.16.0: 3,104 web tests, 286 extension tests, 15 guardrails,
  9 popup tests and 26 packaged Chromium tests, both disposable PostgreSQL
  suites, and the fact-review browser checks at 375/900/1440px.
- Passed web and extension types and lint, engineering policy, Next.js
  production build with placeholder settings, local extension builds, and the
  offline grounding preflight. Web lint reported one existing warning in
  `lib/auth/refund-admin.ts`. The extension ZIP reports `1.0.27 @ 9fdddab-dirty`.
- Expected baseline failure: the repeated-claim assertion received HTTP 200
  at `059e9a3`. The current test received 502 and verified compensation and no
  partial output.
- A two-worker Chromium run timed out during the computed focus check. That
  check passed with a single worker on the same source. Use one worker for
  the local browser matrix to reduce contention.
- Product failures: [ALE-72] records an AQ-01.1 popup/API mismatch for questions
  at 10/11 and job descriptions at 80/81 UTF-16 units when those inputs contain
  enough emoji. Generate is enabled in the popup, but canonical and legacy
  requests fail the server minimum. The separate AQ-04.1 Unicode probe
  reproduced [ALE-70].
  Its temporary test copy was removed after the run. The full suite includes
  the ASCII rejection and the adjacent mixed-Unicode acceptance controls.
- Hosted verification remains open. Run the live one-question, five-question,
  and sparse controls on the same identified build and inspect fresh answers
  for exact copy and accessibility. Use two isolated accounts for hosted
  ownership checks and a metered fixture for debit/refund and quota receipts.
  Record wall time, input/output tokens, and provider attempts for each
  successful size. See the owners in the matrix.
- Fresh-context review found the request minimum mismatch and improved the
  sparse-evidence, SDK compensation, and Store ZIP checks. The return review
  verified the revised assertions and reported no remaining material test
  findings. The two product defects stay open in their owning issues.

## Run the local matrix

- Web, service, and API contracts with `npm test -- --run`.
- Extension with `npm --prefix ascendia-extension test`.
- Guardrails with `npm run test:guardrails -- --run`. Grounded-response preflight
  with `npm run gate:grounded-response:offline`.
- Build the extension with `npm --prefix ascendia-extension run build:ext` and
  `npm run build:extension`. Run the intercepted Chromium suites with
  `PLAYWRIGHT_BASE_URL=http://127.0.0.1:45678 npm run test:e2e -- e2e/extension-application.spec.ts e2e/extension-evidence-picker.spec.ts --workers=1`.
- Run admission locally with
  `ALE56_TEST_PG_BIN=/path/to/postgresql/bin npm run test:generation-admission-db`.
  The harness uses a disposable socket-only PostgreSQL cluster.
- Run reviewed evidence checks with
  `FACT_TEST_PG_BIN=/path/to/postgresql/bin npm run test:candidate-fact-review:db`
  and `npm run test:candidate-fact-review:ui`.
- The original reordered-copy receipt was collected on detached `059e9a3`
  with the historical November 14 service test. On the current candidate, run
  `npm test -- --run modules/application-answer/application/generate-yc-application.service.test.ts -t 'never offers the same complete claim set|reviewed selection'`
  to verify the strict tool never offers the same set to distinct questions
  and rejects invalid choices with no partial batch.

[ALE-38]: https://linear.app/aletheia-connection-builder/issue/ALE-38/instrument-and-diagnose-application-answer-generation-latency
[ALE-56]: https://linear.app/aletheia-connection-builder/issue/ALE-56/harden-generation-admission-against-bursts-refunds-and-yc-batch-abuse
[ALE-67]: https://linear.app/aletheia-connection-builder/issue/ALE-67/show-which-application-questions-need-reviewed-evidence
[ALE-68]: https://linear.app/aletheia-connection-builder/issue/ALE-68/verify-question-specific-application-answers-on-the-installed
[ALE-70]: https://linear.app/aletheia-connection-builder/issue/ALE-70/enforce-the-utf-16-limit-in-the-application-answer-response-schema
[ALE-72]: https://linear.app/aletheia-connection-builder/issue/ALE-72/match-application-input-minimum-lengths-between-the-extension-and-api
