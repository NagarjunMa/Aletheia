# ALE-75 dashboard backend

## Contract

ALE-75 supplies the data for ALE-76. It does not change dashboard presentation.
Use `GET /api/dashboard/metrics?days=30` with the existing web session.
The optional period is 1–90 calendar days including today, in UTC.
The response is private and uncached. Unknown query parameters are rejected.

- `period` gives the UTC boundaries and day count.
- `coverage` gives the deployment's recording start and the retained-data boundary.
  Capture is explicitly `best_effort`. Earlier history is unavailable.
- `activity` gives recorded requests, successful/failed requests, outputs,
  provider attempts, success percentage, all four categories and daily buckets.
- `reviews` gives approvals, rejections, approval percentage and bounded reason
  counts. A percentage is null when its denominator is zero.
- `quota` gives current rolling-window use, the canonical server limit, remaining
  slots and reset instant. Reset is null when no current window exists.
- `profile` gives canonical readiness, percentage, milestone booleans, the next
  milestone and a fixed application-profile action.

The exported `DashboardMetrics` type is in
`modules/dashboard/domain/dashboard-metrics.ts`. Frontend imports should use
`import type`. Credits continue through `GET /api/billing/credits`, which already
supports finite balances and unlimited developer access.

## Counting rules

One authenticated, schema-valid HTTP generation invocation is one request.
Each invocation gets a server-owned generation ID. Persisting that ID twice is
idempotent. A separately submitted retry is another request. SDK transport
retries belong to that request and increment provider attempts, not outputs.
An application batch produces one request and 1–5 outputs on success.
Failed requests produce zero outputs, including refunded failures.

Unauthenticated/invalid request bodies are omitted. Grounding and admission
rejections after schema validation are included with zero provider attempts.
An unavailable SDK transport observer yields null attempts, not a guessed zero.
Totals with any unknown provider counts also report null and the unknown count.

Activity does not depend on credit billing, saved drafts or user feedback.
Review statistics use feedback within the same period, deduplicated by generation
ID where available. Legacy unidentified rows remain separate reviews.
Only existing bounded rejection categories are exposed; missing or unknown
historical reasons become `unspecified`. Private comments are never interpreted.

## Storage and privacy

The migration adds a content-free activity table and a singleton recording-start
record. No source text, question, answer, prompt, draft body, or credential is
accepted by the recorder. Account deletion cascades to activity.

Only the service role writes activity. Authenticated users may call the aggregate
RPC, which takes no user-ID parameter and filters every user table by `auth.uid()`.
Its fixed search path and UTC setting prevent caller-dependent name/time behavior.
It is SECURITY DEFINER because quota and activity rows are service-only.
Direct client access to the new tables and cleanup function is revoked.

Recording has a 750 ms wall-clock limit and a transport abort. Failures emit only
`DASHBOARD_ACTIVITY_WRITE_FAILED` and preserve the generation result.
This deadline bounds added response work; hosted latency remains unmeasured.
Best-effort capture can miss outcomes during outages or process interruption.
The aggregate contract makes that limitation explicit and never backfills
generation volume from credits or feedback.

## Retention and operations

Records older than 90 days are excluded from reads. The existing protected quality
cleanup route now deletes up to 1,000 old activity rows per invocation, alongside
the existing feedback cleanup. Its response includes `activity.removed` and
`activity.saturated`. When saturated, invoke the authorized cleanup again until
the backlog drains. Configure/retain the existing cron secret and daily schedule.
Physical deletion may lag the read-retention boundary under a backlog.

## Verification and rollout

Risk is Critical because this adds a migration, privileged writes and a definer
RPC. Use production-engineering-loop and Ponytail. Preserve ALE-28 work.

The failing persistence regressions were observed before implementation.
Local tests cover one/five answers, provider retries, failed generations,
bounded/outage-safe recording, owner verification, periods, stale facts and
canonical non-default quota limits. The disposable PostgreSQL harness applies
the actual migration and checks aggregate JSON with the TypeScript schema,
duplicates, two users, RPC/table grants, UTC, expiry and deletion.

```sh
DASHBOARD_TEST_PG_BIN=/path/to/postgresql/bin npm run test:dashboard:db
```

The harness uses a temporary socket-only cluster and never reads a hosted
connection or .env file. CI runs it using `pg_config --bindir`.
Local verification on 2026-11-18 passed 3,277 web tests with coverage, 15 guardrail
tests, the PostgreSQL harness, policy checks, type checking, lint and the production
build. Lint retains one existing unused-variable warning. The high-severity audit
passes, with 12 existing moderate advisories including Next.js; dependencies are
unchanged. The build initially failed for local disk space, then compiled but
stopped at Next.js's advisory notice; the unchanged confirmation run exited zero.
Fresh review evidence is recorded outside source in `/tmp/ale75-review-1.json`
and its accompanying reviewer report, when available.
Full Supabase replay and generated-type comparison require a working local
Supabase/Docker stack. The new SQL columns/functions are represented in the
checked-in database types and root TypeScript checks.

Apply the migration before the instrumented backend and ALE-76 frontend.
Verify hosted cookie authentication and two-account aggregates after deployment.
Check successful outreach and one/five-question YC counts, unlimited accounts,
provider attempts and cleanup. ALE-75 stays In Progress until applicable gates
pass. No production migration or model call is authorized by this local test run.

Roll back the backend code first. The additive tables and recording-start record
can remain while rollback is evaluated. Avoid dropping live activity or rewriting
billing/admission history as a rollback.
