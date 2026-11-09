# LinkedIn target-context repair

## Return review corrections — 2026-11-09

Significant backend follow-up on the existing branch. Keep exact reviewed
source text, complete note options, the 200-character Basic cap and the
legacy 300-character default. The route must deny retracted work or closed
openings before model or quota work when no independent target fits. A
standalone optional-experience requirement must not veto an affirmative JD
responsibility. Candidate ranking must use completed work and omit the failed
portion of a compound assertion. An overlapping longer reviewed fact must
stay intact when it qualifies the shorter fact. If it cannot fit, omit the
short fragment too.

Add route regressions with and without a JD, including an independent profile
fallback, exact reviewed wording, and notes under 200 characters. Reuse the
existing source builder and final validators. Run native checks and independent
review before publishing. Live verification and parent completion stay open.

The correction distinguishes job status, optional applicant experience and
affirmative duties. It recognizes explicit profile work retractions and keeps
an independent profile headline available. Candidate ranking stops before
failed or attempted work. The full reviewed text remains the rendered claim.
A longer reviewed excerpt supersedes an exact contained fact on text
boundaries, including qualifications before or after that fact. The ranker
scores each completed first-person sentence separately so unrelated
sentences cannot combine into one stronger claim.

The route suite reproduced 16 failures for the return findings and four for
adjacent controls. All 66 targeted cases pass, including both under-200 flows.
The prior review matrices also pass with both note limits and rhetorical
plans enabled and disabled. They use mocked admission and model services.
The independent return reproduced passive and application retractions,
optional requirements after a dash, attempted work phrased as a gerund,
and fragments inside longer reviewed facts. Eight targeted tests reproduced
those failures. Two further tests showed why ranking must keep sentences
separate. All 80 targeted cases now pass. Independent review receipts are
recorded separately so they can identify the exact source snapshot.

The next return confirmed containment and found that named profile headlines
could bypass work-topic retraction screening. The source builder now checks
specialties from the same headline parser used to render them. Retractions
also cover narrower supported agent topics and an immediate unambiguous
reference to a single prior topic. The route verifies that independent safe
profile context still works. Added coverage also distinguishes “a plus, not
a requirement” from a withdrawn duty and excludes unsuccessful attempts
described inside a completed action. Six new route cases reproduced these
failures. All 87 targeted cases then passed.

The third independent round verified the whole qualification and reproduced
further closed-application, profile retraction, optional-experience and
incomplete-work variants. The local correction recognizes application
closure and a dated immediate reference to retracted work, allows modifiers
in optional experience, and excludes “trying to” work from relevance.
Eight maintained route checks failed before that correction. All 95 targeted
cases pass afterward. This correction still requires independent review
before publication.

## Project introductions from ordinary context — 2026-11-09

Significant follow-up from `b06f8d1`. A profile alone or a normal multi-sentence
JD should yield a relevant project introduction when a fitting reviewed action
is available. Match before spending the one-story budget. Keep the reviewed
statement intact and express interest in the recipient's topic without
asserting a role, hiring relationship or qualification the source cannot prove.
Preserve the explicit target-only fallback when no relevant reviewed fact fits.

Route regressions reproduce the two production 422s and the omission of a
usable fact. They compare the exact first sentence and final 200-character cap, and
include excluded, unrelated and unreviewed facts. Verify legacy callers, final
grounding, private source data and existing pre-model denial. No changes to
storage, the extension, model calls or release configuration.

The selector now uses complete recognized headlines or an interest in a topic
supported by affirmative work text. For a long passage, it can keep complete
topic-bearing sentences after checking the entire passage for exclusions and
qualifiers. A topic sentence cannot establish that someone currently works for
an organization or that a team is hiring.

The automatic path compares eligible facts across reviewed projects before
projecting the winner. Initial independent review reproduced five failures:
the story budget hid a later short fact, discontinued or markup text supplied
interest, negated experience ranked as relevant, long JDs lost specific work,
and unsafe target wording displaced a valid profile match. The corrections
have passing route regressions. Candidate qualification remains verbatim.

The third review independently reproduced closure of the six earlier cases
with rhetorical plans enabled and disabled, then found a remaining gap in
present-progressive profile text and JD responsibility sentences. Both cases
failed locally before the final correction and pass after it. The latest
return review found ordinary pasted lists and comma-separated modifiers could
hide relevant job context. It also found negated matches and overlapping
reviewed facts that could lose their qualifications. Match JD bullets without
rewriting their source text and reject negative topic assertions before
ranking. Prefer a complete reviewed assertion over its overlapping fragment
within the same story. When the complete fact cannot fit, the fragment stays
ineligible. Route regressions cover both 200-character flows, negated targets
and candidates, and the target-only fallback.

JD matching permits unrelated requirements beside a supported responsibility.
It still rejects passages that negate a recognized topic or retract the
hiring claim. Screen the whole JD before using individual paragraphs so a
blank line cannot hide a retraction. A reviewed continuation inside the same
sentence stays attached, including qualifications introduced by a dash or
colon. The route tests exercise the rendered note with its original
qualification and enforce the Basic limit. Review receipts and local checks
are recorded outside the repository in the ALE-46 blocker review packet.

The third blocker review also reproduced a negative clause within a candidate
fact, a standalone prototype qualification, a separate logistics clause, and
later retractions. The correction ranks only the affirmative candidate wording,
keeps the full reviewed assertion, ignores a separate no-relocation or no-travel
requirement when matching, and suppresses retracted topics. A standalone safe
profile headline can still support a draft. Ten new route regressions failed
before these corrections. All 2,199 local tests, 15 guardrails, the offline
grounding gate, lint, types and the production build then passed. The same local
run of the independent review harness passed 192 additional cases across the
Basic and legacy limits and both rhetorical-plan settings. The corrected
snapshot still needs independent sign-off before publication.

After deployment, retest the extension with the same profile alone and with a
normal JD. Use a real reviewed action that can fit with the interest and CTA.
Verify that the action leads the note, the final count is at most 200, and no
invitation is sent during testing. Roll back by reverting the backend change
and redeploying. Hosted verification and the parent acceptance gates remain open.

## Related application monitoring evidence — 2026-11-08

Significant. Continue the current ALE-46 branch. A LinkedIn connection note
may use a reviewed fact describing affirmative application or service
monitoring as related experience when the target mentions AI observability.
Prefer existing direct topic matches. Apply the bridge to story ranking and
the final candidate–target pairing. Accept AI Observability as a named profile
specialty. Keep candidate wording exact and render target interest separately.

Test through the route with an approved job fact and with the profile alone.
Include unrelated AWS work, negated monitoring and direct relevance as
controls. Keep review, exclusions, source provenance, final safety and the
200-character Basic cap. The prose and YC selectors retain their existing
rules. Provider calls in local tests are mocked.

The no-JD regression returned 422 before the change. With a JD, the route
returned a recipient-only note and omitted the monitoring fact. Both paths
now use the full reviewed AWS sentence. The bridge applies only to explicit
first-person monitoring work and ranks below direct topic matches. Generic AWS
work, hiring applications, training material and negated monitoring do not
qualify through the bridge. Verification and review receipts are stored in
`/Users/nagarjunmallesh/.codex/artifacts/aletheia/ale46-related-monitoring-2026-11-08/`.

Independent review reproduced three edge cases before correction. Related facts
could fill all draft options before a direct fact, separate words or an
organization name could activate the target bridge, and recruiting activity or
failed monitoring could qualify. The corrected selector keeps direct options
ahead within the existing job/profile priority, checks the target topic field
and rejects those candidate-side cases. It also recognizes reviewed statements
about contributing to the infrastructure, including contractions and
qualifications such as `without downtime`, while rendering the original text.

The return review reproduced direct evidence losing at the one-story budget,
former team names activating the bridge, and unclear recruiting or failed
monitoring wording qualifying. Direct pairs now take precedence at both
budgets. Named fields require an affirmative observability topic. Monitoring
with no downtime stays eligible and preserves the qualification. Added route
regressions for competing stories with and without the JD and restored strict
typing on the target ranker callback.

The third review found variants of failed monitoring and hiring activity
still passing a prefix-based check. The bridge now checks whole statements
against the supported technical forms and recognizes only explicit context
qualifiers such as AWS, production, deployment periods and no downtime.
Unknown qualifiers stay attached to the source and receive no related boost.

Live verification requires a deployed branch and matching profile/JD inputs.
Roll back by reverting the related-monitoring increment and redeploying.

## Eligibility before selection — 2026-11-08

Branch `fix/ale-46-linkedin-target-eligibility`, based on verified main
`6fb4f77`. Risk: Significant because this changes which target facts reach
the shared LinkedIn composition pipeline. The parent provenance gate remains
Critical.

Apply the existing wording and length rules before a LinkedIn target uses
one of the bounded selection slots. Count wording rejections separately
from overlength and budget rejections. Keep job and matched evidence priority
among eligible facts. Keep the existing rewrite rules, exact source excerpts,
exclusions, injection screening, final validation, and 200/300-character
budgets. Other generation modes keep their existing selection rules.

Regression: the real route and preparation path must produce a complete note
within 200 characters after 16 unsupported blocks, both with a valid job fact
and with only a valid profile fact. An unsupported JD must not starve the
profile fallback. All-unsupported context must still return a pre-model 422.
Use a mocked provider and run the affected backend checks and fresh review.

The four route regressions failed on the base behavior and passed after the
selector correction. The tests cover profile-only, usable JD, profile fallback
and refusal before quota or the provider. Qualified and literal text is kept
intact by the source rules but rejected from the LinkedIn composition pool
when no approved introductory wording exists. Verification and review receipts
are recorded in `/Users/nagarjunmallesh/.codex/artifacts/aletheia/ale46-target-eligibility-2026-11-08/`.

Review reproduced a lost eligibility event when an explicit reviewed story
was paired with entirely unsupported target text. Preserve the explicit 422
and defer this empty-target denial to composition so it logs only counters.
The route regression failed before the correction and checks the same status,
diagnostics, and absence of paid work.

The return review found that a mixed pool could falsely blame unsupported
wording when an eligible target instead failed final safety. Report the
wording reason only if the selector retained no target. Keep the separate
wording count in the eligibility event. The mixed-pool route regression
failed before this correction and preserves pre-model denial.

After deployment, repeat generation with and without a JD in a real Basic
composer and compare content-free eligibility counters. An unsupported headline
or a JD with no complete approved fact can still return 422. The visible
headline and shortened JD from the reported incident still produced zero
options in a local replay of those inputs, with zero budget rejections. The
full original page was unavailable for this replay. Roll back by reverting the
backend change and redeploying. ALE-46 remains In Progress.

2026-10-28. ALE-46 follow-up. Base `bd58f44`, branch
`fix/ale-46-linkedin-target-context`. Initial risk: Critical because instruction
detection and the private grounding boundary change. Parent ALE-46 stays In Progress.

## Contract

The user chose complete facts: do not split sentences, trim qualifiers or permit
partial quotations merely to fit LinkedIn. Empty, whitespace-only and omitted JD
remain valid. A usable profile passage alone must work; otherwise reject before
model/quota/credit reservations with an actionable explanation. A long profile
must not spend the bounded target pool on passages that cannot fit a note and
thereby exclude a usable JD. Recognize names/security research separately from
instruction attempts. Keep exact support, exclusions, scope, final validation,
300 characters, 600 model output tokens, private ledger and current compensation.

Write request-correlated, content-free eligibility counters/reasons and the
correct timing failure code. No new telemetry service, credentials, text logs,
database changes, paid model calls or extension release. Public response changes
are additive diagnostics; the existing extension displays the error message.

## Evaluation plan

- Red-first: benign Dan/research cases, profile-budget starvation, request logger
  propagation and accurate 422 timing. Retain actual malicious instruction cases.
- Test empty/whitespace/omitted JD, useful short profile, complete long passages,
  exclusions, aggregate bounds, UI controls, and post-transform source coverage.
- Exercise the real context builder through the mocked route, including genuine
  injection rejection before any provider/admission call, instead of substituting
  an always-eligible context in every route test.
- Focused tests, root coverage, guardrails, policy, lint, types, build and fresh
  independent review. Report hosted/real-provider checks separately as not run.

## Deployment and rollback

Push the reviewed backend branch for a manual PR. After deployment the user will
retest profile-only and profile-plus-JD generation. Correlate `operationId` with
`outreach.target_eligibility` and `generation.timing`; no raw inputs are required
to identify the rejection class. Revert this backend commit to roll back.

This cannot guarantee that every profile has a complete fitting fact. An all-long
or excluded target pool remains a deliberate 422. A model-selected optional
candidate/long CTA can still exceed the final limit and be rejected/refunded;
this repair concerns pre-model target eligibility, not a new composition planner.

## Evidence

Initial regressions failed on the old implementation: three benign injection
cases, target budget starvation and missing request logger propagation. The
previous keyword-only jailbreak test asserted the false-positive behavior; it is
replaced with a real instruction-to-enable-jailbreak case and six instruction
variants. Existing exfiltration/override/role/encoded-payload tests remain.
Local checks passed: 1,383 tests across 106 files with coverage (89.35% statements,
82.59% branches, 89.12% functions, 90.71% lines), 15 guardrails, type checking and
lint (one inherited unused-variable warning in lib/auth/refund-admin.ts). Policy
installation checks, root dependency audit (zero vulnerabilities), production
build, extension CI (240 tests, zero audit findings, types/lint/build) and 28
Chromium landing/theme smoke cases passed before the review corrections.
Affected backend coverage, guardrails, lint and types were rerun after correction;
the production build is rerun before commit. Extension code/dependencies and UI
are unchanged, so their earlier checks remain applicable.

Fresh-context review round 1 found two medium, material issues: ALE46-R1,
instruction variants bypassed the narrowed heuristic (introduced); ALE46-R2,
adjacent control lines remained eligible (pre-existing, incomplete fix within
this contract). Five regressions failed before correction. R1 now detects direct
"switch to DAN" and "use this jailbreak" commands while keeping the benign-name
and research tests. Preparation tests verify injection-safe mode, no atomic
sources and no raw candidate data. The existing high-level safe summary is
retained, but LinkedIn preflight rejects before any model call. R2 rejects whole
paragraphs composed only of known control lines; mixed factual paragraphs stay
intact. The corrected regressions pass in the full suite. Return review and final
snapshot/commit receipts are recorded outside the source tree at
`/Users/nagarjunmallesh/.codex/artifacts/aletheia/ale-46-target-context-2026-10-28/`.

Not run: real Claude generation, hosted CI, production deployment/retest or
production log inspection. Historical invocation logs and the exact original
profile/JD payload were unavailable, so the specific historical request cause
cannot be proven. Local synthetic reproductions establish the defects repaired,
not proof that every reported invocation followed the same path. No database or
auth changes require a migration. Final risk remains Critical because private
context/instruction handling is affected; human PR review and deployment retest
remain required. Parent ALE-46 stays In Progress.

Reusable regression lesson: apply output feasibility before spending source
budgets, and test the actual newline representation from profile extraction.
Do not detach a qualification to make a source fit. Instruction heuristics are
one defense, not proof that arbitrary text is safe; exact-source and final-output
checks remain mandatory.
