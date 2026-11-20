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
