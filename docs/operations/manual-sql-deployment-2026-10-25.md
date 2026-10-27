# Manual production SQL deployment — 2026-10-25

> Historical deployment record, restored October 27 from the saved worktree.
> Counts, test results and outstanding gates below describe October 25 unless
> explicitly dated. No SQL is being executed by restoring this document.
> For the subsequent three audit migrations and current history/grants, see the
> [October 26 record](production-migration-deployment-2026-10-26.md) and
> [current reconciliation status](migration-history-reconciliation.md).

## Result

The user explicitly authorized validating the intended latest SQL against the
existing production schema and then performing manual deployment using Ponytail.
Risk tier: Critical. All four selected migrations committed successfully on
production project `gzmkloodyhngejchomqj` at 2026-10-25 12:27 EDT (16:27 UTC).
Each version is now recorded as applied. No CD workflow, web deployment, feature
flag, email delivery, or model-provider configuration was changed.

| Version          | Change                                                        | Source SHA-256                                                     |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `20260904054433` | Private resume quarantine and upload reservations/transitions | `b18e0fcce221aa3d7afdb291e7afc749f23278be60f15f72bcafa3b6441211f3` |
| `20260906120000` | Resume quarantine cleanup leases                              | `53544d49c203873985fc29df61a640c6e04a9d051d19174e52af320f44e4bdd3` |
| `20260921012453` | Service-only refund review and receipt storage/RPCs           | `465627516e0b711ae34ac6c91b36781550ea7592bfc57925f206f8717b406ee5` |
| `20261007224520` | Candidate fact-review column, bound and invalidation trigger  | `165397a64d870882ac19d8a578d25bf2c8f95ec7def36fa17605693ce03ddbbe` |

The source SQL files were unchanged. Their content matches the live app's source
commit `6b6bea7f206ddf7e95366339ca55a15e2b72d6df`. The exact deployed bundle SHA-256
is `6c74046aea408564efd4b8ad54ed11c59de49884958662e30fd83bb8ff3b5cf2`.

## Validation before deployment

- Verified the linked project and the live health endpoint's Supabase origin.
- Confirmed the four versions and new objects were absent in production.
- Captured production schema, storage policy/bucket metadata, auth trigger, and
  migration history. No production user rows or secrets were copied.
- Restored that schema and metadata into a separate local Supabase PostgreSQL 17
  project, matching production's PostgreSQL 17 major version. Used synthetic
  users, resumes, and candidate evidence to exercise existing-record upgrades.
- Replayed the exact final transaction from the restored production schema.
  Resume reservation, exact Storage path permission, cross-user denial,
  completion/idempotency, cleanup leases, candidate review invalidation, and
  refund/receipt lifecycle assertions passed. Behavior test transactions were
  rolled back locally.
- 145 resume-security tests and 100 migration/refund tests passed, along with
  the native PostgreSQL fact-review and refund concurrency/idempotency harnesses.
- A fresh-context independent reviewer inspected all four files, callers, the
  production schema and the executable transaction. The final bundle passed
  review, including explicit assertion enablement. Scratch fixture/assertion
  helper errors were corrected before the final complete rehearsal; production
  execution succeeded once without retry.
- Confirmed that the exact live app commit passes a stateless service client to
  legacy multipart Storage uploads. Removing authenticated final-bucket writes
  is compatible with that deployed caller.

## Production execution and verification

The one-off bundle removed only the first three files' outer BEGIN/COMMIT pairs
and wrapped all four original SQL bodies in one REPEATABLE READ transaction with
assertions enabled, a 5-second lock timeout and a 60-second statement timeout.
It checked absent-object/history preconditions and validated new schema, grants,
RLS, RPC search paths, bucket configuration and triggers before commit.

In-database digest guards verified that existing candidate source fields (apart
from the new fact_review field), resume rows and credit ledger rows were unchanged
within the deployment transaction. Guard digests and user rows were not exported.
Existing candidate rows received the intended empty review object.

After successful post-commit schema/security verification, only the four selected
versions were recorded using `supabase migration repair --linked --status applied`.
Production history now has 15 entries; the original 11 remain present. NOTIFY
refreshed the PostgREST schema cache. Health returned 200 and the unauthenticated
resume endpoint returned 401 as expected.

## Remaining limits and recovery

### Additional RPC alignment at 12:40 EDT

The follow-up production-schema comparison confirmed two missing style-count
RPCs and anonymous/authenticated execution of the rate-reservation RPC. The
deployed feedback and generation callers use a separate service-role client.
Manually applied the unchanged existing migration `20260607212225` at 12:40 EDT
(16:40 UTC), then verified and recorded only that additional version. History now
has 16 entries; all 15 prior entries remain. No old table scaffolding, May unique
constraint creation, or June resume-bucket policy setup was replayed.

The migration creates the missing atomic approved/rejected counters and applies
service-only execution with pinned search paths to all four counter/rate RPCs.
Existing preference and quota rows were verified unchanged inside a single
bounded REPEATABLE READ transaction. Post-commit verification and a schema-cache
reload passed. The advisor no longer reports warnings for these four RPCs.

Validation used actual affected production table definitions, constraints,
indexes, triggers and prior RPC definitions with synthetic data on PostgreSQL
17.6. The normal isolated Supabase startup was blocked by Docker disk exhaustion;
a separate socket-only PostgreSQL 17.6 container used a temporary in-memory
filesystem, no network or exposed ports, and no persistent volume. No production
rows were copied or user Docker data pruned. Observed the missing-function failure
before SQL, then passed upgrade/preservation, existing/new-user increments, 20
concurrent increments, rate/release behavior and all eight client-role denial
checks. 49 targeted migration/feedback tests passed; the fresh reviewer also ran
66 targeted migration/feedback/generation tests and approved the exact bundle.

Source SHA-256: `37cdc3a80b2143a4c3e209c29ed20b650e03f6b1fd62af5a330ab90f84d0f974`.
Bundle SHA-256: `5be27636ea3f0b07ca1bc0170272e50fc48a941d9eb6489e0f3384ed52f06c0f`.
Private source snapshot, exact executable bundle, checks and logs:
`/Users/nagarjunmallesh/.codex/artifacts/aletheia/rpc-alignment-2026-10-25-5be27636`.
The temporary test container was removed after verification.

### Outstanding work

Six older local-only migration discrepancies remain open. Broad db push
and automatic CD remain blocked; this targeted deployment does not resolve the
entire historical migration chain. See [reconciliation](migration-history-reconciliation.md).

After RPC alignment the security advisor reports 37 warnings: 35 concern unchanged
legacy database or Auth configuration, and two flag intentionally authenticated-callable
reserve_resume_upload/cancel_resume_upload SECURITY DEFINER functions. Those two
were reviewed for auth.uid checks, ownership predicates, pinned search paths,
and absence of anonymous execution. No security certification is claimed.

The broader application table inventory also found the standalone `/api/feedback`
route refers to absent `public.feedback`, which has no repository migration and
no discovered first-party UI caller. It remains a separate contract/schema issue;
this rollout did not invent or activate a new feedback collection table.

Feature activation and an authenticated hosted browser/extension walkthrough
were not performed. No real generation, credit refund, email or Storage-object
upload was issued in production. The deployment created schema/contracts only;
existing application flags remain configured as before.

Before commit, errors would roll back the entire bundle. After commit, preserve
the additive schema and any future audit/financial data. Recovery should disable
the affected feature or use a reviewed forward correction. Do not blindly restore
the schema dump over a live database or drop tables/columns as a rollback shortcut.
Prior function and Storage policy definitions are retained in the private schema
snapshot for a narrowly reviewed compatibility recovery if needed.

Private evidence, schema-only snapshot, exact bundle, hashes and logs:
`/Users/nagarjunmallesh/.codex/artifacts/aletheia/manual-sql-2026-10-25-6c74046a`.
The existing local ascendia database was preserved; the separate rehearsal
database was stopped and removed after verification.

References: [Supabase migration tracking](https://supabase.com/docs/guides/deployment/database-migrations).
