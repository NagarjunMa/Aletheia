# Grounded outreach rollout

Use this runbook when preparing or monitoring a web or Chrome extension release
that affects grounded drafts. [ALE-31][ale31] added capture guidance to the existing
evidence editor.

## Prepare evidence and check a draft

1. In Dashboard → Evidence library, add an **AI in daily work** story. Name the
   tool or model and the engineering task. Describe your own contribution and
   the checks you ran. Record the real outcome, including relevant limitations.
   A qualitative outcome is fine. Use **See a fictional example** for the
   expected level of detail.
2. Save and confirm the story. In **Review individual facts**, confirm only
   complete claims with their original actor, scope and qualifications. A résumé
   upload supplies material for review. Reviewed résumé evidence must come from
   the current primary résumé.
3. Draft from a synthetic account first. Try automatic selection and an eligible
   story selection. Verify the exact output against the reviewed facts and its
   channel's length and call-to-action rules. Review the draft in the extension
   without sending a message or invitation.

## Source selection and privacy

The server reads candidate context under the authenticated caller's identity.
Owner-scoped reads and row-level security limit access to that caller's records.
Confirmed stories with eligible reviewed facts supply candidate proof. An
explicit story selection must pass current ownership, confirmation and channel
checks. In automatic mode, the job's substantive requirements constrain
selection ahead of general title or profile cues. The selector preserves
qualifications and honors excluded claims. LinkedIn profile, job description and
conversation context are separate target inputs and are screened as untrusted
data.

With blank or sparse hiring context, an appropriate reviewed experience can
support a domain introduction. LinkedIn may use a supported target-only note
when candidate proof does not fit. Initial cold email can reject when the role
requires proof and no relevant reviewed fact fits. InMail and follow-ups have
mode-specific grounding rules. [Job context and channel behavior][relevance]
describes these boundaries in detail.

The final draft is validated before the API reports its grounding level. The
summary uses sources actually represented in that draft. Classification
precedence is reviewed evidence, profile, résumé, then target-only. The response
contract supports profile and résumé classifications for compatibility. On
reviewed-fact paths, candidate proof comes from eligible reviewed facts. The
extension displays a status when it receives a valid summary with validated
provenance and hides it for older responses without one.
Public grounding metadata carries bounded counts and categories. Keep source
IDs, excerpts, prompts, résumés, job posts and draft text out of incident records
and telemetry.

## Diagnose a failure

| Response                                                           | Operator check                                                                                                                                                                                                                                |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `422 INSUFFICIENT_GROUNDING`                                       | Check the stage. For a preflight refusal, check whether complete allowed context or relevant reviewed evidence fits the channel and budget. For a post-generation refusal, inspect the final validation code and compensation outcome.        |
| `422 EVIDENCE_SELECTION_UNAVAILABLE` or `MESSAGE_FOCUS_NO_MATCH`   | Check that the selected story or focus still matches current eligible reviewed facts. Clear it to retry in automatic mode where appropriate.                                                                                                  |
| `422 GROUNDING_PROFILE_INCOMPLETE` on application answers          | Use the response's profile or question guidance. Add or confirm a fact that answers the question, or skip it if the installed extension supports skipping it.                                                                                 |
| `429` admission limit                                              | Read the response code and its retry/reset guidance. Check daily, short-window and simultaneous-generation limits in [Generation admission][admission].                                                                                       |
| `503 CANDIDATE_CONTEXT_UNAVAILABLE` or `QUOTA_SERVICE_UNAVAILABLE` | Check the failing dependency and stage. Candidate-context failure is before admission. Quota-service failure refuses the affected reservation. Use stage and billing evidence to distinguish initial admission from a later provider attempt. |
| `502 PARSE_FAILED`                                                 | Check the bounded validation code, provider attempts and refund state. Follow the [refund review runbook][refund] for pending restoration.                                                                                                    |

Use the operation ID to correlate extension and server events when available.
Record deployment SHA and client version. Compare by channel, mode, status,
stage, bounded error code, grounding level, prompt version and model. Watch
grounding refusals, provider attempts, latency, input/output units and refunds.
Use `generation.quality` and `feedback.quality` for outcome signals, with the
[existing quality-report privacy and consent rules][feedback]. Track approvals
as review feedback, separately from successful HTTP requests.

## Release and rollback

Use the [ALE-32 release checklist](../validation/grounded-outreach-release-checklist.md)
for pinned package evidence, the hosted acceptance matrix, and the rollout decision.

1. Run the applicable local checks, including
   `npm run gate:grounded-response:offline` for generation changes. For
   flag-controlled changes, use the [protected draft-quality gate][quality] or
   [Message Focus gate][focus] with isolated same-commit builds and synthetic
   accounts. Review grounding, privacy, compatibility, latency and billing
   evidence before enabling that feature.
2. Verify the web deployment with `GET /api/health` and
   `GET /api/extension/version`. Check with the installed extension and with a
   response that predates the validated grounding summary. For an extension
   release, run `npm ci`, `npm ci --prefix ascendia-extension` and
   `npm run build:extension` from the intended release commit. Test the
   packaged build and verify its manifest version before publishing
   `ascendia-extension/dist/aletheia-extension.zip`.
3. For degradation isolated to rhetorical plans or Message Focus, disable its
   server flag (`RHETORICAL_PLANS_ENABLED` or `MESSAGE_FOCUS_ENABLED`) and
   redeploy. Confirm a flag-off draft and recheck error and compensation
   metrics. For an unflagged web regression, redeploy the last known compatible
   web revision or revert the affected change, then retest with the installed
   extension. Consider published client versions before a backend rollback.
   The ALE-31 form guidance can be reverted with a web-only change.

[ale31]: https://linear.app/aletheia-connection-builder/issue/ALE-31/43-improve-ai-evidence-capture-guidance-and-operating-documentation
[relevance]: ../operations/ale-77-job-context.md
[admission]: ../operations/generation-admission.md
[refund]: ../operations/refund-review.md
[feedback]: ../operations/ale-51-quality-feedback.md
[quality]: ../operations/grounded-response-production-gate.md
[focus]: ../operations/message-focus-rollout.md
