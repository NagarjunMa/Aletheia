# ALE-66 résumé fact review

Risk: Critical — private résumé text and eligibility for application generation.

## Contract

- The Evidence Library offers up to eight deduplicated work excerpts when a
  verified, parsed résumé is primary. The existing trusted upload paths record
  eligibility during ingestion. Older uploads remain résumé background until
  the user uploads a new copy and makes it primary. Historical parsed text was
  owner-writable, and upload metadata cannot authenticate its exact wording.
  If the original file is identical, keep a local copy, remove the older
  upload, then upload it again. The existing duplicate check still applies.
  The intake truncation signal makes clipped documents ineligible for review.
  Edits to parsed text or its path revoke source eligibility, and the original
  protected file must still exist. The review itself
  uses the signed-in owner's Supabase client.
  Loading and closing do not write approvals. The browser receives the
  proposed excerpts and review state without the full document or Storage path.
- The user chooses which excerpts to confirm and can later withdraw them.
  Whole paragraphs and contiguous bullets stay together with their scope. An
  edit may change whitespace or add the next complete eligible passage. The
  server verifies the current source, retains its wording and qualifications,
  and rejects edited or overlapping claims it cannot match. Users can add
  independently authored details through the existing project-review flow.
- Confirmations belong to the primary résumé row and the approved source.
  Renaming it preserves approvals. Being replaced as primary, changes to
  parsed text or the source file, and deletion discard them. Restoring an old
  primary requires fresh review. A primary change is one owner-scoped database
  operation, so a failed promotion preserves the old primary and approvals.
  A late confirmation cannot overwrite a new source or another review.
  Existing project approvals have their own lifecycle.
- Only the application-answer flow projects confirmed résumé facts into the
  existing citable evidence. The primary résumé itself stays background.
  Standard per-question relevance, exclusions, exact-claim validation and
  pre-admission stops still apply. Outreach and explicit project selection
  retain their current evidence sources.

## Verification

Use synthetic TXT/PDF input and dedicated accounts in Preview. Verify that an
unreviewed résumé leaves a matching question unsupported, two approved passages
can support two matching questions, an unrelated question remains unsupported,
and removing an approval clears it from a new request. Repeat after renaming,
switching primary and deleting it, with the review open in a second tab. Check
keyboard and VoiceOver navigation and cross-account isolation. Capture only
status codes, counts and redacted test results.

The local counterpart runs the native unit and coverage suites, the mock
Chromium fact-review suite and the disposable PostgreSQL fact-review suite.
The latter applies the owner RLS and review migrations before exercising two
authenticated roles and the lifecycle trigger.

## Rollout and rollback

Apply the additive migration before deploying the application code. Verify
the isolated environment before production rollout. Roll back by redeploying
the previous application version and retaining the additive migration and
private approvals. Older application code treats résumé contents as background.
If the legacy upload route is used during a rollback, users can upload those
files again after rollout to make them eligible for review.
