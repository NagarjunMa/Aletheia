# ALE-38 pre-merge audit

Date: 2026-09-09 America/New_York (2026-09-10 UTC).
Branch: `feat/ale-38-generation-latency`.
Merge base: `631e92cd09398bf4f6e834ed7eae21e09fd42e76`.
Scope: complete tracked diff plus all three new implementation/runbook files;
staged changes were absent. This report and the progress update record the audit.

## Decision

The instrumentation's code-level acceptance criteria pass. No material defect
introduced by this diff was identified, and no runtime correction was needed.
**ALE-38 is not complete and remains In Progress.** Matched deployment samples,
a verified bottleneck and a measurable remediation recommendation are missing.
This is not unconditional merge/release approval: inherited dependency findings
and independent reviewer approval remain unresolved.

Final risk tier: **Critical**, retained for instrumentation at authentication,
billing and private candidate/model-data boundaries. The engineering-loop and
available code-review-security checklist were used. The latter's referenced
`plays/code-review-security.md` and `templates/finding.md` do not exist locally;
the repository guide and available checklist supplied the fallback. This audit
is an explicit second review pass by the implementing assistant, **not** an
independent reviewer or human approval.

## Acceptance coverage

| Requirement                                                      | Evidence / result                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Separate total/model time and comparable stages                  | Collector, route and service tests pass; null means unvisited                                    |
| Grounding load/build, quota, billing, post-processing            | Fake-clock preparation/service tests and reviewed transitions                                    |
| Unchanged responses, quota/refunds and caller ownership          | Full regression suite; public schemas, SQL, auth, provider and billing implementations unchanged |
| Privacy-safe metadata and errors                                 | Runtime allow-list/redactor tests, popup failure test, real local 401 log check                  |
| Matched category latency measurements                            | Not run; zero authenticated live samples                                                         |
| Dominant delay, p50/p95/sample limitation and remediation target | Not established; synthetic clock/collector tests are not provider evidence                       |

## Engineering review

| Dimension                    | Assessment                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness                  | Stage intervals partition elapsed time; repeated stages accumulate; terminal snapshots are idempotent; skipped stages remain null                                                           |
| Architecture                 | Shared request-local collector; optional preparation hooks; no duplicate category-specific timing implementation                                                                            |
| Security / privacy           | Only allow-listed category/stage and numeric metrics; no raw payload, source IDs, credentials or provider errors added; no auth/CORS/permissions changes                                    |
| Reliability / data integrity | Existing quota reservations, compensation and provider timeouts unchanged; no new retries, network requests or persistence                                                                  |
| Concurrency / memory         | Per-request fixed stage/metric records, bounded numbers; no event accumulation or global user state; four repository reads remain parallel                                                  |
| Performance / cost           | One extra server summary per request; previous synthetic collector measurement excludes logger costs and is not a production performance claim; no added model calls                        |
| Compatibility                | Public model-time semantics preserved; extension source version 1.0.14, published/minimum policy unchanged; no migrations                                                                   |
| Client / accessibility       | No markup/style/control changes; timer includes synchronous render, not browser paint/history persistence; controller tests and web smoke pass; full extension browser verification pending |
| Observability                | Summary uses existing request/operation IDs and privacy redactor; firstInvocation explicitly is not a certified platform cold start                                                         |
| Regression / rollback        | Full affected tests pass; revert instrumentation and redeploy, keep existing published extension; no data conversion                                                                        |

Changed-code security findings: Critical 0, High 0, Medium 0, Low 0.
These counts exclude the inherited dependency audit below; they are not a
certification of the entire application or its deployment.

## Checks

The shell initially used Node 26.3.0. Primary test/static/build checks were
rerun using the installed **Node 24.16.0**, matching repository engines.

| Check                                                  | Result                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `npm run test:coverage -- --run`                       | Passed: 74 files, 867 tests; statements 88.26%, branches 81.13%, functions 87.76%, lines 89.67%              |
| `npm run type-check` / `npm run lint`                  | Passed on Node 24                                                                                            |
| `npm run test:guardrails -- --run`                     | Passed: 15 tests                                                                                             |
| `npm run test:resume-security`                         | Passed: 145 tests (CI regression)                                                                            |
| `npm run build`                                        | Passed with placeholder Supabase build configuration                                                         |
| Extension type-check / lint / tests                    | Passed: 18 files, 171 tests                                                                                  |
| Extension `security:audit`                             | Passed: zero vulnerabilities reported                                                                        |
| Extension native `build.mjs`                           | Passed on copied sources in `/tmp/ale38-extension-audit.1X7wge`; original dist/ZIP untouched                 |
| `node scripts/check-extension-version.mjs origin/main` | Passed: 1.0.13 → 1.0.14                                                                                      |
| Playwright `e2e/ui-smoke.spec.ts e2e/health.spec.ts`   | Passed: seven tests against separate local port 3108 with placeholder configuration                          |
| Real local unauthenticated generate POST               | 401; one correlated timing summary, no model/billing durations, no synthetic canary in observed request logs |
| Changed-file formatting / diff whitespace              | Passed                                                                                                       |
| `npm run format:check`                                 | Failed on 25 unchanged baseline files; no changed implementation file among them                             |
| `npm audit --json`                                     | Failed: 13 vulnerable dependency entries — 1 critical, 7 high, 4 moderate, 1 low                             |

Root `package.json` and `package-lock.json` match the merge base. The npm audit
findings are inherited, not introduced by ALE-38. The critical entry is `next`;
dependency remediation and deployment-specific reachability need separate
triage before unconditional release approval. No dependencies were upgraded
or controls weakened to clear the audit.

Harness corrections: the first temporary extension build used relative copy
paths from the temporary directory and failed with missing entries; copying
from explicit workspace paths then running the same native build passed.
No source defect was involved. Existing workspace build artifacts were retained.

## Pending gates and next action

- Developer/reviewer: independent Critical-tier review and dependency triage.
- Developer: approved isolated sampling across YC application, LinkedIn
  connection and cold email, with matched context, model, billing and network
  conditions; record warm/cold/unknown classifications and failures separately.
- Developer: exported deployment privacy verification and client/server timing
  reconciliation; see `generation-latency.md` for exact metric definitions.
- Developer: document supported/rejected/unresolved hypotheses, bottleneck,
  sample-size-aware statistics and a measurable scoped recommendation in Linear.
- No live Supabase/model calls, production mutations, new ZIP, Store publication,
  commits or pushes were performed by this audit.

Rollout remains reviewed instrumentation to an isolated deployment first.
Do not use this audit to mark ALE-38 Done or claim ALE-37's batch budget is proven.
