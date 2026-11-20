# ALE-30 production follow-up: concise initial emails

## Execution context and contract

2026-11-20. User requested diagnosis and a local fix for the two attached
`EVIDENCE_SELECTION_UNAVAILABLE` operations from production acceptance. This is
a generation follow-up, newly authorized by that request; ALE-30's original
feedback-only increment remains unchanged. Isolated branch
`fix/ale-30-grounded-outreach-preflight` starts at main `ad26957`.
Full documentation mode; risk Significant because shared output constraints
affect preflight, model options and final validation.

## Diagnosis

Both submitted operations were explicit-story Initial Outreach requests that
returned 422 before provider work. A read-only account check found two current
confirmed frontend facts (23/28 words), and three current confirmed device
automation facts (8/24/18 words). No raw account text is stored in this record.
Local execution of the real review mapper, grounding builder and composer with
these facts and synthetic matching context rejects both explicit Initial
Outreach compositions; Role-Fit Summary succeeds. This is a structural
reproduction, not a replay of the original complete HTTP payload.

Initial Outreach requires 120–185 words, whereas the composer only assembles
complete reviewed facts (at most three), bounded target context and framing.
The frontend control cannot exceed 107 words even with target context. A
minimum intended to encourage detail becomes an unnecessary evidence refusal.
The existing error code conflates unavailable reviews with no fitting option.

## Goal, scope and non-goals

Prefer the existing valid 120–185-word options; only when none survive all
checks, allow complete, relevant 40–119-word cold Initial Outreach emails. Forty words
reuses the existing concise Role-Fit Summary floor, retaining room for proof and
an ask without manufacturing filler. Keep all provenance, review freshness,
selection roots, exclusion, injection, field and maximum-length controls.
Keep InMail Initial Outreach at its existing 80–120 words and every other mode
unchanged. No shortening excerpts, new facts, extra provider calls, retries,
account mutations, billing/admission changes, extension package or dependencies.
LinkedIn's 200-character boundary and rich profile extraction are separate.
Automatic device-story eligibility still requires the existing affirmative
experience criteria; explicit selection does not create an automatic-match claim.

## Design and affected callers

`lib/ai/email-formatter.ts` owns limits; `output-constraints.ts` projects them into
preflight and final validation. Correct this shared rule rather than bypassing
the composer or finalizer. Its direct table consumer, the offline email-quality
rubric, must see the same cold-email floor. Preserve the independent InMail floor
in `getEmailWordLimit`. Store the preferred minimum beside the hard minimum;
the composer searches that tier first with its existing safety/preview/options
bounds, then the concise tier only if no full option survived. Existing long-fact
fixtures remain long options. The old blank-JD length-only denial is now a valid
concise introduction. The focus-accounting denial fixture uses a genuinely
sub-40-word fact, preserving its no-charge/no-provider assertions.

Inspected callers: prose composer, outreach service/pre-admission HTTP boundary,
provider selection tool, final provenance validator, email renderer, offline
quality evaluator and canonical output constraints. No database/auth code edits.

## Evaluation matrix

| Criterion | Case and expected result                                                                            | Check rejecting a wrong fix                                                         |
| --------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AC1       | Two short reviewed frontend facts, explicit and automatic: complete 40–185-word initial email       | Real preparation + HTTP/provider-option regression; a label-only change still fails |
| AC2       | Three short confirmed device facts with explicit selection: valid initial email using selected root | Same HTTP path; no unrelated story may satisfy the selection                        |
| AC3       | No/stale/unrelated/excluded/injected facts: existing denial before quota/provider                   | Existing route, selection, relevance and guardrail regressions                      |
| AC4       | Below 40 or above 185 remains invalid; other modes/InMail retain limits                             | Independent hardcoded constraint tests, composer and finalizer regressions          |
| AC5       | Evidence text remains whole and source-backed; no padding/truncation                                | Exact-excerpt, qualification and final provenance tests                             |

Behavioral TDD: observe new regressions failing against main before implementation.
Use Node 24 and existing locked dependencies, with mocked external I/O. Run focused
HTTP/composer/constraint/rubric tests, full coverage, guardrails, lint, type checks,
policy and build. Independent read-only review required on the final diff.

## Privacy, compatibility and rollout

No request/response shape, stored data, permission or transport change. Existing
1.0.35 clients can consume the shorter body. Rejected preflights remain uncharged;
successful calls retain existing one-attempt accounting. No actual provider call
is needed to verify the deterministic fitting defect locally. Do not export raw
account excerpts, drafts or database responses into diagnostics or Linear.
Backend deployment and production rerun remain separate from this local fix.
Rollback: revert the constraint/test increment and redeploy; no data repair.

## Verification and handoff

Implemented with two runtime files changed: the canonical limit and the existing
composer's option search. New HTTP regressions use synthetic facts representing
the two affected shapes; no private account excerpts are committed. Four intended
red failures were observed before the fix (three HTTP 422s and the 120-word floor).
The new concise successes each make exactly one mocked provider call. Existing
long-form, negative-relevance, exclusion, injection and provenance checks pass.

The same read-only fact mapping/composition probe after the fix returns selected
frontend options of 67–107 words and selected device options of 46–103 words.
Automatic frontend also succeeds; automatic device still has no qualifying
affirmative-experience match under existing rules. These are local deterministic
options with synthetic context and identity, not new live model responses.

Passed on Node 24.16.0: 3,372 tests / 154 files with coverage (statements 91.17%,
branches 85.84%, functions 91.82%, lines 92.22%); 15 guardrails; lint (one inherited
unused-argument warning in `lib/auth/refund-admin.ts`); engineering policy and
Next.js production build using placeholder environment values. Type checks ran
before the final preferred-tier exact-count refinement; the build also checks
TypeScript. Final explicit type-check receipt is linked below.

The first build failed because Turbopack cannot follow a `node_modules` symlink
outside this isolated worktree. A locked `npm ci` succeeded (12 inherited moderate
advisories), and the normal build passed with local dependencies. An attempted
dependency-copy/build run and an early test start were stopped/superseded during
setup; they are not passing checks. No dependency or lockfile changes.

Final execution and independent review receipts live outside source at
`/tmp/ale30-preflight-*-final.log`, `/tmp/ale30-preflight-coverage-verified.log`
and `/tmp/ale30-preflight-review-*`. Review is pending at source capture; final
verdict is in those receipts and the handoff. The source manifest verifies review
freshness. Preserve ALE-30 In Progress and VoiceOver deferred. No commit, push,
deployment, Chrome reload or production generation rerun is part of this local fix.
