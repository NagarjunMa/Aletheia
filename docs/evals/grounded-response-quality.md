# ALE-48 — Offline grounded discourse evaluations

## Execution context

2026-11-02 America/New_York. `test/ale-48-grounded-discourse-evaluations`
starts at synchronized `main`706ff59. User requested the next implementation
stage after the ALE-46 repair merge. Full documentation mode; initial risk
**Significant**, because incorrect quality measurements could authorize a later
unsafe rollout. This stage is offline only and does not authorize that rollout.
ALE-47's merged finalizer and independent claim/privacy review are the technical
prerequisite. Retain ALE-46/47 parent/provider/hosted acceptance gates and statuses;
no issue is marked Done by this work.

## Problem, goal and non-goals

Measure source faithfulness and professional-message structure before rhetorical
planning changes. Existing legacy golden examples test useful formatting rules,
but some include historical real names and cannot serve as the new synthetic
ledger-backed corpus. Do not copy those messages into new fixtures.

Add deterministic, transparent measurements and explicit expected properties,
not an AI detector, an entailment judge, a single opaque quality score, or proof
of human usefulness. No model/provider/database calls, user-corpus collection,
production prompts/API/storage/extension changes, new dependencies or activation.

## Design and location map

Verified: `lib/ai/evals/{email-quality,linkedin-connection-quality}.ts` contain
legacy independent quality rules; preserve their tests and semantics. Canonical
source/coverage policy lives in `modules/grounding/application/validate-atomic-claims.ts`
and final safety/limits in `finalize-grounded-output.ts`; reuse, never fork them.
Channel limits come from `lib/ai/output-constraints.ts`; neutral wording from
`modules/grounding/domain/atomic-claim.ts`. Current outreach option builders and
renderers support a deterministic server-option baseline without paid calls.
YC remains authored by a model; its offline references must not be called real
model output. Pin current prompt/model/budget configuration and baseline origin.

Planned: shared offline metric types/helpers under `lib/ai/evals`, thin outreach
and application evaluators, two synthetic JSON fixture sets, an offline report
runner under `scripts`, and focused tests. Only the CLI serializes a fixed
metadata/metric projection. Evaluator inputs may contain synthetic ledgers;
reports never include bodies, source strings/IDs, excerpts, prompts or identity.
No production consumer imports this evaluation layer. The CLI reuses the existing descriptor-bounded reader exported from `scripts/evaluate-generation.ts`; its original behavior is unchanged.

## Metrics and thresholds (defined before fixtures)

The unit is one final message or one application answer, not an entire YC batch.
An exact source check establishes support, not real-world truth or semantic fit.

| Dimension                   | Measurement / denominator                                                                                                                          | Threshold and limitations                                                                                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factual coverage            | Canonical exact final-source validation; valid declared claims / all declared claims                                                               | Every evaluated final field must pass. Empty ledger is not a failure for a wholly neutral message; target-specificity independently handles required context.                                                                                                         |
| Unsupported assertion count | Invalid declared claims / declared claims. If final coverage fails with no invalid declared claim, count is unknown (`null`), never0               | Zero invalid claims and full final coverage. No regex can reliably count undeclared semantic assertions; unknown blocks the safety gate.                                                                                                                              |
| Target specificity          | Valid target claims actually present in body / declared target claims                                                                              | At least1 when fixture's human-authored context requires a target hook. Optional target-only/candidate-only expectations are explicit. Presence is not semantic relevance.                                                                                            |
| Explanation budget          | Optional framing words after removing declared factual spans and required greeting/ask/courtesy/proof label/signature; body-word denominator       | At most12words for connection,20for email/InMail,15for YC; also at most25% for bodies over20words. Declared spans are measured separately from their support; the factual gate rejects unsupported spans. Source-backed qualifications never count as excess framing. |
| Repetition                  | Extra exact occurrences of each complete claim text / distinct claimed spans                                                                       | Zero duplicate factual spans. Required greetings, asks and proof labels are exempt. Corpus measurements below assess deeper pattern reuse separately.                                                                                                                 |
| CTA appropriateness         | Recognized complete low-friction neutral invitations / message                                                                                     | Exactly1 final invitation for outreach,0for YC. A direct ask is valid; arbitrary new asks require reviewed rubric changes.                                                                                                                                            |
| Channel completeness        | Canonical units/limits, neutral greeting for outreach, supplied cold identity block, paragraph breaks for prose; YC excludes outreach greeting/CTA | All required structure passes. Concise follow-up/target-only cases are not forced into long proof layouts.                                                                                                                                                            |

Corpus rates: dominant opening scope/kind, dominant recognized CTA template, and
dominant ordered candidate/target scope-and-kind pattern divided by group size, grouped
by category/mode. Report numerator and denominator, including empty/singleton
samples. Harmful-pattern denominator excludes target-only and concise(<=90word)
messages. Greeting/CTA/proof labels/signature do not enter that pattern. At least
3eligible cases are required before flagging a dominant pattern above75%.
The CTA denominator contains recognized invitations only, so YC has no CTA rate. These are structural proxies, not proof of bad writing; show required-template
rates separately and do not fail an otherwise correct concise/direct-ask case.

## Acceptance and evaluation contract

- AC1: Locked fictional source-ledger fixtures cover LinkedIn, all cold email
  modes, InMail and YC single/per-question batch scoping. Explicit expected
  dimensions detect generic praise, missing target hook, unsupported rewrite,
  hidden assertion, excess explanation, repetition, bad CTA/format, wrong-source
  and legitimate target-only/concise/proof-block controls. Wrong implementation:
  substring overlap passes ungrounded praise; canonical coverage must reject it.
- AC2: All measurements are deterministic, bounded and explainable; empty groups,
  zero denominators and unknown assertion counts are explicit. A repeated CTA
  alone cannot trigger harmful discourse repetition. No LLM judge.
- AC3: Reports compare variants only on identical fixture IDs/hash and compatible
  baseline origin; metadata pins prompt/model/budgets. No invented token usage:
  report configured ceilings separately from measured local runtime; provider
  token usage remains not run unless separately supplied by authorized evidence.
- AC4: New fixture privacy scan rejects contacts, production hosts, credential
  patterns and known project/user identifiers; manually review fictional provenance.
  Reports contain fixed IDs/enums/counts only. A synthetic flag is an attestation,
  not proof that arbitrary external text is safe to publish.
- AC5: Local suite target: p95<=500ms for the locked corpus on Node24, bounded
  inputs<=10kbody chars/64sources/12claims/128cases. Record environment/workload;
  do not claim production latency or token savings. TDD then focused/native
  gates and fresh Significant-tier independent review are required.

## Phase 4 go/no-go decision

No activation from passing harness tests alone. A planning variant must use the
same locked fixtures/configuration and baseline origin; all safety/channel
checks must pass, with no decline in coverage, no unsupported/unknown assertions,
no new privacy violations, and no individual expected-property regression.
Where baseline harmful repetition is measurable, require at least15percentage
points absolute reduction without dropping candidate/target obligations; other measured groups must not worsen. If fewer
than3eligible samples exist, diversity decision is insufficient evidence rather
than automatic pass. Human usefulness review and authorized real-provider
quality/token/latency evidence remain separate required product decisions.

The deterministic server-option baseline may enumerate a fixed current option
without asking Claude to choose. It measures offered-output structure, not model
selection reliability. YC synthetic references measure the evaluator only.
Clearly retain these origin differences; no phase/parent completion claim from
this offline baseline.

## Implementation sequence and checks

Write explicit failing evaluator cases against a runnable minimal scaffold;
then implement shared measurements and channel adapters. Add locked synthetic
fixtures, baseline/variant report and privacy regressions. Keep tests independent
of implementation scores: fixture expectations are authored before the scorer.
Run focused Vitest, configured coverage,15guardrails, lint, types, policy,
production build with dummy environment, scoped Prettier and diff hygiene;
exercise the offline CLI and fresh reviewer on the final diff. Existing PR CI
also includes resume/browser/extension checks; record what is retained vs rerun.
No external calls in unit or smoke tests.

## Security, compatibility and recovery

Fail malformed/oversized evaluation input with fixed errors. Do not echo unknown
fixture values/errors in reports. No database/auth/billing/runtime generation
boundary changes. No additional model call, telemetry collector or persistent
user context. Rollback is reverting the offline evaluation files/scripts;
production behavior is unchanged. The harness cannot certify prompt-injection
immunity, semantic truth, hiring success or production readiness.

## Progress and handoff

Implemented the evaluator,30locked cases(23positive/7negative), first-current-server-option outreach baseline and synthetic-reference YC baseline, comparison gate and bounded privacy-safe CLI. Initial runnable scaffold reproduced9behavioral failures; canonical-backed implementation passes57new tests and85eval/CLI tests including legacy coverage. A schema/type integration mismatch was corrected without changing production contracts. Next: run full native gates and fresh independent review.
Issue remains In Progress once Linear is updated. Final evidence records passed,
failed, blocked/not-run checks, tested source and remaining release gates; exact
receipts are outside source at `/tmp/ale48-discourse-2026-11-02/`.

## Baseline and usage — 2026-11-02

Run `npm run eval:discourse` from the repository root. The npm banner precedes
JSON; for a pure JSON artifact use `LOG_LEVEL=silent npx tsx scripts/evaluate-grounded-discourse.ts > /tmp/discourse-baseline.json`.
The checked-in `docs/evals/grounded-response-baseline.json` omits variable runtime
and is regenerated intentionally when fixtures or pinned configuration change.
`npm run eval:discourse -- --variant /path/to/synthetic-variant.json` compares the
same locked case IDs and immutable contexts; only body, subject and ledger may
change. Sources, exclusions, identity, target obligations and negative expected
properties must stay fixed. The variant origin is always proposed synthetic
outputs, not evidence that any model produced them under the baseline config.
Errors are fixed strings; input is a regular file bounded to2MB through the same
checked descriptor, including growing-file/FIFO/device protection.

| Group          | Eligible pattern numerator/denominator | Observation                                                                  |
| -------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| Cold initial   | 3/3                                    | Repeated scope/kind order in selected offered drafts                         |
| InMail initial | 3/3                                    | Repeated scope/kind order in selected offered drafts                         |
| YC references  | 5/5                                    | Deliberately same two-assertion reference order; not observed model behavior |

All23positive baseline rows pass grounding/format/rubric checks; all7negative
controls have their manually expected violations. Concise/target-only outputs
and required greeting/CTA/proof labels are exempt from harmful-pattern counting.
The reskinned fictional cases deliberately expose repetition and are not an
estimate of its production prevalence. Unchanged synthetic variants receive
no_go; source-preserving ordering improvements can become eligible only for
human/provider review, never automatic activation.

Pinned configuration: outreach6.0.0, YC2.0.1, claude-sonnet-4-6,
temperatures0.8/0.3, output ceilings600connection/2400prose/1000singleYC/8000fiveYC.
Actual system-prompt content is fingerprinted. No explicit input-token ceiling
is configured by these adapters; report null and the actual per-category source
character bounds, not a character-to-token estimate. Measured provider token
usage is null; provider calls0. The in-process20sample warm benchmark on
Node24.16.0/darwin/arm64 measured p95=15.41ms,max=17.40ms for30cases/23baseline rows
(target500ms); excludes CLI startup and says nothing about production latency.
No memory-saving or model-quality claim is made.

## Current verification checkpoint

Passed on2026-11-02, Node24.16.0:57new behavioral/CLI tests;85focused eval/legacy
checks;1,781native tests/121files with unchanged coverage thresholds
(89.92%statements,83.60%branches,90.58%functions,91.15%lines);15guardrails;
root and new-script lint (only inherited refund-admin warning); types; policy;
dummy-environment production build; scoped formatting/diff hygiene; offline
baseline JSON equality; CLI HTTP/fetch-disabled run with empty credentials.
The original9red failures and later corpus/type setup corrections are retained
in the external receipt directory; no safety assertion or coverage gate was
removed. Root audit high gate passes with20inherited moderate tooling advisories;
no lockfile/dependency change in this task.

Not rerun: extension/browser/resume suites separately, because their source and
runtime consumers are unchanged; merged-base evidence is retained and full
native tests still cover their node-level contracts. Hosted PR CI is not run
until a PR exists. Not run: actual provider tokens/quality, hosted auth/RLS/
concurrency/cost or human usefulness. These are separate from the offline stage;
no new live budget was used or inferred. Parent release gates remain open.
Fresh Significant-tier independent review and final source freshness are pending;
receipts will be external, preserving the reviewed source. No commit, push,
deployment or Done transition is requested/performed in this implementation turn.

## Independent R1 findings and corrected checkpoint

R1 verdict changes_required is retained at the external independent-review.md.
All four findings are confirmed/introduced/P2 and locally corrected, pending
return review on the corrected snapshot; no prior pass is relabeled current.

- ALE48-R1-001: required framing is exempt only once; additional occurrences
  count toward the optional budget. Outreach permits exactly one external
  greeting and at most one proof header, and YC rejects external greetings anywhere. Reuse the
  canonical YC validator for its framing, safety and character/word policy,
  including terminal closings; do not duplicate that policy in a new model.
  Direct and comparator greeting-spam plus terminal YC controls failed first.
- ALE48-R1-002: the canonical finalizer validates safety/coverage before raising
  a channel-limit error. Only that typed limit error is treated as successful
  factual coverage, while channel-format remains failed; all other canonical
  failures remain failures. Long covered/uncovered subject controls prove the
  separation; source checks are not relaxed.
- ALE48-R1-003: fingerprint actual composed outreach system strings using the
  canonical base/provenance helpers and actual single/five-question YC builder
  system strings. Mutation controls for appended and batch-only instructions
  failed first. The saved baseline changed only its configuration fingerprint;
  fixture hash, outputs, counts and metrics stayed identical.
- ALE48-R1-004: add bounded common phone-shaped contact checks alongside the
  existing URL/email/credential/identifier checks. Four reserved fictional phone
  representations failed first, then pass rejection tests. This remains a
  conservative fixture check plus manual fictional-provenance review, not a
  complete international PII detector.

Eight original maintained review regressions and two further terminal-closing
controls reproduced failures before correction. An intermediate integration
edit left stale prompt symbol references; another supplied a parser-only field
to the canonical YC validator. Both were caught and corrected by focused/types
checks; failed logs are retained, not counted as defect-detection evidence.

Corrected current evidence:67new tests/95focused eval+CLI tests;
1,791native/121files with configured coverage89.99/83.75/90.71/91.21;
15guardrails, root/new-script lint(existing warning), types and dummy build pass.
Policy/audit and unchanged-runtime browser/extension evidence remain as recorded
above. Fresh Significant return review round2 of3 and source freshness are the
next step; receipt will be independent-return-review.md outside the source tree.
No model/database/hosted calls, source policy relaxation, commit/push/deployment
or Done transition occurred. Final risk remains Significant.

Final corrected20warm runs: p95=15.14ms,max=16.33ms, Node24.16/darwin/arm64,30cases/23rows;500ms target passed. This supersedes earlier timing for the changed evaluator, excludes CLI startup and is not production generation evidence.
