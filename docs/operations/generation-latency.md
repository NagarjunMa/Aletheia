# ALE-38 — generation latency evidence

## Scope and safety

This is a measurement-only change. No model, prompt, output ceiling, timeout,
billing, quota, query ordering, authorization, or response-contract changes.
Do not optimize ALE-37's batch budget until matched evidence supports it.
Mock timings prove attribution, not production speed or a bottleneck.

Use an explicitly approved isolated deployment with synthetic candidate data
for controlled generation. Model requests and credits have a cost: agree the
sample budget before running them. Do not put credentials, questions, resumes,
drafts, or raw provider errors into evidence or Linear. No automatic sampling,
production mutation, new telemetry transport, or Store submission is authorized
by this runbook.

## Server measurements

Each generation POST emits one `event: generation.timing` on the existing
request logger, correlated by `requestId` and (when supplied) `operationId`.
Its `durationMs` spans handler entry through response construction, including
auth, database waits, quota/billing, model work, post-processing and compensation.
It excludes proxy execution, platform startup before handler entry, network
transit, final log writes and browser rendering. Existing public `processingTime`
and `generationTimeMs` remain model-call timings; they are not end-to-end metrics.

| `stages` field     | Included work                                                           |
| ------------------ | ----------------------------------------------------------------------- |
| `authDispatch`     | Contract/auth checks, body parsing and category validation              |
| `groundingLoad`    | Caller-scoped repository load and mapping; four queries remain parallel |
| `groundingBuild`   | Source selection, preparation metadata and readiness checks             |
| `styleLoad`        | Outreach learned-style lookup                                           |
| `rateLimit`        | Daily-slot reservation and decision handling                            |
| `billing`          | Trial grant and credit reservation when applicable                      |
| `contextHydration` | Outreach resume/JD fallback reads                                       |
| `inputBuild`       | Input sanitation, injection scan and prompt construction                |
| `model`            | Awaited provider call, including its existing SDK retry behavior        |
| `postProcessing`   | Tool parsing, sanitation, validation and response construction          |
| `refund`           | Failure compensation and error response construction                    |

Stages are sequential, nonoverlapping integer milliseconds. Their sum equals
the handler duration. `null` means **unvisited**, not zero time. Timings include
small local bookkeeping/logging costs between stage transitions. A failed call
retains its elapsed stage; `failedStage`, normalized HTTP `status`, and a static
`GENERATION_FAILED` code describe failure without copying upstream errors.
Existing detailed stage logs supply more specific safe failure codes.

`metrics.inputChars` counts system plus user prompt characters (not tool-schema
JSON). `sourceChars` and `sourceCount` describe selected grounding sources, not
all database rows or necessarily every character sent in the final prompt.
`inputUnits` / `outputUnits` are provider-reported input/output **tokens**. These
numeric field names deliberately survive the existing logger's text/secret
redactor; do not loosen that redactor to admit raw prompt/token fields.
`model` and `templateVersion` identify the static generation configuration.

`firstInvocation` is only the first generation POST handled by this module
instance, including rejected requests. It is **not proof of a platform cold
start**. Use deployment/platform evidence to label cold/warm; otherwise record
that classification as unknown. Concurrent requests have separate collectors.

## Client measurements

Extension `generation.complete.durationMs` now starts at Generate-handler entry
and ends after synchronous output rendering, including input preparation and
local-storage reads. It does not include browser paint, generation-history
persistence or final spinner cleanup. Transport exceptions emit one safe
terminal timing. API failures retain their existing response-receipt endpoint.
Correlate with the server using `operationId` (and `requestId` on success).
Diagnostics remain local-only in the existing bounded session buffer/console.

The updated extension source version is 1.0.14. Older installed versions measure
only the messaging round trip; do not mix their client samples with 1.0.14.
There are no permission or API-version changes. Package/publish only with
explicit release authorization; an unpacked isolated test is sufficient here.

## Matched sampling procedure

1. Record the deployed commit, extension version, model/template version,
   billing mode, approximate target/source sizes, environment and sampling window.
2. Use the same synthetic account, candidate data, client/network and warm/cold
   conditions. Compare `yc_application`, `linkedin_connection`, and `cold_email`.
   Keep target sizes comparable and alternate categories across rounds rather
   than running all samples of one category first. Review output validity too.
3. Generate only the agreed number of samples. Capture client events locally
   and server `generation.timing` summaries for the same operation IDs. Export
   only allow-listed timing/count/configuration fields. Check exports for
   credentials or content before sharing. Record failures separately; never
   silently discard slow failures or mix them into successful latency percentiles.
4. For each category and cold/warm/unknown cohort, record sample count, failure
   count, total/model/stage durations, input/output units, source/input sizes and
   client elapsed time. Stage sums must reconcile with total server duration.
   Client minus server approximates client/network overhead, not pure network time.
5. Sort each cohort's durations; use nearest-rank p50/p95
   (`sorted[ceil(p*n)-1]`). Report the sample size and window beside every
   percentile. For fewer than 20 successful samples, report all values/range
   and median, and explicitly mark p95 as insufficiently sampled. Even 20
   samples provide a noisy tail estimate; do not claim a stable production SLO.
6. Compare per-request stage shares and token/size trends within matched
   cohorts. Do not sum per-stage p95s or infer causation from correlation alone.
   Investigate dominant stages with controlled, separately approved experiments.
7. Record each hypothesis as supported, rejected, or **unresolved**: model/output
   ledger size; source/input size; candidate DB wait; billing; client/network;
   platform cold start. No model/token/context experiments should alter security
   validation or be silently shipped as optimizations.
8. Update ALE-38 with dated aggregate evidence, sample limitations, verified
   bottleneck, proposed remedy, measurable target and regression risks. Keep it
   In Progress until its measured-analysis acceptance criteria pass.

## Rollout and rollback

Review and deploy the server instrumentation first, then verify one summary per
request and privacy-safe field retention on the isolated deployment. Test the
updated unpacked extension before any separately authorized Store release.
Rollback is reverting the instrumentation commit and redeploying; there is no
migration or stored-data conversion. Keep the previous published extension
available. Public generation behavior and old clients remain compatible.

Current evidence limitation (2026-09-09): no matched live samples have been
collected for this change. No production bottleneck, p50/p95 or safe ALE-37
output budget has been established. Independent Critical-tier review and
isolated runtime verification remain pre-merge/rollout gates.
