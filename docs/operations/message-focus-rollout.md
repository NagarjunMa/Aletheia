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
   origin and the effective extension capability without following redirects.
   Output contains only the verified SHA and flag states. It does not sign in,
   generate drafts, or change data. A preflight pass is not rollout approval.

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
