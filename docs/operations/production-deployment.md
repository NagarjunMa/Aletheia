# Production database and web deployment

Production releases run through `.github/workflows/production-deploy.yml` on
each push to `main` (or a manual dispatch from `main`). Vercel's Git integration
continues to make preview deployments, but `vercel.json` disables its automatic
`main` deployment. The GitHub workflow is the sole production deploy path.

The order is deliberate: identify the Vercel and Supabase projects, connect to
Supabase, verify migration history, preview pending migrations, apply them,
verify history, build a staged Vercel production deployment, check its health,
then promote it to the production domains. A failed step stops later steps.
After migration, the workflow also checks the Supabase keys pulled from Vercel's
production environment against Auth and a zero-row query of the migrated table.
This catches a broken app database connection without retrieving user data.
It rejects a secret or service-role key in the public browser key setting.

## One-time setup before merging this workflow

1. Create a GitHub Actions environment named `production`. Restrict it to
   `main`; add a required reviewer if desired. Protect `main` so the existing
   pull request CI must pass before merge. Do not put production secrets on PR
   jobs.
2. Add the following to that environment:

   | Name                    | Type     | Source                                                                        |
   | ----------------------- | -------- | ----------------------------------------------------------------------------- |
   | `SUPABASE_ACCESS_TOKEN` | Secret   | A Supabase access token authorized to link the project and inspect migrations |
   | `SUPABASE_DB_PASSWORD`  | Secret   | The production project's database password                                    |
   | `SUPABASE_PROJECT_ID`   | Variable | The production Supabase project reference (20 lowercase letters or digits)    |
   | `VERCEL_TOKEN`          | Secret   | Vercel token able to deploy and promote the existing project                  |
   | `VERCEL_ORG_ID`         | Secret   | Existing Vercel team/account ID                                               |
   | `VERCEL_PROJECT_ID`     | Secret   | Existing Aletheia Vercel project ID                                           |

   The project IDs are also in the local `.vercel/project.json` after linking
   the correct Vercel project. Do not commit that file or any token/password.
   The workflow reads Vercel's production `NEXT_PUBLIC_SUPABASE_URL` and
   requires its project reference to match `SUPABASE_PROJECT_ID` before a
   database write.

3. Reconcile the existing production database with repository migration
   history **before the first automatic run**. This project historically
   allowed Dashboard SQL Editor changes. Check `supabase migration list
--linked` with an appropriately privileged account. For each existing SQL
   migration, verify its schema effect in production before marking its version
   applied. Use Supabase's documented `migration repair` only for versions
   whose SQL was already applied. Never mark a missing schema change applied,
   use `--include-all`, or reset the production database to make history pass.
   The workflow refuses an empty baseline, remote-only entries, or historical
   gaps. The pending `20261007224520_candidate_fact_review.sql` migration
   should appear as a newer local-only version until applied.
4. Ensure the Supabase token has the project privileges required by `link`.
   A previous local read-only attempt returned HTTP 403; the workflow will
   stop at connection validation if that remains true. Run the workflow on
   `main` only after the target and history checks have been reviewed.

`supabase db push` runs without seed data, roles, or Vault updates. It uses
Supabase's migration history to apply each pending SQL file once. The workflow
does not repair drift automatically. The CLI and Vercel CLI versions are pinned
in the workflow; update and test them deliberately.

## Rollout and recovery

- Inspect the Actions `Production deployment` run: its preflight lists pending
  migration versions, and the staged Vercel URL is written to the run summary.
  Verify `/api/health` on the staged deployment before promotion.
- For the October 2026 YC generation failure, verify the production
  `candidate_evidence.fact_review` column exists after migration; the workflow
  checks this without reading user rows. Then make a fresh authenticated
  generation attempt. The health endpoint does not exercise that user-specific
  path.
- If migration application fails, keep the previous web deployment live and
  inspect the database state. A migration may have partially applied; resolve
  it from schema evidence before rerunning. Do not blindly retry or repair
  history.
- If staged build or health fails after migrations succeeded, leave the old
  production deployment live. Correct the code or configuration and rerun the
  workflow. If a promoted web release fails, use Vercel rollback to restore
  the prior web deployment. A Vercel rollback does **not** undo database
  migrations. New migrations must therefore be compatible with the previous
  web version during rollout.

This workflow cannot establish the first production baseline or configure
GitHub/Vercel/Supabase credentials by itself. Those are one-time account tasks.

References: [Supabase migration deployment](https://supabase.com/docs/guides/deployment/managing-environments),
[Supabase CLI `db push`](https://supabase.com/docs/reference/cli/global-flags#supabase-db-push),
[Vercel Git deployment control](https://vercel.com/docs/project-configuration/git-configuration),
[Vercel staged production builds](https://vercel.com/docs/cli/deploying-from-cli).
