# ALE-51 — privacy-safe feedback and voice readiness

## Execution context / change contract — 2026-11-02

Full documentation mode. Risk: Critical — private evaluation metadata,
authenticated persistence, idempotent feedback and personalization counters.
Apply the Supabase skill alongside engineering-loop/Ponytail for existing storage
and RLS inspection; no production connection is permitted.
Base: merged ALE-49 main `78438aa`; branch `feat/ale-51-private-quality-feedback`.
Do not mark this issue or ALE-45 complete during implementation. Preserve the
unrelated primary checkout. No production migration, deployment, paid provider
call or planning-flag enablement is authorized. Initial step: red privacy,
readiness and compatibility tests, then wire metadata and persistence.

## Scope and invariants

- A server-random generation UUID for every category, independent of caller IDs,
  content hashes, source identifiers or plan references. Batches remain one
  generation/outcome; different per-answer archetypes become `mixed`.
- Fixed minimal quality fields: schema version, coarse archetype enum (including
  `legacy`/`mixed`), used-source count/kinds, grounding outcome and finalization
  fingerprint count. Timing/tokens/model/category/version use existing metadata.
  No `rp1.*` reference, option ID, exact source/claim ID, excerpt, URL, identity,
  source/model text, request/response body or raw provider error in new telemetry.
- Final-output validation remains authoritative. Metadata is derived after it;
  failures emit content-free operational events, not successful quality claims.
  Keep one model call, caps, timeouts, admission and refunds unchanged.
- Optional bounded quality reasons, preserving old payloads and existing YC user
  issue reports. Raw outreach message is transient input to the existing private
  style analyzer, never telemetry persistence. Existing explicit YC free-text
  user reports remain private legacy feedback, not automatically captured drafts.
- Threshold is **three approvals** across repository loading, prompts, settings,
  tests and documentation. These are heuristic preferences, not a full voice
  model or reinforcement training. Grounding always overrides style.

## Storage decision (no migration)

Reuse `user_feedback.metadata` JSONB; do not add another evaluation table or
migration. The random generation UUID can also be the existing receipt primary
key. Concurrent identified inserts use that existing atomic uniqueness boundary;
first outcome wins. An exact retry returns success/duplicate; a conflicting later
outcome returns 409. Duplicate lookup is always owner-scoped. Requests without a
generation ID remain legacy/unidentified, cannot promise idempotence, and must
not be counted as verified unique cohort observations. Existing rows are untouched.

Use a user-scoped Bearer client for new receipt reads/writes and the existing
ownership RLS; no new service-role user-data bypass or SECURITY DEFINER function.
Private style analysis runs only after a newly persisted receipt, using existing
canonical JS analysis/merge and atomic counter RPC. Persistence failure returns
503 without learning. Duplicate receipts never retrigger style processing. The
existing background style update remains eventual/best effort: worker failure
can lose that contribution, but cannot falsely claim additional approved evidence.
Do not add an outbox or speculative transaction framework in this phase.

Feedback metadata echoed by clients is **client-reported/unverified**, not an
attestation of server execution, billing authority, causal evidence or permission
to enable features. Strict schemas/projectors prevent text-bearing extras. Store
only selected safe fields; preserve old-client compatibility explicitly, including
safe existing `grounding` and `hasCandidateRelevance` fields the current server
already returns. Server stdout supplies the separate content-free generation
observation keyed by random UUID. No new remote telemetry transport.

New quality-v1 feedback has a 90-day retention window. Bounded daily cleanup on
the existing Vercel Hobby plan; saturation/failure can extend retention and must
be monitored (best effort, not a strict deletion deadline). Keep existing general
or historical feedback outside this narrowly scoped cleanup. Idempotency is
bounded by that retention period. Account deletion continues existing cascade.
No generation-time database write; at most one receipt row per identified
feedback plus its optional preference update. No raw message in RPC parameters
or telemetry rows; private aggregate style data remains in `user_preferences`.

## Cohort and consent policy

Only users currently opted into `share_analytics` may enter cross-user quality
reports; default/null is out. Withdrawal excludes prior records from reports.
Explicit user feedback can still support private personalization without analytics
consent. Query only allowlisted metadata columns and current consent, never
private text. Exclude legacy/unidentified or malformed records.

No per-archetype conclusion before at least 200 distinct generation outcomes,
30 distinct opted-in users per compared cohort, and a 14-day observation window.
Cap any one user's contribution for exploratory comparisons. Report uncertainty,
response/selection bias and denominators; this is observational feedback, not an
unbiased experiment. A five-answer batch contributes one outcome, not five.
Phase 6 owns power analysis, protected checks, human judgment and rollout; no
automatic promotion or rewriting from these aggregates.

## Affected ownership and checks

Shared pure quality/schema projection and style readiness; outreach/YC generation
services; strict feedback schemas and owner-bound existing-PK persistence; optional
extension reason/metadata projection and package version; existing settings
readiness copy; bounded cleanup and a metadata-only query/runbook. No new SQL
schema, function or generated database type change is needed.

Acceptance checks selected before implementation:

1. Synthetic canaries in arbitrary text-bearing metadata reject; only known enum,
   bounded count and UUID fields survive logging/public feedback projection.
2. All categories have random current IDs and no source-derived plan identifier;
   single/batch success/failure preserve finalizer/refund/admission behavior.
3. Old payloads parse; safe current server metadata round-trips. Duplicate and
   conflicting identified feedback do not increase style counts twice; failed
   writes never learn. Actor/row ownership and existing unique insertion tested in isolated SQL.
4. Readiness at counts 0/1/2 is false, 3+ true only with a valid aggregate; sparse
   settings do not advertise an active learned voice. Prompt escaping retained.
5. Retention/consent/idempotency bounds and maximum payload/write volume calculated.
   Existing schema/RLS contracts plus isolated local PostgreSQL test; no production SQL.
6. Focused tests; full coverage; guardrails; lint/types/policy/build; extension CI,
   version/packaging checks; privacy/redaction audit; fresh independent review.

No performance/cost improvement claim without measurements. Planned metadata
budget <=2 KiB/event and <=4 KiB/feedback record (excluding the separately
user-authored legacy issue comment); verify serialized worst-case enums/counts.
Example: 30 generations/user/day produces zero new DB rows until explicit
feedback. At 30 identified feedback events/day, 90 days and 4 KiB maximum,
metadata payload upper bound is about 10.6 MiB/user before indexes/row overhead.
Logs keep deployment-provider retention; no new permanent generation corpus.

## Compatibility / rollout / rollback

The existing primary key and owner RLS are prerequisites for identified receipts;
a storage failure is retryable feedback failure, never silent loss or weaker
deduplication. No migration is required.
No generation admission depends on telemetry infrastructure. New fields/reasons
are additive; legacy clients remain supported. Extension packaged changes require
manifest/package/lock version bump and an independently reviewed Store release.
Planning remains off. Rollback application changes; retain bounded cleanup for already recorded
metadata. Do not drop evidence or undo production data.

## Documentation basis

Supabase CLI 2.119.0 inspected with `--help`; no CLI upgrade required. Official
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and
[function privilege](https://supabase.com/docs/guides/database/functions) guidance
checked 2026-11-02. Changelog index fetched read-only; no relevant breaking change
was identified for the existing owner-predicate/SECURITY INVOKER RPC pattern.

## Implementation evidence — 2026-11-03 (in progress)

- New code reuses the existing receipt UUID primary key and canonical owner RLS.
  No new table, migration, RPC or index. Authenticated insert/read uses the
  verified Bearer JWT; privileged cleanup authenticates before client creation.
- Receipt writes and duplicate lookups share a 10-second deadline. Cleanup has
  at most five read/delete pairs of 100 rows, each with a two-second timeout,
  daily at 03:37 UTC. Delete predicates repeat IDs, age and quality-v1 marker.
  Partial deletion is retry-safe; an empty subsequent run is successful.
- Red regressions: count 1/2 activated style; private extras/IDs in metadata;
  thrown receipt failure; missing cold-email public quality and current feedback
  round-trip; telemetry exception replaced a successful generation. All corrected
  using shared readiness, projection, owner persistence and existing best-effort
  measurement logger. Initial fixtures with missing test imports were corrected
  before claiming meaningful red evidence.
- Extension **1.0.21** (baseline 1.0.20): optional rejection reasons and explicit
  quality projection for private YC cache/feedback. No permission, host, model
  budget, retry or production flag changes. Old server/client fields remain
  accepted; current cold-email `identityIncluded` and grounding metadata also
  round-trip. New metadata-only feedback intentionally does not analyze prose.
- `QUALITY_TEST_PG_BIN=/opt/homebrew/opt/postgresql@14/bin npm run
test:quality-feedback:db` passes in a new socket-only disposable cluster.
  Loads canonical feedback DDL/owner policy; tests simultaneous inserts,
  cross-user/anonymous denial, reassignment denial, consent withdrawal, ten-row
  user cap, 200-outcome/30-user/14-day cohort floor, and private-column exclusion.
  PostgreSQL 14 is local evidence, not hosted Supabase PostgreSQL 17/JWT proof.
- New size test measures worst-case projected receipt <4 KiB and quality event
  <2 KiB, before ordinary provider log framing. Zero extra generation DB writes
  or model calls. Identified new feedback: one insert; duplicates: failed insert
  plus one owner read; style: existing preference read and counter RPC/fallback.
  Cleanup: at most ten bounded queries/day (up to 500 removed rows). At 2 KiB per
  event and 30 generations/day, stdout quality payload is <=60 KiB/user/day
  before provider framing; 30 receipts/day at4 KiB for90days is <=10.55MiB/user
  plus database/index overhead. These are example volumes, not an admission cap
  on arbitrary feedback; client reports can be fabricated and are unverified.
- Query/report access is an operator action; run `docs/evals/quality-feedback-cohorts.sql`
  read-only. It returns only aggregate category/version/model/archetype/counts,
  never user IDs, generation IDs, comments or private style. Unique receipts do
  not attest that a model actually ran. Analytics withdrawal changes membership
  immediately; private personalization may continue on explicit approval.

## Release checks and recovery

Check fresh review/native receipts before publishing. CI, hosted two-user JWT/RLS
checks, scheduled deletion/backlog observation, human/domain approval and Store
publication are separate pending gates. No paid/provider call is needed to
validate this metadata-only change. ALE-50 still owns real quality outcomes,
protected rollout and planning activation.

After deployment, test new insert, identical retry and conflicting retry with two
authorized test accounts; verify owner-only visibility and no repeated preference
increments. Observe `generation.quality`, `feedback.quality` and `quality.cleanup`
through the existing logger. Export content-free logs and check canaries, exact
source IDs, plan references and private fields are absent. Never export real drafts
for this audit. Confirm 03:37 daily Cron is authorized and reports saturation;
inspect total/backlog size before increasing batch size or adding an index.
Existing metadata has no new index; large historical tables can exceed the read
budget. Measure with read-only EXPLAIN before an independently reviewed index
migration if necessary. Rollback reverts application/extension changes and keeps
cleanup for already tagged quality-v1 records; metadata is additive and existing
old rows are unaffected. Never enable planning as a consequence of this phase.

Historical check logs and final independent-review receipts are retained outside
source under `.codex/artifacts/aletheia/ale51-quality-feedback-2026-11-03/` (ignored).
Keep ALE-51 and ALE-45 In Progress; do not claim production readiness from mocks.

## Review resolution and current local checks — 2026-11-03

Fresh-context independent review R1 covered all 555 captured files, read the full
tracked/new diff and affected callers, and reproduced 291 focused tests,
243 extension tests, 15 guardrails and isolated SQL. Exact reviewer model is
unknown; no cross-model assurance is claimed.

**ALE51-R1-001**, confirmed/introduced/P2: the exploratory SQL query counted
partial or malformed quality objects. Its old fixture reproduced 400 invalid
outcomes from 40 users meeting the floor. A red test against that old query
confirmed the gap. The corrected query checks complete v1 object keys, actual
JSON booleans/numbers, bounded integer counts and known array kinds, with safe
array handling. SQL fixtures now carry all mandatory fields; seven malformed
controls are excluded, alongside consent and sampling checks. No telemetry
attestation or automated rollout was added. Return review of this correction is
pending; do not treat the original review as a passing review.

Self-review also preserved Reset style for partial/invalid aggregates (activation
still needs three approvals), and avoids advertising learned preferences when a
stored aggregate is invalid. Privacy copy's effective date matches this update.

Passed: 1,849 native tests/131 files and configured coverage
(90.32% statements,84.47% branches,91.06% functions,91.50% lines), 15 guardrails,
root lint/types, script lint, policy installation, dummy-environment production
build, 53 Chromium smoke checks, extension audit/types/lint/243 tests/build,
version policy 1.0.20→1.0.21 and ZIP construction. These checks cover the
runtime change; the subsequent SQL correction reruns the disposable SQL test
and relevant script/static checks, and the settings correction reruns browser,
root types/lint/build and smoke evidence before final review.

The browser diagnostic runs the real Settings component/CSS with mocked local
identity/preferences at 0/1/2/3 approvals on360/1280px and the real popup reason
markup at400px; external requests are blocked. It is UI evidence, not hosted auth.
Passed root high-severity audit gate; 20 inherited moderate ESLint-tree advisories
remain, and root lint retains one inherited unused-argument warning in
`lib/auth/refund-admin.ts`. No dependency changes are introduced here.

Failed (historical, corrected): deliberate red regressions, initial two stale
extension-version expectations, malformed-cohort reproduction, and an initial
browser diagnostic fixture/import error. No failed check is silently counted as
passed. Not run: hosted CI, production/Supabase JWT/RLS, deployed Cron/backlog,
Store review/publication, provider evaluation and qualified human/domain review.
Provider calls were intentionally not run for metadata-only changes; ALE-50 owns
the rollout decision. The issue remains In Progress regardless of local results.
