# Resume upload production gate

This runbook is the Phase 5 release gate for ALE-43. Run it only against the
dedicated non-production Aletheia deployment, Supabase project, and two test
accounts. Never use production users or real resumes.

## Architecture and ownership

The authenticated browser reserves an owner-scoped path, then sends file bytes
directly to the private `resume-quarantine` Supabase bucket. Vercel receives
metadata-only reservation and finalization requests. The server downloads the
quarantined object, validates it, moves accepted bytes to the private
`user-resumes` bucket, and atomically creates the ready database row.

Only the service role can read, move, or delete quarantine objects and execute
lifecycle RPCs. Authenticated users can insert only at an exact live reservation
path, cannot read quarantine, and cannot write the final bucket. Generation
reads parsed text only from ready rows.

State transitions are:

```text
reserved -> uploaded -> validating -> ready
                                  \-> rejected
                                  \-> failed -> validating
reserved/uploaded/failed -> canceled or expired
```

Stable client failures are defined in `lib/resumes/contracts.ts`. Raw parser,
database, and Storage errors never cross the API boundary.

## Required protected environment

Create a GitHub environment named `resume-production-gate` with approval
required. Point it at a non-production deployment built with
`NEXT_PUBLIC_RESUME_DIRECT_UPLOAD_ENABLED=true` and the matching isolated
Supabase project.

Configure these protected environment variables:

- `RESUME_GATE_BASE_URL`
- `RESUME_GATE_PRODUCTION_BASE_URL` — the current production application origin

Configure these protected secrets:

- `RESUME_GATE_SUPABASE_URL`
- `RESUME_GATE_PRODUCTION_SUPABASE_URL` — the current production Supabase origin
- `RESUME_GATE_SUPABASE_ANON_KEY`
- `RESUME_GATE_SUPABASE_SERVICE_ROLE_KEY`
- `RESUME_GATE_USER_A_EMAIL` and `RESUME_GATE_USER_A_PASSWORD`
- `RESUME_GATE_USER_B_EMAIL` and `RESUME_GATE_USER_B_PASSWORD`
- `RESUME_GATE_CRON_SECRET`
- `RESUME_GATE_VERCEL_AUTOMATION_BYPASS_SECRET` — required only when the
  isolated Vercel deployment has Deployment Protection enabled; generate it
  under **Project Settings → Deployment Protection → Protection Bypass for
  Automation** and copy it into the GitHub environment secret

The workflow sets `RESUME_GATE_CONFIRM_ISOLATED_PROJECT=yes` and supplies
`RESUME_GATE_EXPECTED_COMMIT_SHA` from the selected workflow commit. Its parser
requires HTTPS, rejects the configured production application and Supabase
origins, the known production hostname, and identical test accounts. Before
authentication or mutation, `/api/health` must report both the exact configured
isolated Supabase origin and the selected commit SHA. Browser traffic
must use the exact configured isolated Supabase origin. The service-role key is
used only by the Node test process to discover, verify, and remove artifacts
carrying the unique run marker; it is never passed to the browser.

The Vercel bypass value is sent as the `x-vercel-protection-bypass` header only
to the configured application origin. Before browser login, the gate exchanges
that header for Vercel's scoped bypass cookie through Playwright's
browser-context request client; subsequent browser requests are left unchanged.
The secret is not added to direct Supabase requests, URLs, logs, or Playwright
artifacts. Keep Vercel Deployment Protection enabled and rotate or remove the
bypass after the gate if it is no longer needed.

## Automated gate

After checking both protected production-origin comparison values, manually
dispatch **Resume Production Gate** and enter `yes` in its isolation confirmation
field. It must prove:

1. A 1 MiB and a near-5 MiB UTF-8 TXT fixture upload directly to Supabase and
   become ready without a Vercel 413.
2. Vercel reservation/finalization requests contain metadata only.
3. A second user cannot view the reservation, read quarantine, or write the
   final bucket.
4. A binary TXT is rejected with a stable code and its quarantine object is
   removed.
5. An expired reservation is claimed by the secret-protected cleanup endpoint,
   its object is removed, and cleanup completion is recorded.
6. Test-created objects are removed before their database references. If Storage
   cleanup fails, the gate fails and preserves the rows so a later cleanup can
   rediscover and retry them.

The Playwright report records validation durations and response outcomes for the
1 MiB and near-5 MiB fixtures. GitHub artifact upload is allow-listed to those
timing JSON files; never upload the complete `test-results` directory because
Playwright failure context can include values from form controls. The workflow
does not use or mutate production data.

## Observability and log privacy

The isolated run must emit `stage.complete` events for:

- `resume_upload.reservation`
- `resume_upload.acknowledgement`
- `resume_upload.validation`
- `resume_upload.promotion`
- `resume_upload.rejection`
- `resume_upload.cleanup`

Events may contain safe IDs/codes, counts, statuses, and durations. They must not
contain resume bytes, extracted text, original file names, Storage paths,
content hashes, credentials, or raw provider/parser errors.

Use synthetic canary strings in the test fixtures, export the matching Vercel
JSON logs, and run:

```bash
RESUME_GATE_LOG_CANARIES='ALE43PRIVATECONTENTCANARY,ALE43PRIVATEFILENAMECANARY' \
  npm run audit:resume-logs -- /absolute/path/to/vercel-log-export.ndjson
```

The audit is bounded to 20 MiB/50,000 lines. It fails if a canary is present, a
forbidden structured content/file/path/hash field is present, or any required
lifecycle stage is absent. Record only its safe summary—never the canary values
or raw log export—in Linear.

## Cleanup and retention

Vercel invokes `/api/internal/resumes/cleanup` daily at 03:17 UTC. Each run is
bounded to five batches of 100 and reports `saturated`. Failed leases become
claimable after 15 minutes. Rejected, canceled, expired, or residual quarantine
objects are processed by this best-effort daily cleanup job. This is the accepted
operating target for Vercel Hobby, not a strict 24-hour deletion guarantee.

Vercel Hobby scheduling can be delayed by up to 59 minutes, and a failed or
saturated daily run can extend retention into a later run. Before rollout,
confirm one run clears the test backlog and inspect `saturated`. Escalate to a
more frequent scheduler only if observed backlog or failures make the accepted
daily best-effort policy operationally inadequate.

## Rollout checklist

- Apply the Phase 1 and Phase 4 migrations to the isolated project, then run a
  clean migration reset/type-generation check.
- Verify bucket privacy, RLS policies, RPC grants, and `CRON_SECRET`.
- Deploy the candidate with direct upload enabled only in the isolated gate.
- Pass focused resume security CI and the protected production-like workflow.
- Pass the exported-log audit and record validation durations and cleanup
  capacity.
- Apply and verify migrations in production while the production flag remains
  false.
- Enable direct upload and redeploy only after the evidence is approved.
- Observe stable outcome codes, latency, cleanup counts, and saturation; do not
  inspect or record document data.
- Remove the temporary multipart rollback transport in a separate follow-up
  only after the observation window succeeds.

## Rollback

Set `NEXT_PUBLIC_RESUME_DIRECT_UPLOAD_ENABLED=false` and redeploy. This restores
the authenticated multipart path while the temporary compatibility route
exists. Stop new reservations and allow in-flight validations to finish or
expire. Leave additive migrations in place; do not reverse them while rows or
objects exist. Pause the cleanup Cron only if cleanup itself is implicated.

## Incident response

For cross-user access, credential exposure, unexpected final-bucket writes, or
document data in logs: disable direct uploads immediately, rotate affected
secrets, preserve only non-sensitive identifiers needed for investigation,
restrict log access, and follow the account/data incident process.

For validation errors, rising latency, cleanup failure, or saturation: keep or
restore the flag to false, inspect stable error codes and counts, retry cleanup
after the lease, and escalate scheduler capacity before re-enabling.

Public/team sharing, inline preview, and third-party download remain prohibited.
An approved AV/CDR provider, privacy/retention review, threat-model update, and
new release gate are mandatory before any of those capabilities are introduced.
