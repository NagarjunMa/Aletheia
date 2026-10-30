# LinkedIn relevance and introductory composition — implementation plan

## Execution context

- Plan established and A/B1 implemented locally, 2026-10-29 America/New_York. Uses production-engineering-loop 0.7.0 and Ponytail full. This record separates completed foundation evidence from the pending wider roadmap.
- Current worktree: `ascendia-production-audit-fixes`; branch `fix/ale-46-linkedin-introductory-messages`; HEAD `bb8170af16da9c968c6b857d42164b5317f34aa1` plus the existing uncommitted introduction patch and tests. HEAD alone does not identify that patch.
- Read the current [introduction record](linkedin-introductory-messages.md) as historical implementation evidence. Its finite headline/hiring rewrites and two synthetic provider samples do not establish this expanded contract.
- Linear read on this date: ALE-46 In Progress; ALE-54 and ALE-61 Backlog. Planning made no Linear mutations; the later A/B1 implementation added dated evidence to ALE-46 without changing status.
- Current audit: inspect the full branch diff, verify retained evidence freshness and complete a final independent review. Next implementation work is ALE-54 relevance and the remaining composition stages; the wider held-out evaluation set is not complete.
- Full documentation: selection of private candidate evidence and changes to grounded public output require coordinated Critical-tier review.

## 1. Issue summary

Produce a courteous, specific professional introduction using the strongest supported connection between the candidate's experience and the recipient's work or hiring need. Preserve full source records; select only the necessary facts for the short note. A correct quotation of a headline is not a successful introduction.

This plan coordinates existing issue responsibilities rather than creating a second ranking system:

- [ALE-46](https://linear.app/aletheia-connection-builder/issue/ALE-46/phase-1-atomic-claim-and-final-output-provenance-contract): reviewed facts, exact support, coverage and introductory composition repair.
- [ALE-54](https://linear.app/aletheia-connection-builder/issue/ALE-54/improve-deterministic-evidence-relevance-for-outreach-and-application): canonical automatic relevance policy, including its existing outreach/YC scope.
- [ALE-61](https://linear.app/aletheia-connection-builder/issue/ALE-61/message-focus-stage-2-deterministic-confirmed-evidence-selection): later focus preference atop that policy. It must not be silently implemented in this repair.

## 2. Scope and non-goals

In scope: eligibility before selection budgets; problem/responsibility relevance; natural introductory framing around supported facts; correct final length; representative quality and safety evaluations; precise safe failure and preparation guidance.

Not in scope: graph/vector infrastructure, embeddings, extra model judges or repair calls, new provider/SDK, new ranking service, full-resume transmission, permanent request-content logs, bulk outreach, new fact-storage schema, automatic fact confirmation, or the Message focus field/picker. No changes to billing, admission, RLS or extraction consent. Reuse those boundaries and test affected paths.

The wider resume and profile remain available to their existing owner-scoped preparation flow. They are not all authorized atomic facts: the current runtime accepts reviewed individual assertions from evidence records. Unreviewed resume statements cannot silently become eligible because they match a job description. Automatic resume-to-reviewed-fact onboarding would be a separate scope, not a hidden part of this plan.

## 3. Existing system and cause

Verified source observations, not new test results:

1. `rankedEvidence` uses weighted lexical overlap plus a 100-point `ai_usage` bonus. Generic AI evidence can dominate a more relevant problem-specific story.
2. `applyBudget` retains at most one LinkedIn evidence record and truncates its rendered content before `buildAtomicCandidateSources` calls `readFactReview`. An unusable first story can prevent a later reviewed, fitting story from reaching generation.
3. `buildAtomicCandidateSources` accepts only complete current reviewed excerpts contained in the selected source. A reviewed excerpt beyond the truncated root can disappear. This is a selection-order problem, not justification to weaken containment.
4. Targets are complete paragraphs; long/qualified passages cannot be arbitrarily shortened. Current target fit considers the greeting and shortest CTA, not the desired candidate-plus-target introduction as a whole.
5. `resolveLinkedinSelection` accepts source IDs and a fixed CTA. `allowedClaimTexts` permits exact facts and narrow rewrites; arbitrary natural paraphrases fail `CLAIM_REWRITE`.
6. `validateAtomicOutput` covers entire fields with verified claims or whole neutral phrases. Arbitrary unvalidated connective text would bypass the contract.
7. The existing quality evaluator uses a small vocabulary and a terminal-CTA regex. It cannot establish semantic relevance and currently conflicts with a courtesy phrase after the CTA.

The original prompt required a recipient-specific hook, a candidate bridge and an invitation. Restore those communicative functions while retaining the stronger provenance boundary. Do not revert to lexical overlap as proof of truth.

## 4. Relevant locations

Paths below are relative to this worktree. Verified means inspected for planning, not exhaustively audited.

| Path / symbol                                                                                         | Status and planned responsibility                                                                           |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `modules/outreach/application/build-outreach-grounding-context.ts` / `rankedEvidence`, `applyBudget`  | Verified; replace premature story reduction with eligibility-first candidate selection; reuse ALE-54 policy |
| `modules/grounding/application/build-atomic-sources.ts`                                               | Verified; preserve complete reviewed facts, root bindings and target scope while changing selection order   |
| `lib/candidate-profile/fact-review.ts` / `readFactReview`                                             | Verified; canonical current-review/qualification boundary, reuse unchanged unless separately scoped         |
| `modules/candidate-context/infrastructure/candidate-context.repository.ts`                            | Verified; existing caller-JWT/RLS reads, no new read or service-role bypass                                 |
| `modules/outreach/domain/outreach-grounding.types.ts`                                                 | Verified; budgets and content-free selection metadata                                                       |
| `modules/outreach/domain/linkedin-grounded-selection.ts`                                              | Verified; source/wording selection, pair feasibility and recoverable failure                                |
| `modules/grounding/domain/atomic-claim.ts`, `modules/grounding/application/validate-atomic-claims.ts` | Verified; canonical wording/support/coverage rules; preserve other channels                                 |
| `modules/outreach/application/render-linkedin-connection.ts`                                          | Verified; final order, complete CTA/courtesy and server length                                              |
| `lib/ai/prompts/linkedin-connection.ts`                                                               | Verified in branch/history; composition instructions and version                                            |
| `modules/outreach/infrastructure/anthropic.repository.ts`                                             | Located; inspect complete tool/provider adapter before editing; retain single call and 600 output-token cap |
| `modules/outreach/application/extension-generate.service.ts`                                          | Verified LinkedIn finalization slice; inspect full billing/error callers before editing                     |
| `app/api/extension/generate/schema.ts`, `route.test.ts`                                               | Located; preserve public shape and old-client behavior                                                      |
| `lib/ai/evals/linkedin-connection-quality.ts`, golden cases and tests                                 | Verified evaluator; update behavioral rubric and fixtures, not just phrase regexes                          |
| Existing grounding, selection, renderer, introduction, fact-review and route tests                    | Located; read complete cases before TDD edits                                                               |
| `modules/application-answer/application/build-yc-grounding-context.ts`                                | Candidate; inspect under ALE-54 before shared ranking changes, retain intentional per-question differences  |

No new production file is required by this plan. A small pure shared scorer is justified only by ALE-54's genuinely shared outreach/YC policy, not as an extra framework. No new package is expected.

## 5. Dependencies and constraints

Preserve the existing introduction draft; do not ship it as satisfaction of this plan. Before implementation, compare its dirty diff and remote main, preserve all unrelated work, and use the issue's active conventional branch or a separate issue-prefixed branch as appropriate. Planning does not synchronize or switch branches.

ALE-46's existing provenance code is the safety baseline, not evidence that every parent acceptance gate is complete. ALE-54 owns ranking; its current full scope includes YC. Prepare and review that PR under its own criteria rather than claiming ALE-54 complete from a LinkedIn-only correction. The narrow eligibility-order bug may be repaired in ALE-46 first if covered independently, without introducing competing scoring weights. ALE-61 remains downstream.

Length contract: approximately 260 **characters** is a preferred output target for a verified 300-character composer, never an exact minimum or a reason to pad/drop qualifications. The existing API hard maximum remains 300 for compatibility. The current LinkedIn Help page describes 200-character invitations; runtime budget propagation must be resolved before claiming compatibility with those accounts. Stage A must inspect the actual extension/composer and record whether a smaller server-owned budget can be selected without changing the client. If not, plan a separate bounded client/API compatibility change; do not silently send 260 to a 200-character composer or claim this is universally backend-only. No limit increase, auto-truncation or automatic resend.

## 6. Security, privacy and invariants

- Caller ownership, current per-fact confirmation, exclusions and injection screening precede relevance. Score is never a permission or truth check.
- Candidate facts, recipient facts and job requirements remain distinct namespaces. A job's required three years never becomes the candidate's three years.
- Keep complete actor, tense, negation, scope, numbers and qualification. A prototype cannot become a deployed system; shared topic cannot become proven equivalent expertise.
- Stored originals are unchanged. The request builds a bounded projection; omitted facts are not deleted or invalidated.
- No source IDs/excerpts/ledgers, names, resume/post/JD text, prompts or generated prose in diagnostic logs. Reuse bounded reason codes, counts and existing timing/token metadata.
- Validate after all transformations. Shared neutral-phrase additions must not grant arbitrary text or factual clauses a grounding exemption.
- Preserve quota-service 503 versus proven-limit 429, model-attempt accounting, exact reservation handling and existing fair compensation. No extra model attempt to repair a draft.
- Raw knowledge remains untrusted data; source completeness and user attestation are not proof of real-world truth.

## 7. Implementation increments

### A — Product contract and red cases (ALE-46)

Freeze named development cases plus held-out cases before rewriting. Include Apple hiring with/without JD, documentation versus generic AI, non-AI roles, qualified employment, no reviewed fact, long facts and multiple plausible projects. The Apple project facts must be explicitly synthetic, not attributed to the real user's resume.

Add red behavioral tests for a later eligible fact lost behind an unusable first story; a reviewed fact lost at a source truncation boundary; a complete candidate/target pair losing to an individually fitting but unusable target; and citation-style output passing existing safety checks. Verify intended failures rather than import/setup errors. Settle composer length and missing-evidence presentation at this stage.

### B — Select the strongest usable evidence (ALE-46 ordering repair, ALE-54 relevance)

Read current reviewed facts across the existing bounded owner pool before reducing it to one evidence record. Filter invalid, stale, excluded and unsupported facts first. Preserve each fact's exact excerpt, source version and root. Rank complete eligible facts using their parent context for relevance only; parent context does not authorize new claims.

Under ALE-54, define server-owned, deduplicated signals for responsibility/problem, domain and relevant methods. Use explicit golden ordering requirements to calibrate weights; remove the unconditional category bonus as a deciding shortcut. No invented universal similarity percentage. Stable ties; repeated keywords do not accumulate weight. Related work can be selected without asserting that it proves full job qualification.

Apply the same ordering correction to targets: inspect complete eligible units across the already bounded raw profile/JD input before the final 16-source/4,000-character target projection. A relevant later JD paragraph must not disappear behind 16 generic earlier paragraphs. Keep existing request-length and per-unit limits, stable request-local IDs and bounded linear scanning. Do not build an unbounded Cartesian product: retain a bounded best-target list per eligible candidate using the canonical relevance policy, then materialize only the top feasible combinations. Record explicit pool/work bounds and benchmark the maximum accepted input.

Evaluate candidate/target pairs against the final output budget, including greeting, complete ask and courtesy. Retain one candidate evidence root in the final LinkedIn context; prefer a meaningful fitting pair over a target that unnecessarily consumes the entire note. No additional queries. If no meaningful match exists, use explicit target-only behavior, not the first story. If the best fact cannot fit, try the next relevant complete fact, not an unsupported shortened version.

Enforce the result, not merely prompt for it: server-built admissible options bind the exact candidate fact, target fact, approved wording, framing and final length. The model chooses an opaque request-local option ID from that bounded set; the resolver requires membership and reconstructs the exact option. Do not expose independently combinable source IDs or an unconditional nullable candidate. When a qualifying complete pair exists, every admissible option includes that candidate introduction; target-only options are allowed only when no qualifying pair exists. Recompute final count and coverage after sanitation. Update the internal tool/resolver together; the public extension response stays unchanged. Negative tests reject unknown/stale option IDs, valid individual source IDs forming an inadmissible pair, null candidate despite a qualifying pair, and framing changes that exceed the effective cap.

### C — Compose a natural introduction (ALE-46)

Default presentation: greeting → concise supported candidate introduction → recipient/job context and reason for interest → modest invitation → courtesy. Preserve supported networking/mentorship intent; do not turn every request into a job inquiry.

Use the existing model call to select eligible source/wording/template IDs. Server-owned composition generates the private ledger. Select a recipient-specific detail and a candidate contribution; a generic shared word alone is not evidence of alignment. Framing can express interest in discussing the work, but cannot claim a perfect fit, ability to solve the employer's problem, personal familiarity, or deployment scale without support.

The selection tool returns only the admissible option ID defined in B, not independently editable wording/template fields. Source/wording choices are encoded in that server-owned option. A relevance score authorizes prioritization, not a new factual relationship: prefer juxtaposing two supported facts with an interest invitation over asserting that the candidate has solved the employer's problem. Any explicit factual alignment statement needs the same support/coverage discipline as its component facts.

Reuse exact first-person reviewed facts and complete source-supported target statements. Extend canonical approved wording only through narrow, independently tested transformations that preserve the complete proposition. Separate a finite set of whole non-factual greetings, invitations and courtesy phrases from factual slots. Do not exempt arbitrary prefix/suffix text from coverage. A named greeting is allowed only from reliably sourced recipient identity; otherwise use a neutral greeting. Never infer the recipient's name from the candidate's identity.

Do not expand company/job-title regex lists as the general solution. Before adding a rewrite family, demonstrate positive and qualified/negated cases across different domains. Unrecognized prose is not silently paraphrased. Where a natural complete fact is unavailable, use another eligible fact or a clear preparation outcome; do not report a citation-style fragment as successful introductory composition.

Important limitation: arbitrary polished summaries cannot be proven by the current deterministic equality rule. This phase reuses the existing one-time review flow for concise complete evidence; it does not ask users to rewrite an entire story on every generation. New stored paraphrase variants or automatic resume fact preparation require a separately designed/approved contract. If representative cases show those are essential, stop at that design boundary instead of adding a model judge or weakening `CLAIM_REWRITE`.

Preserve final full-body claim coverage after sanitation. Update the CTA contract to allow an intact ask followed by a whole courtesy phrase. Do not require a question mark. No automatic fact clipping to reach a preferred count.

### D — Boundary verification, quality and controlled release

Test extension payload → auth/preparation → selector → provider tool → server composition → sanitation → final atomic validation → public response. Mock external I/O for routine tests. Verify blank and whitespace-only JD preserve profile-driven behavior and valid JD takes precedence for role relevance without attributing the post to the recipient without evidence.

Then obtain fresh independent Critical-tier review and separately authorized synthetic provider/hosted evidence. Existing two provider samples are historical, not a pass for this contract. Release only the verified stage; do not close ALE-46 or downstream issues on partial evidence.

## 8. Implementation order and PR boundaries

1. A: agree exact quality fixtures, length compatibility and safe missing-evidence behavior; reproduce failures.
2. B1: ALE-46 eligibility/budget-order correction using current ranking, if independently shippable.
3. B2: ALE-54 canonical relevance policy, retaining its outreach/YC scope and acceptance gates.
4. C: ALE-46 composition and final coverage; depends on accepted selection behavior.
5. D: end-to-end quality/release evidence for the combined revision.
6. Later: ALE-61 focus selection, ALE-60 generation integration, ALE-62 client UI and ALE-59 rollout under their own verified contracts. These are not authorized implementation in this task.

Do not release a partially compatible combination of selector and tool schema. Reuse the current branch for its active repair; separate ALE-54 work must preserve/cherry-pick only the required accepted prerequisite, with base and dependency explicit in its PR.

## 9. Acceptance and evaluation contract

These are the wider roadmap's criteria, not a claim that A/B1 implements every row. Current foundation results and remaining work are recorded in section 10; wider model-quality and platform-limit gates remain pending.

| ID   | Representative case / expected behavior                                                                                                                                                       | Wrong implementation the check must reject                                                                                  | Evidence location / method                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AC-1 | Relevant reviewed later project survives an unusable top-ranked record and truncation boundary; later relevant JD unit survives earlier generic paragraphs                                    | Cap to first story or first 16 target units before eligibility/relevance                                                    | Grounding builder + atomic-source unit tests, immutable-input assertions    |
| AC-2 | Policy/reliability project beats unrelated AI work; no-match is explicit; stable ties                                                                                                         | AI bonus, repeated keywords or first-record fallback determines selection                                                   | ALE-54 selector fixtures; zero/weak-match and reordered-input cases         |
| AC-3 | With JD: candidate introduction + specific role problem + modest ask + courtesy; without JD: same functions from profile; selected option must bind a feasible qualifying pair when available | Citation fragment, job-interest-only success, empty-JD failure, independent mismatched IDs or null despite an eligible pair | Selection/tool/resolver negatives, renderer and route tests, human rubric   |
| AC-4 | Known qualifiers and complete facts survive every rewrite and sanitizer                                                                                                                       | Prototype becomes deployed; target requirement becomes candidate achievement                                                | Atomic validator negatives, transformed final-body integration tests        |
| AC-5 | Preferred 260 only when supported and useful; never exceed effective composer limit; ask/courtesy intact                                                                                      | Padding, substring clipping, 260 accepted for a 200 composer                                                                | Boundary-length cases including Unicode/names and real composer check       |
| AC-6 | No usable candidate: target-only with no fabricated introduction; no safe usable target: precise existing safe failure                                                                        | Arbitrary personal claim, success with quoted fragment, model call after preparation denial                                 | Service/route tests, no-provider/no-billing-effect assertions as applicable |
| AC-7 | All private data stays caller-scoped; final response/logs contain no ledger or excerpts                                                                                                       | Bypass RLS, log source text, leak source IDs in public metadata                                                             | Repository/route/privacy tests; synthetic hosted log audit                  |
| AC-8 | Same database/provider round trips, current budgets and compensation semantics                                                                                                                | Extra judge/repair call, token-cap increase, duplicate charge or refund                                                     | Call-count, admission/refund tests, model usage and duration samples        |
| AC-9 | Other outreach/YC contracts and old extension requests remain valid                                                                                                                           | Shared framing or scorer accidentally weakens other channels                                                                | Full affected-subsystem/route suites and existing CI                        |

Freeze each scenario's expected outcome before execution: `candidate_introduction`, `target_only`, or `preparation_denial`. For candidate-introduction cases, score recipient specificity, useful candidate introduction, supported problem-level connection, natural grammar, and courteous low-burden ask from 0 (absent/wrong), 1 (partial), to 2 (clear). Proposed launch gate: at least 90% of all scheduled candidate-introduction runs score at least 8/10 with no zero on introduction or relevance. Unexpected refusal, target-only degradation or provider failure counts as a failed run in that denominator; never relabel after seeing results.

Target-only and preparation-denial runs form a separate correctness gate: 100% must produce their predefined safe outcome, no fabricated candidate claims, no unnecessary model/billing effects for pre-model denial, and appropriate recovery guidance. Review target-only prose for recipient specificity, grammar and courtesy without penalizing the deliberate absence of a candidate claim. Across all groups require zero material factual/privacy/length violations. Report every group size, failure and infrastructure blocker; interrupted runs do not become passes. These thresholds are product acceptance decisions, not scientifically proven reply-rate predictors.

Freeze 12 development and 12 held-out synthetic scenarios covering the case families above. After authorization, run each held-out case three times through the actual provider path (36 bounded requests, no automatic retries), plus a same-settings baseline when needed (maximum 72 requests total). Include actual failures in the denominator. Have a human review the messages blinded to variant; an LLM self-score is not ground truth. Record input/output tokens, stop reason, total/stage durations and failure codes. Do not claim statistical certainty or improved hiring outcomes from this small sample.

Proposed efficiency guard: zero new network round trips, retain the 600 output-token cap, benchmark local selection at the maximum accepted pool on Node 24 with p95 below 10 ms over warmed repeated runs; investigate rather than waive a failure. Compare matched input-token usage, completion rate and latency against the frozen baseline. More than 10% median input-token growth or 20% p95 end-to-end latency growth requires investigation and an explicit bounded tradeoff before release; small-sample latency is a diagnostic, not an SLA.

## 10. Implementation progress

- 2026-10-29: implementation authorized after planning. Current increment is A/B1 only: candidate eligibility before the one-story LinkedIn budget. It is independently testable without changing the ranking policy or tool/public API.
- Scope: use complete current reviewed facts that fit intact with at least one already offered target and CTA; preserve whole-record exclusions, source IDs, qualification text, existing data and source caps. Keep original scoring, target projection, model choices, other-channel atomic rules and all admission/refund behavior. Those remaining design changes belong to subsequent increments.
- Before editing: saved the existing tracked diff/untracked source outside the worktree under `.codex/artifacts/aletheia/ale46-eligibility-2026-10-29`. Continuing the active ALE-46 branch, not replacing unrelated work.
- Baseline: 52 tests across three affected files passed. Six new behavioral failures reproduced unreviewed/empty/stale/unfitting first-record selection and loss of a later reviewed excerpt during truncation. No setup failure was counted as a red test.
- Local correction: project complete eligible facts before applying the evidence slot; retain raw record only for exclusion checks, not in the returned source object. Existing selection fixtures now explicitly review their facts; raw-record confirmation alone is no longer a LinkedIn eligibility assertion.
- B1 evidence: 335 affected tests across 19 files, 1,482 full-suite tests across 108 files with configured coverage, 15 guardrails, type-check, lint (one existing warning), policy and web dependency audit (zero advisories) passed on Node 24.16.0. Initial boundary-test fixture mistakenly passed its old root content to the renderer; corrected the fixture to use its actual supporting root, preserving the validator, and reran the affected/full suites.
- Bounded local benchmark: 25 records × 8 reviewed facts, 7,078 profile characters and 1,902 JD characters, 200 warmed runs; p50 3.17 ms, p95 5.22 ms. One evidence root / 8 complete facts / 671 projected source characters selected. This is a local synthetic observation, not hosted latency or a retained-memory guarantee.
- Current B1 changes: the grounding builder and LinkedIn fit predicate; reviewed-fixture corrections; new eligibility regression file; renderer boundary test; HTTP route cases with an unusable first record and both JD states. Source storage, read/auth boundaries, provider count, final validators, billing and packaged extension code are unchanged by B1.
- Implementation review R1 found ALE46-B1-001 (pre-existing normalization mismatch still violated B1 eligibility) and ALE46-B1-002 (an unfit reviewed substring could reappear when final atoms were rebuilt). Five additional red failures reproduced these before correction. A shared source-preparation normalizer now applies NFKC/whitespace normalization before XML escaping for candidate and target source units, and the projection uses the same function. This is a narrowly scoped shared normalization correction across channels; review/confirmation, source-support and final-output validation rules remain intact. Final LinkedIn candidate atoms also pass the same fit predicate, preventing unfit substrings from reappearing. Raw stored review/source versions are unchanged.
- Corrected evidence: 436 affected tests / 26 files including YC, 1,489 full-suite tests / 108 files, 15 guardrails, types and lint passed. The baseline web audit/policy/extension checks passed earlier; unchanged manifests, policy and extension runtime justify retaining those results as pre-correction evidence. The isolated initial production build, health/browser smoke (28 tests) and fact-review UI (375/900/1440px) passed before the source-normalization correction; corrected build and follow-up review receipts are separate, not implied by those earlier passes.
- Corrected benchmark: a run concurrent with coverage/lint/types exceeded the 10 ms target (p95 25.55 ms); the unchanged corrected source then ran standalone with p50 3.15 ms / p95 3.38 ms / maximum 3.81 ms over 200 warmed runs. Preserve both observations. This establishes the local single-process workload result only, not behavior under hosted contention. GC was uncontrolled; heap delta is not retained-memory evidence.
- Remaining checks and fresh implementation review receipts live outside source under `.codex/artifacts/aletheia/ale46-eligibility-2026-10-29`; consult their actual outcomes. An initial isolated build failed because Turbopack could not resolve symlinked dependencies outside its project root; retry uses a local clone of the same installed dependencies, without environment files. Do not count that failed setup as a source defect or a successful build.
- Broader ranking, target ordering, admissible composition options, 260-character presentation and the held-out quality matrix remain unimplemented. This increment does not claim the overall introductory-message problem is resolved.
- B1 corrected build passed; independent R2 resolved ALE46-B1-001/002 with no remaining material finding in that increment. Next: finish the full-branch pre-merge audit, then execute ALE-54 and composition increments under their contracts. Do not mark ALE-46/ALE-54/ALE-61 complete. Hosted provider/auth/RLS/extension replay and production release were not performed for B1.

## 11. Session handoff

Read this record, the existing introduction record, ALE-46/ALE-54 and applicable `AGENTS.md`/engineering-guide instructions. Revalidate branch, dirty files and upstream state. A/B1's reproductions are already implemented and passing; use the current audit receipt before choosing the next stage. Resolve the composer-budget boundary before length-dependent composition. Do not discard the current patch or repeat historical provider runs as new evidence.

Inspection gaps: complete provider/service error paths, full existing fixtures, current extension composer handling, YC selector and hosted deployment state. Inspect these at their respective increments. Source findings above do not assert those whole subsystems were audited.

## 12. Decisions and deviations

- Initial risk **Critical**: private evidence selection and source-to-public-claim security semantics change. This describes potential impact, not an unresolved security incident.
- No graph database: existing source IDs, parent records, reviewed facts and request-local target relationships are enough for the bounded task. No fabricated graph nodes or semantic confidence percentages.
- Keep original data; budget the model projection after eligibility. Preserve one evidence-root output policy unless a separate measured requirement justifies changing it.
- Prefer a natural complete message over reaching an exact count. Greeting/thanks are product choices informed by guidance, not guarantees of attention.
- This supersedes the narrow patch's product-acceptance claim, not its historical safety evidence. No unrestricted paraphrasing is approved.
- No new Linear issues or status changes made. Reconcile issue scope before implementing across ALE-46/ALE-54; do not silently move acceptance criteria between them.

Research basis (read during preceding research, not proof of product outcomes): [LinkedIn invitation guidance](https://www.linkedin.com/help/linkedin/answer/a563153), [warmth/competence review](https://pubmed.ncbi.nlm.nih.gov/17188552/), [question-asking study correction retaining conclusions](https://pubmed.ncbi.nlm.nih.gov/40111841/), [Berkeley networking guidance](https://www.career.berkeley.edu/prepare-for-success/networking/). Question-asking evidence comes from conversations, not cold connection-invitation trials.

## 13. Validation plan and present results

Use Node 24 in the implementation worktree. Read current test configuration before running any command; routine tests use mocked I/O and builds use the documented dummy environment.

Focused commands planned:

```sh
npm run test -- --run modules/outreach/application/build-outreach-grounding-context.test.ts modules/outreach/application/linkedin-introduction.test.ts modules/outreach/application/linkedin-grounded-selection.test.ts modules/outreach/application/render-linkedin-connection.test.ts modules/grounding lib/candidate-profile/fact-review.test.ts lib/ai/prompts/connection.test.ts lib/ai/evals/linkedin-connection-quality.test.ts app/api/extension/generate/route.test.ts
npm run test:guardrails -- --run
npm run test:coverage -- --run
npm run test:resume-security
npm run policy:check
npm run security:audit
npm run lint
npm run type-check
npm run build
git diff --check
```

Run ALE-54's YC focused suites for shared selection changes. Run current CI's built-server health check, `e2e/landing-navigation.spec.ts`, `e2e/frontend-theme.spec.ts` and `npm run test:candidate-fact-review:ui`. CI also runs `make extension-ci` and extension-version validation against the actual PR base; retain those gates. If client changes become required, add actual built-extension request/limit tests, packaging and release-version checks.

Historical planning-only evidence: source/Linear inspection passed; implementation tests and benchmarks were then not run. Subsequent A/B1 tests, benchmark, build and review evidence are recorded in section 10 and the external receipts. The broader provider-quality matrix, hosted auth/RLS replay, log audit and hosted CI remain not run. No production mutation, paid call or deployment occurred in A/B1. The planning TDD exception never replaced implementation's recorded red/green tests.

Required future review: fresh-context independent review of the actual complete diff, exact dirty/untracked snapshot and criteria; Critical additional review before release. Default maximum three review rounds, with affected checks rerun after corrections. A planning review cannot replace implementation review.

Planning review R1 (fresh-context `linkedin_plan_review`, 2026-10-29): three confirmed document omissions—PLAN-1 admissible pair enforcement, PLAN-2 target projection ordering, PLAN-3 stratified evaluation outcomes. Corrections are specified in B/C and AC-1/3/quality gates above. Follow-up R2 confirmed all three resolved at the planning level with no new material contradictions. Reviewer model identity was not independently verified; this is fresh-context review, not cross-model certification. No application tests were run for this prose-only correction. Prettier on this plan and `git diff --check` passed; implementation and release review remain pending.

## 14. Completion, rollout and rollback

Status: **A/B1 implemented and verified locally; remaining roadmap planned; not released**. Final audit risk is **Critical** because private source selection and source-backed public wording cross a security/data boundary. Parent ALE-46 remains In Progress; local checks do not establish parent-level hosted or quality gates.

Rollout: deploy only after local/CI and representative synthetic quality gates; test an isolated hosted account via the actual extension with JD, without JD and whitespace JD. Confirm deployment SHA, effective character cap, privacy-safe logs, token usage, latency and fair failure handling. Monitoring uses existing timing/usage/error fields, not stored user requests/responses. Live testing requires authorization for its environment and bounded cost.

Rollback: revert the cohesive backend stage and redeploy without altering stored facts or rolling back prior security migrations. A ranking and composition release must revert as a compatible unit if their contracts changed together. Any separately required client compatibility work needs its own version/rollback plan; do not assume reverting the server updates installed extensions.

Remaining risks: deterministic support rules cannot certify arbitrary paraphrases; relevant facts may be missing/unreviewed/too long; legacy accounts may lack usable facts; provider selection varies; platform character limits differ. These need the defined evaluations or explicit preparation/compatibility outcomes, not silent loosening.

## 15. Instructions for the next implementation session

Implementation was subsequently authorized for A/B1. On resumption, load the active issue and this contract; establish the next requested increment and dependency base, preserve unrelated changes, use the updated engineering-loop and Ponytail, and start red-first. Keep acceptance criteria independent of current output. Do not promise universal natural writing under a source-equality rule or mark a safety-only test as message-quality verification.

## A/B1 pre-merge audit — 2026-10-29 America/New_York

Scope: complete dirty/untracked branch diff against merge base `bb8170af16da9c968c6b857d42164b5317f34aa1`, covering the existing finite introductory repair plus A/B1. Final risk: Critical. This is not an audit claiming every parent ALE-46 criterion or the expanded roadmap complete.

The implementation snapshot `cc9f48982c4a448aac631c0ee7ffc920a8e051d23da05204a657b8362493033d` was current at audit entry. Runtime, tests, manifests and configuration have not changed during this audit; only stale feature-status/handoff documentation is corrected. Retain recorded checks on those exact unchanged inputs rather than presenting them as new executions. Re-run affected documentation/policy checks after the correction. Fresh final review and check receipts are stored outside source at `.codex/artifacts/aletheia/ale46-final-audit-2026-10-29` so this record does not invalidate its own final snapshot.

Acceptance mapping for A/B1: later usable reviewed records survive unusable first records; reviewed facts beyond the old truncation boundary survive; qualification/current-review/exclusion rules and exact source binding hold; Unicode-created markup is escaped consistently; final offered atoms cannot reintroduce an individually unfit substring. Boundary, route and privacy tests cover those properties. Unsupported claims still fail final coverage after sanitation. Null/independent model choices, the old ranking bonus, target-pool ordering and the 200/300 compatibility decision remain explicitly pending, not certified by this audit.

Retained passed checks: 1,489 full tests/108 files with coverage thresholds, 436 focused tests/26 files including YC, 15 guardrails, types/lint, corrected isolated production build; unchanged policy/audit, 240 extension tests/build, 146 resume-security tests, 28 browser smoke tests and fact-review UI checks. Independent B1 R2 reproduced both resolved findings and passed 359 tests/15 guardrails/four extra assertions. The final review receipt records its own actual coverage, rather than claiming these coordinator checks were all independently rerun.

Failed then corrected: six initial behavior regressions, a boundary-fixture root mismatch, five review regressions, and initial isolated dependency-symlink build setup. Performance: standalone p95 3.38 ms passed the specified local workload; the contended p95 25.55 ms failure remains documented. Not run: live/provider/hosted auth/RLS/user-account replay, hosted PR CI and expanded held-out quality gate. No production calls, deploy, push or issue completion.

Compatibility/rollback: public request/response, stored facts and extension package remain compatible with the current API; no migration. Revert the cohesive backend change and redeploy, retaining stored evidence and prior security migrations. Actual 200-character composer compatibility remains a wider release gate. The roadmap completion checklist below stays unchecked until the wider criteria pass.

## Engineering Loop Completion Gate

- [ ] Final audit of the actual implementation diff
- [ ] Acceptance criteria and human quality rubric verified
- [ ] Final risk tier recorded
- [ ] Relevant native checks passed
- [ ] Failed, blocked and not-run checks recorded
- [ ] Security/privacy/data and final claim coverage reviewed
- [ ] Fresh independent Critical review completed
- [ ] Compatibility, rollout and rollback verified
- [ ] Remaining risks and dated completion evidence recorded
