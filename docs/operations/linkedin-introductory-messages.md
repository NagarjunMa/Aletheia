# ALE-46: restore introductory LinkedIn notes

## Current increment — 2026-10-29

The user has expanded the desired product behavior to
natural candidate introductions, stronger problem-level relevance and a preferred
260-character note where the platform supports it. See the
[next-phase plan](linkedin-relevance-composition-plan.md) for the new contract,
dependencies and evaluation gates. Its A/B1 candidate-eligibility foundation is
implemented and verified locally; broader relevance and composition remain pending.
The original introduction implementation and evidence below are preserved as
history; they do not establish completion of the expanded contract.

## Contract — 2026-10-28

Risk: Critical — source-backed wording becomes a public draft from private candidate evidence.
Branch: `fix/ale-46-linkedin-introductory-messages`; base: `bb8170a`.

Restore an introductory greeting, target/job interest and relevant reviewed candidate
experience within 300 characters. Prefer supplied job context over a generic profile
headline. Blank JD must continue using the selected profile. Never represent a job
requirement as the candidate's qualification or invent experience when reviewed facts
are absent.

The regression is a product-contract failure: the ID selection tool's server renderer
only offered `The supplied context says` for targets. Candidate facts additionally
require individual review, and complete paragraphs exceeding the note budget are
excluded. Passing HTTP, exact-source and privacy tests did not establish usable prose.

## Design and boundaries

Keep model-selected IDs and the existing private ledger. Add finite target-interest
wording only for LinkedIn sources, with a narrowly recognized complete hiring sentence
rewrite and a complete role/company/specialty headline rewrite. The latter expresses
interest in the specialty without attributing it to the role. Qualified, ambiguous or
unrecognized formats retain complete quoted context with reader-facing interest
framing. Add the existing neutral greeting. Use the same approved wording for prompt,
fit calculation, composition and final validation. Prioritize JD sources in selection
and instruct selection to include relevant reviewed experience when it fits.

Do not auto-confirm resume/profile facts, cut qualifications, infer candidate fit,
add a judge/model call, increase the token cap, change billing, add telemetry or change
extension/API contracts. Existing source ownership, exclusions, injection screening,
post-sanitation validation and refund paths remain mandatory.

## Evaluation plan

Red-first: Apple-style hiring context plus reviewed synthetic project produces a
human introduction and relevant experience; blank JD uses profile context. Negative
cases: qualified/negated hiring text cannot use the narrow rewrite; no unreviewed
candidate promotion, wrong-source IDs, hidden assertions, altered excerpts, exclusions,
invalid CTA and overlength output still fail. Route tests prove actual preparation,
sanitation, final validation and public response privacy.

Run focused tests, guardrails, coverage, lint, type-check, policy, dependency audit,
build and a fresh independent review. Hosted/real-model quality and token-fit evidence
must be distinguished from mocked tests. No deployment or parent issue completion.

## Rollout / rollback

Backend-only; existing extension is compatible. After deployment evaluate matched
with/without-JD cases including a reviewed project, checking introductory usefulness,
latency, token counts, failure/refund codes and private-ledger absence. Revert this
backend change and redeploy to roll back. No migration or data rollback is required.

## Evidence

TDD: initial seven product assertions failed on the original citation form. Focused
and full local gates passed on the first implementation, but a real-provider synthetic
profile-only check exposed a remaining citation-style output. Independent R1 confirmed
ALE46-INTRO-001 (P2). Added an exact natural-headline expectation and observed three
failures before the correction; added qualified/negated/headline-shape negatives.
The bounded headline correction now passes exact natural-output assertions for both
with/without-JD cases, including the actual HTTP preparation/sanitation/final-validation
path with mocked I/O. R2 resolved ALE46-INTRO-001 but identified ALE46-INTRO-002: a free-text headline
suffix such as "Retired since 2020" could be moved away from the role it qualifies.
Five new red assertions reproduced this family through the actual renderer/validator.
The correction uses positive named-specialty vocabulary (and combinations), with
unknown suffixes quoted intact; it does not grow the injection denylist or relax any
rejection. R3 independently resolved both findings with no remaining material in-scope finding.
The final receipt is stored outside the frozen source.

The supported headline grammar deliberately recognizes a finite set of professional
roles and named specialties, and preserves role, company and specialty text. Other roles/languages/qualified
narratives retain complete quotes; it is not a general semantic paraphraser. Broadening
this grammar requires its own positive and adversarial examples, not relaxed validation.
Candidate inclusion remains a relevance decision by the model; null is valid for
irrelevant/unavailable/too-long evidence. Synthetic tests do not certify every selection.

### Checks — 2026-10-28 America/New_York

- Passed: Node 24 full coverage suite, 1,469 tests / 107 files; configured thresholds.
- Passed: 15 guardrails; type-check; lint (unchanged unused `status` warning in
  `lib/auth/refund-admin.ts`); policy check; web audit (zero vulnerabilities).
- Passed: final correction's dummy-environment production build.
- Passed: independent R3 review, 273 repository and 14 reviewer assertions across
  eight files plus 15 guardrails. Original qualification reproductions and additional
  malformed/mixed/positive cases pass. Both ALE46-INTRO-001 and ALE46-INTRO-002
  are resolved. Fresh-context review, not a cross-model or production certification.
- Passed: two real Claude synthetic cases on the corrected source through local
  preparation, provider repository, sanitation, renderer and atomic validation.
  With JD: 208 characters, 2,193 input / 113 output tokens, 2,665 ms.
  Without JD: 178 characters, 1,899 input / 107 output tokens, 2,133 ms.
  Both contain the reviewed synthetic experience and an introduction, not a source
  citation. Same single-call path and 600 output-token cap. These are individual
  observed samples, not latency/quality guarantees or end-to-end extension timings.
  Test script, results and review packets live under the local Codex artifact directory
  `aletheia/ale46-linkedin-introduction-2026-10-28`.
- Failed, then corrected: initial seven regression expectations; R1 headline product
  gap (three red assertions) and R2 qualification placement (five red assertions). No known unresolved local test failure.
- Not run: hosted HTTP/authentication/RLS/extension workflow, user-account replay,
  hosted CI and broader statistical/model quality evaluation. No production user
  reads/writes or deployment. Synthetic model tests do not establish those gates.
- Extension build/UI and migration/reset checks not repeated: their files/contracts
  are unchanged. Existing refund, admission, owner review and injection tests passed.

### Remaining risks and lesson

Nonrecognized or qualified target prose still uses a complete quote; this is an
explicit limitation of deterministic source-preserving composition. Do not claim
arbitrary natural paraphrasing. Real user evidence may have no eligible reviewed fact,
may be excluded, or may not fit alongside target/CTA. A successful HTTP/grounding test
must be paired with representative actual prose expectations and provider sampling;
otherwise citation-style regressions can pass every safety check. Parent ALE-46 remains
In Progress with its other channel/environment gates distinct from this fix.
