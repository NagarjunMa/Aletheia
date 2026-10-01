# LinkedIn connection output-validation repair

Follow-up: [ALE-57 shared output budget](ale-57-linkedin-output-budget.md)
addresses separate per-section allocation failures. The evidence below is
historical for the model-declared count repair, not ALE-57 readiness evidence.

## Change contract

Risk tier: **Significant**. This changes the Claude tool-output contract, but not
the extension request or response API. The server is authoritative for the
rendered note's `character_count` and 300-character limit. A stale or absent
model-declared count must not reject an otherwise valid note. The model tool
schema and prompt must no longer request that count. Only the obsolete
`character_count` key is tolerated in legacy tool input; other unexpected
fields, malformed sections, missing CTA, unsupported candidate claims, and
overlength output continue to fail with 502 and credit/rate-limit compensation.

This is backend-only: no extension package, SDK upgrade, migration, or retry
policy change. The Anthropic and extension boundaries remain independently
deployed; old clients receive the same response shape, with a server-calculated
count. Model output and profile context must never enter validation logs.

## Evaluation and evidence

The observed production failures on 2026-09-27 included two valid-length notes
whose declared counts differed from server counts (254/245 and 239/231). A
third tool-input failure had no field-level diagnostic. Synthetic tests first
reproduced the count-mismatch 502, then established acceptance with wrong,
missing, and legacy counts. Focused tests also cover strict rejection of other
fields, component limits, grounding, CTA, malformed input, safe diagnostics,
and refund behavior. The existing API response still reports `body.length`.

Local validation on 2026-09-27 (Node 24.16.0): the five focused files passed
180 tests before the exact-length fixtures were added; the full coverage suite
then passed 1,098 tests in 91 files, with 88.78% statements / 81.96% branches /
88.8% functions / 90.17% lines. Guardrails passed 15/15; resume-security
passed 145/145. Type-check, production build with CI placeholder variables,
root dependency audit (zero findings), and extension audit/type-check/lint/
tests/build (230 tests; no extension source changes) passed. Root lint passed
with one existing warning in `lib/auth/refund-admin.ts`. The final exact-length
fixtures passed; changed-file formatting and the extension version policy
passed. The CI-equivalent Chromium landing smoke suite passed 4/4 against
this worktree's production build. A fresh-context read-only reviewer found no
material in-scope defect and independently passed all five focused files
(182/182 tests). The reviewer confirmed the implementation/test file hashes
matched the captured snapshot; model identity was not reported, so this is
not claimed as cross-model review. Local tests do not establish live Claude
behavior or deployment success; hosted PR CI is unavailable until a PR exists.

## Rollout and rollback

Deploy the backend through the usual PR path, then compare LinkedIn validation
codes, 502 frequency, latency, and refunds against the prior prompt version.
The previously unclassified malformed field may recur; the new diagnostics
expose only known field names and Zod validation codes. If valid output or
privacy regresses, revert the backend commit and redeploy. No extension
release or data migration is required.
