# ALE-37 development audit — 2026-09-13

## Verdict

**Not complete; not merge-ready.** The contract freeze and executable red-test
checkpoint are present and reproducible. Phase 1 runtime contracts remain
unimplemented; Phase 2 generation and Phase 3 review UI have not started.
Expected TDD failures still fail CI and cannot satisfy feature acceptance.

Audited with the production engineering-loop at **Critical** tier: public API
compatibility, untrusted model output, private application data and credit/quota
compensation. This is an assistant review, not independent reviewer approval.

## Scope and repository evidence

- Read the complete current ALE-37 issue, repository AGENTS/engineering guide,
  engineering-loop and risk/TypeScript references, frozen contract, progress,
  native checks/CI, relevant implementation and all changed test diffs.
- Read the separate question/answer discussion for newer decisions: it explains
  IDs and current evidence selection; it does not authorize a changed contract or
  claim an implementation has been completed.
- Branch: `ale-37/application-batch-contracts`. After fetch, HEAD, origin/main,
  and merge base are all `d6d0cce180e408d727dc2c3c3392f1ba2d526954`.
- No ALE-37 commits or runtime changes exist. The work is four modified test files,
  an untracked contract, and the ALE-37 progress entry. Preserved unrelated
  ALE-38/ALE-52 audit/research documents and earlier progress changes.
- 67 tests were added and two superseded new-UI payload expectations were revised.
  Legacy API/default tests remain intact. No skipped or expected-failure wrappers.

## Acceptance criteria

| Criterion                                                                | Evidence and status                                                                                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| One to five questions produce matching ordered answers                   | Not implemented. Request schema remains one `question`; positive canonical fixtures fail.                             |
| Each answer shows its question and copy control                          | Not implemented. Popup still renders a single body.                                                                   |
| Multi-answer bold headings and copy-all; single-answer compatibility     | Frozen in tests, not implemented. Formatting/order fixtures fail; old body-only behavior remains.                     |
| Private review with answer-only storage/feedback and full batch capacity | Not implemented. Four storage/feedback projection tests fail; API feedback still caps application messages at 10,000. |
| Legacy single-question clients continue working                          | Existing tests pass, including omitted default and 1,000-character boundaries. Must rerun after implementation.       |
| Application Questions labels and accurate ATS positioning                | Not implemented; existing YC UI remains.                                                                              |
| No auto-fill or submission of applications                               | Existing restriction preserved; no content script or permission edits.                                                |
| Single application generation regression                                 | Existing service/route tests pass; no runtime diff.                                                                   |
| Connection/cold email/InMail regression                                  | Existing root and extension tests pass outside the expected ALE-37 failures.                                          |
| Candidate readiness and resume fallback                                  | Existing application/candidate tests pass; no runtime change.                                                         |
| Batch billing, refunds and rate limits                                   | Not implemented or demonstrated for batches; existing single-request tests do not establish batch guarantees.         |
| Every question bounded, escaped and scanned                              | Legacy path preserved. Canonical input/scan path not implemented.                                                     |
| Caller-scoped candidate data through RLS                                 | Repository boundary unchanged; existing mocked tests pass. No live RLS verification performed.                        |
| Any invalid answer fails/refunds the entire batch                        | Not implemented; request-aware output and compensation integration tests remain necessary.                            |
| Sensitive inputs/outputs absent from logs                                | Existing logging boundary unchanged; no batch log-privacy evidence yet.                                               |
| Unit and API/contract tests pass                                         | Fail: eight root tests intentionally red.                                                                             |
| Popup integration tests pass                                             | Fail: 22 extension tests intentionally red.                                                                           |
| Relevant E2E/accessibility                                               | Batch UI absent; not yet verifiable.                                                                                  |
| Guardrails/build/types/lint                                              | Existing application build, guardrails, root/extension types and lint pass. This does not establish batch support.    |

## Material release gaps

1. **Batch request and response support is absent.**
   `app/api/extension/generate/schema.ts:62` still defines the single question;
   the tool repository still returns one body/ledger. New batch fixtures are
   rejected as unknown fields. Implement schemas, question-aware grounding and
   bounded tool output before enabling the new UI.
2. **Ordering tests are not request-aware coverage proof.**
   Existing fixtures specify sequential public IDs and client reordering. The
   server still needs tests against the actual submitted ID set: e.g. requesting
   q1/q2 but receiving only q1 must fail, even though q1 alone looks internally
   valid. A well-formatted combined body cannot repair missing/invalid answers.
3. **Private persistence and downstream feedback capacity are unresolved.**
   `popup.js:1477` stores the supplied output, accepted storage spreads it, and
   feedback sends the top-level body. A future question-bearing response would
   persist those questions. This is a demonstrated batch enablement risk, not
   evidence that today's single-answer production response contains question
   headings. Implement permitted-field projection and the bounded application
   feedback extension before releasing batches.
4. **Whole-batch failure and compensation need implementation evidence.**
   The existing service uses `Promise.allSettled(cleanup)` without inspecting its
   returned results. That alone cannot prove confirmed refunds or reconciliation.
   Test one invalid answer, timeouts/truncation, credit/quota cleanup failures and
   duplicate cleanup, preserving original error and fail-closed behavior.
5. **Five-answer feasibility is unverified.**
   The existing 1,000-output-token ceiling and 30-second SDK per-attempt timeout
   have not been validated for five answers plus ledgers. Establish a bounded
   initial policy during implementation. Regular-usage cohort analysis remains
   follow-up work; no production performance/cost claim is made from mocks.

These are known unfinished feature work, not defects newly introduced into
runtime code by this test-only change. No test-harness defect or contradictory
runtime edit required correction in this audit. Tests were not weakened or made
green by implementing the remaining feature under a verification request.

## Fresh validation

Node 24.16.0. Commands ran with the repository's Node 24 path. Routine tests used
mocked external I/O. Log filenames below are under `/tmp/` and are ephemeral.

| Command                                                | Result                                                                                             | Log                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `npm run test:coverage -- --run`                       | **Failed:** 931 passed, 8 failed; 77 files. Coverage gate not passed; no fresh percentage claimed. | `ale37-audit-coverage.log`         |
| `npm test --prefix ascendia-extension`                 | **Failed:** 176 passed, 22 failed; 19 files.                                                       | `ale37-audit-extension.log`        |
| `npm run lint`                                         | Passed                                                                                             | `ale37-audit-lint.log`             |
| `npm run type-check`                                   | Passed                                                                                             | `ale37-audit-types.log`            |
| `npm run lint --prefix ascendia-extension`             | Passed                                                                                             | `ale37-audit-ext-lint.log`         |
| `npm run type-check --prefix ascendia-extension`       | Passed                                                                                             | `ale37-audit-ext-types.log`        |
| `npm run test:guardrails -- --run`                     | 15 passed                                                                                          | `ale37-audit-guardrails.log`       |
| `npm run test:resume-security`                         | 145 passed                                                                                         | `ale37-audit-resume.log`           |
| `npm run build` with CI placeholder public environment | Passed; existing single-answer runtime builds                                                      | `ale37-audit-build.log`            |
| `npm run security:audit --prefix ascendia-extension`   | Passed; registry reports zero extension dependency vulnerabilities                                 | `ale37-audit-ext-dependencies.log` |
| `npm run check:extension-version -- origin/main`       | Passed; no packaged extension changes                                                              | Tool output                        |
| Changed-file Prettier check and `git diff --check`     | Passed                                                                                             | Tool output                        |

The eight root failures and 22 extension failures match the prior red checkpoint.
They are unsupported-field rejections and behavioral assertion failures, not
import/type/reference errors. Negative schema tests currently rejecting every
batch cannot independently establish correct batch validation; positive fixtures
must pass too. Full root execution found no additional failing tests.

Not run: batch manual/E2E/accessibility (UI absent), extension bundle/ZIP (no
packaged source change), general site smoke (no runtime/site change; unrelated to
missing batch acceptance), live provider/model-quality/load tests, production
log/RLS checks, Store submission, and independent Critical-tier approval. The
composite extension-ci target cannot pass while its unit tests are red; audit,
types, lint and tests were exercised individually. Root dependency advisories
recorded in the earlier ALE-38/ALE-52 audit remain a separate historical triage
item; root dependencies/lockfile are unchanged and were not re-audited here.

## Engineering review and handoff

Correctness/compatibility: the contract checkpoint is reproducible, but public
feature criteria fail. Architecture/readability: tests use established schema and
pure popup boundaries; VM boundary tests follow the repository pattern. Security
and privacy: no new runtime input/permission surface; batch projections and
request-aware validation remain required. Existing provenance validation checks
do not constitute a full semantic proof that every generated claim is supported.
Reliability/data integrity: batching and compensation are unproven. Performance,
memory and cost: local fixtures are bounded; no runtime change or efficiency claim.
Accessibility: planned only, not inspected in a working batch UI. Observability:
unchanged, with live batch evidence pending. No migrations or new dependencies.

Keep ALE-37 **In Progress**. Next development sequence: implement additive
schemas/helpers to green, then server pipeline/compensation and request-aware
tests, then review UI/privacy integration and full final verification. Continue
performance evaluation alongside development, with release limits explicit.

No merge, push, deployment, package or paid call performed. No runtime or test
edits made during this audit; only this report, progress and dated Linear evidence
were updated. Rollback for this checkpoint is removal of ALE-37 test/contract
changes, preserving unrelated notes. Additional explicit Critical review and
passing feature/native checks remain required before release.
