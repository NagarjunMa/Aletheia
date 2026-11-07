# ALE-46 — Atomic claim provenance

## LinkedIn Basic composer compatibility — 2026-11-07

Scope: `fix/ale-46-linkedin-composer-limit` from verified main `d394929`.
Risk: Significant for this increment (extension/API contract and model-option
eligibility); the parent provenance acceptance remains Critical.

- The updated extension requests a 200-character connection note. The API
  accepts only 200 or 300 for this channel and still defaults to 300 if omitted.
  Other channels, response shape, model budget, and admission/refund rules stay
  unchanged.
- The selected limit applies to source eligibility, the complete options offered
  to the model, and final validation. A shorter supported target observation may
  let the sender keep a complete reviewed fact. Automatic mode can still use a
  target-only note when no complete pair fits and passes final validation. An
  explicit story that cannot fit
  returns 422 before quota or model work. No factual span is shortened.
- Autofill identifies a single visible, editable invitation field and checks its declared
  limit, defaulting to 200 when absent, before modifying the note. The profile reader no longer claims unrelated
  messages, so the extension can report the actual fill result.
- A synthetic route regression reproduced 223 characters before the fix.
  An offline replay of 13 cases produced 30 options across 11 eligible cases,
  all within 200 (maximum 199). The 300-character control produced three
  options over 200. Return review cases cover rejected pairs, rejected option IDs
  and preserving unrelated, visually hidden, or uneditable fields. Packaged Chromium exercises over-limit refusal,
  exact-200 acceptance and an explicitly advertised 300-character field.

Evidence receipts: `/tmp/ale46-composer-evidence/`. No provider calls, production
data changes, deployment or store publication. Deploy the compatible backend
before publishing the extension. To roll back, revert the backend and redeploy;
an updated extension still checks the composer before filling a legacy response.
Chrome Store rollback would require a new release. No migration is involved.

The actual LinkedIn composer with a signed-in account, human usefulness review,
and full disposable Supabase migration/type replay remain separate parent
acceptance checks. Keep ALE-46 In Progress and preserve the ALE-61 worktree.

## Final three-call result and structural correction — 2026-11-02

The user approved three additional synthetic calls (combined output ceiling
7,200 tokens, zero retries/database writes). **All three are consumed and all
three failed** under prompt5.1.0: cold initial CLAIM_COVERAGE (984output tokens),
follow-up CLAIM_REWRITE (464), InMail CLAIM_REWRITE (654). Each completed with
tool_use below2400. Totals:9,506input/2,102output tokens. Citation namespace
resolution progressed, but prompt instructions alone did not prevent unsupported
wording or uncovered spans. Keep these failures as evidence, not passing prose
quality results. Temporary credential files were removed after the calls.
Private synthetic responses, frozen inputs, safe events and exact manifests:
`/Users/nagarjunmallesh/.codex/artifacts/aletheia/ale46-prose-final-live-2026-11-02/`.

### Corrected change contract

Reuse LinkedIn's existing complete-option boundary for cold email and InMail.
`prose-compositions.ts` prepares complete immutable drafts from request-selected,
reviewed candidate facts and supported target context. Prefer candidate-bearing,
target-aware combinations; permit explicit target-only output only if no complete
candidate-bearing combination fits. InMail may use candidate-only proof when a
complete target would exceed its shorter canonical budget. Never repeat facts,
shorten qualifications, infer fit, or invent a subject. Reuse approved neutral
framing, existing cold renderer/signature, final provenance, exclusion and mode
limits. This intentionally reduces writing flexibility; useful prose remains a
human evaluation gate. No graph, model judge, repair retry, SDK/dependency change,
client API change, extension release or database mutation.

The service builds options before quota/credits/provider work. No complete option
returns422 preparation guidance without cost. Each offered draft is independently
validated against its private immutable ledger and final channel limits. Search
is bounded to64sources, at most three distinct candidate facts per combination,
256fitting validation attempts,8options and12,000UTF-8 preview bytes. Sources
already follow upstream bounds/ranking; exceeding the bounded search can return
preparation guidance even if a later combination might fit. Do not claim exhaustive
composition search. An adversarial excluded-source case reproduced36,096checks
before the new256check cap; the red/green regression now enforces the bound.

Claude returns only one current opaque option_id, bound to mode, identity and
current sources/review. Strict parsing rejects stale/unknown IDs and all extra
prose/claim/count fields. The server resolves the original draft, renders it,
then reruns the existing final grounding/length checks. Public responses expose
only existing content/counts/metadata; no private ledger, source IDs or previews.
Prompt6.0.0 removes conflicting authoring instructions. Legacy semantic tool
helpers remain for offline compatibility tests; production requests always use
complete-option tools. Existing2400prose/600LinkedIn output ceilings and admission
work units remain conservatively reserved; no performance/cost saving claimed.

### Verification and remaining gates

TDD reproduced prompt-only provider failures and the unbounded excluded-combination
case. Local complete-option tests cover all twelve category/mode pairs, immutable
sources, stale/extra-field rejection, qualifications/literal whitespace, source
aliases and bounded preparation. HTTP tests exercise real complete qualified
fixtures through current tool/parser/render/final validation, preflight422before
admission and502once-only compensation, with privacy canaries. Final-length
mutation cases still fail after selection; source and final safeguards stay active.

Current check execution and final independent-review receipt live outside source
under `/tmp/ale46-prose-contract-2026-11-02/`; final results will be reported with
the handoff. Previous1698-test/review evidence applies to prompt5.1.0 only. The
three default repair review rounds are exhausted. The user approved one additional
fresh review specifically for this structural correction; that review is pending.
No paid calls remain. New protocol live-provider reliability/quality and hosted
migration/auth/RLS/concurrency/cost remain unverified. Keep ALE-46 **In Progress**,
**Risk: Critical**. Do not label this a production-readiness certification.
Rollout requires reviewed backend deployment and monitored codes, tokens, latency
and fair refunds; rollback is backend revert/redeploy. No extension/storage rollback.

## Prose citation/composition correction — 2026-11-02

User authorized fixing LIVE-003/LIVE-004, then committing/pushing this existing
branch for a manually created PR. Preserve all current ALE-46 work and unrelated
checkouts. Remote main remains86215c4. Risk **Critical**: selected private source
binding plus the branch's existing cost/admission and safe logging changes.

Contract: cold proofs may cite either an existing selected parent ID or a current
selected candidate atomic fact whose root is selected. No target/unknown or
unselected-root aliases. Map only server-prepared sources, never infer parents
by stripping model strings; retain overlap checks and the exact final claim
validator. The returned draft/ledger stays immutable and private.

Prose correction: replace the conflicting legacy prose prompts (inferred subjects,
compressed/paraphrased proof lines and fabricated fit prose) with concise guidance
matching the current atomic contract and existing semantic tools. Facts remain
complete approved spans; neutral text comes only from NEUTRAL_FRAMING. Selected
parent records and resumes are context, not permission for unreviewed claims.
Use approved neutral subjects instead of impossible ungrounded subject templates.
Keep all six modes and canonical tool word limits, paragraph/proof layout,
server-owned signature and generic API failure/compensation behavior. Follow-ups
select fewer complete facts; never shorten qualifiers or pad/repeat to meet bounds.
Bump PROMPT_VERSION. No new graph, model judge, fallback repair, output-cap change,
dependency or extension release. Existing2400/600ceilings and admission units stay.

TDD: first reproduce selected atomic proof-ID rejection; retain unknown/target/
unselected-root and unsupported-overlap negatives. New prompt regressions reject
legacy inference/rewrite guidance and verify canonical mode/tool guidance.
Exercise corrected cold initial/follow-up and InMail fixtures with the same
complete qualified synthetic facts, real parser/render/final grounding, through
the HTTP boundary; old paraphrases and155-word follow-up must still fail. Public
responses/logs must not contain private ledger fields. Run affected/native gates,
independent review, hooks and push only verified source. The previous repair used
two reviewer rounds; preserve receipts and count the next review as round3.

The four real-provider calls are exhausted. No additional paid or production
calls are authorized. Local prompt/contract regression evidence does not prove
post-correction live-provider reliability; include that limitation in the PR.
Keep ALE-46 In Progress and parent human/platform/composer gates. Rollback is a
backend revert/redeploy retaining additive review storage and patched tooling.
Evidence for this correction: `/tmp/ale46-prose-contract-2026-11-02/`.

### Prose correction checkpoint

Red-first checks reproduced5intended failures: valid atomic proof rejection,
HTTP initial-email502 instead of200 and three conflicting-prompt assertions.
A separate alias-chain red case proved roots must be checked against the original
parent set rather than a map expanded with aliases. Both corrections now pass.
Parent-ID compatibility remains; alias/source/claim objects are not mutated.

Removed the obsolete inference/shortened-proof/subject-template instructions,
not the safety tests. Prompt5.1.0 now uses the authoritative atomic wording,
neutral subject, server signature and word policy from each requested tool.
Historical prompt-string assertions requiring inferred subjects and compressed
proofs were replaced with contract assertions; all canonical tool-mode tests,
negative grounding, attachment/privacy and final-length checks remain.

Passed so far:862affected tests,1698native tests/116files with unchanged coverage
thresholds,15guardrails, lint(existing refund-admin warning),types,policy,audit
high gate and dummy-environment build. Three qualified synthetic HTTP success
cases pass; unsupported rewriting and overlength follow-up still502 with one
release. New review uses the remaining third round of the repair budget.
The user separately approved3final synthetic prose calls (7200total output
ceiling, no retries/database writes); these are not yet executed. Keep both
previous live failures and any final results. No production deploy is authorized;
branch publication is authorized after checks/review. Do not mark parent Done.

## Four-call follow-up — authorization and result

The user approved the separate four-call synthetic evaluation after the local
repair review. All **four calls are consumed**, no retries/database writes or
hosted app requests. The tested runtime/tests match the independent return-review
snapshot; only later evidence documentation differs. Temporary production model
credentials were removed after execution. No application code changed in this
follow-up. Frozen fixtures, exact call timestamps, private synthetic responses,
source receipts and reports are retained under
`/Users/nagarjunmallesh/.codex/artifacts/aletheia/ale46-four-call-2026-11-01/`.
The prior pending-approval notes below are superseded by this result.

| Sample             | Output tokens/cap | Final result                                                                  |
| ------------------ | ----------------- | ----------------------------------------------------------------------------- |
| Cold initial email | 961/2400          | Rejected: proof-reference namespace mismatch                                  |
| Cold follow-up     | 975/2400          | Rejected: proof-reference namespace mismatch                                  |
| InMail             | 609/2400          | Rejected: CLAIM_REWRITE                                                       |
| Five-answer YC     | 1538/8000         | Passed current service with real provider and local DB/auth/admission doubles |

All responses stop normally with tool_use; none hits max_tokens. Totals:
19,817input/4,083output tokens. LIVE-001's revised ceiling fits these three prose
samples, but **three of four final generation checks fail**. Do not describe
budget fit as successful email/InMail generation or complete parent acceptance.

**ALE46-LIVE-003:** Both cold drafts cite selected candidate atomic fact IDs in
proof_points.source_ids, while validateOutreachDraft checks only parent source
IDs. All four observed references have selected candidate parents. The contract
must align those namespaces without accepting unknown/unselected/target facts
or bypassing final exact grounding.

**ALE46-LIVE-004:** All three prose responses include unapproved claim rewrites,
despite complete supporting excerpts. Offline inspection of the unchanged next
gate shows both cold drafts also fail CLAIM_REWRITE; resolving IDs alone would
not fix them. The follow-up renders155words against its30–90word limit. Preserve
complete approved facts/qualifications and canonical word limits; align the prose
prompt/tool/composition contract instead of relaxing guards.

The revised YC path accepts all five answers in this synthetic sample. It is
not a hosted repaired deployment test, proof of the original rejected field,
or a human usefulness evaluation. Local simulated admission/compensation is not
live quota/credit evidence. The exact historical YC field remains unconfirmed.
The scoped captured first-party logger events contain no tested synthetic source
canaries; raw responses are separate private evaluation artifacts, never app logs.

ALE-46 remains **In Progress**, risk **Critical**. Next development is the
reference/composition contract repair and its regressions/independent review,
then a separately authorized provider recheck. No calls remain in this approval;
no deployment/commit/push or Done transition occurred. Keep all original failed
and successful artifacts and the remaining human/platform/composer gates.

## Live-failure repair contract — 2026-11-01

Active branch: `fix/ale-46-generation-output-fit`, from verified main
`86215c4981a7df54a27e8f3486378763391a171c`. Prior completion-audit notes are
preserved on this branch and in an external patch; the unrelated primary
checkout, other worktrees and retained stashes remain untouched.

**Risk: Critical** for private model-validation diagnostics and cost/admission
accounting. No authentication, RLS, migrations, billing prices or client API
change is planned. This repair does not close the parent acceptance gates.

### Change contract and decisions

1. Fix ALE46-LIVE-001 with a server-owned **2,400-token prose ceiling** for cold
   email and InMail; retain the **600-token LinkedIn** ceiling. Three real prose
   samples exhausted600 before returning the required ledger. The new ceiling
   gives up to four times the previous output allowance for complete prose plus
   provenance; it is bounded headroom, not a guarantee that every source/ledger
   maximum fits. The user explicitly requested fixing this limit after those
   measurements. Reuse one resolver for SDK requests, timing and admission:
   prose reserves **three** output-work units instead of one; LinkedIn retains
   one. Preserve the rolling work budget, daily quota, no hidden retries and
   30-second complete-response deadline. No input/output limits or grounding
   checks are relaxed. Explicitly reject token-truncated tool results even if
   their partial JSON looks structurally usable.
2. Investigate ALE46-LIVE-002 without guessing its lost private response. The
   production five-answer result completed at1863/8000 and only exposed a
   general validation failure. Keep YC caps unchanged. Align stale YC
   candidate-source/plural-source instructions with the actual approved atomic
   text, singular source_id, complete excerpt and per-question selection rules;
   bump the YC prompt version. This is an evidenced contract inconsistency, not
   proof of the exact historical production failure.
3. Add bounded allowlisted failure stage/reason/schema-field codes to first-party
   logs. Never log generated prose, source IDs/values, excerpts, Zod messages,
   unrecognized property names, credentials or raw tool input. Keep public
   errors generic and preserve once-only credit/quota compensation and consumed
   attempt/work budgets. Do not return diagnostics or private provenance to the
   extension.

### Execution context and evaluations

Verified edit locations: outreach Anthropic repository (tool/provider budget),
`extension-generate.service.ts` (timing and cost reservation), YC repository
(strict tool parsing), `generate-yc-application.service.ts` (per-answer
sanitization/final validation/catch), YC prompt and relevant co-located tests.
Existing atomic validator/finalizer, logging redaction and admission repository
remain authoritative. No dependency, graph, judge, repair call or extension
release is needed.

TDD: prove per-category SDK/admission/timing ceilings before changing them;
reject token-truncated otherwise-shaped outputs; reproduce indistinguishable
YC tool-schema, wrong-question source, coverage and final-limit failures, then
verify safe distinct diagnostics with private canaries. Include a valid
five-answer real-parser/finalizer path and keep wrong-source/exclusion/rewrite
negative cases. Prompt tests must reject obsolete schema guidance.

Run affected suites, guardrails, native coverage, lint, types, policy, build and
scoped formatting/diff checks. Obtain fresh independent review under this
repair's three-round budget; prior completion-audit review is historical.
Synthetic provider re-evaluation requires a new bounded authorization; do not
reuse the exhausted41-call budget. No production writes/deployment are part of
this repair. If historical YC cause remains unobservable, retain the finding
as investigated/diagnostics prepared, pending hosted reproduction.

Rollout: reviewed backend deployment after merge; monitor safe validation
codes/stages, stop reason, tokens, quota restoration and latency. Rollback:
revert this backend repair/redeploy; no stored-data rollback. Do not mark Done
or claim cross-channel readiness from mocks alone.

### Repair implementation / verification checkpoint

Additional retained-log analysis narrows the historical YC failure to strict tool
parsing/envelope or exact batch-ID validation: the normal tool_use response has
no claimCount/ledgerChars metrics, which are assigned immediately after those
gates and before per-answer sanitation/grounding. The existing timing/logger
allowlist preserves these names. This still does not identify a particular field
or prove prompt corrections resolve the original production incident.

Independent repair round1 found one introduced test-fixture issue,
ALE46-OUTPUT-R1-001: two budget route tests reused a LinkedIn-only SDK mock, which
threw before producing a prose response. Keep their502 expectation and supply an
explicit completed invalid prose tool response. The fixture correction is local;
return-review evidence is recorded externally. The failed coverage/reviewer runs
are retained. No additional material runtime finding was reported. Browser smoke
29checks, focused resume146checks, final build and types pass. No runtime changes
were required after this review; the reviewed-fact characterization title now
accurately says one reviewed fact reused across five answers.

Local repair implemented with red-first coverage: 14 intended failures reproduced
before correction (one additional SDK test setup failure was corrected separately).
Prose SDK requests, admission units and timing share the category resolver.
Partial max-token output is explicitly rejected. YC prompt2.0.1 uses the actual
atomic schema; bounded parse fields, fixed validation codes/stages and numeric
item indexes cross the existing logger, not private source text or error messages.
The public failure/compensation shape is unchanged. Real prepared five-answer
fixtures traverse parsing, sanitation, per-question grounding and final public
projection; negative cases retain fail-closed rejection and once-only release.

Initial checks:847affected tests,1686native tests/116files with coverage gate,
15guardrails, types, engineering policy and dummy-environment build pass. Root
high-severity audit gate passes with20 inherited moderate advisories. Lint has
only the existing refund-admin warning after correcting parameter-property lint
warnings in the first pass. Final current-source checks and independent review
are recorded in external receipts under `/tmp/ale46-output-fit-2026-11-01/`.
No new provider invocation is authorized yet; a new four-call/15,200-output-token
maximum proposal is pending. Exact historical hosted YC cause and parent human,
platform and composer gates remain open. Current evidence is local, not a claim
that the deployed generation defect is resolved.

### Repair handoff — local checks complete

Passed on the corrected repair:1686native tests/116files with coverage thresholds
(statements89.33%,branches82.61%,functions89.29%,lines90.68%),15guardrails,
146resume security checks,29browser/health smoke checks, types, build, lint
(existing refund-admin warning only), policy, scoped formatting and diff hygiene.
The root high-severity audit gate passes;20 inherited moderate advisories remain.
No dependency or extension files changed. Hosted PR CI and unchanged extension CI
were not rerun locally as part of this backend repair; future PR CI remains
separate from these checks.

Independent return review on the corrected frozen source resolved
ALE46-OUTPUT-R1-001 with no material findings:429fresh focused tests,3isolated
budget cases and15adversarial probes pass, with manifest freshness at start/end.
Two repair review rounds were used. Exact reviewer model identity is unknown;
this is fresh-context review, not a cross-model claim. These handoff lines are
later evidence-only documentation; the reviewed runtime/tests remain unchanged.
Final manifests/reports and failed diagnostic history are preserved privately at
`/Users/nagarjunmallesh/.codex/artifacts/aletheia/ale46-output-fit-2026-11-01/`.

ALE46-LIVE-001 has a locally verified bounded-cap/accounting correction; actual
provider fit at2400 remains not run. ALE46-LIVE-002 now has narrower historical
stage evidence, corrected prompt/schema guidance and safe failure diagnostics;
the exact original rejected field and hosted closure remain unverified. The
separate four-call authorization request is pending; no new paid/provider or
production call was made. Keep ALE-46 In Progress. No commit/push/deploy occurred.
Human quality, platform replay and composer gates from the parent record remain.

## Latest live verification — 2026-11-01 America/New_York

**Acceptance incomplete; ALE-46 remains In Progress. Final risk: Critical.**
The user authorized up to 41 synthetic Claude calls and expressly selected
production for hosted tests. This supersedes the pre-live authorization limits
recorded below only for this bounded evaluation. Tested deployed source:
`86215c4981a7df54a27e8f3486378763391a171c`. No application, dependency, migration,
configuration or deployment change was made during verification.

### Passed

- All **41 actual model calls** are consumed: 35 direct synthetic provider calls
  and six authenticated production API calls. Six additional local preflight
  rejections made no model call. No automatic retries, repair/judge calls or token
  cap increase. The direct runner performs no database writes; hosted lifecycle
  tests use only dedicated temporary synthetic accounts/records.
- **30/30 direct LinkedIn outputs** pass exact grounding and the 300-character
  contract. Production generation with a JD and with no JD both returns 200 and
  retains the reviewed candidate assertion. After actual review withdrawal,
  generation returns 200 with target-only text and omits that assertion.
- Real production owner save/reload, anonymous/cross-user read/update denial,
  native browser server-action cross-owner denial, source-edit invalidation,
  stale action rejection, current revision re-review and confirmation revocation
  all pass. Cross-owner action testing changes only synthetic record IDs in the
  browser's native action request, retaining its normal authentication/protocol.
- Read-only production schema type generation succeeds. Every existing public
  table Row shape matches; `candidate_evidence`, `candidate_profiles`, and
  `profiles` Row/Insert/Update shapes match. The reviewed-fact column is present.
  This establishes deployed type compatibility, not clean migration replay.
- Eight scoped Vercel exports cover 20 unique synthetic requests, including all
  six API model attempts and review actions. The audit finds no tested source
  canaries, credentials, prohibited source/ledger fields or raw evidence IDs.
  This is a scoped audit, not an audit of every production log/customer request.
- The targeted failed cold-email call restores its daily quota slot
  (`quotaRestoration: released`). Production billing is disabled (`billing: none`),
  so no live credit debit/refund was exercised. Local refund regressions remain
  separate evidence.
- All **15 temporary synthetic accounts** were signed out and deletion verified;
  customer accounts were not enumerated and customer records were not queried or
  changed. Temporary production environment credentials were removed, saved test
  state was scrubbed of passwords/tokens, and evidence retained privately.

### Failed: material live-generation findings

- **ALE46-LIVE-001 / P1 — output budget does not fit prose plus provenance.**
  Direct cold initial email, cold follow-up and InMail each stop at exactly
  600 output tokens (`max_tokens`) with an incomplete tool result lacking the
  required claims. Two separate production cold-email attempts reproduce
  **502 PARSE_FAILED**, also at the 600-token cap. The current shared repository
  applies that cap before parsing the required composition/ledger. Repair the
  bounded output representation/budget together; preserve exact support and
  final validation. No cap increase is authorized by these test results.
- **ALE46-LIVE-002 / P1 — hosted YC batch rejected; exact validation reason unknown.**
  A production five-question batch returns **502 YC_OUTPUT_INVALID**, with its
  daily quota released. Claude finishes normally (`tool_use`) at **1,863 of
  8,000 output tokens**, so this result does not establish truncation. The catch
  in `generate-yc-application.service.ts` records only
  `OUTPUT_VALIDATION_FAILED` across several validators. Add allowlisted reason
  and stage diagnostics, then reproduce and correct the actual failed check;
  never log the private tool input or relax grounding to obtain a pass.

Direct YC single and five-answer samples pass at 549/1,000 and 1,538/8,000 output
tokens respectively. Those successes do not clear the hosted batch failure.
The direct suite used 76,347 input and 5,387 output tokens. LinkedIn provider
calls used 48–53 output tokens, median 1,767 ms (range 892–3,602 ms); these small
synthetic samples are not an SLA, full extension latency or a dollar-cost claim.
Three production LinkedIn calls used 51/49/47 output tokens and took roughly
3.52/3.33/2.93 seconds end to end.

### Remaining acceptance and evidence limits

Human usefulness/quality scores and a matched baseline comparison are not yet
provided. A shuffled synthetic review sheet is prepared; it is not completed
human review. The original Product-research/Designer expectation mismatch remains
recorded: 27/30 direct LinkedIn outcomes match predeclared expectations; three
follow existing canonical relevance policy with target-only output. No fixture
outcome or relevance rule was silently changed.

Blocked: full disposable Supabase17 migration reset/replay because Docker is
unavailable. Production was never reset. Not run: actual 200-character composer
compatibility, live credit refunds with billing enabled, further provider calls
(the approved 41-call budget is exhausted), and independent verification of
future fixes. The prior additional independent review resolved
ALE46-C-R3-001 with no material code findings in its inspected cases; it predates
these live failures and does not certify their closure.

Earlier hosted harness failures are preserved: transient success-notice timing,
route/empty-state assumptions, manual action replay, and a compensation query
against a nonexistent table were test-harness errors. The corrected native
browser flow and quota compensation checks subsequently passed. Those harness
corrections do not erase the real model-output failures above.

Evidence: private local artifacts under
`/Users/nagarjunmallesh/.codex/artifacts/aletheia/ale46-live-2026-11-01/`, including
`summary.json`, `evidence-manifest.json`, provider responses using synthetic data,
production lifecycle/type/log reports, failed diagnostics and the shuffled human
review sheet. The original proposed plan is preserved unchanged; a separate
authorization receipt records the user's approval. Do not publish raw synthetic
ledgers or scoped logs in the repository.

Next incomplete step: repair and independently verify ALE46-LIVE-001 and
investigate ALE46-LIVE-002 with safe diagnostics, then obtain human quality
review and remaining platform/composer evidence. Do not mark Done or claim
cross-channel readiness. No commit or push was performed. No new rollout was
performed; application rollback remains a reviewed backend revert/redeploy,
retaining additive reviewed-fact storage/data and patched tooling. A future fix
needs focused regression checks and a new bounded real-provider authorization.

## Pre-live completion audit — 2026-11-01

User selected completion verification after PR117 merged. Local main and remote
main match `86215c4981a7df54a27e8f3486378763391a171c`; the source tree is identical
to published `21e61bd`. Verification branch:
`test/ale-46-completion-verification`. Preserve the old dirty primary checkout,
other worktrees and all retained stashes. Re-read the complete Linear issue and
latest composition contract; historical missing-column, old selection-protocol
and unmerged-work notes below are not current blockers.

Full audit record; risk **Critical** for private evidence, exact factual support,
owner-scoped reviews and compensation boundaries. Verify rather than add a new
generation framework. TDD is applicable to any evidenced correction; this audit
itself runs existing regressions and makes evidence-only documentation changes.
Do not mark ALE-46 Done without the remaining acceptance evidence.

| Criterion                                             | Relevant current implementation/check                                                                                              | Completion evidence required                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Complete reviewed facts, current source and ownership | `fact-review.ts`, authenticated fact-review actions, candidate repository, migration trigger; actions/unit/disposable-DB/UI checks | Actual hosted two-user authenticated save/reload/stale/revoke/generation flow remains distinct from mocks    |
| Exact selected source support and final-body coverage | Shared atomic validator/finalizer and outreach/YC services; adversarial and finalization integration tests                         | Validate all categories and per-question batches; no ledger/source leaks                                     |
| Complete LinkedIn introduction with/without JD        | Complete-option builder, canonical relevance, prompt/tool/parser, renderer and route tests                                         | Preserve single call/600-token cap; live usefulness and blinded quality rubric are separate                  |
| Fair failure and cost bounds                          | Admission/credit route tests, provider deadline tests                                                                              | Retain no-model preflight denial and once-only compensation; no paid/production invocation in routine checks |
| Schema and generated types                            | Additive reviewed-fact column/types and migration records                                                                          | Clean Supabase17 replay/type comparison is not established by a stubbed PostgreSQL14 test                    |
| Final correction review                               | `isFirstPersonAssertion` shared by approval/prioritizer/composer                                                                   | ALE46-C-R3-001 needs independent/human closure; prior three-round budget exhausted, extension requested      |
| Delivery                                              | PR117 merged at86215c4; hosted lint/types, policy, unit, extension and smoke jobs all SUCCESS                                      | CI is verified, not a substitute for live model, hosted auth/RLS or real-composer evidence                   |

Planned local work: inspect merged source/privacy/normalization/output budgets;
run fact-review DB and browser component diagnostics plus affected regressions;
retain exact-tree native/hosted CI evidence instead of gratuitous repeats.
Record failed, blocked and not-run checks and every new finding. Existing root
audit high gate passes with20 moderate advisories; extension audit is zero after
the separately reviewed matcher fix. No threshold or runtime contract changed.

External receipts for this audit: `/tmp/ale46-completion-2026-11-01/`.
No paid model calls, hosted account/data mutation, migration push, schema reset,
deployment or extension release authorized by the local verification request.
The existing 300-character API remains; universal200-character composer support
is not established. Rollback of application behavior is a reviewed backend
revert/redeploy retaining additive fact-review storage/data and patched tooling.
Next: finish local evidence, obtain budget-approved independent correction review,
then identify the exact remaining hosted/provider/human actions without claiming
parent completion. Do not implement ALE-61/ALE-48 in this task.

### Local verification results

Passed:921 focused tests/45files across grounding, outreach, YC, candidate
context/profile, fact-review actions, route/refund and logger checks; existing
native fact-review DB diagnostic; real FactReview component/CSS diagnostic at
375/900/1440px with a mocked action. The disposable DB is PostgreSQL14 with
stubbed `auth.uid`, not Supabase17/Auth/PostgREST. Docker daemon information
returned failure; no clean platform reset/type generation was attempted against
a linked/production project. PR117's five required GitHub jobs are SUCCESS on
the exact published source; retained local1,667 root tests,15 guards and native
build/static checks also correspond to that source. Documentation-only audit
edits do not change the tested runtime or dependencies.

Additional scratch verification freezes12 synthetic LinkedIn scenarios before
execution and enumerates every offered option through exact final validation.
11/12 expected outcomes match; one predeclared product-research candidate case
instead returns target-only for a Designer opening. Retain this failure and
investigate whether its assumed topic match is warranted by canonical ALE-54
policy; do not relabel it or broaden relevance to obtain a pass. All emitted
options satisfy current grounding/300-character constraints. Eight expected
candidate cases are not a completed blinded live-quality sample. Request
assemblies are3,829–9,460 serialized UTF-8 bytes for these fixtures, not measured
tokens or worst-case input capacity. Initial scratch SDK transport interception
failed (the pinned SDK owns its fetch); preserve that setup failure separately.
The corrected probe uses pure request assembly/fabricated responses only, never
real credentials, and establishes neither real SDK transport nor model behavior.

The user approved one additional independent review on2026-11-01. Scope: merged
ALE-46/composition consumers and ALE46-C-R3-001 closure, with current source,
local evidence limitations and the unexpected synthetic selection outcome.
Source writers pause for review; receipt and final finding dispositions remain
external to the frozen record. Actual live-model useful-output/token-fit,
blinded human scores, hosted two-user/auth/RLS/generation/log replay and clean
platform type comparison are still missing. No parent Done transition.

### Completion-audit handoff

The user-authorized additional fresh-context review completed with
**no_material_findings** in inspected code and independently resolved
**ALE46-C-R3-001**. It ran664 focused tests/38files,15guardrails and a45-option
contraction/late-target/JD-present-or-absent probe with exact final validation,
source/review immutability and invalid-prefix/qualification controls. Exact model
identity is unknown; no cross-model claim. Full receipt:
`/tmp/ale46-completion-2026-11-01/independent-review.md`. The review's frozen
manifest passed freshness before and after. Only evidence/status documentation
is updated after that receipt; implementation/tests/dependencies remain exactly
the merged86215c4 tree. Do not present the old manifest as including these later
documentation updates; final audit receipts are external.

Independent topic controls confirm that the frozen product-research/Designer
expectation has no supported nongeneric match under the existing canonical
policy. This does not establish a new production defect; preserve the11/12
matrix outcome and resolve the expectation explicitly before claiming a held-out
quality pass. No relevance rule, output limit or fixture outcome was changed to
obtain a pass. Separate explicit-research/designer controls both pass.

Prepared five additional actual-builder request assemblies (not model runs):
cold initial/follow-up25,496/25,510 bytes; InMail9,866; YC single9,652;
YC five-answer11,493. These measurements include tool schemas and serialized
source duplication; they are not token counts or a token-fit/quality pass.
Their current caps remain600/1,000/8,000. The bounded live proposal allows at
most41 scheduled attempts (12LinkedIn cases×3 plus5cross-channel diagnostics),
no retries, no judge/repair requests and no DB writes. Provider spending
authorization and the isolated hosted deployment/project identifiers have been
requested; until supplied, these tests remain not run. Existing fixture-validity
and blinded-human gates still apply even if all API calls succeed.

Current status: **local code verification complete; parent acceptance incomplete**.
Outstanding evidence: authorized actual-model tokens/stop reasons/latency/useful
output, blinded human scores and explicit relevance-case decision; isolated
hosted two-user authenticated review/generation/privacy replay; clean Supabase17
full-schema/generated-type comparison; actual composer capacity/supported-scope
decision. No new application bug, paid response, production mutation, migration
push, release or Done transition is claimed. Local platform/auth mocks and
successful PR CI do not waive those gates. Scope-specific rollback remains
backend revert/redeploy retaining stored review data.

## Current audit corrections — 2026-10-27

Branch `fix/ale-46-grounding-boundaries`, base remote main `07ea627`. Re-read
ALE-46 and its October 27 audit. Critical risk: changes to the shared private
provenance/exclusion boundary and admission before paid generation. Scope is
only ALE46-CURRENT-R1/R2; do not close ALE-46, deploy or expand architecture work.

R1: reuse one case/NFKC/punctuation-aware, whole-topic exclusion comparison in
source preparation and final atomic validation. Keep exact claim/source support
normalization separate; do not relax it. Retain the final validator's legacy
conservative substring denials as well as the shared whole-topic comparison.
Filter excluded target facts before
model admission, with final validation retained as defense in depth. Keep YC's
existing additional conservative exclusion check unchanged.

R2: the LinkedIn tool may offer only target facts whose complete approved wording
and at least one approved CTA fit the existing 300-character limit. Use this same
eligibility rule before quota/credit/model admission; return the existing 422
INSUFFICIENT_GROUNDING when none fits. Do not truncate facts/CTA or increase caps.
Optional candidate/CTA combinations still require the unchanged final renderer
and validator; eligibility proves at least one feasible target-only choice, not
that every model-selected combination will fit.

Verified locations: grounding domain/validator, atomic-source builder and both
outreach/YC context builders (R1); LinkedIn selection tool, generate service
preflight, selection and route tests (R2). No schema, dependencies, public response
fields or extension assets change. TDD: reproduce capitalization/punctuation
exclusions, neutral final-field exclusions, target filtering, impossible-only
target 422 with zero quota/model calls, mixed source pools and exact 300/301
boundaries before fixes. Then run affected tests, native gates and fresh review.

Historical missing-column/CI/R4 notes below are superseded by later migration,
hosted PR #104/#108 and fact-review evidence. Remaining real-model channel
quality/token-fit, hosted authenticated two-user lifecycle and applicable
schema/type compatibility evidence are not resolved by these fixes. Rollback:
revert this backend correction and redeploy, preserving additive review data;
that restores the identified exclusion/feasibility defects. No rollout authorized.

### Correction implementation and checks

R1 uses `modules/grounding/domain/excluded-claims.ts` in both context builders,
atomic target preparation and final validation. Matching keeps the existing
whole-topic semantics of source preparation (case, NFKC and punctuation/space
separators); final validation additionally retains all legacy conservative
substring denials. YC's existing compact exclusion check also remains. Exact
support, approved wording, scope, coverage, private ledgers and exclusions after
sanitation are unchanged or strengthened; no existing denial was removed.

R2 filters tool target IDs by complete approved text plus the shortest canonical
CTA and one space, using the existing 300-character constant. Preflight invokes
this same tool builder before style reads, quota/credit reservations or model
work; the provider uses it again on the same prepared request context. Unknown
IDs and overlength candidate/CTA combinations still fail closed at final checks.

Seven functional regressions failed before implementation. The first table-driven
route test accidentally passed a source object rather than an array; corrected
the fixture, then verified that retaining the presence-only service gate while
using the new provider tool still caused four reservation/admission/compensation
RPCs before returning 422. Moving the same eligibility check before admission
returns 422 with zero quota/model calls.
A prior credit-refund fixture had only an impossible source and now correctly
returned 422 instead of its old expected 502. Added a feasible alternate target
to preserve that test's paid-output-failure/refund purpose, and a separate
billing-enabled regression proves impossible-only inputs cause no RPC/model work.
No compensation assertion was removed or weakened.

Passed locally on Node24: 581 focused tests; full coverage suite 1,330 tests /
105 files with configured thresholds; 15 guardrails; type-check; root lint (one
unchanged unused-status warning); web dependency audit (zero advisories); scoped
Prettier and diff whitespace. Final coverage rerun follows retaining conservative
substring denials. The dummy-environment production build also passed; the
independent review receipt will be recorded outside the frozen source. No migration, dependency, frontend or extension artifact change.

Not run for this increment: paid provider calls, production writes, hosted
workflow dispatch, new hosted two-user fact-review lifecycle, clean schema/type
generation and browser/extension rebuilds (their source inputs are unchanged).
The full ALE-46 quality/environment gates remain open; this is a bounded backend
correction, not parent completion or production certification. Critical risk.

## CI security follow-up — 2026-10-08

On published commit `96e5d33`, reproduced the newly reported Next.js advisory
failure with `npm run security:audit` (one high-severity dependency finding).
Contract: replace locked Next.js 16.3.6 with patched 16.3.8, align its bundle
analyzer and ESLint config, preserve ALE-46 behavior and extension assets, and
keep the security gate unchanged. Exact pins avoid unintentionally selecting
the newer 16.4 minor release. This is a framework security dependency change;
the parent ALE-46 risk remains Critical. Reuse this existing full feature record.

Acceptance evidence: clean Node 24 installation and audit must pass; inspect the
lockfile to exclude unrelated upgrades; rerun coverage, guardrails, lint/types,
production build, and mocked browser checks against the patched runtime. The
audit is the red/green regression check, rather than a redundant unit test of
third-party version metadata.

Verified locally on Node 24.16.0, against `96e5d33` plus this dependency-only
update: clean `npm ci --ignore-scripts` installed 808 packages; the audit passed
with zero vulnerabilities. All changed lock entries are Next.js packages or
root manifest metadata, and every Next.js package resolves to 16.3.8.
`npm run test:coverage -- --run` passed 1,260 tests with coverage thresholds;
15 guardrails, lint, type-check, and dummy-environment production build passed.
Production-build Playwright health/landing/theme passed 29 checks; the mocked
fact-review browser diagnostic passed at 375/900/1440px. Extension CI passed
230 tests, audit, types, lint, and build; extension source/lockfile is unchanged.
Known baseline warnings remain: unused refund-admin parameter and module-type
warnings for Tailwind/Vite. No hosted or real-provider test was performed.

Hosted CI and the existing ALE-46 acceptance/review gates remain pending. Do not
deploy or mark Done. Apply the fact-review migration before eventual reader
rollout. Reverting this dependency update would restore the known advisory;
any emergency application rollback must retain a patched runtime.

Upstream evidence (accessed 2026-10-08):
[Next.js advisory and patched version](https://github.com/advisories/GHSA-3w37-wq28-93x7).

## Approved preparation contract — 2026-10-07

The user explicitly approved one-time profile fact review and owner-scoped
storage within ALE-46. This supersedes the no-UI/no-migration constraint below
for this increment only. Critical risk; no deployment or Done authorization.
Bounded suggestions are exact excerpts of existing project context, not trusted
facts. Users choose the type and attest each is one complete assertion, preserving
qualifications, while seeing all original context. This is human attestation, not
automated verification of real-world truth. No story rewriting, per-generation
confirmation, extraction/judge model call or output-cap increase.

Use an additive bounded JSONB review on the existing owner-RLS evidence row.
Review writes authenticate, load the owned saved row, check the displayed
updated_at, validate exact excerpt support, and conditionally update that same
revision. Source edits and confirmation withdrawal invalidate the review via a
database trigger. Legacy records are unreviewed. Raw mixed fields must not be
silently promoted to typed facts. Excerpts and ledgers stay private.

Evaluation sequence: red-first domain support/bounds/stale/withdrawal tests,
authenticated action ownership/concurrent-update tests, migration invariants
and executable RLS/trigger tests where local Postgres is available, profile
review flow, generation source integration, existing refunds/privacy/channel
tests and native gates. A source-only regex migration test is not live RLS proof.
False implementation to reject: confirming an entire record automatically,
accepting unsupported excerpts, keeping review after a source edit, reporting
success for a zero-row conditional write, or sending the ledger publicly.

## Current resumption — 2026-10-07 America/New_York

User selected ALE-46 after ALE-63 Stage 1 merged and was marked Done. Re-read
the complete current Linear issue; Critical risk and unresolved ALE46-R4 remain.
Continued the existing branch, fast-forwarding its base from a9dffaf to verified
origin/main `060e2cf9e3d09c0c218fd5bfc6c4d53dd297650c`. The recovery stash
`a5e30522308165699e1c3c085a625849b5a15409` remains retained. Thirty restored
files are byte-identical to the recovery snapshot. Three route/service files
auto-merged with ALE-63; the progress-log conflict was resolved retaining both
histories. No independent atomicity finding is resolved by this synchronization.

Fresh Node 24.16.0 baseline: `npm ci --ignore-scripts` passed (806 installed
packages, zero vulnerabilities); `npm test -- --run` passed **1,237 tests / 97
files**. This is integration/regression evidence, not completed acceptance or
token/quality evaluation. No application-code edit beyond merging the existing
issue work onto current main, no new TDD increment, no commit/push/deployment.

The user clarified the UX: a short request such as "use the policy-grounded
AI agent project" selects already saved context. It is not evidence and must
not require rewriting a whole story or reconfirming facts on every generation.
That request-time selection belongs to Message focus, not this provenance stage.
The approved fact-review step runs when project context changes. Generation uses
only individually confirmed, supported assertions. The preparation implementation
and checks are recorded below. Prior round-2 findings remain historical; the
new correction requires fresh review. Do not treat record-level confirmation or
sentence splitting as proof of semantic atomization. No completion claim.

## Preparation increment — 2026-10-07

Implemented `fact-review.ts` (bounded typed exact excerpts and revision binding),
authenticated `saveCandidateFactReview`, a one-time inline `FactReview` UI on the
application profile, and additive migration
`20261007224520_candidate_fact_review.sql`. Existing owner RLS applies. The
trigger invalidates on insert, substantive source changes or confirmation
withdrawal. Conditional review writes reject stale/zero-row updates. Profile
refresh replaces saved evidence revisions without discarding unsaved profile
inputs. Removal and zero-selection save support individual/all-fact withdrawal.
No new model calls, production dependencies, token cap changes or extension changes.
The browser diagnostic has an explicit esbuild 0.28.1 development dependency
(same version as the extension build) and runs in the existing CI smoke job.

`buildAtomicCandidateSources` now admits only valid reviewed evidence facts
whose exact text survived source selection/exclusion/budgeting. Legacy profile
and resume paragraphs cannot become typed assertions. YC background remains a
profile-completeness requirement, separate from permission to cite it; eligible
reviewed evidence is also mandatory, including each batch question. Public
generation projections are unchanged. Added private ledger/review redaction to
the existing logger and Sentry boundaries; safe counts remain available.

TDD: domain initially 3 failures, action 1, candidate builder 3, privacy 2; each
reproducer passed after its correction. Test fixtures explicitly model saved
human reviews; application code never automatically confirms a suggested excerpt.
Node 24.16.0: coverage suite 1,259 tests / 99 files passed; coverage statements
88.99%, branches 82.17%, functions 88.75%, lines 90.36%. Guardrails 15 passed;
resume-security 145 passed; lint passed (one inherited refund-admin unused-arg
warning); type-check and production build with dummy Supabase values passed;
web dependency audit zero advisories. Browser diagnostic passed at 375/900/1440px
with real component/CSS and a mocked action: explicit type/confirmation, save and
revision reload, withdrawal, unsupported excerpts, no overflow/runtime errors.
Disposable socket-only PostgreSQL executed both foundation and review migrations:
owner RLS, cross-user/anonymous denial, owner-change denial, insert/source/revoke
invalidation, stale revision and bounded payload checks passed. No hosted DB used.

Initial extension CI failed because extension dependencies were not installed
(`@types/chrome` unavailable); clean install/rerun passed 230 tests, lint, types,
build and audit zero. Version policy correctly reports no packaged changes.
Production-build Chromium health/landing/theme checks: 29 passed, dummy env only.
Complete Supabase migration reset
and generated-type comparison, hosted authenticated UI/RLS, real model quality and
token-fit evaluation, hosted CI and release remain not run. Hand-updated additive
database types are not a clean Supabase-generated schema verification.

Critical risk; In Progress. Human attestation supplies atomicity/type/qualification
judgment; deterministic exact support does not prove real-world truth. Prototype
qualifications in separate fields must be included in the reviewed assertion or
the assertion must be left unconfirmed; there is no semantic model judge. Sources
over 600 chars are ineligible. Restrictive exact text can reduce writing flexibility;
realistic useful-output/token evidence remains a release blocker.

Rollout: apply additive migration and verify isolated owner/RLS/revision flows
before deploying readers selecting fact_review; legacy rows start unreviewed.
Do not deploy this reader to a database missing the column. No automatic backfill
or feature activation. Rollback: revert the application change/redeploy; retain
the inert additive column/trigger and user reviews, do not destructively drop data.
Returning to the old application also returns to its weaker provenance boundary.
Next: fresh review and correction, then controlled environment/quality evidence.

### Independent round 3 and diagnostic correction

Fresh-context reviewer `/root/ale46_preparation_review` (exact model unknown)
reviewed frozen dirty snapshot
`bb1981dc23c6c3b5297b2f40fcb1d971c11dc124ec7933c4680a1d7b66b105c4`.
No confirmed material code finding. R4 resolved for the approved human-attestation
boundary; R1–R3 remain resolved for their reproduced cases. Fresh reviewer ran
334 focused tests, 15 guardrails and the disposable PostgreSQL checks; all passed.
Full acceptance verdict blocked by useful-output/token-fit and hosted/full-schema
evidence. Source freshness passed before/after; review was read-only by convention,
not a physical sandbox. Report: `/tmp/ale46-review-lV73gu/review.md`.

Reviewer browser check could not resolve undeclared esbuild from a scratch copy.
Confirmed diagnostic reproducibility gap, not a demonstrated product runtime bug.
Correction declares pinned dev-only esbuild, updates the root lock, exposes native
UI/DB test scripts and runs the no-external-I/O browser diagnostic in existing CI.
Post-review changes also add explicit UUID/revision string ceilings, strengthen
the distinct nine-fact and revoked-parent tests, and format a new test file.
Affected fresh check evidence is recorded after reruns; the previous review is
historical for these changed paths/dependency snapshot, not current full approval.
Three-round budget exhausted; any additional independent review needs explicit
authorization. No completion/merge/release authorization is inferred.

### Post-correction checks — 2026-10-07

Clean Node 24.16.0 `npm ci --ignore-scripts`: 808 packages installed / 809 audited,
zero advisories. Pinned esbuild resolves locally; `npm run
test:candidate-fact-review:ui` passes independently of parent-directory tooling.
Fresh coverage run: **1,260 tests / 99 files**, thresholds passed (same coverage
percentages above); guardrails 15, lint, type-check, dummy-env production build,
web security audit, and `FACT_TEST_PG_BIN=/opt/homebrew/bin npm run
test:candidate-fact-review:db` passed. Changed-file Prettier and whitespace checks
pass. Full `npm run format:check` fails on **19 unrelated baseline files**, all
verified unchanged against main060e2cf. Initial missing-dependency/type and browser
diagnostic failures are historical, corrected by clean installs/explicit tooling.
No generated types, hosted schema reset/CI, paid provider or production action
has been run or implied. Extra-review authorization was requested asynchronously;
unless granted the dependency/diagnostic/bounds correction remains pending that
additional independent review. In Progress; no release readiness claim.

Implementation in progress; Critical risk. The user approved source-backed
factual wording and narrowly tested rewrites on 2026-10-01. Reject unsupported
rephrasing rather than assuming excerpt containment proves entailment.

## Contract and execution context

Source: complete ALE-46 and parent ALE-45, re-read 2026-10-01 through the
Aletheia MCP connection. Base: remote main a9dffaffb889a521944cb29ab2bfa7cef4e4f81a.
Branch: feat/ale-46-atomic-claim-provenance, isolated from unrelated edits.
Full documentation mode: shared private-data/output boundary, Critical risk.

Implement bounded claims (text, kind, source ID, exact supporting excerpt),
separate target sources, normalized exact support, complete final text coverage,
exclusions and source-scope checks for connection/email/InMail/YC (including
per-question batches). Keep evidence server-only; public shapes, 300-character
connection limit, quotas, credit compensation and single-model-call policy stay
unchanged. No database migration, extension release, model judge or SDK upgrade.
Do not mark ALE-46 or its parent complete. ALE-47 and later phases are separate.

## Proposition inventory

Connection observation is target-scoped; relevance is candidate-scoped; CTA
can only be a neutral invitation or supported rationale. Email subject, opening,
positioning, proof, value and CTA can all contain facts and must be covered.
Greeting and signature are neutral/server-owned identity. InMail subject/body
and each YC answer require full coverage, not just numeric coverage. Counts and
approved neutral framing are not factual claims.

## Design

Shared pure domain schemas and application validation own normalization and
support rules; provider adapters own wire schemas; existing services own I/O,
refunds and explicit public projections. No parallel generation pipeline.
Normalization permits NFKC and whitespace equivalence, not punctuation removal,
case folding, synonym replacement, changed actor, changed modality or metrics.
Evidence remains immutable through sanitation; validate final output afterward.
Full-text coverage uses complete supported spans plus enumerated neutral phrases,
not a model's assertion that it remembered every claim. Excerpts must be complete
source units, not arbitrary substrings that drop qualifications. Source-scoped
quotation is permitted; narrowly typed profile-role framing is permitted. New
rewrites need explicit adversarial tests.

Verified locations: modules/candidate-context/domain; modules/outreach/domain,
application/build-outreach-grounding-context, validate-outreach-draft,
render-linkedin-connection, render-cold-email, extension-generate.service;
modules/application-answer/domain, application/build-yc-grounding-context,
sanitize-yc-application-output, validate-yc-application-output,
generate-yc-application.service; both Anthropic repositories; lib/ai/prompts;
app/api/extension/generate/schema.ts. Follow root AGENTS and engineering guide;
no scoped AGENTS found. Re-read each affected caller/test before editing.

## Evaluations and implementation sequence

1. Red-first exact excerpt, unknown/wrong-source, punctuation/Unicode, scope,
   negation/actor/causal amplification, excluded claim and hidden-body-claim tests.
2. Shared contract/validator, source builders, strict tools/prompts, then final
   service validation and immutable sanitization. Keep public projection explicit.
3. Route/refund, per-question scoping and privacy-canary regression tests.
4. Focused tests, coverage, guardrails, lint, types, build and diff check; fresh
   independent Critical-tier review before release. Round 1 requires changes;
   return review of corrections is pending. This is not a completed feature.

Wrong implementations the tests must reject: real excerpt with invented claim;
punctuation-stripped comparisons; model-supplied incomplete ledger; rewriting
the excerpt to match sanitized output; target evidence used as candidate fact;
another question's source; private ledger spread into response/logs; failed
output consuming a successful-generation credit.

## Bounds and rollout

Current output caps are 600 tokens outreach, 1,000 single YC, and at most 8,000
batch YC. Do not raise these silently. Per-string limits alone are insufficient:
30 added 1,000-character excerpts would add 30,000 characters before JSON. Select
aggregate ledger limits and serialize synthetic examples; token fit/quality in
live generation remains unverified without authorized evaluation. Character
counts are not token estimates. Retain 30-second provider timeout.

No deployment or live generation authorized. Rollback eventual backend commit
and redeploy; no database/extension migration. Watch safe validation codes,
rejection rates, latency, tokens and refunds; never log text, IDs or excerpts.

## Evidence

2026-10-01 unchanged-base baseline: 3 deterministic validator test files, 29
tests passed on Node 24.16.0. Not new acceptance evidence. Previous fresh npm
install failed ENOSPC; its partial directory was moved recoverably to Trash.
Initially used an untracked node_modules symlink to ALE-57's lockfile-identical
installation. Turbopack rejected that external symlink. Replaced only the local
symlink with an APFS clone of that installation; no dependency or lockfile change.
The native production build subsequently passed with CI placeholder environment.

2026-10-01 implementation checks (Node 24.16.0): core red-first tests reproduced
14 failures before implementation. The first independent review found four
introduced material issues. Reproduced R1–R3 in three failing tests, then corrected
the source builder, readiness and batch prompt. Latest coverage run: 94 files,
1,164 tests pass; statements 88.89%, branches 81.99%, functions 89.15%, lines
90.24%, unchanged thresholds pass. Existing coverage configuration excludes
modules/; these percentages do not establish new-module coverage. Guardrails:
15 pass. Lint passes with only the pre-existing refund-admin unused-argument
warning. Diff whitespace and scoped formatting pass. Web dependency audit:
zero vulnerabilities on the unchanged lockfile. Initial native types passed;
concurrent typegen/build later raced over .next/types (ENOENT), so the separate
native type-check is being repeated after build. Build passes. Hosted CI,
browser/extension checks, model tokenization and live quality/cost evaluation
have not run. No production calls, commit, push or deployment.

## Independent findings and disposition

Round 1 reviewer: /root/ale46_independent_review, fresh context, exact model
unknown; no cross-model claim. Read-only full diff and affected consumers review
on snapshot c084dbe71c41af6e98346beca82b206b630fcaacc332e67d2b2fb293e0001405.
Verdict: changes_required. All four findings are confirmed, introduced and
material. Source remained frozen during that review.

- ALE46-R1 (P1): extracting evidence.actions separately discarded cross-field
  qualifications. Correction retains the complete original evidence record,
  including context/title, as an inseparable source. Oversized/truncated records
  are not admitted. Regression: build-atomic-sources.test.ts simulated-results
  case failed first and now passes. Return review pending. This containment fix
  does NOT resolve R4's proposition-level typing requirement.
- ALE46-R2 (P2): per-question prompt IDs named old parent sources while claims
  needed atomic leaf IDs. Correction maps each question to eligible atomic IDs
  using the same rootId rule as final validation and includes target IDs.
  Real builder-to-prompt test failed first and now passes. Return review pending.
- ALE46-R3 (P1): old readiness allowed no usable atomic sources. Readiness now
  uses admissible candidate roots and checks every batch question's evidence.
  Red-first builder regression plus service test prove 422 before quota, credits
  or model calls for the reproduced empty-source case. Return review pending.
- ALE46-R4 (P2): OPEN. Paragraphs/whole records remain typed as a single action
  despite containing company, technology, metric and other assertions. Complete
  copying and coverage are not semantic atomization. Do not claim ALE-46's
  individual-proposition contract satisfied or waive this criterion.

The earlier failing sanitation guardrail expected private evidence to be rewritten
alongside redacted body text. Updated it to assert immutable, structurally valid
evidence, pre-sanitation validity, public-body redaction, and final CLAIM_COVERAGE
rejection. The sanitizer unit regression now likewise proves original validity
before rejecting the changed output; it no longer passes merely on schema failure.

## Remaining design and release gates

Current claim templates permit complete source quotation and narrowly typed role
framing; this is a draft safety boundary, not proof of useful professional prose.
Existing success fixtures that repeat neutral/candidate phrases establish route
mechanics only, not realistic quality or token fit. Serializing approved texts
alongside excerpts also duplicates prompt content; aggregate serialized input and
representative output budgets remain unverified. Existing output caps are intact.
User decision requested: whether a measured bounded output-cap increase is allowed
if necessary. No increase or additional model judge is authorized by this record.

To resolve R4 without unreliable sentence-splitting, the input needs separately
supported assertions with their qualifications attached, or a more restricted
contract that rejects mixed free-text evidence. Both materially affect existing
profile usability; decide the fact-preparation boundary before marking the current
quote-based implementation complete. Do not silently add an extraction/judge call,
remove qualifiers, or weaken atomicity to obtain a passing review.

Round 2 return review completed on snapshot
ed751c08049fc8af4d65aa84677cc0450746a4f6ca9932d4d5683c0ce010dcd0.
Same independent reviewer verified R1–R3 resolved for the reported scenarios,
including a batch with usable evidence counts [0,1], and verified the corrected
sanitation test with valid original evidence. No new material correction finding.
Overall verdict remains changes_required because R4 and token/quality feasibility
remain open. Exact model unknown; no cross-model claim. Source freshness passed
before/after review. Separate native type-check after build passed. These final
evidence updates change documentation only after that reviewed snapshot.

Next incomplete step: settle and implement per-assertion fact preparation and
bounded prompt/output representation, then realistic tests and independent return
review. ALE-46 remains In Progress; ALE-47 remains blocked by its prerequisites.
