# ALE-73 skip unsupported application questions

Risk: Significant — the extension changes which questions it submits to the
existing grounding and metering path, and how it maps answers back to the draft.

## Change contract

After a validated evidence-gap response, offer a Skip action for each identified
question and keep the evidence review link. Skips are explicit and reversible.
The job description, original questions, and their positions stay in the open
draft. The extension shows the included count and the existing four-credit
batch cost before generation. With none included, it sends no request.

Send only the included questions in original order through the current API.
Map diagnostics and validated structured answers using the submitted positions.
Retain skipped positions as Unanswered without a copy button. Copy All contains
only completed answers. Skip state and skipped prompts stay out of stored results
and telemetry. If generation requires sign-in, the existing 15-minute
extension-only session draft retains all questions and the selected skips for
their owner. Editing the draft or changing accounts removes the old actions.
The server revalidates every submitted question through the existing grounding,
metering, and final-output path.

## Verification and rollout

The popup and installed ZIP Chromium cases use synthetic questions and responses.
They exercise skipping and undo, original positions, retry mapping, no request
for an empty subset, changed drafts, and copying only included answers.
The unit suite checks malformed and stale response mappings. The application
service tests cover pre-model failure and the existing batch charge.

In hosted acceptance, use the ALE-67 slot-four fixture with metered test
credentials. Verify the initial 422 precedes quota, credit, and provider work.
Generate four supported answers, verify exactly one normal charge, and check
the original position, the accessible count, the review link, and copy. Repeat
with one question and with multiple gaps. Use keyboard and VoiceOver.
Keep older packaged clients supported by the current API. Roll back by
rebuilding the prior extension as a higher Store version if already published.
