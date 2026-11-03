# ALE-49 — constrained rhetorical plans

## Change contract — 2026-11-02

Risk: Critical — private source context crosses the model/tool boundary and invalid
selections must preserve generation compensation. Main baseline: `6389ee7`.
Full documentation mode. Implementation is not release authorization.

Goal: vary the ordering of complete supported facts in one existing model call,
without factual rewriting, extra calls, new infrastructure or client changes.
Shared plan ownership belongs to grounding/domain because outreach and YC consume
it. Channel composers own greetings, CTAs, signature and final channel validation.
Strict legacy tool schemas stay strict; private server plans never enter public
responses, feedback, logs or persistent storage.

## Eligibility and deterministic selection

The ALE-48 corpus exposes dominant target → action → outcome ordering in long
outreach and action → outcome ordering in YC. Approved archetypes:

| Category / evidence                                | Eligible shape                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| LinkedIn with candidate and target                 | evidence-led or target-led                                       |
| Cold email / InMail with candidate and target      | target-led, evidence-led; outcome-led when outcome/metric exists |
| Short follow-up / clarification / role-fit summary | concise-direct                                                   |
| Outreach without fitting candidate evidence        | target-only                                                      |
| YC with selected candidate facts                   | evidence-led; outcome-led when outcome/metric exists             |

No question-led narrative: existing complete final CTAs remain authoritative.
Source-less plans fail. Public target input retains the existing screening policy.
Owner-confirmed candidate facts are untrusted data, not permission to change tool
fields or execute instructions. Instruction-looking wording is not universally
rejected: it can be retained verbatim as reviewed data. The selector cannot obey
it by returning new factual text, private context, tools or fields. Existing final
content safety, exclusions and atomic coverage still apply; a plan never turns
rejected input into permission to bypass them. Target-only options cannot
replace a qualifying candidate introduction. Weak evidence is already removed by
ALE-54 selection, and is not restored here.

For equally eligible orders, a SHA-256 context/claim binding selects a stable
archetype; there is no randomness, clock or cross-user state. Current source
contents, selected facts, intent, category and mode bind the plan. A batch's
question index offsets equally eligible orders deterministically. Eligibility
always takes precedence. Same request and source snapshot yield the same plan.
No truncation, dropping qualifications or combining unrelated sources is allowed.

## Model boundary and compatibility

`RHETORICAL_PLANS_ENABLED` is server-owned, defaults false and enables only for
exact `true`. Read once per request and carry explicitly to composers and parsers.
Disabled paths retain exact legacy tool schemas, prompts, options and response
behavior. Enabled tools return an option ID plus a strict `{reference, archetype}`
plan selection. The private ordered atomic references are resolved server-side
from the current option; stale/mismatched/extra fields fail, never repair/retry.
YC uses complete validated per-question options when enabled; every question's
source subset and the existing final validator remain authoritative.

Enabled prompt versions: outreach `7.0.0`, YC `yc-3.0.0`. Disabled versions remain
`6.0.0` and `yc-2.0.1`. No public API version bump: public result schemas and the
independently deployed extension are unchanged. No SDK/dependency/migration work.

Existing output budgets remain 600 LinkedIn, 2,400 prose, 1,000 single YC and
at most 8,000 batch YC tokens; admission reserves these same budgets. Selection
adds fewer than 160 ASCII bytes per plan reference/archetype, at most five for a
batch, replacing YC body/ledger output when enabled. Existing bounded option
previews cap prompt growth; tests must assert actual serialized bounds. Provider
latency and realized cost are not established by local fixtures. No new model
request or retry is permitted; deadline and SDK retry policy remain unchanged.

## Evaluations selected before implementation

- Red regression: source-less, foreign, stale or altered plan selections must
  reject; ordering facts with a detached plan must not pass.
- Stable repeated selection; category/mode eligibility, empty-candidate fallback,
  complete CTA/signature, atomic coverage and exclusion/injection rejection.
- Flag-off exact legacy parity, including the ALE-48 saved baseline report.
- Mocked SDK and service checks: one call, fixed caps, strict selection,
  compensation on invalid output, no private plan/ledger exposure.
- Enabled actual composers evaluated against the locked ALE-48 positive and
  negative corpus: zero new safety/coverage failures, no lost candidate/target
  references; at least 0.15 reduction in each measured dominant-pattern group.
  A failed diversity gate is recorded, not hidden by changing baseline fixtures.
- Focused Vitest, full coverage, guardrails, lint, types, policy, build, diff check.
  Fresh independent review before handoff. No provider or production mutations.

## Rollout / rollback

Keep production flag absent/false. Operators may enable only after independent
review and subsequent authorized provider/human rollout evidence. One deployment
owns the flag; no NEXT_PUBLIC alias. Rollback: false/absent and redeploy, restoring
legacy prompts/options. No data rollback needed because plans are request-local.
Parent ALE-45 and this issue remain open during implementation.

## Execution context

Branch `feat/ale-49-grounded-rhetorical-plans`, based on verified main `6389ee7`.
Final pre-merge verification is checking the complete tracked/untracked diff and
current receipts. Feature remains disabled; no live calls authorized. Unrelated
primary checkout changes are preserved. Separate live/provider/human rollout
work is not part of this local final audit.

## Implementation evidence — 2026-11-02

- Passed: initial red plan and YC option regressions were observed before their
  implementation. Later red diversity evaluation exposed object-key-order-sensitive
  hashing; canonical argument serialization plus a regression corrected it. The
  fixed baseline corpus and thresholds were not changed.
- Passed: implementation coverage before the review correction: 1,815 tests / 126 files; statements 90.03%,
  branches 83.85%, functions 90.74%, lines 91.25%. Guardrails 15/15. Lint has zero
  errors and the existing refund-admin unused-argument warning. Type-check and
  policy installation pass. Dependency audit passes the high threshold; inherited
  moderate tooling advisories remain outside this change.
- Passed: actual enabled first server options over the unchanged locked corpus,
  with no external I/O: zero new factual/safety failures, unchanged candidate and
  target reference counts, preserved negative controls. Dominant pattern rates:
  cold initial 1.00 → 0.67, InMail initial 1.00 → 0.67, YC 1.00 → 0.80. The small
  YC corpus still has a dominant shape; the predefined 0.15 improvement gate passes.
  This is eligibility for subsequent human/provider review, not rollout approval.
- Passed: exact legacy saved ALE-48 baseline remains identical when disabled.
  Mocked HTTP tests cover all outreach channels, current selections, final channel
  validation, public metadata privacy and invalid-plan daily-slot compensation.
  YC single-answer service tests cover credit compensation, and five-answer tool
  tests verify per-question membership, duplicate/stale IDs and one 8,000-token call.
- Bounded work: at most 64 atomic sources, 12 claims per plan; eight outreach or
  per-question YC options; 256 expensive validation attempts per composer/question.
  YC uses at most three complete candidate facts per offered answer, preferring
  larger fitting combinations before smaller fallback. No approved fact is cut.
  This finite search can reject a request with no offered valid combination;
  it is not an exhaustive proof that no possible wording can fit.
- Preview allowance: prose retains 12,000 serialized preview bytes; YC shares
  24,000 bytes fairly across at most five questions. Escaping can expand tool
  description bytes; these are prompt bounds, not provider token measurements.
- Final implementation review/build receipts are recorded outside source at
  `/tmp/ale49-rhetorical-2026-11-02/` and retained artifact copies at
  `~/.codex/artifacts/aletheia/ale49-rhetorical-2026-11-02/` after validation.
- Not run: new real-model quality/token-fit/latency/cost evaluation, human usefulness
  comparison, hosted auth/RLS/concurrency checks or production flag activation.
  This phase changes no auth/RLS/schema/admission policy; existing parent release
  evidence remains separate and is not claimed complete. No CI push/PR yet.

The feature remains disabled and ALE-49 remains In Progress. Any material review
finding must be corrected and its affected checks rerun before handoff.

## Review correction

ALE49-R1-001 (P2, confirmed, introduced contract gap): the enabled LinkedIn
parser retained legacy `character_count` stripping, so its strict tool contract
accepted that extra field. The new enabled parser regression failed first; the
correction passes raw enabled input to strict current-option parsing while
preserving the disabled/standalone legacy compatibility. Return review and
current-source receipts live in the evidence directory above. No source
support, public count contract, privacy check or compensation rule was relaxed.

## Final pre-merge audit — 2026-11-02

Re-read the complete ALE-49 Linear criteria and full diff (including untracked
modules) against fetched main/merge base `6389ee7`. Final risk remains Critical:
private source/tool-output and compensation boundaries. Source and installed
runtime remain unchanged since the 1,816-test implementation correction; existing
coverage, guardrails, types, lint, policy, build and extension checks are retained
only after source-fingerprint verification. No changes to auth, RLS, migrations,
permissions, quota or credit business rules; no new model call or dependency.

Shared plan ownership, strict parser/render/finalizer paths, request-local source
and question binding, bounded search/preview memory, fixed model caps/deadlines,
privacy projection and compensation were inspected. CPU-only diagnostics and
serialized schema parity are recorded separately; no provider latency/cost
improvement is claimed. The locked quality corpus, thresholds and off behavior
are unchanged. Flag rollback remains false/absent plus redeploy.

ALE49-FINAL-001 (P3, confirmed non-material evidence overclaim): the short YC
injection fixture could fail solely because it had fewer than 50 words. Renamed
that bounded-answer case and added a length-qualified characterization through
actual fact review and grounding preparation. It proves reviewed literal text
remains data, while arbitrary body/instructions/foreign-source tool fields reject.
The earlier blanket-rejection statement above was corrected; no runtime guard was
added or weakened. This is test/documentation correction, so characterize existing
behavior rather than claiming a new red runtime regression.

Current final audit/check/review receipts:
`/tmp/ale49-verification-2026-11-02/`, retained at
`~/.codex/artifacts/aletheia/ale49-verification-2026-11-02/`.
New tests and these substantive records need current focused/full checks and the
ongoing independent final review before the audit is closed. Keep ALE-49 In
Progress and production disabled. Provider/human evaluation and hosted PR CI are
not run by this audit; pending parent release gates are not asserted complete.
