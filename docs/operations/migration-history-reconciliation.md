# Production migration history reconciliation

## Current status — October 27, 2026

Production project: `gzmkloodyhngejchomqj` (Aletheia). Repository baseline:
`c91c8fa`. This document restores archived operational knowledge; this branch
changes documentation only, not SQL files, production history or schema.

Read-only production catalog/history verification on October 27 found **19 applied
versions** on PostgreSQL 17.6. The four September/October migrations and June RPC
hardening deployed on October 25 remain recorded. All three October 26 audit
migrations are also recorded:

| Version          | Change                                                 | Deployment record                                                                      |
| ---------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `20260607212225` | Style-counter/rate RPC hardening                       | [October 25](manual-sql-deployment-2026-10-25.md#additional-rpc-alignment-at-1240-edt) |
| `20260904054433` | Resume quarantine and upload perimeter                 | [October 25](manual-sql-deployment-2026-10-25.md)                                      |
| `20260906120000` | Resume cleanup leases                                  | [October 25](manual-sql-deployment-2026-10-25.md)                                      |
| `20260921012453` | Refund review queue                                    | [October 25](manual-sql-deployment-2026-10-25.md)                                      |
| `20261007224520` | Candidate fact-review storage/invalidation             | [October 25](manual-sql-deployment-2026-10-25.md)                                      |
| `20261026025036` | Identified quota reservations and generation admission | [October 26](production-migration-deployment-2026-10-26.md)                            |
| `20261026025105` | Retire obsolete legacy resume context                  | [October 26](production-migration-deployment-2026-10-26.md)                            |
| `20261026025206` | Public-feedback admission limiter                      | [October 26](production-migration-deployment-2026-10-26.md)                            |

**Targeted deployment is complete; historical reconciliation is not.** A broad
repository `db push` remains blocked by older identity mismatches. Do not interpret
an applied version as evidence that every function or application path works.

## Repository versus production identities

The archived October 25 investigation proposed three file renames and recovered a
fourth file. Those SQL-file changes belonged to an unmerged checkout; they are
**not present in current main and are not restored by this documentation branch**.

| Current repository file           | Recorded production identity                               | Required future review                                                                           |
| --------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `20260218001_create_enums.sql`    | `20260218_001_create_enums.sql`                            | Compare full stored SQL before porting the archived rename.                                      |
| `20260521_add_profile_resume.sql` | `20260522043041_add_profile_resume.sql`                    | Compare full stored SQL before porting the archived rename.                                      |
| `20260527_release_rate_limit.sql` | `20260603144546_release_rate_limit_reservation.sql`        | Compare full stored SQL before porting the archived rename.                                      |
| No corresponding current file     | `20260603144626_harden_release_rate_limit_reservation.sql` | Review recovered production SQL and subsequent RPC changes before restoring its historical file. |

The fresh comparison has **four remote-only identities and nine local-only
identities**. Three of those nine are the renamed counterparts above. After
accounting for those pairs, six older local-only versions still need an explicit
schema/history decision:

| Historical local version                    | Remaining decision                                                                                                                                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260218002`–`20260218005` (four versions) | Old table/policy/index scaffolding overlaps existing and subsequently removed objects. Do not replay CREATE statements or resurrect obsolete tables merely to fill history.                                                   |
| `20260510`                                  | Atomic style-increment setup overlaps schema and later hardening. Verify the entire file's effects, not only the existence of two RPCs, before any history decision.                                                          |
| `20260615190912`                            | Resume source-of-truth structures exist without the matching history identity. Compare definitions, backfill effects and later security policies; do not replay its older bucket policies or recreate deleted resume context. |

Production's `20260401` history entry has no stored SQL statements. The repository
retains substantive cleanup SQL for that version. A history fetch alone cannot
reconstruct or certify the full database.

## How the October 26 deployment avoided historical replay

The initial repository-wide dry run failed with `DbPushMissingLocalError`, listing
the four remote-only identities above. No history was repaired to suppress it.

For the separately authorized targeted rollout, the operator fetched existing
remote history into a private temporary staging directory, added only the three
byte-identical reviewed October 26 migrations, and checked that dry run listed
exactly those three files. The scoped `db push --skip-vault` then applied and
recorded only those versions. No seed/custom-role deployment, historical replay,
June resume backfill, filename rename or automatic CD activation was included.

That staging procedure recorded the actual targeted rollout. It is not a reusable
shortcut that approves arbitrary future migrations: fetched history can omit SQL,
and every future upgrade still needs its own source/schema review and bounded
execution plan.

## Historical October 25 validation

The restored investigation used base `80c695d` and the unmerged reconciliation
checkout. Its corrected 22-file chain replayed on a separate local Supabase
PostgreSQL 17 database after an initial container-start failure. It reported 71
migration contracts, seven deployment guards and the fact-review database harness
passing, plus fresh independent review. These are archived results, **not fresh
execution on this branch**, and an empty-database replay did not prove an upgrade
against the existing production schema.

A later production-schema rehearsal and authorized deployment applied four newer
migrations, then June RPC hardening. Those dated outcomes are preserved in the
[October 25 deployment record](manual-sql-deployment-2026-10-25.md). Its references
to 11, 15 and 16 history rows describe successive historical stages, not today's
19-row history.

## Reconciliation work still required

1. Prepare a separate implementation plan for the four remote-only identities and
   nine local-only identities. Match stored SQL and effective schema; document
   cases where later migrations replaced earlier effects.
2. Rehearse both a clean replay and an upgrade from a production-equivalent schema
   with synthetic records. Include later resume policies, fact-review invalidation,
   service-only RPC grants, reservation/refund isolation and preserved records.
3. Review exact SQL identities/content and each proposed history adjustment. A
   history-repair command records a claim; it does not execute or verify SQL.
4. Keep broad `db push`, blanket `--include-all`, history repair and automatic CD
   outside this documentation task. Any eventual write requires explicit scope
   and the relevant engineering-loop validation.

Recovery for this branch is a documentation revert. Preserve actual production
schema/history and financial/audit records; do not drop new tables, restore old
RPC grants or replay obsolete policies as a rollback shortcut.

References: [Supabase migration tracking and repair](https://supabase.com/docs/guides/deployment/database-migrations),
[Supabase migration fetch](https://supabase.com/docs/reference/cli/supabase-migration-fetch).
