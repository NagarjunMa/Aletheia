# ALE-46 — Atomic claim provenance

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
