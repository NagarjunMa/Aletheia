# ALE-79 — Actionable LinkedIn grounding warnings

## 1. Execution context

2026-11-22. Issue ALE-79; branch `fix/ale-79-grounding-warnings`, based on
main `a44a22d`. Full documentation: Significant risk across API, worker and popup.
Implemented and independently reviewed locally. Commit and branch push authorized
2026-11-22; merge, deployment and publication remain separate actions.

## 2. Problem

Expected preflight failures conflate missing context, unrelated reviewed facts
and complete facts that exceed the selected note budget. Old drafts remain visible
after inputs change or a new attempt fails.

## 3. Goal

Give a specific recovery action without HTTP prefixes in known grounding warnings,
retain inputs, and keep previous drafts out of the current result area.

## 4. Scope and non-goals

LinkedIn preflight diagnostics, bounded worker projection, existing warning panel,
draft invalidation and regression coverage. No ranking/grounding relaxation,
provider retry, schema, permission, billing or account ownership change. No fix for
the separately known incomplete profile preview. VoiceOver remains deferred.

## 5. Location map

- `modules/outreach/application/build-outreach-grounding-context.ts`: existing
  current-review/relevance/complete-composition eligibility; derive safe reasons.
- `modules/outreach/domain/linkedin-grounded-selection.ts`: existing error and
  canonical 200/300-character complete-fact budget; actionable public recovery.
- `modules/outreach/application/extension-generate.service.ts`: additive 422 field.
- `ascendia-extension/background/generation-core.js`: strict transport projection.
- `ascendia-extension/popup/popup-core.js`: safe warning presentation and legacy fallback.
- `ascendia-extension/popup/popup.js`, HTML: warning focus, context revision and output.
- Route/unit tests and `e2e/extension-evidence-picker.spec.ts`: mocked real-boundary checks.

## 6. Invariants

Only current confirmed facts can support claims. Qualifications stay intact.
Relevance, exclusions, injection guards, final validation, quota, credits, provider
attempts and ownership remain authoritative. No source excerpts in new diagnostics.

## 7. Risk

Significant: inaccurate warnings can misdirect review and async responses can
misrepresent an earlier draft as current. Require fresh independent review.

## 8. Design

Derive a bounded recovery reason alongside existing preparation, after relevance
and safety checks. A length reason requires the canonical complete-note fit check;
an unrelated long fact must never become a length diagnosis. Keep existing safety
reasons ahead of these normal gaps. Add a safe optional response field; older
clients still receive the public message and existing codes. Validate the new field
at worker and popup boundaries. Unknown failures keep existing error treatment.
Reuse the warning surface, with a cause-specific title and keyboard focus. Hide old
output on context edits and new attempts; a revision check rejects late output.

## 9. Sequence

Write failing HTTP, serialization and packaged UI tests. Implement at existing
boundaries. Verify negative/malformed/legacy cases and existing application skipping.
Run repository checks and independent review, then record remaining hosted gates.

## 10. Security and privacy

No new external I/O or dependencies. Guidance contains enums and the 200/300 limit
only. Existing diagnostics preserve status/code/correlation and redaction. Do not
persist recovery excerpts or automatically confirm facts.

## 11. Acceptance matrix

| Criterion            | Check                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| Missing context      | Sparse target without eligible facts gives a concrete next action              |
| Unrelated facts      | Complete museum JD asks for matching reviewed work, not an absent JD           |
| Limit                | Same complete reviewed fact succeeds at 300; 200 denies before admission/model |
| Stale output         | Edits and failed retries hide old draft; late auto response cannot restore it  |
| Recovery             | JD, purpose, story and note limit remain selected                              |
| Diagnostics          | Safe guidance only; unknown/503/provider errors remain visible                 |
| Compatibility/access | Legacy fallback, focus, keyboard link; hosted VoiceOver deferred               |

## 12. Verification

TDD required. Use Node 24 and matching locked dependencies. Mock all external I/O.
Focused route/worker/popup tests, packaged Chromium, full coverage, guardrails,
lint/type/policy, extension checks/version/packaging and production build.
Passed: 3,392 root tests / 155 files with coverage (91.17% statements,
85.84% branches, 91.82% functions, 92.22% lines), 15 guardrails, 389 extension
unit tests, root/extension lint and types, policy, version guard, packaged build,
production build and eight web/health browser checks. Root lint retains one
inherited unused-argument warning in `lib/auth/refund-admin.ts`. Root audit has
12 inherited moderate advisories and no high/critical findings; extension audit
has zero vulnerabilities. No dependencies changed.

The two extension browser files exercise 58 cases. An initial stable run passed
57/58; the old limit-change expectation still expected the old draft to remain.
Its corrected hidden/empty-output assertion passed in an affected rerun. The full
58-case run after review corrections is `/tmp/ale79-browser-review.log`.
New cases cover all recovery reasons, legacy/503 handling, preserved safety
messages, keyboard focus/link, JD/limit/intent/category/focus/story changes and
late automatic responses. The existing worker/YC function-isolation harness now
supplies the new revision/invalidation dependencies; its behavioral assertions
remain unchanged. The unreviewed fixture uses the canonical optional review type,
not an invalid null/deletion on an inferred required property.
No hosted requests made.

## 13. Rollout and rollback

Backend addition is optional for old clients. Extension 1.0.36 understands it;
new client handles legacy responses. Merge, deployment and hosted acceptance need
a later authorized step. Roll back by reverting code and rebuilding; no data repair.

## 14. Evidence and findings

Red evidence: four HTTP failures for absent distinctions, one worker projection
failure, two popup presentation failures, and a built-Chromium failure showing old
output after a JD edit. The 300-character complete-fact control already passed.
Green HTTP checks cover all three causes, unrelated long facts, stale/unreviewed/
unconfirmed facts, the Premium control, privacy and zero admission/provider work.
Safe backend diagnostic codes remain unchanged; worker status/code/request ID
remain preserved. New guidance projects only a known reason and the 200/300 limit.

Local setup failures were corrected without changing runtime requirements: the
Next build needs dependencies inside its worktree, and packaged browser tests need
the ZIP built after the unpacked build. A browser run overlapped dependency copy
and was discarded. The stable rerun and current receipts are outside source in
`/tmp/ale79-*.log`; independent review packet/report are `/tmp/ale79-review-1.json`
and `/tmp/ale79-review-report-1.md`. The corrected return-review packet is
`/tmp/ale79-review-3.json` and report `/tmp/ale79-review-report-2.md`.
Keep ALE-79 In Progress.

Round-1 findings (fresh-context, independently reproduced):

- ALE79-R1, medium/material/introduced: raw target overlength overrode the semantic
  no-match reason. Removed that override. Both 200/300 long museum/profile cases
  now retain `no_matching_evidence`; only a relevant eligible complete reviewed
  fact failing the canonical fit creates `note_limit`. An overlong raw target
  without usable reviewed work asks for usable context and retains its safe
  diagnostic code. Existing target fit and generation limits are unchanged.
- ALE79-R2, medium/material/introduced: legacy generic recovery hid public safety
  guidance. Absent/invalid new guidance now retains canonical public error text
  after removing the transport prefix, followed by useful generic recovery.
  Injection/contradiction/exclusion worker→popup regressions pass; the real built
  UI case includes safety guidance. Unknown failures remain ordinary errors.

Both fixes have red reproductions in `/tmp/ale79-review-red-api.log` and
`/tmp/ale79-review-red-client.log`, with passing full root/extension suites in
`/tmp/ale79-coverage-review.log` and `/tmp/ale79-extension-review.log`.
Return review resolved ALE79-R1 and ALE79-R2 with no remaining material findings
on source snapshot `69b8d68ce6b2ce92d5bfee2b148ba843f1899cf9e9ab4b93a6ebdb265e64e23c`.
The reviewer independently passed full root coverage, extension tests, guardrails,
types, lint, policy and the original cross-boundary reproducers. The final browser
run passed 57/58 cases; the remaining worker-startup timeout passed its unchanged
isolated retry. The production build passed an unchanged retry after Next emitted
its inherited security advisory. No security setting or dependency was bypassed.
The dated ALE-79 Linear verification comment retains these results and review
resolutions; the historical `/tmp` receipts may no longer be available.

## 15. Handoff

Next: push the reviewed branch and open a PR into main, then verify remote CI
and deployed acceptance. The completed local review and results are recorded in
Linear. Runtime extension version is 1.0.36; unpacked files are in
`ascendia-extension/dist`.
Do not publish or deploy as an implementation side effect. Hosted real-account
acceptance, remote CI and VoiceOver remain separate pending/deferred evidence.
Lesson: compute recovery diagnostics after canonical review/relevance eligibility;
raw length or an HTTP 422 alone cannot identify a note-budget failure.
