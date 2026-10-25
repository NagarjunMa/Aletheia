# Production database migrations and web deployment

Vercel's existing GitHub integration builds each merge to `main`. The GitHub
Actions workflow `.github/workflows/production-deploy.yml` independently
connects to the production Supabase project, detects pending migrations, then
applies and verifies them. **Vercel must require the GitHub check named
`Supabase migration gate` as a production Deployment Check.** Vercel can build
while migrations run, but the check holds the new build off the production
domains until the database job succeeds. No Vercel token or project ID is
needed in GitHub Actions.

The workflow validates the project reference and credentials, checks the live
app's public `/api/health` response against that project reference, links to
Supabase, checks migration history, previews pending SQL with `db push
--dry-run`, applies pending migrations with `db push`, and verifies history and
the `candidate_evidence.fact_review` column. With no pending migrations,
`db push` reports the database up to date and the check can pass. A failed
step leaves the Vercel deployment unpromoted when the Deployment Check is
configured.

## One-time setup before merging this workflow

1. In GitHub, create an Actions environment named `production` and restrict it
   to `main`. Add these values to that environment:

   | Name                    | Type     | Source                                                                 |
   | ----------------------- | -------- | ---------------------------------------------------------------------- |
   | `SUPABASE_ACCESS_TOKEN` | Secret   | Scoped Supabase access token authorized for the production project     |
   | `SUPABASE_DB_PASSWORD`  | Secret   | Production project's database password                                 |
   | `SUPABASE_PROJECT_ID`   | Variable | Production project ref from `supabase.com/dashboard/project/<project>` |

   `supabase link` needs the token to read Project Settings, API Keys, and API
   Key Secrets. Database migrations use the database password. The existing
   Vercel production environment retains `NEXT_PUBLIC_SUPABASE_URL`, the
   browser-safe public key, and the server-only Supabase secret/service-role
   key. The service-role key is **not** a replacement for the CLI access token
   or database password; do not copy it into `NEXT_PUBLIC_` settings. Before
   enabling the workflow and after changing Vercel's Supabase settings, check
   that the live `/api/health` `supabaseOrigin` is
   `https://<SUPABASE_PROJECT_ID>.supabase.co`. The workflow repeats this
   check before every migration and fails closed if the endpoint is unavailable
   or reports a different project. This public check does not validate the
   server-only key's scope; verify that key in Vercel settings separately.

2. In the existing Vercel project, confirm the Git repository is connected
   and production automatic aliasing is enabled. Go to **Project Settings →
   Deployment Checks → Add Checks → GitHub** and require the unique check
   `Supabase migration gate` for production. Verify that Vercel shows the
   check as required before merging. Without it, Vercel can publish a build
   before the GitHub migration job finishes.

3. Reconcile the existing production database with repository migration
   history **before the first automatic run**. This project historically
   allowed Dashboard SQL Editor changes. See the current
   [reconciliation evidence and blockers](migration-history-reconciliation.md).
   Run `supabase migration list
--linked` with an appropriately privileged account. For each existing
   SQL migration, verify its schema effect in production before marking its
   version applied. Use Supabase's documented `migration repair` only for
   versions whose SQL was already applied. Never mark a missing schema change
   applied, use `--include-all`, or reset the production database to make
   history pass. The workflow refuses an empty baseline, remote-only entries,
   or historical gaps. The pending
   `20261007224520_candidate_fact_review.sql` migration should appear as a
   newer local-only version until applied.

4. Ensure the Supabase token has the project privileges required by `link`.
   A previous local read-only attempt returned HTTP 403. The job will stop at
   connection validation if that remains true.

## Rollout and recovery

- On every merge to `main`, inspect the GitHub Actions `Production database
migrations` run. The check lists pending migration versions, then verifies
  that none remain. Vercel automatically publishes its build only after the
  required GitHub Deployment Check passes.
- For the October 2026 YC generation failure, the workflow checks that the
  production `candidate_evidence.fact_review` column exists without reading
  user rows. Then make a fresh authenticated generation attempt; the schema
  check does not exercise that user-specific path.
- If migration application fails, inspect the database state before rerunning.
  A migration may have partially applied. Do not blindly retry or repair
  history. The previous web deployment stays live while the check is failed.
- If migrations succeed but the new web build fails, the prior web deployment
  remains live against the new schema. New migrations must therefore remain
  compatible with the prior web version. A Vercel rollback does **not** undo
  database migrations.
- If the live health endpoint is unavailable, the migration gate stops before
  touching the database. Restore or verify the production app and its Supabase
  target before rerunning; do not bypass the gate simply to publish.

The production Deployment Check and initial migration-history reconciliation
are account-level setup tasks. They cannot be completed by repository code.

References: [Supabase environment deployment](https://supabase.com/docs/guides/deployment/managing-environments),
[Supabase API tokens](https://supabase.com/docs/guides/platform/personal-access-tokens),
[Vercel Deployment Checks](https://vercel.com/docs/deployment-checks).
