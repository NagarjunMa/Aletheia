# ALE-59: Message Focus rollout gate

**Decision: hold.** Leave production Message Focus disabled until the isolated
comparison, privacy and admission checks, and release review pass.

## Start with a read-only preflight

Use the existing isolated `aletheia-ale50-gate` Vercel project and the protected
GitHub environment only after checking their identities, branch restrictions,
and reviewer configuration. Reuse the isolation variables documented in the
[grounded-response gate](grounded-response-production-gate.md); the two Preview
URLs below are for ALE-59, so do not overwrite an active ALE-50 comparison.

1. Confirm the integration Supabase project is separate from production and
   apply the migrations for the tested commit there. Create or verify two
   synthetic `@example.test` accounts with the same reviewed facts and sufficient
   credit and quota headroom. Keep their credentials in protected storage.
2. In the isolated Vercel project, make two protected, Git-backed **Preview**
   deployments from the same full SHA. Set `MESSAGE_FOCUS_ENABLED=false` on one
   and `true` on the other. Both use the isolated database and the same model,
   prompt configuration and limits. Keep `DEBUG` and `RHETORICAL_PLANS_ENABLED`
   off. Set `GROUNDED_RESPONSE_GATE_ATTESTATION=true` and expose Vercel's system
   variables. Use the immutable URL from each deployment, not branch aliases.
3. From Node 24 with an authenticated Vercel CLI on PATH, load
   `GROUNDED_GATE_CONFIRM=yes`, `SHA`, `PROJECT_ID`,
   `PRODUCTION_PROJECT_ID`, `SUPABASE_URL`, `PRODUCTION_SUPABASE_URL`,
   `PRODUCTION_APP_URL`, `OFF_URL`, `ON_URL`, and `VERCEL_BYPASS` (all with the
   `GROUNDED_GATE_` prefix). Load the bypass from protected storage. Run:

   ```sh
   ./node_modules/.bin/tsx scripts/message-focus-rollout-preflight.ts
   ```

   The script checks both immutable URLs in the authenticated Vercel inventory
   before sending the bypass. It then checks protection, SHA, project, database
   origin, provider wire debug, and the effective extension capability without following redirects.
   Output contains only the verified SHA and flag states. It does not sign in,
   generate drafts, or change data. A preflight pass is not rollout approval.

## Run the paired hosted smoke

Use Node 24, a clean checkout of the deployed SHA, and an authenticated Vercel
CLI. The command repeats the protected preflight and checks the extension
version on both deployments before signing either account in.

1. In the isolated Supabase project, use two different confirmed,
   password-enabled `@example.test` accounts. Give both the same full name
   (`Synthetic Engineer`) and current role (`Evaluation Engineer`). Leave
   other profile fields, target job preferences, resumes, exclusions and
   accepted examples empty.
2. On both accounts, add and confirm one **Technical project** titled
   **Policy evaluation prototype**. Copy the complete strings from the
   [runner fixture](../../scripts/message-focus-hosted-fixture.ts). Put
   `automaticShortFact` and `focusedShortFact` in Context, separated by a
   space. Put `focusedAction` in Actions and `focusedOutcome` in Outcome.
   Confirm the excerpts in this exact order: `automaticShortFact`,
   `focusedShortFact`, `focusedAction`, then `focusedOutcome`. Assign
   **Action** to the first three and **Outcome** to the fourth. Skip the
   title suggestion. Leave metrics, skills and links
   empty. Keep both accounts on the same billing mode. For metered runs,
   allow 20 credits per account. Each account should have room for six new
   model attempts in its short window and at least 14 daily work units.
3. Load the preflight variables plus the isolated `SUPABASE_PUBLISHABLE_KEY`
   and each account's `USER_ID`, `EMAIL` and `PASSWORD`, prefixed with
   `GROUNDED_GATE_OFF_` or `GROUNDED_GATE_ON_` for the account fields and
   `GROUNDED_GATE_` for the key. Keep credentials in protected storage.
4. With the isolated provider budget and run authorized, set
   `MESSAGE_FOCUS_GATE_MAX_REQUESTS=16` and
   `MESSAGE_FOCUS_GATE_MAX_OUTPUT_TOKENS=27600`. Write the report outside
   the worktree so the clean checkout check passes.

   ```sh
   npm run --silent gate:message-focus:hosted > /tmp/ale59-message-focus-smoke.json
   ```

The 16-request budget covers generation. Setup adds eight health/config
requests, two version requests, two isolated sign-ins, and the read-only Vercel
inventory command. The fixed workload runs 12 expected successes and four
expected denials.
It checks LinkedIn at 200 characters, initial and follow-up cold email and
InMail, plus a headerless LinkedIn request without Focus or a note-limit
field on each Preview. The focused LinkedIn pair must switch reviewed facts.
Focused prose must lead its candidate facts with the full reviewed Actions
sentence, including its training-only qualification. It expects 409 for stale Focus with the flag off and
422 for an unmatched note in each channel with the flag on. The 12 expected
successes have a combined 21,600-token output allowance. The runner checks
approval against the more conservative 27,600 output tokens that would be
allowed if all 16 requests reached the model at the current server caps.
Input and cache tokens can also cost money. The provider budget and hosted
admission still apply. Unexpected responses stop the run without retrying.
Setup failures also write a safe JSON report and exit with a nonzero status.

Keep the report with the hosted acceptance evidence. It stores the SHA,
extension version, status, latency, output counts, input/output/cache token
counts and generated request IDs. Match those IDs to `request.complete`,
`generation.timing`, `repository.generation_attempt_start`, and the provider
and credit events in the same export. Confirm the four denials have zero model starts, reservations
and credit charges. Look for `ALE59PRIVATEFOCUSCANARY` and
`ALE59PRIVATENOMATCHCANARY` in the relevant exported logs and extension
storage. Keep raw logs private and preserve failure reports. The runner's
`passed` field covers the 16-case HTTP smoke. Its release decision stays
`hold`. Check emphasis in the full quality exercise. The larger latency sample,
independent log and storage audit, installed-extension checks, YC parity and
rollback each require separate evidence.

## Complete the hosted comparison before release

- Record the approved provider-call and spend limits, synthetic test inputs,
  expected billing, and cleanup before dispatch. Do not retry automatically.
  Start with paired smoke checks for LinkedIn, cold email and InMail, including
  follow-ups. Keep the same synthetic fixtures and backend configuration across
  the two arms. Check old/no-focus compatibility, and verify YC is unchanged.
- Check current versus excluded, stale and cross-account evidence, qualifiers,
  no-match recovery, prompt-injection handling and source limits. Compare
  model attempts, quota and billing outcomes. Audit logs, responses and
  extension storage for synthetic private canaries.
- Review whether focused drafts lead with the intended reviewed fact while
  preserving its meaning and qualifications. Report sample counts, p50/p95,
  tokens and cost. The planned gates are at most 20 ms added local p95 and a
  hosted p95 at most 1.10 times the no-focus baseline. Record inconclusive
  results as open. Keep the applicable ALE-56 hosted admission checks separate
  from local PostgreSQL evidence.
- The Store build permits only production API hosts. Test the unmodified
  packaged build with local intercepted requests, as the existing Chromium
  suite does. For a live isolated extension check, use a separate test build
  scoped to the verified Preview hosts. Do not publish that build or broaden
  production host permissions.
- Prove rollback in Preview by setting `MESSAGE_FOCUS_ENABLED=false`,
  redeploying, and checking capability and no-focus generation. Record the
  final independent review, clean release artifact and hosted evidence before
  enablement. No data rollback is expected.
