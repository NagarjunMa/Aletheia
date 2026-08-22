# Credit billing migration runbook

Use this runbook to deploy the credit wallet and YC application billing category without applying unrelated migration-history drift.

## Migrations

Apply these files in order:

1. `20260618164022_credit_based_billing.sql`
2. `20260815180105_add_yc_application_billing_category.sql`

Both files are transaction-wrapped and bound lock waits to 5 seconds and statement execution to 60 seconds. The base migration creates the wallet, immutable ledger, owner-only read policies, indexes, trigger, and service-role-only RPCs. The delta adds `yc_application` to the ledger constraint and reservation allowlist.

## Preconditions

- Confirm `supabase/.temp/project-ref` is the intended project.
- Confirm the configured Supabase URL belongs to the same project without printing its key.
- Run `supabase migration list --linked`.
- Confirm `public.profiles`, roles `anon`, `authenticated`, and `service_role`, and `gen_random_uuid()` exist.
- Confirm whether the billing tables/functions and these two history versions already exist.

Do not run `supabase db push` while unrelated local/remote migration versions are divergent. Apply only the required SQL files:

```bash
supabase db query --linked \
  --file supabase/migrations/20260618164022_credit_based_billing.sql

supabase db query --linked \
  --file supabase/migrations/20260815180105_add_yc_application_billing_category.sql
```

## Required verification

Before recording history, verify all of the following against the linked database:

- both tables exist and have RLS enabled;
- only two authenticated owner `SELECT` policies exist;
- `anon` has no table access and `authenticated` has `SELECT` but no write privileges;
- all five billing RPCs are `SECURITY DEFINER`, use `search_path = public, pg_temp`, are unavailable to `PUBLIC`, `anon`, and `authenticated`, and are executable by `service_role`;
- the updated-at trigger and four ledger indexes are enabled;
- the validated ledger category constraint and reservation RPC both include `yc_application`;
- a rollback-only transaction passes trial, YC reservation, refund, and purchase idempotency assertions;
- the rollback leaves account and ledger row counts unchanged.

When targeted SQL was applied directly and all verification passed, record only those versions:

```bash
supabase migration repair --linked --status applied \
  20260618164022 20260815180105 --yes

supabase migration list --linked
```

Do not mark a version as applied before its schema and behavior have been verified.

## Failure and rollback

- Before history repair: correct the migration and reapply it only when its operations are idempotent and the affected tables are still empty.
- After launch data exists: do not drop the wallet or ledger. Ship a new forward-only corrective migration.
- If the transaction hits a lock or statement timeout, investigate the blocking query and retry during a quiet window; do not raise the timeout without review.
- Keep unrelated historical migration reconciliation in a separate issue and deployment window.

## 2026-08-22 production application

Linked project `gzmkloodyhngejchomqj` received both migrations in order. Before application, the billing tables, RPCs, and both history entries were absent. After application, catalog/security checks and a rollback-only lifecycle smoke test passed, both billing tables remained empty, and migration history showed both versions locally and remotely.

The linked full-schema lint still reports pre-existing functions that reference missing style/security tables. Those findings are unrelated to the new billing objects and must be reconciled separately.
