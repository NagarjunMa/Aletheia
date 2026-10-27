# Production audit migration deployment — October 26, 2026

## Deployment result

Production project: `gzmkloodyhngejchomqj` (Aletheia). The user explicitly authorized
applying the pending migrations and checking LinkedIn generation. The deployed
application source was `3db3ed2658f24b78b1735c7882f37bb41506fae9`.
The following three reviewed migrations were applied and recorded successfully:

| Version          | Change                                                                                                           | SQL SHA-256                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `20261026025036` | Identified daily reservations; burst, weighted-work and in-flight admission; obsolete service RPC grants revoked | `597615deae5cbd20257523797458e19afa832c05429cbec34ef1e3c41d58604c` |
| `20261026025105` | Clear retired legacy resume fields and enforce `profiles.resume IS NULL`                                         | `420a3268148549c94b55ae876719212a3b53bd1906d679c59bdb1f9badf805a1` |
| `20261026025206` | Bounded public-feedback admission table and service-only RPC                                                     | `d643ebc152c517ce1fdc05ef30ba4d73caedd3c75df3967ae7f1116fb33a364b` |

The source bytes match these files in main `c91c8fa`. Migration history grew from
16 to 19 records. The saved verification receipt was written at
`2026-10-27T00:50:11Z` (October 26, 20:50 EDT); this is the receipt timestamp,
not a measured migration start/commit timestamp.

## Failure and preparation

The production application returned `503 QUOTA_SERVICE_UNAVAILABLE` before any
Claude call. Matching Vercel logs showed successful authentication, context and
style reads, then `RATE_LIMIT_RPC_FAILED`. A read-only API probe returned
`PGRST202`: `reserve_generation_daily_slot` was absent from the schema cache.

Preflight catalog checks found the existing private resume storage structure,
four current resume records, 11 profiles and zero non-null obsolete legacy resume
values. Consequently, the retirement migration did not need to clear any
remaining legacy text on this production project. No resume backfill or
recreation of previously deleted records was performed.

The repository-wide dry run first stopped with `DbPushMissingLocalError` because
four existing production migration identities were absent from the local file
list. It applied no migrations. The operator did not repair history or replay
older setup SQL to suppress the mismatch.

## Targeted execution

1. Fetch the 16 recorded remote migrations into a private staging directory,
   separate from all active worktrees.
2. Add only the three exact, checksum-verified October 26 SQL files.
3. Run the scoped dry run with an explicit production project ref and
   `--skip-vault`; verify it lists exactly these three versions.
4. Apply that reviewed set using scoped `db push --skip-vault --yes`. No seed,
   custom-role, old resume setup or other historical migration was included.
5. Read back migration history, schema and execution permissions, and confirm
   the previously missing function resolves through the database API.

This describes the authorized historical execution, not permission to repeat it
or a generic deployment script. Production history now contains all three
versions; rerunning raw CREATE SQL would not be a valid verification procedure.

## Post-deployment verification

- All three versions appeared in history; all four existing resume records and
  the 11-profile baseline remained after temporary test-account cleanup.
- RLS was enabled on `generation_daily_reservations`,
  `generation_admission_state` and `public_feedback_limits`.
- The four new generation RPCs and `reserve_public_feedback_slot` were executable
  by `service_role`, but not `anon` or `authenticated`.
- The obsolete `check_and_increment_rate_limit` and
  `release_rate_limit_reservation` RPCs were no longer executable by
  `service_role`, `anon` or `authenticated`. Do not restore these grants to make an
  older caller work; it would bypass identified reservation settlement.
- `profiles_legacy_resume_retired` existed. The invalid-UUID read-only probe
  changed from missing-function `PGRST202` to argument-conversion `22P02`, proving
  function discovery without reserving a real user's quota.
- An authenticated synthetic request passed quota reservation and generation
  admission. Claude returned HTTP 200, sanitation passed, and atomic validation
  rejected the output with `CLAIM_REWRITE`, exposed as `502 PARSE_FAILED`.
  The model used 2,722 input / 200 output tokens. Daily-slot release and attempt
  completion succeeded; the temporary account was deleted. This verified the
  repaired quota path, **not a successful final LinkedIn draft**.

The independent [LinkedIn source-selection repair](linkedin-claim-rewrite.md)
subsequently passed real-provider checks through a changed local backend and
merged into main `c91c8fa`. Those local results are not a production post-deploy
functional test.

## Read-only refresh — October 27, 2026

This documentation task re-read production catalogs/history and public health:

- PostgreSQL 17.6; 19 applied records, including the three exact version/name pairs.
- The RLS flags, retirement constraint and role permissions above still hold.
- Health reported project origin `https://gzmkloodyhngejchomqj.supabase.co` and
  deployment SHA `c91c8fafda9c92af32a2727044e02984be3b9e1f`.
- `public.public_feedback_limits` exists; `public.feedback` does not. Admission
  limiting does not create a feedback collection table. The separately reported
  collection contract remains outside this records task.

Health is liveness/configuration metadata, not a database dependency or generation
readiness check. No authenticated request, model call, database write, history
repair or deployment was issued by the documentation task. A Python HTTPS probe
failed due to its local certificate trust configuration; a normal TLS-verified
curl request succeeded. Certificate verification was not disabled.

## Remaining rollout limits and recovery

Historical identity reconciliation remains unresolved; see
[migration-history reconciliation](migration-history-reconciliation.md).
Do not enable automatic database deployment, use blanket `--include-all`, or mark
older versions applied merely because a newer migration succeeded.

Hosted sustained concurrency/cost calibration and a functional generation retest
of the deployed source-selection backend are not established here. The saved
security-advisor result had 37 warnings and none naming the five new functions;
it is historical evidence, not a current security certification or a fresh scan.

Preserve additive schema, identified reservation records and financial/audit data
on rollback. Disable the affected caller or deploy a reviewed forward correction;
do not drop tables, restore obsolete service RPC grants, restore retired resume
text or overwrite production from a schema snapshot. No schema rollback is
needed to revert this documentation-only branch.

## Evidence and documentation change contract

Documentation branch: `docs/production-migration-history-records`, base `c91c8fa`.
Risk: **Significant** for operational guidance; the historical deployments were
Critical. Full evidence is kept in the existing records rather than a parallel
feature specification.

Acceptance: restore both saved October 25 notes; distinguish their unmerged
reconciliation experiments from current main; record the three actual October 26
migrations/hashes and verified permissions; preserve unresolved historical gates;
make no executable/schema/configuration or production changes. Docs and links
must agree with source and the dated read-only catalog evidence.

TDD exception: there is no executable behavior change. Do not add tests asserting
prose. Validate source hashes, local/history identity sets, relative links,
Markdown formatting and relevant existing migration contracts instead. Run a
fresh independent review of the operational claims. Runtime build, browser/load
checks and production upgrade execution are not part of this documentation task.

The original October 25 private schema/bundle/check receipts remain at the paths
listed in the [historical record](manual-sql-deployment-2026-10-25.md). Its first
bundle checksum was reverified during restoration; the detailed old test/review
claims are historical, not rerun here.

October 26 application logs, dry run, apply receipt and catalog checks were copied
from temporary files to durable private storage, together with the October 27
read-only refresh:

`~/.codex/artifacts/aletheia/production-audit-migrations-2026-10-26/`

That directory is mode 0700, files 0600, with checksums. It contains no copied
production user rows or credentials; it is local evidence and is not shipped in
Git. Access permissions are not a claim of encryption. The restored originals
also remain in local recovery branch
`archive/2026-10-27-135731/extension-1-0-19`.

Final check/review receipt for this documentation branch:
`~/.codex/artifacts/aletheia/migration-records-review-2026-10-27/receipt.json`.

### Documentation verification — October 27

Passed: 71 existing migration-contract tests across six files; seven SQL hash
rows against repository source; both archived October 25 executable-bundle
checksums; relative links/heading anchors in all three records; Markdown formatting
and diff whitespace checks. Fresh SELECT-only catalog assertions confirm 19
versions, four remote-only/nine local-only identities, five new service-only
functions, three RLS-enabled admission tables and the retirement constraint.
The scope diff contains Markdown/progress documentation only.

Not run: full runtime tests/build, browser/extension checks, security-advisor
rescan, production migration replay, history repair, load/cost tests and a new
model generation. No executable or SQL changed to justify those runs; they are
not represented as passing or waived for a future implementation/rollout.
Fresh reviewer outcome is recorded in the private receipt named above. The
remaining historical reconciliation is documented, not completed by these notes.
