# Aletheia Evaluation Log

## Current reporting — ALE-30, 2026-11-19

Use the single read-only [quality cohort query](quality-feedback-cohorts.sql)
only in an authorized environment. The old Q1–Q6 examples in `eval-queries.sql`
are retired: they lacked current consent, receipt and privacy gates. Never copy
comments, user/generation IDs, source text or drafts into this log.

The default query retains existing cohorts/counts and the first eleven columns;
three appended columns are null. Set `by_grounding=true` for validated outreach
grounding/fallback and coarse candidate-source classes. Set `by_feedback=true`
for email mode, normalized atomic claim kinds and fixed rejection counts. Both
options can be enabled together. YC has no outreach grounding summary; use
`by_grounding=false` to retain its quality cohorts. Atomic claim kinds such as
action/technology are not project-story kinds such as technical_project.

All six existing modes remain distinct: `initial_outreach`, `founder_ceo_outreach`,
`follow_up`, `clarification`, `role_fit_summary`, `referral_request`. Missing/invalid
modes are `unreported`; non-email channels are `not_applicable`.
No historical mode is backfilled or inferred. Rejection counts include rejected
receipts only and share the approvals/outcomes denominator. Unknown reasons use
`unreported`, never free text. Claim-kind order does not split a cohort. The
original parent user cap applies before finer breakdowns.

### Taxonomy and compatibility

Keep existing codes: `too_generic`, `too_formal`, `wrong_tone`, `too_repetitive`,
`weak_target_relevance`, `unsupported_feeling`, `wrong_ask`. Add `weak_evidence`
for the wrong reviewed experience being selected. The Unsupported claim label
keeps the `unsupported_feeling` code and remains a user allegation. Application
issue categories/private summaries are unchanged; the report never selects them.
The dashboard retains its existing Other bucket for the new reason.

Deploy the backend before extension 1.0.35. Older servers may reject the new
reason; the draft and retry controls remain. Legacy approvals with optional
reasons remain accepted, while strict summary approvals reject reasons. Neither
becomes a rejection counter. Duplicate/style and regeneration behavior is unchanged.

### Interpretation

Review aggregates after releases or in the existing weekly review. Current
analytics opt-in is mandatory; withdrawal removes prior feedback. Retention is
best-effort 90 days. Metrics remain client-reported, unverified and responder-selected.
A YC batch is one outcome. The exploratory floor requires 200 outcomes, 30 users
and 14 days in the displayed cohort. Smaller slices may fail it. The floor is not
proof of power, causality or permission to roll out a flag. Use ALE-50's existing
reviewed decision process; no automatic prompt changes or user outreach.

Record only report commit/options, observation window, coarse cohort dimensions,
outcomes/approvals/rejection counts, floor flag, missing-data limits and reviewed
action. Do not average rates or sum distinct users across overlapping cohorts.

## Entries

### 2026-11-22 — ALE-29 synthetic outreach coverage

**Contract and risk.** Standard. Extend the deterministic test corpus on
`test/ale-29-grounded-outreach-evals` from `main` `d9fd52b`. Use the existing
ALE-48 rubric and canonical composers, limits and provenance checks. This is
test-only coverage. Keep the locked corpus and release comparison stable.

| Coverage                     | Existing evidence and missing-case check                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cold email and InMail modes  | ALE-48 covers all six modes for both channels. Nordnet covers AI workflow specificity, unsupported exploratory wording, orphaned technologies, generic inventories and signature structure. Add an unsigned cold-email draft and a fabricated-signature negative control. |
| Proof quantity               | The selector tests cover source budgets. Check that the cold-email draft schema rejects a third proof point even when the additional claim has a source.                                                                                                                  |
| Connection notes             | ALE-48 covers reviewed and target-only notes. Existing intent tests cover networking, referral, job inquiry and mentorship. Add the exact 200-character boundary for a complete mentorship ask, including the same ask one character over.                                |
| InMail                       | Check that a follow-up can use reviewed candidate proof when the complete target claim cannot fit. Reject unsupported metrics, skills, employers and projects placed in the subject.                                                                                      |
| Fallback, safety and privacy | Reuse the existing final-used-source summary tests for profile and résumé compatibility. Reuse the existing exclusion, privacy-loader and channel-level source checks. Extend the injection-safe context fixture to InMail and verify it has no usable facts.             |

The InMail control keeps the fictional recruiter's short question when it fits.
The longer infrastructure scenario keeps candidate proof without shortening the
conversation fact. The added tests live in
[`outreach-golden-cases.test.ts`](../../lib/ai/evals/outreach-golden-cases.test.ts)
and the existing grounding-context suite.

**Reproduction.** A temporary test copy that used 300 characters for the Basic
note and discarded the InMail subject failed five assertions as expected. The
intact tests passed. Existing legacy examples, including Nordnet, remain in their
original suites. All new examples are fictional.

**Version record.** The renderer and source rules are from `d9fd52b`. The
locked ALE-48 gate still uses outreach prompt `6.1.0`, configured model
`claude-sonnet-4-6`, and fixture fingerprint
`d5f62e0944578e5d2682a7c4df3f9ecbe978377ab6fb7c41a52f951edd2ef289`.
The additional cases run in the ordinary unit suite. The gate recorded zero
provider calls. There are no provider quality, latency or token measurements.

**Local results.** The focused suite passed 201 tests. Full coverage passed
3,382 tests in 155 files with 92.22% line coverage, and all 15 guardrail tests
passed. Lint, type checking, engineering policy, formatting and diff checks
passed. Lint reported the existing unused parameter warning in refund-admin.
Hosted rollout validation belongs to ALE-32. No deployment is needed to roll
back this test-only change.

### 2026-08-24 — ALE-24 synthetic Nordnet regression

- Prompt/schema/renderer: `2.0.0` / semantic cold-email composition / deterministic cold-email renderer
- Fixture: synthetic engineering-productivity target and two synthetic confirmed evidence sources; no private candidate or recruiter data
- Rules: concrete AI workflow evidence, unsupported `exploring`, generic AI phrasing, technology inventories, orphaned technology lines, repeated claims, and complete-or-omitted signature
- Result: focused eval/renderer tests and the full Phase 2 gate passed: 57 unit files / 681 tests, 13 guardrails, lint, strict TypeScript, production build, and `git diff --check`

### Results template

- Date and report/deployment commit:
- Options, observation window and missing-data limits:
- Coarse cohort dimensions:
- Outcomes / approvals / allowlisted rejection counts:
- Exploratory floor and uncertainty:
- Reviewed action (hold/investigate); no automatic rollout:

No hosted report was run for ALE-30 during implementation.
