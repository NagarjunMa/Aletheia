# Generation performance evaluation — ALE-52

Use this workflow to evaluate normal generation traffic, identify where observed
time is spent, and decide which optimization deserves a separate change. The
implementation issue is [ALE-52](https://linear.app/aletheia-connection-builder/issue/ALE-52/build-generation-performance-evaluation-and-local-reports), related to ALE-38.

## Capture and run

1. Export existing Pino stdout events for `POST /api/extension/generate` over a
   UTC window. Include request start/complete, generation timing, provider attempt
   and candidate query events with their existing correlation fields. Do not
   enable request/response payload logging. Export from every instance serving
   the window; do not filter to successes or selected slow requests.
2. Optionally export the extension's local diagnostic **event array**, including
   generation start/complete/finished, API attempts and auth stages. Its session
   buffer holds at most 80 events and expires after one hour; export promptly.
   Closing a popup or worker suspension can leave missing terminal events.
   This workflow never uploads extension diagnostics or generates paid requests.
3. Put exports in an ignored local directory such as `perf-results/input/`.
   Create a JSON manifest next to them:

   ```json
   {
     "start": "2026-09-10T12:00:00Z",
     "end": "2026-09-10T13:00:00Z",
     "environment": "production",
     "deployment": "a425dfbe4e5384ffef0cdd476f7ba8892f496f30",
     "clientVersion": "1.0.15",
     "complete": false,
     "server": ["server.jsonl"],
     "client": ["extension.json"]
   }
   ```

   The dates/version above are examples, not a claim that this release is live.
   Use actual source metadata. `environment` accepts `test`, `development`,
   `preview`, or `production`. Deployment/client version are optional; omit them
   for mixed/unknown exports unless every unlabelled event shares that version.
   Event-level versions take precedence. `client` may be omitted. `complete`
   is an operator assertion about capture coverage, not something the analyzer
   can prove. Keep it false for sampled, filtered, truncated or uncertain exports.

4. From the repository root, using Node 24:

   ```sh
   npm run eval:generation -- --manifest perf-results/input/manifest.json --out perf-results/review-001
   ```

   Open `report.html` locally. `aggregate.json` contains statistics and cohorts,
   without request sample rows. Output files must not already exist. Files are
   created with owner-only permissions, and the HTML has no scripts or remote
   assets. It can be inspected without a server or network connection.

Supported input forms: Pino JSON objects, JSONL, arrays of events, and platform
wrappers with serialized JSON in `message`/`msg` or a `logs` array. Local extension
exports must contain the array, not the enclosing Chrome storage object. Unknown
formats are counted as ignored/malformed; never interpret an empty result as zero
latency. Source paths resolve relative to the manifest. Limits: 64 KiB manifest,
20 MiB combined exports, 100,000 decoded records, four nested wrapper/array levels,
100 source files per surface, 128 displayed cohorts and 1,000 sanitized sample
rows. Global statistics include all valid summaries, including omitted cohorts.

## Measurement dictionary

| Measurement                                                                 | Boundary and meaning                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generation.complete`                                                       | Popup handler entry through synchronous result display, including local preparation and background/auth/HTTP work. Failures have their own outcome. This is not a browser paint metric.                                                       |
| `generation.finished`                                                       | Same entry through spinner reset after local storage/usage bookkeeping. Can fail after a result was displayed successfully.                                                                                                                   |
| `generation.timing.durationMs`                                              | Server generation handler work through response construction. Does not include client transport, proxy work before dispatch, or response delivery.                                                                                            |
| `stages`                                                                    | Sequential partition of server wall time: auth/dispatch, grounding load/build, style, rate limit, billing, context hydration, input build, model, postprocessing, refund. `null` means unvisited.                                             |
| Public `processingTime` / `generationTimeMs`                                | Existing semantics preserved: awaited SDK call including retries and response processing.                                                                                                                                                     |
| `provider.attempt`                                                          | Per-request SDK `fetchWithTimeout` entry through headers/error, including timer/signal setup. Ordinal includes SDK retries; `gapMs` is the observed interval since the previous attempt ended, including retry response handling and backoff. |
| `candidate.query`                                                           | Each existing context/evidence/primary/legacy query, measured inside the existing parallel group. These overlap and are nested within grounding load. Never add them to server stages.                                                        |
| Local `api.request.complete`                                                | Each extension HTTP attempt through response JSON consumption/error. Attempt ordinal resets when auth recovery starts another HTTP loop. Request IDs distinguish server requests.                                                             |
| Local auth/workflow stages                                                  | Existing auth readiness/recovery and background generation-workflow durations, correlated by operation ID.                                                                                                                                    |
| `inputUnits` / `outputUnits`                                                | Provider-reported tokens for the returned response. Failed attempts with absent usage remain unknown; these are not total billed usage across unseen retries.                                                                                 |
| `cacheReadUnits` / `cacheWriteUnits`                                        | Provider-reported cache token counts, only when supplied. Missing is unknown, not a cache miss.                                                                                                                                               |
| `temperature`, `maxOutputUnits`, `stopReason`                               | Actual configured temperature/output ceiling and returned stop reason. The ceiling is not actual output size.                                                                                                                                 |
| `inputChars`                                                                | Constructed system plus user text length, excluding SDK/tool-schema serialization overhead.                                                                                                                                                   |
| `targetChars`, `contextChars`, `sourceChars`, `sourceCount`, `exampleCount` | Numeric sizes/counts of target, hydrated job context, selected candidate sources and accepted examples. Never their contents.                                                                                                                 |
| `resultChars`, `claimCount`, `ledgerChars`                                  | Final result size, parsed/validated claim count where applicable; ledger characters measure YC claim text, excluding source-ID serialization.                                                                                                 |
| `config` and versions                                                       | Category, supported intent/mode, billing mode, model, template, deployment SHA and extension version. Missing/unsupported values remain unknown.                                                                                              |

No streaming is introduced, so time to first generated token and true decoding
tokens/second are **not measured**. Do not divide output tokens by total SDK time
and label that decoding speed. `firstInvocation` is not evidence of platform cold
start. Provider internal queue/prefill/GPU time, database execution vs network,
proxy delay and exact client transport time require separate platform evidence.

## Interpret the report

Retry-gap statistics include only attempts with ordinal greater than one. New
first-attempt records omit `gapMs`; legacy first-attempt zeros are ignored. A real
zero wait on a subsequent attempt is still measured. Fetch durations include both
headers and errors; inspect `providerOutcomes`, `providerStatuses` and
`providerFailureCodes` before interpreting their distribution.

Provider and query measurements remain visible when the request's terminal
summary is missing, invalid, outside the window or conflicting. These appear in
`provider.unmatchedAttempts` and `coverage.unmatchedQueries`. They do not create
successful completions or server latency samples. Provider records lacking a valid
request ID or valid duration/positive integer ordinal are excluded with separate
coverage counters.

`failuresByCode` distinguishes `MODEL_TIMEOUT`, `MODEL_ABORTED`,
`OUTPUT_VALIDATION_FAILED`, `INPUT_VALIDATION_FAILED`, and other explicitly
allowlisted codes. Legacy generic failures remain `GENERATION_FAILED`; absent or
unsupported codes remain unknown. A provider `FETCH_ABORTED` event cannot establish
whether the SDK timer or caller initiated cancellation; final SDK timeout/abort
classification comes from the generation summary. No error message, response body
or arbitrary code is captured.

`refunds.credit` and `refunds.rateLimit` summarize correlated existing
`repository.credit_refund` and `repository.rate_limit_release` completions by
outcome, duration and failure code. YC cleanup now receives the request logger,
as outreach already did. A refund stage alone does not establish that a credit
refund succeeded. Helper success is observed execution evidence, not an independent
ledger reconciliation. Absent cleanup events remain unknown.

- Start with coverage: malformed/ignored/outside-window events, duplicates,
  conflicting terminals, missing IDs/timestamps, missing terminal summaries and
  matched client operations. Conflicting summaries and invalid stage partitions
  are excluded from latency calculations. Never turn missing values into zeros.
- Server summaries correlate by request UUID; client events correlate by operation
  UUID. Client/server joins require both matching request and operation IDs.
  Correlation identifiers are used internally and removed from report artifacts.
- The UTC interval includes its start and excludes its end. Rates describe distinct
  server requests observed within that interval and successful completions within
  it. Delivery requires a successful client display event. A server success alone
  cannot prove delivery; repeated HTTP attempts may repeat work for one operation.
- Report count, median, range and nearest-rank p95 (`ceil(0.95*n)-1` in sorted data).
  Suppress p95 below 20 observations; above that threshold a small sample still has
  a noisy tail. Do not add stage percentiles or compare pooled category/version
  distributions as if the workload were identical.
- Compare category/outcome/model/template/deployment/billing/retry/intent/mode/client
  cohorts. Inspect numeric parameter quartiles only where a parameter varies.
  Quartiles partition observations by rank; ties can appear in adjacent groups.
  These are associations, not causal experiments. A fixed temperature/model gives
  no evidence about how changing it would affect latency or quality.
- Client-minus-server elapsed time is unexplained overhead: auth, previous attempts,
  network, local preparation and rendering can all contribute. It is not pure
  network latency. Completion after rendering can reveal slow local storage/usage.

## Investigation order

| Evidence                                                  | Next investigation                                                                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model stage dominates; output size increases with latency | Compare output lengths, stop reasons and input-size cohorts. Evaluate a smaller output budget/model only in a separate quality-preserving experiment. |
| Multiple provider attempts or long inter-attempt gaps     | Inspect provider status, timeout/rate-limit patterns and SDK retry evidence before changing retry policy.                                             |
| Long grounding load                                       | Compare the four parallel query timings. Separate query/network evidence before proposing indexes, caching or query removal.                          |
| Long context hydration                                    | Investigate the additional resume/job-context hydration and fallback paths.                                                                           |
| Long auth, quota or billing stages                        | Inspect service latency, refresh/recovery, RPC contention and failure/refund evidence.                                                                |
| Long postprocessing/refund                                | Inspect validation/claim-ledger sizes, invalid outputs and compensation latency.                                                                      |
| Server is fast but display/completion is slow             | Inspect auth recovery, repeated HTTP calls, background usage bookkeeping, local storage and popup lifecycle.                                          |
| Tail varies without matching metadata                     | Obtain complete version/workload/platform evidence; label the cause unknown until measured.                                                           |

## Verification, rollout and rollback

Run `npm run bench:generation` for a reproducible synthetic local baseline. It
compares five alternating batches of 10,000 mocked requests after warm-up, with
and without timing/four query records/one provider attempt/one summary. Pino
serialization and the mandatory redactor use a synchronous discard sink. It also
evaluates and renders a near-20 MiB single-cohort export. No paid generation,
database calls, deployment or telemetry upload occurs.

Local regression targets are at most 1 ms added median batch-average work per
mocked request, 10 seconds to evaluate/render the fixture, and 512 MiB peak process
RSS. These are development guardrails, not production SLOs. On 2026-09-11 with
Node 24.16.0, macOS arm64, Apple M1 Pro: added work was 0.0188 ms/request; the
72,490-record, 20,971,300-byte fixture took 685 ms and reached 362 MiB peak RSS.
Serialized measurement records averaged 1,396 bytes/request before production
correlation/logger bindings. All three local targets passed.

The benchmark excludes production stdout backpressure, network/service latency,
extension storage and concurrent production load. RSS includes Node, imports and
fixture construction; batch averages are not individual-request p95. A single
fixture is not a worst-case capacity guarantee. Representative live overhead and
the first approved traffic report remain pending under AC12.

Tests mock Supabase and Anthropic. The SDK contract test uses the real pinned SDK
with a fake fetch to verify retries and unchanged response usage. The CLI fixture
is explicitly test data, not a performance benchmark. Native gates include root
lint/type-check/coverage/guardrails/resume-security/build, extension CI and version
policy. See ALE-52 and `docs/progress.txt` for dated results and remaining checks.

The change has no migration or new dependency/telemetry transport. New telemetry
uses existing redaction and bounded numeric/enumerated fields. New measurement
logging is best effort. Existing normal logging and auth/billing semantics are
unchanged. Runtime enrichment adds four query completion events and one event per
provider attempt, plus one local spinner-finish event per operation; no extra
database/provider requests are made.

Critical-tier review applies because instrumentation surrounds private data, auth
and billing. Obtain the additional explicit review required by engineering-loop
before rollout. Do not merge/deploy or publish the extension as part of local
verification. The source extension version is 1.0.15; it is not a publication claim.
For rollback, revert the enrichment in a reviewed server change and publish a
higher extension version if a published client needs rollback. Legacy logs remain
readable with unknown fields. No database rollback is needed.

The first approved normal-traffic export and live diagnosis remain pending until
that source is available. Do not close ALE-38 or claim measured bottlenecks from
synthetic tests. Proposed performance fixes belong in separately reviewed issues.
