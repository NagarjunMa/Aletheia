# Production migration history reconciliation

## Scope and release status

2026-10-25, production project `gzmkloodyhngejchomqj`, base commit `80c695d`.
Risk: Critical (production migration identity and privileged SQL). This correction
restores files for real production records. It does not repair production history
or apply production SQL. Automatic database deployment remains blocked.

## Restored production identities

`supabase migration fetch --project-ref gzmkloodyhngejchomqj` recovered the 11
recorded production migrations into an isolated temporary directory. Three local
files contained the recorded SQL under different versions; they now use their
actual production versions. SQL content of those three files is unchanged.

| Previous repository file          | Production version / current file                          |
| --------------------------------- | ---------------------------------------------------------- |
| `20260218001_create_enums.sql`    | `20260218_001_create_enums.sql`                            |
| `20260521_add_profile_resume.sql` | `20260522043041_add_profile_resume.sql`                    |
| `20260527_release_rate_limit.sql` | `20260603144546_release_rate_limit_reservation.sql`        |
| No separate local file            | `20260603144626_harden_release_rate_limit_reservation.sql` |

The fourth file is recovered production SQL: it pins the existing release RPC's
search path, revokes execution from PUBLIC/anon/authenticated, and grants execution
to service_role. It does not create a new RPC. Fetch adds a redundant terminal
semicolon for a stored multi-statement string; the recovered file omits that
redundant semicolon. No production history records were removed or changed.

Historical planning documents retain the former filenames as historical evidence.

## Remaining production blockers

After restoring those identities, production `db push --linked --skip-vault
--dry-run` correctly reports seven local migrations older than its latest applied
version (`20260815180105`). Do **not** follow its generic `--include-all` suggestion.

| Historical local version            | Evidence and remaining decision                                                                                                                                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260218002` through `20260218005` | Old table, policy, and index scaffolding; some tables already exist and others are absent. Replaying CREATE statements against production would conflict or resurrect obsolete tables. Compare final schema, including subsequent cleanup, before choosing a baseline/history strategy. |
| `20260510`                          | Production has the user_id unique index, but the two increment RPCs are absent. This is not fully applied; do not mark the whole file applied.                                                                                                                                          |
| `20260607212225`                    | The release RPC has the separately recorded June 3 hardening, but the rate-limit RPC has no pinned search path and the increment RPCs are absent. The full local hardening migration is not reflected in production.                                                                    |
| `20260615190912`                    | user_resumes, its private bucket, functions, RLS, and policies exist without a matching version. Full definitions, grants, triggers, and backfill effects still require comparison before recording the version.                                                                        |

The four newer versions `20260904054433`, `20260906120000`, `20260921012453`, and
`20261007224520` remain unrecorded. Earlier catalog checks found resume_uploads,
refund_review_cases/events, and candidate_evidence.fact_review absent. Do not
mark these applied without executing and verifying their changes.

The production `20260401` record contains no stored statements. Fetch creates an
empty file for it; the existing substantive repository cleanup SQL was retained.
Fetching history alone therefore cannot reconstruct the full database.

## Validation and recovery

- Production operations: migration-history fetch/list, schema-only dump, catalog
  SELECT queries, and db push dry run only. No user rows were exported.
- Docker was available on October 25. A separate local project
  `aletheia-reconcile-20261025` used ports 55420/55422; the existing local project
  `ascendia` was not reset.
- First local database startup failed with a container exit 125; a second start
  completed and applied all 22 corrected migration files successfully on local
  Supabase PostgreSQL 17, matching production's PostgreSQL 17 major version.
- A successful empty-database replay proves the sequence executes locally. It
  does not prove compatibility with the existing production schema or user data.
- Verification passed: all 71 migration contract tests, seven existing deployment
  guard tests, formatting/diff checks, and the native PostgreSQL fact-review
  harness (owner RLS, cross-user/anonymous denial, invalidation, and payload
  bounds). The three renamed files were byte-compared against HEAD and the
  recovered file was compared with fetched production SQL.
- A fresh-context independent reviewer found no new material finding, reran the
  71 migration contracts, and checked local replay history and all four
  privileged RPCs' search paths and execution grants. Production upgrade and
  history reconciliation remain unresolved release gates.
- Keep the CD branch unmerged until the seven older discrepancies are resolved,
  upgrades are tested from a production-equivalent schema with synthetic data,
  and production dry run lists only reviewed pending changes.
- Repository rollback: revert the file renames and recovered file. No database
  rollback is needed for this repository-only correction.

References: [Supabase migration tracking and repair](https://supabase.com/docs/guides/deployment/database-migrations),
[Supabase migration fetch](https://supabase.com/docs/reference/cli/supabase-migration-fetch).
