# ALE-80 preserve opportunity context and select reviewed evidence

[Linear issue and acceptance criteria](https://linear.app/aletheia-connection-builder/issue/ALE-80/preserve-original-job-context-and-let-claude-select-reviewed-evidence)

## Execution context

Development starts from main `1f2e353` on `feat/ale-80-reviewed-evidence`. The branch preserves opportunity context and adds a server-controlled reviewed drafting path. The Linear issue defines release acceptance. The critical risk tier covers private evidence sent to the provider, output verification, and the effects of a model-reported evidence gap on reservations and charges.

## Problem

Cal Carlisle's Founding AI Engineer post exposed two failures. Without the trailing hashtag, the existing relevance gate could block generation. With it, a candidate-only draft could reach Claude while the job description was removed. Overjet's open impact question exposed a separate failure. It can be rejected before the provider call despite an approved action and outcome, because it lacks the matcher's expected terms.

## First increment

- `modules/outreach/application/extension-generate.service.ts` sends clean job context to the existing option selection call, including candidate-only outreach. The server keeps the complete description within the existing 20,000-character request bound. A legacy saved description above the same bound returns recovery guidance the extension can display, releases the reservation, and stops before the provider call.
- `lib/ai/prompts/job-context.ts` separates trailing hashtag lines and removes standalone controls only in a recognizable LinkedIn post header. It preserves ordered lines, headings, and qualifiers in the body.
- `lib/ai/prompts/yc-application.ts` keeps question IDs and text separate, makes the question primary and the job description secondary, and encodes literal tag delimiters in XML target fields. The existing JSON selection shape preserves its separate question fields.
- The provider still selects server-owned, validated drafts. This change keeps current evidence eligibility, output verification, connection limits, and account-scoped data loading. Candidate-only requests omit the saved job-description fallback and keep private fallback strings and learned style out of the provider request. The prompt versions and offline comparison metadata changed. The recorded synthetic corpus and its expected outputs stayed identical.

## Evaluation

| Case | Check |
| --- | --- |
| Cal provider handoff | HTTP route tests capture the mocked provider call for both post variants with an independently valid prepared note. The complete agent-security description reaches the call and copied controls are removed. A real-preparation replay separately observed the current tag-free preflight block. |
| Long job and safety | Route tests assert the later qualifications arrive past 4,000 characters, instruction-like job input is withheld, and an oversized saved description returns 400 and releases the slot. Parser tests cover controls that must remain in the body. |
| Overjet provider handoff | Prompt test compares decoded ordered question fields and the production-integration requirements. A negative test prevents pasted tags from introducing a fake prompt section. This tests serialization and prompt priority. |
| Existing contracts | Full unit coverage, guardrails, types, lint, policy, and the offline discourse evaluation. The offline fixture tests compare synthetic outputs and send no provider requests. |

The red run reproduced missing context in both Cal provider requests, truncation of long input, an instruction-like description reaching the provider, missing question priority, and unescaped application delimiters. A follow-up red run reproduced over-removal of control-like lines inside legitimate job text. Independent review identified missing extension-visible recovery guidance, a saved job description reaching candidate-only selection, and removal of a substantive heading after the copied header. Red tests reproduced those cases and the parser's blank-line hashtag handling. The corrections passed 1,038 focused tests. The full unit suite and 15 guardrails passed before the review corrections. Final checks are recorded in the local logs. Check logs use the `/tmp/ale80-*.log` prefix and independent-review evidence uses `/tmp/ale80-review*`.

## Reviewed drafting

- The extension and API preserve Unicode wording and question order. The application job description is optional. Existing limits continue to count normalized UTF-16 units with an additional raw bound. The legacy response shape for an expressly single-question request still works.
- When `REVIEWED_DRAFTS_ENABLED=true`, the two preparation services load the caller's current project and eligible résumé approvals before any generation reservation. The pool retains complete, safe, current reviewed fields and project identity. It returns recovery guidance above the evidence budget. Explicit story selection still requires use of those stories. An evidence-backed request goes to the structured draft tool without a lexical eligibility gate or prewritten drafts.
- Claude sees the original question fields, substantive job or post context, and reviewed evidence in one call. The result has per-answer source IDs and drafted text or a gap. Legacy mechanisms still handle explicit message-focus requests, injection-safe fallbacks, and outreach without usable reviewed facts. Raw résumé text stays outside the new prompt.
- The server verifies source IDs, complete approved statements, output coverage, selected roots, visible text, and channel limits. It rechecks the cited facts under the same caller before release, including facts from the current primary résumé. Choose an independently approved concise fact when a long fact will exceed the channel limit. Grounded text preserves literal spelling and punctuation. Every cited claim is checked against recognized names in the caller's complete eligible reviewed evidence pool, including uncited and unselected projects. Names are matched by normalized case and word boundaries with longer names taking precedence. Mixed-project drafts also require a clear project lead and separate paragraphs. The name catalog stays on the server.
- A semantic evidence gap returns the existing 422 guidance, with original question positions and compensation for the credit and daily-slot reservations. The extension's explicit skip flow is unchanged. The provider attempt still consumed work. A metered failure can leave a debit and matching refund in the ledger.

## Local verification and rollout

- The Cal route fixture runs both post variants at 200 and 300 characters through the owned-data preparation and actual provider request boundary. The mocked Claude response selects a separately approved concise statement from the same story as the longer fact. Its prototype scope and the purpose of the work remain visible at both limits. The prior keyword false negative for Overjet is reproduced locally. The new Overjet route logic preserves the exact impact question, handles missing job context and returns ordered 1/3/5 answers from a small reviewed profile. A slot-4 gap and separate supported retry verify compensation and order.
- Negative cases cover a fabricated deployment, uncited or repeated claims, omission of qualifications, changed punctuation in a literal, misleading placement of cross-project claims, removal of approval during generation, and evidence budget overflow. The reviewed draft returns a complete invitation for outreach and accounts for the server-rendered email signature in the provider's word limit. Cold email and InMail regressions use a résumé-only account fixture and check public grounding metadata. The first independent review reproduced wording, attribution, repeated answers, résumé projection, and outreach framing problems. The branch includes corrections and regression checks. The local receipts are under `/tmp/ale80-complete-*.log` and `/tmp/ale80-regressions*.log`.
- The flag defaults off. Verify on a controlled deployment before enabling it for production. Deploy the API support for optional job context before distributing extension 1.0.37. Disabling the flag restores the legacy selection path. Application question inputs remain compatible with the newer API when the flag is off.
- The local suite mocks provider and database boundaries. Hosted acceptance still needs the current extension and approved test account to verify live relevance and natural writing, qualifying details, tokens, latency, how the model reports genuine gaps, meter balance and ledger, and account isolation. Keep ALE-80 In Progress.

### Verification on the corrected branch

The final local run passed 3,440 web tests with 92.32% line coverage, 390 extension tests, 18 Chromium application panel scenarios, and 15 guardrails. Type checking, lint, engineering policy, extension version checks, and extension packaging passed. Lint retains the existing refund-admin warning. The build passed on retry after the existing Next.js advisory interrupted its first run.

Three independent review rounds identified and exercised defects in shortening, project attribution, résumé bullets, reused claims, signature budgeting, and invitation handling. The final round isolated an unquoted literal substitution and overlapping project names. The final source removes the reported substitution and checks complete project names, with local regression passes for both cases. Those last corrections still need an independent recheck before enabling the reviewed drafting flag. The final runtime evidence is in `/tmp/ale80-corrected-*.log`. Mocked model cases establish request shape, validation, and reservation behavior. Hosted wording, evidence selection quality, and metered results remain open.


### Follow-up grounding corrections

The November 23 recheck reproduced material cases in the recorded `214f7831` snapshot. The latest correction removes generated shortening and applies verbatim validation to the complete displayed factual span. An approved Unicode compatibility glyph is preserved. The project validation checks every claim, resolves overlapping titles across case and common separators, and includes eligible project titles outside the selected or cited facts without forwarding them. The existing same-account approval refresh also compares project titles.

The red suite reproduced eight failures involving literal names, compatibility characters, uncited or unselected longer names, and foreign project claims after a valid lead. These regressions passed after the correction. The separately approved compact Cal fact and independent Apollo and Apollo Billing paragraphs pass with the tighter rules. No migration is required. Keep the reviewed drafting flag off until the release gates are met. Full local evidence and the fresh review relate to this correction's captured source.


The first independent return found that a hyphenated modifier could conceal a known foreign project name. Conflict checks now recognize the full known name inside a compound. An unresolved compound alone cannot establish a project lead. Approved leads with the reproduced relational modifiers remain usable. The verbatim path retains the previous Unicode-normalized exclusion checks. Five red regressions reproduced the modifier and exclusion issues and passed after the fixes.

### Overjet question coverage

The application-answer service suite runs the exact Overjet impact question and a plain-language rephrasing with and without job context. Three- and five-question batches add fictional examples of auditing an automated decision, improving device setup, making a volunteer integration reliable, and giving users control over a draft. Each batch checks the exact original question and its expected approved answer in order, even if the provider returns the items in reverse order. The unsupported slot-4 case still tests compensation and retry. All 193 service tests passed locally. The provider is mocked in CI, so live relevance and writing quality remain Preview checks.

### November 26 follow-up on merged baseline

PR #169 merged at `3407818` with CI green. The follow-up branch
`fix/ale-80-context-and-note-fit` starts from that commit. Risk remains
Critical because this modifies final validation behavior for drafts that contain
private reviewed evidence.

- `separateJobContext` removes an exact double paste of a recognizable
  LinkedIn post before projecting the job description and hashtags. Text
  repeated inside a post or a plain job description stays intact, including
  requirements, ordered steps and code examples.
- Reviewed LinkedIn notes above the selected limit can drop an optional
  thank-you and then an optional greeting. The existing final validator
  verifies the intact approved claims, invitation and selected limit against
  the text returned to the extension. The reviewed prompt is now
  `reviewed-draft-3` and prioritizes the complete fact over optional framing.
- Cal regressions use the one original 175-character implementation fact and
  an unrelated distractor. With and without copied controls and hashtags, the
  216-character proposed draft fits the 200-character limit at 195 characters
  and remains intact at 300. The mocked requests make one provider call. The
  source retains its prototype qualification. The pre-change 200-character
  route returned 502 for both post variants. Separate checks preserve greeting
  text when it belongs to an approved fact and reject notes still over budget.
- The long-fact case is resolved through framing. The Linear paraphrase
  criterion for facts that still cannot fit, live Preview quality, latency,
  meter evidence and the installed extension checks remain open. Keep
  `REVIEWED_DRAFTS_ENABLED` off pending acceptance. No schema, API or extension
  release changes are required for this follow-up.

The first independent review reproduced a loss of repeated approval steps
and code statements in the wider deduplication attempt. The current rule
recognizes only two complete identical LinkedIn pastes. The corresponding
tests preserve ordered and indented repetitions and the literal content of
fenced examples.

The corrected behavior passed 1,420 focused tests, 3,462 coverage tests,
15 guardrails and the offline gate with zero provider calls. Lint, policy and
the high-severity dependency audit passed. The audit reported 12 existing
moderate advisories. The independent return review verified the narrower
duplicate handling and found no other material issues.

### November 27 follow-up on concise LinkedIn wording

PR #170 merged at `6d9635c`. The next increment is
`fix/ale-80-reviewed-note-wording`. Risk remains Critical because the final
draft must be grounded in the same current approved source after shortening.

- `validateReviewedDraft` verifies Claude's selected fact against its current
  approval. If a single-action LinkedIn note is too long after optional
  framing is removed, the server looks for the complete approved alternative
  that replaces only an opening “In order to” with “To”. The alternative must
  have its own current approval, on the same project and with the same fact
  kind. Known project names at the changed prefix prevent substitution.
  No new factual wording is generated by this fallback.
- The validator checks both original and displayed project references and
  applies the same exclusion rules to both versions. It still requires final
  coverage, a complete invitation and the selected character limit.
  Approval refresh uses both facts when the fallback applies. The public
  grounding details count the fact actually displayed. The
  reviewed prompt is now `reviewed-draft-4`; call count, public API and
  extension packaging are unchanged.
- The new local Cal replays start with a complete verbatim note of 209 or 306
  characters after optional framing. Those requests returned 502 before this
  change. The expected final notes are 200 and 297 characters, respectively,
  with the prototype scope intact. Regressions assert that already-fitting
  wording stays exact, an overlength draft still fails, and an alternative
  from another project or one withdrawn during generation cannot be used.
- Facts without a separately approved shorter variant still need approval
  before the alternate wording can be used. Live Preview relevance, token
  use, latency, metering and installed
  extension acceptance remain required. Keep `REVIEWED_DRAFTS_ENABLED` off
  pending hosted acceptance. Disable the flag to restore legacy drafting
  after deployment or revert the increment to restore the prior reviewed
  wording behavior. No migration is needed.

Independent review reproduced inferred wording edits to literal captions and
to a statement about its own opening tokens. It also found an original-only
exclusion case. This revision replaces inference with separately approved
exact wording and applies the same exclusion predicate to both facts.
The final approval-based design still needs an independent review after the
three rounds on the earlier inferred-wording approach.

### November 27 pre-merge verification

A fresh reviewer reproduced an exclusion added while Claude was drafting.
The approval refresh previously checked whole topics. It missed an exclusion
that matched the original wording only under the final validator's
whitespace-folded substring rule. The refresh now uses that same predicate
on every fact it rechecks. The HTTP regression returned 200 before the fix
and now refuses the draft and releases the daily slot exactly once.
