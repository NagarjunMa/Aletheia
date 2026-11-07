# ALE-54 — deterministic evidence relevance

## Execution context

2026-10-29 America/New_York. Critical risk; full engineering-loop record. Active branch `feat/ale-54-evidence-relevance`, from synchronized remote/local main `bb8170af16da9c968c6b857d42164b5317f34aa1`. The pending ALE-46 branch at `2601fb1` remains separate and unmodified. Read the complete ALE-54 and completed ALE-19 contracts before implementation. User authorized this next issue while ALE-46 CI/merge proceeds; do not mark Done or deploy.

### Publication preparation — 2026-10-30

The user authorized committing/pushing this feature branch and providing a manual PR description. Remote main now contains ALE-46 at `b2cc7c9a0e29fc946395d247f838fe4f7c834a34`. The current branch is based on that commit; the original `bb8170a` base and earlier pending-integration notes below are historical. A recoverable safety stash (`0b3ef969e5d36459eb8726b69027f8227e601832`) preserves the pre-integration changes. No direct main push, merge, deployment or issue completion is authorized by the PR preparation.

Resolved conflicts preserve both progress records and the entire ALE-46 reviewed-fact/feasibility preparation path. Shared relevance ranking feeds its unchanged reviewed-source mapping/filter before the one-story budget. No old AI-kind bonus was restored. Twenty-one combined regression failures exposed synthetic fixtures that relied on broad AI preference; use explicitly relevant Data Platform work for Data Platform targets and a parser-specific JD for escaping tests. All original full-message, provenance, exclusions, Unicode, stale/empty review, complete-fact, budget and safety assertions are retained. Do not infer relevant qualifications from unrelated project metadata or weaken a grounder to restore those fixtures.

Combined evidence: 249 focused integration tests passed; full coverage **1,548 tests / 111 files** passed with unchanged root coverage percentages; web audit zero advisories. Commit hooks must run normal policy/lint/types/unit/guardrail/build gates. Prior 1,502-test and 109-file counts below belong to the old base. Hosted PR CI/model quality and independent review of the R4 correction/integrated diff remain pending; publication is for review and does not complete ALE-54. No extension/schema/dependency release change.

## 1. Problem and goal

Replace the outreach selector's unconditional 100-point AI-kind bonus and YC's arbitrary first-two zero-match fallback. Select the same strongest supported topic matches for the same owner-scoped input, preserving final grounding and per-channel differences. Matching is a relevance heuristic, never proof of qualifications or truth.

## 2. Scope

One pure canonical ranking policy used by both existing builders; explicit no/weak-match handling; stable ordering; private content-free diagnostics; synthetic evaluation and bounded-work measurements. No graph/vector store, embedding, model reranker, new storage, provider, SDK, API field, UI or permission. No extra model/database call. No broad prompt or source-normalization rewrite.

## 3. Existing system

Both builders independently tokenize and weight title/skills, outcome/metrics, actions and context. Outreach adds the kind bonus; YC takes two arbitrary zero-score stories and round-robins up to six across questions. Existing repository JWT/RLS loading and final atomic-source validation remain the trust boundaries. ALE-46's pending eligibility/composition delta is not copied into this independent branch; test integration after that change merges, before claiming the combined roadmap verified.

## 4. Verified and planned locations

| Path                                                                                              | Responsibility / state                                                                                                              |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `modules/outreach/application/build-outreach-grounding-context.ts`                                | Verified; replace scoring only, preserve exclusion/injection/budget/fallback plumbing                                               |
| `modules/application-answer/application/build-yc-grounding-context.ts`                            | Verified; replace per-question ranking and zero-match fallback; retain round-robin, source IDs, readiness and source limits         |
| `modules/candidate-context/application/rank-evidence.ts`                                          | Implemented; `createEvidenceRanker` prepares one request-local pool, shared by both consumers                                       |
| Both builders' colocated tests; new ranking unit/integration/evaluation cases                     | Existing tests verified; new files planned; tests call actual builders before helper implementation to obtain behavioral red states |
| Both `prepare-*-grounding-context.ts` modules and context types                                   | Verified; expose bounded private selection outcomes to existing logs, outside public metadata/prompts                               |
| Candidate repository, fact review, atomic validators, generation services, public response schema | Read/retain; no new authorization, raw-fact promotion or compensation behavior                                                      |
| `lib/ai/prompts/yc-application.ts`, existing golden cases, CI/package scripts                     | Inspected for consumer/privacy/native-check contract                                                                                |

## 5. Dependencies and constraints

ALE-19 is Done and its selector is maintained, not rebuilt. Work from current main, preserving the pending ALE-46 PR and unrelated primary checkout. No borrowing unmerged runtime code to disguise a dependency. Re-run combined integration when that PR lands. Existing limits: outreach one connection/InMail story or two email stories; YC six stories and 16,000 source characters, up to five questions. Keep source-budget/readiness rules and public metadata keys unchanged.

## 6. Security and privacy

Existing caller-owned aggregate, confirmed-only/exclusion gates precede ranking. Injection-safe outreach mode still withholds raw context. Scores cannot override a gate, manufacture an AtomicClaim, or make target requirements candidate facts. Preserve immutable source strings and qualifiers; matching-only Unicode/alias normalization never rewrites source material. Diagnostics contain enums/counts only, no IDs, text, topics, URLs or user credentials. No new logging service. Keep diagnostics outside `.metadata` and explicit public response projections.

## 7. Implementation policy

1. Observe baseline and red cases through both maintained builders.
2. Normalize matching text with NFKC, case-folding and whole-token boundaries; preserve technology punctuation such as C++/C#/Node.js. Use a small explicit set of tested grammatical/domain aliases (evals/evaluations, docs/documentation, policies/policy, agentic/agents, reliable/reliability and AI phrase forms). Do not perform fuzzy substring matching or arbitrary stemming.
3. Deduplicate target/evidence terms. For each target term count the strongest supporting field once: actions/outcome/metrics weight 3, title/skills weight 2, context weight 1. Context-only overlap is weak. Generic instruction/job words are stop words; generic AI signals cannot displace more specific matches.
4. A primary question/JD with non-AI topics must have at least one such topic match in contribution or title/skills; AI/LLM/ML/RAG/agent overlap alone cannot qualify it. For an AI-only primary, a supported actual method remains sufficient. Generic question framing, including use/used/uses and job/good-fit forms, is ignored. If the primary has no informative terms, use the secondary context (JD for YC, selected profile for outreach). A genuinely broad AI target may use supported AI-family work; kind alone is insufficient. Matching status is matched, weak_match, no_match or no_evidence. “Agent” alone is not evidence of AI; the AI-family normalization requires explicit AI/LLM/ML/RAG terms. The kind tie-break requires matching AI content, not the category label alone.
5. Sort meaningful matches by primary non-AI topic/domain score, primary total score, secondary non-AI topic/domain score, secondary total score, then a genuinely matched AI-kind tie-break, sortOrder and ID. AI-family terms (AI, LLM, ML, RAG and agent) cannot collectively displace a direct match to the target’s other topic; this is a relevance priority, not a claim that all uses of “agent” are AI. AI-only targets still rank by supported method matches. Specific question relevance precedes JD-only overlap; repeat count never increases a score. Sort copies, never stored input. Tokenize the candidate pool once per request and reuse it across batch questions; no cross-request/user cache.
6. Outreach primary: nonblank JD, else conversation, else profile; remaining supplied context is secondary. YC primary: each question, secondary: JD. Filter unrelated records instead of returning arbitrary first stories; existing profile/resume/target-only fallback remains explicit. For YC, absence of eligible evidence retains the existing readiness denial before billing/model work.
7. Keep YC's round-robin union and per-question eligible IDs; apply current budgets after ranking. Per-question matching does not allow cross-question claims or multiply the aggregate source budget.
8. Publish only private bounded status/count diagnostics through existing preparation telemetry. No individual record scores or matched terms in logs. Run actual-path integration and API projection checks.

## 8. Order

Contract → baseline/red builder cases → shared policy → caller integration → focused/held-out cases → benchmark → full native gates → fresh independent review → dated handoff. Implementation is authorized; commit/push/deploy/issue completion are not part of this request.

## 9. Acceptance / evaluations

| ID  | Expected behavior                                                                                       | Plausible wrong implementation / check                                                                        |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| AC1 | Documentation/policy/evaluation project outranks unrelated generic AI in every outreach category and YC | Keep 100-point kind bonus; builder-level synthetic comparison must fail                                       |
| AC2 | Relevant question wins over a longer JD; batch best sources retain opportunity under shared cap         | Concatenate question and JD or expand per-question source budgets; batch/readiness/source-ID tests            |
| AC3 | No/weak match emits private outcome and no arbitrary stories; YC readiness remains strict               | Keep first two or label unrelated source as matched; no-match, weak-context-only and preflight tests          |
| AC4 | Same ordered IDs across repeated/reordered input; repetition and substring lookalikes do not boost      | Count repeated tokens or recalculate non-deterministic ties; exact expected ordering tests                    |
| AC5 | Confirmed/exclusion/current support and injection boundaries remain enforced                            | Rank before filtering or return target text as candidate proof; existing/adversarial integration tests        |
| AC6 | Old clients/public metadata unchanged; logs contain only bounded counts/enums                           | Spread private selection details into response or raw text into logs; preparation/route/prompt contract tests |
| AC7 | One shared scorer, no added I/O/provider call, existing source limits and compensation retained         | Duplicate scoring or reranker; caller inspection, existing integration/refund tests and measurement           |

Development cases: policy agents vs generic assistants, task-specific question vs broad JD, exact technology aliases, keyword repetition, stable ties, no-match, context-only match, excluded/unconfirmed and injected targets. Freeze separate held-out scenarios (database reliability, accessibility, mentoring, recruiting, security, non-AI documentation) before implementation; assert expected ordering/outcome, not a score computed by the production helper. A passing finite matrix is not universal semantic accuracy or improved hiring outcomes.

Proposed performance gate: Node 24, 25-story supported pool, up to five questions, warmed standalone p95 under 10 ms for each builder, zero added database/provider calls. Record raw timings and source counts; do not treat a contended run as an SLA or infer retained-memory bounds from heap delta.

## 10. Progress

2026-10-29: Implemented shared request-local ranking, outreach/YC integration and private diagnostics. Baseline: 35 existing builder/preparation tests passed. The first 8 builder regressions produced 7 intended failures (one existing safety case already passed); all are now green. Additional red-first cases caught generic question framing and the false inference that any “agent” implies AI. Existing fallback-dependent fixtures were changed to genuinely relevant synthetic data while retaining trust-order, escaping, atomic-ID and channel-cap assertions.

The full suite currently passes 1,502 tests in 109 files; 58 selector cases include six separate held-out domain scenarios. Held-out domains/expected choices were defined in the contract before implementation; their executable fixtures were frozen after the initial implementation and before calibration. No observed failures in that matrix prompted score tuning. This finite sample does not establish universal relevance. No unrelated working changes modified; no commit/push/deployment.

## 11. Handoff

Use this branch and record. Next: inspect the fresh reviewer receipt and resolve material findings, then integrate/retest against ALE-46 after its PR merges. Do not repeat ALE-19 or change the pending PR. Native checks and benchmark receipts are in the external evidence directory below. ALE-54 stays In Progress; the user did not authorize issue completion or publication.

## 12. Decisions and deviations

Shared helper is justified because both consumers own the same relevance invariant; source packing/readiness/finalization remain channel-specific. The old AI category priority and arbitrary zero-match choice are intentionally superseded by ALE-54; genuine supported AI relevance is retained. Public metadata structure stays unchanged; private selection diagnostics may be added to internal contexts and logs. No inferred percentage confidence or model entailment judge.

Measured deviation: the first implementation tokenized 25 stories five times for a five-question YC batch. An isolated local run exceeded the proposed 10 ms p95 budget (10.55 ms; an earlier contended run also failed). `createEvidenceRanker` now prepares immutable matching sets once per request. Same synthetic workload passed at outreach 5.19 ms p95 and YC batch 3.11 ms p95, with 7,187 and 15,994 packed source characters respectively. These are local measurements, not hosted latency promises. No global cache, new dependency or I/O.

### Independent finding ledger

**Latest status — 2026-10-30 America/New_York.** The user-authorized round 4 independently resolved R1/R2/R3 on snapshot `265f6e62…`, then found **ALE54-R4**, a confirmed P2 in-scope inherited false match: real-estate-agent actions made explicit AI/LLM/ML/RAG-agent targets ready. The report correctly distinguishes relevance from atomic truth; no fabrication/authorization bypass was found. Seven real-builder cases plus an AI-in-background-only helper case failed before correction (`review-r4-red.log`); real estate and genuine AI-agent positive controls already passed. The shared eligibility condition now requires actual AI-family support in contribution/title/skills when the matching agent term is used for an explicit AI-family target. Non-AI agent targets remain eligible. No other policy or source handling changed. All ten added cases pass, with 118 affected tests and the unchanged six-domain held-out matrix.

Latest checks: 1,502 native tests / 109 files, 58 selector cases with 100% explicit helper coverage, 15 guardrails, types, lint and dummy-environment production build passed. R4 is **locally corrected, independent closure pending**; the authorized extra review was completed before this correction and must not be reported as reviewing it. Four rounds used; further closure needs human review or another explicit budget extension. ALE-54 remains In Progress/uncommitted/unpushed. Historical round reports remain immutable.

Latest benchmark: the first R4 run failed the outreach p95 gate at 12.09ms (median4.97ms). Retained in `benchmark-r4.log`; no external contention cause is claimed. One repeat after other checks completed passed at outreach5.04ms / YC5Q2.91ms, with identical source counts/characters (`benchmark-r4-repeat.log`). This measured variability is not a hosted SLA or guaranteed maximum; do not discard the failed run. Runtime checks and release limitations remain as listed below.

Round 3 resolved R1, reopened R2 for generic job/good-fit wording and introduced **ALE54-R3** as an unfulfilled support contract over inherited partial-match behavior: a generic AI-method action could qualify a record with no supported non-AI topic, including a context-only topic match, and fill the second email slot. Baseline origin comparison did not claim this as a newly introduced runtime bug. Eight exact builder/helper assertions failed before correction (`review-r2-r3-red.log`). Eligibility now uses the same topic classification as ranking: when non-AI topics exist, one must match a contribution or title/skill field; context-only plus generic methods stays weak. Add ordinary job/jobs/role/position/good framing to the existing stop words. Original cases and all new cases pass (`review-r2-r3-green.log`, 108 focused tests in six files); the held-out matrix is unchanged. Latest final suite: 1,502 tests; selector 48 cases/100% explicit helper coverage, guardrails/types/lint/dummy build pass. Final p95 outreach 5.53ms / YC5Q 3.41ms. R2/R3 are locally corrected, not independently closed yet. Three review rounds exhausted; another reviewer round requires an explicit user budget extension, otherwise final review remains pending. No completion/publication permitted from local results alone.

Round 2 resolved R2 but retained R1: a generic AI-agent action still scored 9 versus policy/documentation labels at 8, so a spelling-specific alias correction was insufficient. Two target variants across four builder paths failed before the broader correction (`review-r1-near-cases-red.log`, eight failures). The corrected selector adds a lexicographic non-AI topic/domain priority using the same field weights; it retains primary-before-secondary order and genuine method matching for AI-only targets. All eight now pass; a secondary-priority regression also confirms a secondary topic cannot displace a specific primary AI-method requirement. The topic-priority checkpoint passed 1,484 tests / 40 selector cases and benchmark 5.18/3.10ms; later eligibility-correction evidence is listed above. The round-three report is external and its open R2/R3 findings are superseded only by the later local corrections described above; independent closure is pending. This prevents adding more AI-family terms from defeating the requested policy/documentation topic. Do not alter held-out expected choices or fact validation.

- **ALE54-R1 — confirmed, material (P2), corrected awaiting return review.** The reviewer supplied a generic LLM assistant versus a Policy documentation project whose concrete reviewed action described a searchable corpus/citation renderer. Generic LLM earned both its specific match and the derived AI match, displacing the policy record. Introduced for YC (base selects policy); pre-existing outreach acceptance gap still in scope. Four builder regressions (all three outreach categories and YC) failed before correction. Match the specific LLM/ML/RAG token once, skipping its broader AI alias; policy wins with no fabricated fact or extra AI priority. Field-strength and primary/secondary rules retained; round two required the broader topic-priority correction above.
- **ALE54-R2 — confirmed, material (P2), introduced, corrected awaiting return review.** “How have you used AI?” treated “used” as an informative topic and denied reviewed AI evidence. The real YC builder regression failed before correction. Add only the ordinary use/used/uses framing forms to the shared stop words; broad AI stays answerable while narrow questions still require relevant evidence.
- Original report, baseline origin checks and counterexamples are immutable external history in `review-1-report.md`, `reviewer-reproducers.log` and `review-findings-red.log`. First focused correction checks: 91 tests passed in six files (`review-findings-green.log`); broader correction: 99 passed (`review-r1-green.log`), followed by the additional secondary-priority test in the final full suite. The untouched held-out matrix remains six cases. Resolution is not final until the current-snapshot return review receipt confirms it.

Self-review of the complete diff: no new I/O, secrets, permissions, storage, retry, billing or transaction path; source strings/qualifiers, callers' authorization/exclusion gates, safe injection path, final claim validation, all budgets and explicit public response projections remain intact. Private diagnostic type stays in the shared domain, not an application import into domain. Worst-case request-local pool has 25 stories and up to five question rankings with no cross-user cache. Existing provenance/admission/refund/ownership regressions pass; keyword relevance is a closed heuristic and can still miss synonyms. Rollback/release limitations below remain required.

## 13. Validation plan

Node 24.16.0. Focused red/green Vitest builder/helper/prepare/route/prompt cases first, including existing YC golden fixtures and batch tests. Then `npm run test:coverage -- --run`, `npm run test:guardrails -- --run`, `npm run test:resume-security`, lint, type-check, policy, security audit, scoped Prettier, diff check and dummy-environment build. Retain CI extension/version/browser gates. Routine tests mock I/O; no production or paid provider calls. Required fresh Critical review uses exact dirty/untracked source and isolated scratch. Default budget was three rounds; the user explicitly authorized one additional round. Four rounds have now completed; further independent review is not authorized. Preserve evidence-backed corrections and affected reruns.

Dated evidence: 2026-10-29 through 2026-10-30 America/New_York, Node 24.16.0. Receipts: `/Users/nagarjunmallesh/.codex/artifacts/aletheia/ale54-evidence-relevance-2026-10-29/`. The final snapshot/review receipt is external so it can name the snapshot without changing its own hashed source.

| Check                                                                                                | Result                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Root coverage                                                                                        | Passed: 1,502 tests / 109 files; statements 89.33%, branches 82.55%, functions 89.17%, lines 90.69%               |
| Selector-specific coverage                                                                           | Passed: 58 tests; 100% statements/branches/functions/lines (the default root coverage scope excludes modules)     |
| Guardrails / resume security                                                                         | Passed: 15 / 146 tests                                                                                            |
| Full generate-route regression                                                                       | Passed: 131 tests, including no private diagnostics in response                                                   |
| Type-check / lint                                                                                    | Passed; inherited unused `status` argument warning in `lib/auth/refund-admin.ts`                                  |
| Policy / web audit                                                                                   | Passed; zero advisories at this run                                                                               |
| Extension CI / unchanged-version policy                                                              | Passed: audit/type/lint, 240 tests, build; no extension source changes                                            |
| Native production build                                                                              | Passed in a source copy with CI placeholder Supabase values, no application environment files or real credentials |
| Browser smoke / fact review UI                                                                       | Passed: 28 Playwright checks plus fact review at 375/900/1440 px; mocked/no external calls                        |
| Benchmark                                                                                            | Passed after request-local token preparation; retained first failed runs in external receipts                     |
| Fresh independent Critical review                                                                    | Four rounds completed; R1/R2/R3 resolved, latest R4 correction not independently closed; see external receipts    |
| Hosted CI, original user profiles, real provider/model quality, combined unmerged ALE-46 integration | Not run: branch not published, no paid/live calls or production mutation authorized for this task                 |

The earlier full-suite failure was one fixture relying on zero-match fallback; its JD now matches its policy action while retaining exact atomic-ID assertions. Type-check caught an unsupported test-only `toReversed` call, replaced by a copied array plus `reverse`. These failures are retained in historical logs; affected checks rerun. No unresolved local failure is waived. No prose-only testing exception applies.

## 14. Completion and rollout

Status: In Progress, not complete/released. Risk: Critical due to private evidence selected for an external model. Rollout only after native gates/review and integration with the eventual ALE-46 main. Monitor existing outcome/failure/timing counters; no request/response content collection. Rollback: revert the cohesive scorer/consumer change and redeploy; no database or client rollback. Missing relevant evidence may now deny a YC request rather than generate from arbitrary stories; preserve stable readiness response and recovery guidance.

## 15. Next-session instructions / completion gate

Preserve unrelated work, use TDD and canonical source rules, re-read acceptance and complete diff at audit; correct material findings, rerun affected checks, record failures/blocked/not-run checks, obtain additional independent Critical review, and update Linear with dated evidence and rollback. Do not mark ALE-54 Done from local implementation alone or close ALE-46/ALE-61.

- [x] Acceptance and held-out selection cases passed locally
- [x] Final risk and full-diff audit recorded
- [x] Relevant native checks passed; failed/blocked/not-run recorded
- [x] Security/privacy/compatibility/rollback reviewed
- [ ] Fresh independent review completed on final source
- [ ] Dated evidence and remaining limitations recorded

## Reviewed-fact correction — 2026-11-06

The original acceptance smoke passed for User B in production. Independent
review on `8d96c14` found a different case. In automatic cold email, InMail and
YC, an unreviewed AI sentence could make a story relevant even when its only
reviewed fact concerned real-estate work. YC could reach the admission and
model path. Final grounding still required approved evidence.

Automatic selection in those channels now scores whole, current reviewed
excerpts within the existing channel limits. Each eligibility match needs
support in one excerpt. Raw story text and labels cannot qualify a story.
The evidence context uses the same bounded excerpts. YC checks matches again
after the final atomic budget using each surviving fact ID and its original
text, so escaping cannot manufacture a topic. Exact fact IDs keep dropped
excerpts out of the ledger even when they occur inside another excerpt.
Candidate preflight uses the existing safety rules without emitting generated
output events. Reviewed source budgets include the whitespace inserted by
role-marker escaping, so a matching final fact stays whole or is excluded
before ranking. For explicit AI-agent work, generic activity and question
framing do not qualify non-AI facts. A fact without AI support can qualify
for an adjacent domain through at least two matching topical terms in the
same excerpt. This keeps policy and documentation work eligible. Explicit selections and LinkedIn
connection ranking retain their existing eligibility paths.

Regression coverage includes the partial, stale and split-review cases, a
genuine reviewed AI match, stable held-out ranking, a YC question whose matching
excerpt falls out of the atomic budget, and denial before quota, credits or the
provider. Node 24.16.0 local p95 for 25 stories and 250 runs was 1.58 ms for
outreach and 1.80 ms for five-question YC, within the existing 10 ms gate.

Local acceptance passed on 2026-11-06. The 2,038 web tests with coverage,
15 guardrails, six held-out scenarios, offline release preflight, type-check,
production build, lint, 53 browser smoke tests and seven Chromium story-picker
checks passed. The web audit passed its high-severity gate with 12 inherited
moderate advisories. Extension CI passed 275 tests and built successfully.
Type-check initially caught an implicit return. The first broad browser run
used a localhost canonical URL and failed the crawler metadata check. Both
passed on rerun after the return and smoke configuration were corrected.

Three fresh reviews reproduced and narrowed the remaining AI-agent eligibility
case. The last correction has passing local regressions. Fresh independent
review of that correction is pending. The synthetic negative cases make zero
quota, credit, or model calls. No new paid or hosted generation ran against the
fix because the published health SHA still points to pre-fix main.

Risk remains Critical. Keep ALE-54 In Progress until the final correction is
independently reviewed and the hosted gate passes on the deployed fix SHA.
Rollout uses the normal backend deploy. Revert the backend commit and redeploy
to roll back.

## Generic activity eligibility repair — 2026-11-07

The additional review disproved the two-topic exception. Generic activities
can overlap twice without describing AI-agent work. This increment removes
that exception and the activity-word filter. Automatic requests containing
AI-family and agent requirements need an explicit AI-agent expression in
the same current reviewed fact that provides the matching topic. Recognized
forms are direct AI/LLM/ML/RAG agent noun phrases, including powered/based
forms. Reversed modifiers such as human agents backed by AI tools and loose
agentic-AI mentions are ambiguous and do not qualify automatically. Matching
normalization never edits source text.

This is a deliberate conservative eligibility change. An adjacent policy or
documentation fact alone no longer qualifies for explicit AI-agent work. Such
facts still qualify for their own requested topics, and explicit story choices
retain their existing reviewed-source rules. Update synthetic AI-agent positive
fixtures to state their AI-agent work explicitly, and retain separate tests
for adjacent-only rejection and ordinary policy/documentation eligibility.

Scope stays in the shared selector and its maintained tests and evidence. No
model call, dependency, prompt rewrite or new storage is needed. Risk stays
Critical. The parent issue stays In Progress pending hosted acceptance.

Validation on Node 24.16.0 passed 2,087 web tests with coverage, 15 guardrails,
the offline gate, lint, type-check, production build and scoped formatting.
The six-domain held-out expectations remain intact. The exact original paid
failure and the ambiguous human-agent modifiers were reproduced before their
corrections. The maintained service regressions now deny both single-question
and five-question requests before quota, credit reservation or provider work.
Local p95 at 25 stories and 250 iterations was 1.62 ms for outreach and
1.68 ms for five-question YC against the 10 ms gate.

The independent return review found no material findings after the correction.
It passed 302 maintained tests, 75 reviewer cases and 15 guardrails, verifying
the manifest before and after. The earlier broad regex failure is retained as
review history. Final review receipts and publication identifiers are recorded
in Linear. The web audit passes its high-severity gate with 12 inherited
moderate advisories. Lint retains the existing refund-admin warning.

Direct recognized wording is intentionally conservative and can miss equivalent
indirect descriptions. Explicit story selection retains the existing reviewed
fact rules. Hosted/provider acceptance is pending on the deployed fix SHA.
Rollout uses the backend deployment. Rollback reverts the commit and redeploys.

## Non-AI qualifier correction

Treat whitespace and Unicode dashes, including minus signs, between the whole
word `non` and an AI-family agent phrase as part of the same qualifier. The
shared matcher excludes that occurrence and can still find a separate
affirmative AI-agent phrase in the reviewed fact. The Unicode word boundary
preserves affirmative phrases after names such as Xénon.

Twenty-three checks reproduced the spacing and Unicode boundary gaps before
the corrections. The focused suite passed 328 tests, including cold email,
InMail, and both YC request sizes. The YC regressions verify rejection before quota,
credit reservation, or provider work. Verification and review receipts are
recorded in Linear under ALE-54. Hosted acceptance remains pending.

## Cold email and InMail admission correction

Hosted acceptance on `1174284` exposed a draft fallback that could call the
model with a complete unrelated job description after the selector had rejected
the candidate's unrelated facts. Risk remains Critical because this boundary
controls access to quota, billing and the model.

Every cold email or InMail option must now contain at least one complete reviewed
candidate fact that individually matches the target under the existing scoring
rules and fits the final draft. This applies to automatic and explicit story
selection. Explicit selection still requires the chosen stories to contribute.
The route uses its existing 422 codes and stops before reserving any resources
when no option fits. A preselected synthetic discourse fixture supplies the
relevance decision in offline evaluations. No scoring threshold, billing
operation, provider adapter, extension, or migration changes.

Six synthetic route cases returned 200 on the merge base. The local regressions
exercise complete unrelated job descriptions in both channels, including when
an unrelated story was explicitly selected or the relevant fact in a mixed
story cannot fit. They assert a 422 and zero quota, billing and model calls.
The first independent review found that markup escaping could introduce a
false keyword match. Relevance now uses the original reviewed excerpts for
the exact fact IDs that survive grounding. Two selector regressions cover
that case, and the independent reviewer reproduced it through both routes.
The four hosted YC cases already passed on the merge base. Hosted outreach
acceptance still needs to run against the deployed correction. Roll back by
reverting the backend change and redeploying.
