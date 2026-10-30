# ALE-47 — grounded final-output finalization

## Execution context

2026-10-30 America/New_York. Branch `feat/ale-47-grounded-output-finalization` from synchronized main `b2cc7c9a0e29fc946395d247f838fe4f7c834a34`. ALE-54 was subsequently merged into main at `71c9e25`; local main and this uncommitted branch were fast-forwarded to that baseline, preserving both sets of work. Read complete ALE-47/46 and relevant dependencies before editing. Initial risk **Critical**: source-backed public output and fair compensation. Implement, test and review; do not mark the issue or parent Done, publish, deploy, or mutate production.

## 1. Problem and goal

The same grounded text currently passes different transformations per channel. Destructive negative-lexicon removal, fingerprint rewriting, formatting and truncation can damage facts, technical tokens, paragraphs or CTA/signature. Every final generated body must pass provenance after its last content transformation and retain its complete channel contract.

## 2. Scope

One shared final provenance/safety boundary and narrowly defined nonsemantic text preparation, used by LinkedIn connection, cold email, InMail and YC single/batch answers. Remove semantic postprocessing/truncation from these grounded paths. Preserve immutable source excerpts/IDs, confirmation, ownership, source scopes, exclusions, model/admission/billing and API compatibility. No model call, dependency, migration, UI, ranking, rhetorical plan or broad prompt rewrite.

## 3. Existing implementation and prerequisite evidence

ALE-46's fact preparation was independently reviewed on snapshot bb1981dc…: R4 resolved for human-attested individual assertions, R1–R3 resolved; 334 tests/guardrails/disposable PostgreSQL passed. Current merged A/B1/introductory coverage/privacy audit independently ran 621 focused/1489 full tests and confirmed no material findings in that implemented scope (Linear comment dated 2026-10-29). This supplies ALE-47's required code-review prerequisite; it does not complete ALE-46's broader hosted/quality gates or clear its parent status. Retain the dependency relation and document remaining release gates.

Observed: cold email renderer truncates its final section before service word checks, then basic sanitizer removes phrases; InMail rewrites/formats/truncates before final validation; LinkedIn validates components but not its exact final rendered body; YC rewrites its body while keeping its ledger immutable, so supported technical prose can be rejected after a style rewrite. Existing final atomic validators remain canonical.

## 4. Location map

- Verified/edit: `lib/ai/sanitizer.ts` — shared policy pattern definitions; add grounded inspect-only safety, keep general-purpose legacy behavior.
- Verified/read: `lib/ai/ai-fingerprint-detector.ts`, prompt sanitizer and email formatter — inventory existing transformations; grounded paths must not apply their semantic rewrites.
- Verified/edit: `modules/grounding/application/finalize-grounded-output.ts` — shared nonsemantic preparation plus exact-final-body safety/provenance; grounding owns the cross-channel invariant, avoiding YC→outreach application dependencies.
- Verified/edit: outreach renderers, `validate-outreach-provenance.ts`, `extension-generate.service.ts`; YC sanitizer/validator/service — wire common boundary, preserve channel-specific framing/counts and refunds.
- Verified/edit/test: provider and draft subject schemas share the existing160-character subject ceiling with the finalizer; provider tool shape and budgets are unchanged. Atomic domain/validator and canonical `lib/ai/output-constraints.ts`, route/refund/admission tests, co-located renderer/YC/guardrail tests.
- Verified/read: caller repository/RLS, public response/extension projections, logger/Sentry redaction. No storage or permission change planned.

## 5. Dependencies and constraints

Use Node24, installed Vitest/Playwright/Zod, canonical output constraints and atomic validator. No ALE-54 dependency. Technical code prerequisite above is satisfied; parent release/hosted gates remain separate. Do not change immutable supporting_excerpt/source IDs to fit transformed text. XML-escaped source units remain escaped. Preserve source equality and final scope/coverage checks.

## 6. Security and privacy

Grounded text is text-only, never executable HTML. Inspect using existing blocked/suspicious/profanity/contact policy; reject unsafe output rather than redact it into a different assertion. Literal harmless technical tokens/URLs/flags are preserved. Email may retain legitimate addresses under the existing email-specific policy; LinkedIn and YC reject contact redaction cases. No malicious/script execution or weaker user-data access. Detection telemetry contains fixed pattern names/counts/lengths only. Never log text, excerpts, claims or identity. Keep the exact server-inserted terminal cold-email signature exemption; no model-controlled arbitrary trusted text.

## 7. Design and authoritative order

Parse bounded structured output → prepare body/sections with NFKC, CRLF→LF and outer trim only → render deterministically → shared safety and atomic validation of exact final body/subject (plus LinkedIn component scopes) → canonical channel limits → return. Claim text uses only the shared NFKC/LF/outer-trim equivalence; ledger/source IDs and supporting excerpts remain immutable. Inner whitespace is preserved and compared exactly; only spacing between complete supported facts is flexible. No paragraph flattening or inner whitespace rewriting (quoted command arguments can be significant).

Fingerprint policy for all grounded channels is detection-only; semantic/grammar/CTA rewrites are not applied. Prompt constraints remain prevention guidance. Source-backed em dashes, buzzwords or polite wording must remain exact rather than be silently repaired. Legacy non-grounded sanitizer callers retain their behavior. If an unsafe-content policy would require editing a fact, fail/refund. No model repair/retry call.

The shared finalizer owns exact displayed fields, selected atomic sources, exclusions and safety. The shared boundary also enforces canonical final limits; adapters retain structured parsing, deterministic rendering and product-specific framing. The only provenance exception is the exact terminal server-owned cold-email identity block. YC batch headings copy escaped user questions as display labels; answer bodies are individually finalized/scoped after all transforms, then assembled without changing those bodies. Do not treat user-supplied question labels as model-generated facts.

## 8. Channel × transformation matrix

| Surface                       | Preparation/rendering                                                                                       | Last provenance gate                                     | Limits / invalid result                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| LinkedIn connection           | Nonsemantic sections; deterministic finite intro/CTA                                                        | Exact rendered body plus target/candidate/CTA scopes     | 300 chars; complete CTA; 502/compensation                                                    |
| Cold email                    | Nonsemantic fields; deterministic paragraphs, proof lines, exact server signature; no truncation            | Exact subject/body minus only verified terminal identity | Existing mode word bounds and160-char subject; signature/CTA retained; 502/compensation      |
| InMail                        | Nonsemantic body/subject; preserve existing supplied paragraph boundaries; no semantic formatter/truncation | Exact subject/body                                       | Existing mode constraints capped at80–120 as canonical and160-char subject; 502/compensation |
| YC single / each batch answer | Nonsemantic body; immutable source ledger; per-question scope                                               | Exact final answer                                       | 50–150 words,3000 chars; existing YC framing; 502/compensation                               |

For every regression fixture record before/after lengths and expected exact text or rejection. NFKC may expand characters (e.g. ligatures); enforce the final actual count, never truncate. All channels keep their existing model-call/attempt budgets and reservation release semantics.

Measured nonsemantic preparation (native function; synthetic fixtures; external `fixture-lengths.json`): em dash26→26, courtesy33→33, buzzwords34→34, multiline proof30→30, URL42→42, quoted flags42→42, version21→21, outer-whitespace/CRLF36→30, NFKC ligature16→18. A separately grounded subject fixture expands57→165, so the shared finalizer rejects the final160-character violation rather than silently shortening it. Its first fixture used an invalid unwrapped target claim; corrected to a supported first-person candidate assertion before treating it as length evidence.

## 9. Evaluations and acceptance

- AC1: exact final bodies/subjects and scoped components must be covered after rendering; reject a final-only hidden assertion, wrong source, altered excerpt, target-as-candidate and excluded text. Wrong implementation: validate only old components/old body.
- AC2: preserve factual wording, URLs, `--flags`, version strings, technical punctuation, quoted spaces and multiline proof/signature blocks. Reject unsafe text without editing ledger/body. Wrong implementation: reuse negative lexicon/fingerprint/formatter that changes claims.
- AC3: complete CTA/signature and canonical final bounds; expansion/overlength fixtures reject/refund. Wrong implementation: silently truncate final section or InMail.
- AC4: same fingerprint inspect-only policy across grounded channels; only justified email/contact differences. Telemetry canaries must not leak. Wrong implementation: log transformed fields or sanitize source excerpts.
- AC5: actual route/single+batch/refund/admission tests, including real default sanitizer wiring, preserve API and no additional DB/model calls. Wrong implementation: mocked local helper never used by service.
- AC6: baseline/red/green and adversarial/native gates plus fresh Critical review, exact source evidence and dated remaining risks; no Done from local checks alone.

Development fixtures include em dash, formulaic courtesy, AI-first/robust language, multiline proof blocks, URLs with query/version punctuation, command flags and quoted spaces, Unicode expansion, transformed/omitted CTA, over-limit text, signature mutation and claim removal. Independent review will exercise additional held-out mutations; no live user data or provider calls. Scope only this deterministic finalization, not broad semantic entailment.

## 10. Implementation progress

Implemented the shared safety/provenance/limit boundary across all four channels, with independent final-body and component-scope coverage checks. Removed grounded semantic rewriting/truncation; preserved exact terminal identity and CTA checks. Fixed stateful global blocked-regex checks and multiline script-tag detection. The existing160-character subject ceiling is now shared with tool schemas and rechecked after Unicode preparation; there is no tool shape, client, database, provider-call or model-budget change.

TDD: baseline35 tests passed; five initial behavioral failures reproduced YC semantic rewriting, technical whitespace loss, email truncation and repeated blocked-content bypass. A real-route negative control then reproduced missing final-body300-character enforcement. Further finalizer/safety cases cover omitted final claims, scoped laundering, edited signature, CTA removal, unsupported assertions, exclusions, malicious text and Unicode expansion. Some initial failures were stale test doubles or invalid fixtures; corrected those explicitly without weakening provenance/privacy expectations. All legacy semantic-rewrite expectations now assert exact supported text or actual final-body mutations.

Original native verification and fresh Critical R1 review passed with no material findings. After integrating merged ALE-54, refresh the combined source evidence below; keep final receipts external.

## 11. Handoff

Use this branch/record and current integration base `71c9e25`; preserve merged ALE-54 behavior and the unrelated primary checkout. Original ALE-47 snapshot `3bdef040…` received independent R1 no-material-findings review; its receipt is historical after integration. Next incomplete step is combined verification and return review. Verify exact current state and acceptance before resuming; inspect changed dependencies/callers rather than repeating earlier phases.

## 12. Decisions and deviations

A shared core under grounding is justified by four real consumers with the same final-body invariant; source-specific adapters retain their product rules. Detection-only style handling replaces unsafe repair rather than inventing neutral paraphrases. Excerpts stay immutable despite the issue's body/ledger sanitation wording: only existing nonsemantic equivalence is permitted, not rewriting provenance. No new generic pipeline framework or dependency.

## 13. Validation and evidence

Passed during development:320 affected tests,25 shared finalizer/safety checks and170 actual route/YC-service tests (overlapping suites; not additive). Initial guardrail run failed1 outdated redaction expectation; corrected to require outright rejection and immutable evidence. Passed pre-review: full1,526 tests/111files and coverage gate (89.32% statements,82.55% branches,89.26% functions,90.67% lines),15guardrails,146resume contracts, types, lint (one unchanged refund-admin parameter warning), policy, audit0advisories, dummy-environment build, local health and28browser smoke tests. After the subject-limit correction,1,527 full tests/111files,15guardrails,lint and the dummy build pass again; provider-tool and actual route suites pass. Fact-review browser checks pass at375/900/1440px. A separate post-build type check is recorded externally before review. Extension code unchanged; extension CI/version/release not run on this branch. Hosted CI, real provider quality/latency, real authentication/RLS and production deployment are Not run. No routine external DB/provider calls. Full-source fresh Critical review in isolated scratch, default3-round budget; no recursive reviewers. Receipts outside source at `/Users/nagarjunmallesh/.codex/artifacts/aletheia/ale47-finalization-2026-10-30/`.

## 14. Completion, rollout and rollback

In Progress only after Linear update; not complete/released. Critical risk. Monitor content-free validation/sanitization/limit/refund counters and actual output tokens/latency after authorized deployment. No extra provider calls expected; CPU bounded by existing output/source caps. Rollback by reverting the cohesive finalization/adapter change and redeploying; no database/client migration. Legacy unsafe rewrites return on rollback; no guarantee of arbitrary paraphrasing or perfect quality. Hosted real-model/extension and parent ALE-46 release evidence remain separate gates.

## 15. Completion gate

- [x] Local acceptance regressions and transformation matrix verified
- [ ] Final diff/risk/security/privacy/compatibility reviewed
- [x] Relevant local native checks passed; failures/blocked/not-run documented
- [ ] Independent review current; material findings resolved
- [ ] Dated evidence, rollout/rollback and remaining risks recorded
- [ ] Linear updated without prematurely completing the issue/parent

## Integration refresh — 2026-10-30

User confirmed ALE-54 merged. Verified remote/main `71c9e25` contains the published relevance implementation. Saved the complete ALE-47 dirty/untracked work in retained stash `6b2fcebadbc423d1b2e88b90ab1d3025ab6b0c2e`, fast-forwarded local main and the commit-free feature branch, and reapplied the stash. Only `docs/progress.txt` conflicted; retained both ALE-54 and ALE-47 entries. Route and YC tests merged automatically and retain the newer ranked-evidence fixtures and privacy assertions. No ranking/source/finalizer contract change intended. Preserve earlier R1 evidence; rerun affected/full native checks and one return review (ALE-47 round2 of3) against the combined snapshot before calling verification current. Integration receipts remain external under `main-sync-ale54/` in the existing artifact directory. No new feature, commit, push, deployment or Done transition.

Combined native verification passed before return review:652 focused tests/35files;1,586 full tests/114files and configured coverage;15guardrails;types;lint(one unchanged refund-admin warning);policy;dummy-environment build;scoped formatting and diff hygiene. The source preservation check confirms all19 changed prior paths belong to merged ALE-54 or deliberate integration-document updates; every other original ALE-47 file remains byte-identical. All four saved untracked runtime/test files also match the retained stash. The feature contract file is intentionally updated for this new baseline. No corrective runtime edit was needed. Return review round2 and final post-build type/freshness receipts are recorded externally; original R1 remains historical evidence only for its old baseline.

## ALE47-R3-1 correction contract — 2026-10-30

User authorized fixing the confirmed inherited quoted-whitespace gap. Critical risk remains: shared fact/provenance normalization and compensation. Preserve original complete reviewed-fact whitespace throughout source projection, canonical approved wording and final comparisons, using only existing NFKC/CRLF/outer-trim preparation. No quote/command parser, new dependency, model call, cap increase, API/schema/migration or unrelated cleanup. Structural whitespace between complete supported facts may vary; whitespace inside a fact must not be silently rewritten or compared away. This intentionally narrows the old blanket internal-whitespace equivalence; literal technical values cannot safely be treated as formatting. Keep source membership/escaping/whole excerpts, exclusions, scope, budgets and fair refunds intact.

TDD: copy the independent failing fact-review→real context→source choice→renderer→finalizer case into maintained tests; cover double/single/escaped quotes, tabs/multiline and unquoted CLI flags. Add real cold-email/InMail/YC source-to-final checks and negative cases for changing public body, ledger or supporting excerpt. Verify Unicode/CRLF/outer-trim equivalence and inter-fact paragraph spacing without treating within-fact changes as equivalent. Run affected/full native and guardrail/static/build checks. No commit/push/Done transition. Existing R1/R2 no-finding reviews are superseded by R3's material open finding; three automated rounds are used. Implement/verify locally, then request one extra review authorization or report fresh review pending; do not silently reset the budget.

### ALE47-R3-1 implementation evidence

The five affected runtime surfaces now share a non-collapsing canonical normalizer: atomic sources/approved wording, final atomic comparisons, outreach source projection, YC source projection and final public-text preparation. The atomic coverage scanner permits whitespace only between complete known facts/framing; it never discards internal literal whitespace. The existing closed named-role/hiring rewrite grammar alone may normalize line wrapping while parsing named fields; unknown/quoted context retains the complete unchanged excerpt. No command/quote parser or new abstraction was added.

Observed12 initial behavioral failures before code changes: actual LinkedIn quoted/unquoted CLI values, tabs/newlines/escaped quotes, actual cold-email/InMail/YC preparation and body/ledger/excerpt mutation acceptance. The inter-fact framing test passed as a baseline. After the core correction, two old tests required explicit contract updates: mixed factual paragraphs now retain their line breaks; the former blanket within-fact whitespace-equivalence assertion was replaced by positive NFKC/CRLF/outer-trim and negative within-fact flattening checks. Two new wrapped-headline/hiring compatibility assertions failed before narrowing whitespace folding to the existing named-field grammar. All17 maintained full-path cases now pass, including literal profile/JD fallbacks; all807 then affected tests passed before the last two fallback cases were added.

This is stricter for free-form model output: if it reflows whitespace inside a complete cited fact, reject/refund rather than silently replacing or weakening that assertion. Formatting between complete facts stays flexible. Stored fact-review source fingerprints are unchanged; no migration or client contract change. Whole-record exclusions, XML escaping, exact supporting excerpts, scopes, source caps, original300-character budget and compensation remain in force. ALE47-R3-1 is locally corrected with passing regressions, but independent closure on this new source remains pending. All three review rounds are exhausted; no round4 may run without explicit authorization or human review. Fresh evidence/rollout gates remain separate; do not mark the issue Done.

Local correction verification complete:17 full-path whitespace regressions,1 additional strict-equivalence guard and1,604 native tests/115files with configured coverage pass. Fifteen guardrails,types,lint(one inherited refund-admin warning),policy,dummy-environment production build and post-build type-check pass. The exact original independent reproducer now reports rawDoubleSpace/atomicDoubleSpace/renderedDoubleSpace=true and finalizationAccepted=true. No formatter/escaping/exclusion/limit/refund check was removed. Fresh reviewer closure is pending budget authorization; local passing tests alone are not independent acceptance. Current receipt/snapshot and any authorized return review will be stored externally in `premerge-audit/`. No live provider,hosted auth/RLS,production load,extension release,commit,push or issue completion.

## ALE47-R4-1 correction contract — 2026-10-30

Human authorized one additional independent review (round4). It independently resolved ALE47-R3-1 and confirmed a new introducedP2: changing the shared factual normalizer narrowed the retained partial-substring exclusion fallback when either side has repeated whitespace. Current acceptance reproducer fails and identical base assertion passes. Correct this within the original authorized whitespace fix: retain exact fact/excerpt/body comparison, but fold whitespace separately on both sides of the deny-only conservative substring rule. Keep whole-topic exclusion matching unchanged. Add red-first whitespace/source/denylist variants and a nonmatching positive control; rerun affected/full/security/static/build checks. No other semantic, API, data, provider or release change. Preserve R4 as historical evidence, do not call its old snapshot current after correction. Authorized4-round review budget is now used; any further independent review needs explicit authorization/human review.

### ALE47-R4-1 implementation evidence

Added five observed red acceptance cases: repeated spaces in source/output, repeated spaces in the exclusion, tabs/newlines in source/output and mixed exclusion whitespace. A separate nonmatching exclusion control remained green. Restored the prior conservative substring denial by whitespace-folding denylist values and a deny-only searchable text copy; whole-topic matching is unchanged. This does not touch source, claim, excerpt or displayed text, which remain exact. The original quoted-argument probe remains fully preserved; the exclusion probe now throwsCLAIM_EXCLUDED.

All815 affected tests and1,610 native tests/115files with configured coverage pass, including17 full-path whitespace regressions and six added exclusion controls. Fifteen guardrails,types,lint(one inherited refund-admin warning),policy and scoped format/diff checks pass. Current build/final receipt and post-build types are external. R3-1 was independently resolved by authorizedR4 on its snapshot; R4-1 is now locally corrected but current independent closure remains pending. Four authorized rounds used; no fifth review without a new explicit approval or human review. No new provider/database/client/dependency/schema/budget change; no commit,push,deployment or Done transition.
