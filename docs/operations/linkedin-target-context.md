# LinkedIn target-context repair

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
