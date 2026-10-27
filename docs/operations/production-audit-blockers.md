# Production audit blockers

> Operational update, October 27: the three audit migrations were applied to
> production on October 26. The local pre-deployment evidence below is historical.
> See [the deployment record](production-migration-deployment-2026-10-26.md) for
> current history/grants and the separate LinkedIn validation outcome; see
> [reconciliation](migration-history-reconciliation.md) for unresolved identity drift.

## Execution context

- Scope: user-authorized correction of audit findings M1–M6; not a new feature or permission to deploy.
- Base: `origin/main` at `6b6bea7f206ddf7e95366339ca55a15e2b72d6df`.
- Branch: `fix/production-audit-blockers`, isolated from all existing worktrees.
- Risk: **Critical** (billing credentials, deletion/privacy, privileged migrations, cost admission).
- Documentation mode: full, because the fixes cross database, API, SDK and extension boundaries.
- Next step: finish pre-push timing correction review and record current evidence; hosted release gates remain separate.

## Contract and evaluations

| ID  | Observable acceptance criterion                                                                                                                                                               | Evaluation / wrong implementation rejected                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Both locked dependency trees pass their existing audit thresholds; no audit exclusions or weakened gates.                                                                                     | Fresh installs, root/extension audits, type checks, complete tests, builds. Reject merely changing audit thresholds or overriding vulnerable version labels.                                                                           |
| M2  | After deleting an imported legacy resume, neither context reader can return its deleted text. Other resumes and identities remain intact.                                                     | Delete-then-read regression and isolated SQL migration/ownership checks. Reject clearing all resumes or only hiding the imported row.                                                                                                  |
| M3  | Authenticated ordinary users can load credit information using privileged RPCs, without their browser session replacing the service credential.                                               | Real SDK with synthetic cookies and fake fetch, plus credits route tests. Reject mocked-client-only proof.                                                                                                                             |
| M4  | Every outreach/YC model attempt requires shared atomic burst, weighted-work and one-in-flight admission. Model-reaching failures retain abuse charges while fair daily/credit refunds remain. | Existing ALE-56 contract and reusable implementation; red/green route, repository and disposable PostgreSQL concurrent tests. Reject local-memory enforcement, client weights or unaccounted SDK retries.                              |
| M5  | A daily reservation releases once and only its own window; late/duplicate/wrong-owner releases cannot affect other requests.                                                                  | Disposable PostgreSQL duplicate/rollover/concurrency and service compensation tests. Reject user-ID-only release.                                                                                                                      |
| M6  | Public feedback has a bounded body and shared submission limit before privileged insertion; genuine denials and infrastructure outages are distinct.                                          | Route tests for absent honeypot, repeated submissions, oversized streamed bodies, spoofed identity and limiter outages; isolated SQL permission/concurrency tests. Reject per-instance counters and trusting forwarded client headers. |

## Existing design and scope boundaries

- Preserve bearer/cookie authentication, owner-scoped RLS, existing daily quota and YC batch pricing.
- Reuse the local ALE-56 implementation only after inspecting and integrating it with current atomic-provenance code. Its source worktree remains untouched.
- Reuse the existing cookie-free service client, bounded-body pattern and database-backed counters; do not add Redis or a new service.
- Admission changes necessarily reconcile error/reset information and extension guidance (related audit findings 9–10). Other should-fix work remains separate.
- Keep private bodies, email addresses, resume contents, raw tokens and IP addresses out of logs and admission keys.
- Public feedback limiter: trusted platform IP hashed with a server-only HMAC key; bounded shared window and no model calls. Missing production trust/key configuration fails closed.
- No production migration, provider traffic, deployment, push, or Linear completion is authorized by this request.

## TDD and verification evidence

Baseline audit: 1,260 root tests, 230 extension tests, 15 guardrails, 145 focused resume security tests, builds/type/lint and 28 public-page browser checks passed. Root and extension audits failed. These are historical baseline results, not evidence for the changed snapshot.

Record intended failing regressions and final commands here as work proceeds. Dependency-only edits use native audit/install/type/build checks instead of implementation-mirroring tests.

## Compatibility, rollout and recovery

Apply additive migrations in an isolated database first. Verify role/ownership, reservation rollover and concurrent requests before hosted rollout. Keep existing applied migration history unchanged. Independently deployed extension clients retain existing daily quota/pricing, with explicit 429/503 guidance.

Deploy migrations before callers. Admission thresholds remain the existing ALE-56 provisional policy (one in flight, six starts/10 minutes, 60 weighted units/day); hosted legitimate-traffic/cost calibration remains required. Do not claim that local concurrency proves hosted behavior.

Rollback server/extension callers separately while retaining reconciliation records. Resume deletion is intentionally irreversible; preserve database backups and do not restore deleted personal text as a rollback. Security dependency rollback must not restore known vulnerable versions.

## Findings and completion

M1–M6: implemented; final validation/review in progress. Required fresh Critical review completed in two rounds; final evidence below. Hosted migration/authentication/load checks remain pending unless separately performed with explicit isolated targets. Do not mark any Linear issue Done.

## Implementation notes (2026-10-25 America/New_York)

- M1: Next.js and its lint/analyzer packages 16.4.3; Zod 4.6.7; Vitest/coverage 4.1.12; compatible Vite/fast-uri transitive patches. Audit thresholds unchanged. Adapted safe Zod error forwarding/diagnostics and preserved explicit UTF-16 limits. The shorter diagnostic list on oversized arrays is intentional early rejection, not weaker validation.
- M2: Both context readers stop selecting/falling back to profiles.resume; extension body resume is accepted for old-client shape compatibility but cannot restore deleted data. An additive migration clears obsolete legacy text/timestamp and prevents future writes to that retired field. The earlier source-of-truth migration must already be applied. This intentionally does not recreate any deleted resume; visible user_resumes and identity fields remain intact.
- M3: Credits route uses the existing cookie-free service client after auth. Actual installed Supabase SDK plus synthetic cookies/fake transport verifies RPC authorization; no hosted credentials used.
- M4/M5: Integrated ALE-56 without changing its original worktree, adapting current atomic-provenance/refund tests. New migration uses CLI-generated current version. Daily reservations, admission leases, weighted attempts, service-only permissions, 429/503 and extension 1.0.20 guidance are included. Old unsafe RPC grants are revoked to prevent mixed-version corruption; a server rollback must retain identified reservations or disable generation.
- M6: 24 KiB actual UTF-8 JSON bound, five submissions per trusted-IP subject per ten minutes in PostgreSQL, HMAC-SHA256 subject derived only from Vercel's overwritten x-vercel-forwarded-for. Optional FEEDBACK_RATE_LIMIT_SECRET otherwise uses the server service key with a distinct purpose prefix. Non-Vercel production fails closed; local development uses one shared development subject. No raw address/email/body enters admission storage or logs. IP-based control cannot stop a distributed botnet; existing platform firewall rules remain complementary.

### Regression-first evidence

- Before repair: real-SDK billing test returned 500 rather than 200; retired-resume reader test returned legacy text rather than empty context (2 intended failures). Public-feedback limiter/body cases failed as 200/400 rather than 429/503/413 (3 intended failures). Integrated admission expectations failed on the old server, including missing Retry-After and unsafe settlement; historical fixture failures were resolved without discarding newer atomic-provenance cases.
- After repair: 1,295 root tests pass. Disposable PostgreSQL verifies exact/duplicate/rollover reservations, role isolation, concurrent daily/in-flight control, feedback limit/concurrency and legacy retirement preserving visible resume/identity. Actual hosted auth/RLS/load/cost evidence is still not run.
- Post-upgrade corrections: Zod's changed issue forwarding and UTF-16 behavior exposed test failures; fixed the adapter and retained the prior input contract. Did not lower coverage, audit, quota, or validation thresholds.

### Explicit remaining release gates

Fresh Critical review, clean installation and final full CI-equivalent checks remain pending until recorded below. Apply the three additive migrations in an isolated hosted project; verify a non-developer credits request, all generation categories and 1–5-question YC batches under parallel traffic. Verify the Vercel trusted-IP header and feedback 429/503 behavior. Do not re-enable old quota grants or restore deleted legacy text on rollback. No production migration, push or deployment has run.

## Final local evidence and review ledger

2026-10-25/26 UTC: clean locked installs PASS; root/extension audit zero advisories; coverage PASS (1,295 root tests, 89.31% statements / 82.53% branches / 89.12% functions / 90.71% lines); guardrails 15 PASS; focused resume security 146 PASS; extension CI 232 PASS; type-check PASS; lint PASS with the inherited unused-status warning; production build PASS; extension version policy PASS (1.0.19 → 1.0.20); 53 Chromium smoke tests PASS; fact-review UI PASS at 375/900/1440px. These results cover snapshot 4d0f97ead92ddb079e09668ad597655b5790e462cf12f03510510106bd4dc3fe; affected checks are rerun below after the review correction.

Fresh-context review round 1: reviewer model identity unavailable; independently checked 241 matching source/config files, 220 focused tests and disposable PostgreSQL. One confirmed P2 finding F1: worker error serialization lost reset timing, making the introduced admission messages incomplete. No other material finding reported. Snapshot freshness passed at both ends.

F1 correction: preserve bounded future reset timestamps and integer Retry-After seconds across the actual HTTP/worker/popup boundary; display a human-readable retry interval. Two boundary tests failed for the intended missing metadata before correction, then passed; invalid/nonfinite/excessive values are omitted. Historical diagnostic assertions now retain the upper bound while accepting Zod's safer early rejection of oversized arrays. Scoped round 2 passed with F1 resolved; final affected checks passed.

Release state: implemented and locally verified, not deployed. Hosted migration/RLS/auth/concurrency/load/cost calibration, live Vercel trusted-IP behavior and PR-hosted CI are NOT RUN. Original unrelated checkout remains unchanged. Fresh review passed on the corrected implementation snapshot; hosted release evidence remains separate. No Linear issue has been completed.

### Corrected snapshot and final disposition

Fresh-context round 2 verdict: **no_material_findings**, F1 resolved, snapshot `c5c480b35fc5c5e57a3618d433ab38e5378331a8f8f9e863f187d47a76b53694`. The reviewer independently passed 79 focused extension tests, the updated disposable PostgreSQL suite, and source freshness checks. No recursive reviewer or production call was used. Reviewer model identity unavailable; this is fresh-context automated review, not a human or cross-model approval.

Final affected reruns PASS: 1,295 root tests with coverage above; 240 extension tests with audit/type/lint/build; root audit zero advisories; root type/lint (one unchanged warning); extension version check 1.0.19 → 1.0.20. Database regression includes actual prior hardening migration, revoked obsolete service grants, wrong-owner/duplicate/rollover releases, nonrefundable model work, concurrent admission and feedback limits, legacy field retirement, and preservation of visible resume/identity. Earlier unchanged-runtime build, guardrail, 146 resume security tests, 53 browser smoke tests and fact-review UI results are retained; only extension retry code/tests, dependency exact-spec metadata, SQL verification coverage and documentation changed afterward.

M1–M6 are **implemented and locally verified** with no unresolved material review finding. Risk remains **Critical** because billing, privacy and privileged migrations are affected. This is not production deployment approval. Three new migrations require isolated hosted verification before application to production. Full Supabase migration reset/type generation and Supabase hosted advisors were NOT RUN; the socket-only PostgreSQL harness exercises scoped schema/functions, not a complete hosted Supabase environment. Hosted PR CI, authentication/RLS, trusted Vercel address behavior and load/cost calibration remain NOT RUN.

One final rerun initially failed before executing checks due local disk exhaustion while opening log files. Removed only this task's old scratch build directory, then successfully reran all affected checks. No failure was hidden or treated as a pass.

Unrelated primary checkout status was compared byte-for-byte with its starting status and preserved. Existing ALE-56 source worktree was read/copied, never edited. No commit, push, production mutation or Linear completion occurred. Final evidence-only documentation updates do not change reviewed runtime, tests, schemas, configuration or locked dependencies.

## Pre-push verification — 2026-10-26

The full fresh review initially reported no material findings on snapshot `f49d84d43c1ef9a067dbd35929498021519600d25e86c80dd3e4a584300aab0b`. A targeted timing follow-up superseded that verdict with confirmed F2 (P2): a successful admission response arriving after the three-minute lease expired could authorize an overlapping model call. Actual Supabase SDK regression reproduced two accepted leases, and the installed Anthropic SDK timeout also left a stalled response body unbounded after headers arrived.

F2 correction: admission uses a 10-second abort signal plus monotonic elapsed-time rejection; both model clients use a 30-second end-to-end abort signal and normalize deadline aborts to the existing model-timeout/refund path. Four real-SDK boundary cases failed for the intended timing defects before correction and passed afterward. Outreach-route and YC-service regressions verify stale admission returns 503, no model call, no misleading Retry-After, and once-only credit/daily-slot compensation. Uncertain admission retains the database recovery lease and consumed abuse budget; it is never treated as a proven limit or successful generation. Final scoped re-review and affected checks are recorded below when finished.

### Pre-push final disposition

2026-10-26: final scoped reviewer verdict **no_material_findings; F2 resolved** on snapshot `d5c7d89fd38cb07c74c3fcf2ccf26dcbc2bd0ce96d95246ad7865f037370ddd5`. The fresh-context reviewer independently passed 221 tests across seven affected files and reran 21 credit-route tests after a test-only TypeScript correction. Model identity unavailable; no recursive delegation, production traffic or source mutation. This supersedes the earlier timing finding and provisional clean verdict.

Affected reruns PASS: 1,301 root tests across 104 files with unchanged measured coverage (89.31% statements, 82.53% branches, 89.12% functions, 90.71% lines); type-check; guardrails 15; lint with one inherited unused-status warning; production build; changed-file formatting; 53 Chromium smoke tests against the rebuilt local production server. Earlier checks in this same verification remain applicable because their inputs did not change: extension CI 240, root/extension audit zero vulnerabilities, disposable PostgreSQL concurrency/role/privacy checks, focused resume 146, extension version policy and fact-review UI at 375/900/1440px. No repeat clean install was needed for the timing correction: installed locked trees were unchanged; prior clean-install evidence is retained.

Checks that failed during this verification are explicit: four intended timing regression failures before repair; one TypeScript error in the new test's unchecked array access, corrected using optional access without weakening the assertion and rerun successfully. No failed gate is represented as a pass.

**Local pre-push audit passed. Risk tier remains Critical.** Hosted CI, isolated hosted migration/auth/RLS/concurrency, actual provider cancellation/cost behavior, live Vercel trusted address behavior, full Supabase reset/type generation and hosted advisors remain NOT RUN. The scoped disposable PostgreSQL harness is not equivalent to a hosted Supabase rollout. Apply and verify the three migrations in isolation before production rollout; use the documented forward-safe rollback without restoring obsolete quota grants or legacy resume text. No commit, push, deployment, production migration or Linear completion is included in this verification.

Final documentation-only evidence append follows reviewed source; runtime/test/schema/config/lock files are compared with the reviewed packet before handoff. Remote main still matches the verified base; original unrelated primary checkout status is unchanged.

### Hosted CI runner compatibility — 2026-10-26

CI run 40268728162 passed lint/types, root coverage/guardrails/resume contracts and extension security/build. Smoke job failed before executing browser checks: `ubuntu-latest` resolved to Ubuntu 26.04, unsupported by locked Playwright 1.57.0. Pin only the two Chromium-installing workflows to `ubuntu-24.04`, which the installed SDK's browser registry and native dependency map support. No package upgrade or test removal. Scope risk Standard (CI environment only); product changes retain their existing Critical classification. Hosted rerun remains the authoritative Linux installation check; local macOS cannot verify apt installation. Rollback would restore the incompatible floating label, so upgrade Playwright with verified OS support before moving runner versions.
