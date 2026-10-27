# LinkedIn claim rewrite repair

## Contract and execution context

2026-10-26. Branch `fix/linkedin-claim-rewrite`, base `3db3ed2`.
Risk: Significant. Backend model contract only; no API, extension, database,
quota, credit, retry, token-budget or SDK changes. Preserve unrelated work.

Production evidence: after the three audit migrations, request
`c0c5871d-20db-4c74-a70c-1d22c815141e` passed authentication, admission,
Claude (HTTP 200, 2,722 input / 200 output tokens) and sanitation, then failed
`CLAIM_REWRITE`. The validator accepts only finite source-owned wording; the
LinkedIn prompt/tool still requests free-form observations and tailored CTAs.
No raw production model content was logged, so its exact rejected wording is
unknown. Do not claim it was a factual hallucination.

The model will select request-local target/candidate source IDs and an existing
approved CTA. Server code resolves complete approved text and constructs the
ledger from trusted source metadata. Keep final source ownership, exact support,
allowed wording, scope, exclusions, coverage, sanitized output, 300-character
limit and complete CTA checks. Legacy structured responses still traverse the
same existing strict checks; unsupported rephrasing remains rejected.

## Evaluations

- Reproduce selection failure before implementation; then resolve selected IDs
  into a note accepted by the unchanged atomic validator and renderer.
- Unknown, wrong-scope, forged-root and unsupported extra fields fail closed.
- Unsupported legacy rephrasing, wrong excerpts, negation/metric changes,
  overlength and post-sanitization factual changes remain rejected.
- Confirm route response has server-calculated count and no private ledger.
- Run affected route/provider/prompt/grounding/sanitizer tests, root coverage,
  guardrails, types, lint and build; obtain fresh independent review.
- Exercise corrected local backend with a real Claude call and synthetic
  context if credentials permit; record blocked checks honestly. No deployment
  is authorized. A passing old production request cannot verify new local code.

Rollback: revert the backend change and redeploy the previous verified build.
The original strict validator remains the authority, never relax it to get 200.
Progress and final evidence will distinguish fixtures, real-provider checks,
local execution and deployed execution.

## Implemented boundaries and evidence

- `modules/outreach/domain/linkedin-grounded-selection.ts` owns the strict choice
  schema and server composition. Unknown IDs, duplicate/mis-scoped IDs, missing
  candidate roots, arbitrary CTA text and model-supplied ledger/prose fail closed.
- Reuse canonical allowed wording/normalization from the grounding domain. Their
  bodies moved unchanged; the validator keeps its original exports and checks.
- The provider receives the request-specific selection tool. The route resolves
  it, sanitizes, renders and performs the original final atomic validation.
- No eligible target returns 422 `INSUFFICIENT_GROUNDING` before quota, credits
  or model admission. Legacy composition remains strict and source-checked.
- Prompt version 4.1.0 removes contradictory prose/CTA examples. Model, SDK,
  600-token output ceiling, retries, timeout, API response and extension remain
  unchanged. More rigid source-owned wording is the intentional existing policy.

Regression-first evidence: production CLAUDE-200/CLAIM_REWRITE observation; initial
selection tests failed because the new resolver did not exist, then passed.
Four old prompt-copy assertions failed for the intentionally changed contract and
were replaced by source-selection/budget checks, not by removing safeguards.
The unsupported paraphrase regression still returns `CLAIM_REWRITE`.

Real-provider checks use the corrected local production build on port 3111,
production Supabase, disposable confirmed accounts and synthetic target data.
These are not a production deployment of this branch or a browser-popup test.

| Case                                    | HTTP | Characters | Input/output tokens | Observed wall time |
| --------------------------------------- | ---- | ---------- | ------------------- | ------------------ |
| Target only, 1.0.20 headers             | 200  | 159        | 1,624 / 83          | 5.253 s            |
| Target only, 1.0.19 headers             | 200  | 159        | 1,624 / 83          | 2.976 s            |
| Reviewed candidate fact, 1.0.20 headers | 200  | 203        | 1,898 / 132         | 4.497 s            |

The reviewed-fact case includes the exact confirmed candidate assertion and passes
final grounding after sanitation. Initial fixture setup tried confirming during
INSERT; the existing database trigger correctly cleared that review, yielding a
valid target-only 200 but failing the test's candidate-inclusion assertion. The
corrected fixture saves first and confirms that saved revision separately. All
four temporary accounts were deleted; no real user's context was changed. No
retry policy, quota or validation was bypassed for these checks. Wall times are
small-sample observations, not performance benchmarks or a reliability guarantee.

Final checks/review receipt: `/tmp/aletheia-claim-rewrite-review-receipt.json`.
Hosted branch CI, production deployment/retest and browser extension operation
remain not run. Existing production still uses the previous backend until merge
and deployment. No commit/push or Linear completion is authorized by this task.

## Native checks before independent review

PASS: 1,319 root tests across 105 files; coverage 89.31% statements / 82.53%
branches / 89.12% functions / 90.71% lines. Type-check, lint (one inherited
unused-status warning), 15 guardrails, production build and changed-file formatting
passed. Root security audit: zero vulnerabilities. Source comparison confirms
canonical wording functions moved verbatim and final validator body is unchanged.
No dependency/extension artifacts or migrations changed. Browser/UI smoke and
extension rebuild were not rerun because those sources/contracts are unchanged;
this branch's generated API shape is tested and real-provider HTTP exercised.
Reviewer verdict and final snapshot belong in the external receipt linked above.
