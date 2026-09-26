# Chrome extension 1.0.19 account isolation

Date: 2026-09-26. Branch: `codex/extension-1-0-19-account-isolation`. Risk tier: **Critical** because local draft data, authenticated requests, and account transitions cross extension page and service-worker boundaries.

## Change contract

- A draft or approved example saved by account A must never be shown, exported, or sent to the API under account B.
- Old records without an owner are ignored. Sign-out removes saved drafts, approved examples, and local usage data.
- A generation or feedback request is sent only when the popup's requester matches the account and token used by the worker.
- A temporary A → unauthenticated → A refresh preserves an unsent form and a successful draft; a confirmed A → B transition clears the visible state.
- Local usage limits and export belong to the active account.

The shared `lib/account-owned-cache.js` owns the account checks. Popup, settings, and worker apply those checks at their respective storage and request boundaries. The worker serializes local account-owned writes, including approved examples, saved generation, and usage; explicit logout drains those writes before clearing storage. The popup reads the resulting count.

## Evidence

- Local source and package manifest: 1.0.19. The developer dashboard screenshot showed draft 1.0.18 and published 1.0.17, but the uploaded 1.0.18 CRX was not available for byte-level comparison.
- Extension: 23 test files, 230 tests passed; lint, type-check, and dependency audit passed. Adversarial tests reproduced and now reject stale-account retries and usage writes after logout; pending usage and approved-draft writes are drained before logout cleanup.
- Root: 91 files, 1,094 tests; 15 guardrails; type-check passed. Root lint passed with one pre-existing unused-argument warning in `lib/auth/refund-admin.ts`.
- Browser smoke: 6 Chrome tests passed, including a response discarded after account change.
- Version policy and ZIP package contract passed; `git diff --check` passed.
- Audited local artifact before this branch was cut: `ascendia-extension/dist/aletheia-extension.zip` (manifest 1.0.19), SHA-256 `65c5e0519bcdc0c94baadd4a75d1100600ae15eb7ac822c52df581993e45c263`. Its build metadata identified the source as dirty. Rebuild from the committed branch and verify the new hash immediately before upload; ZIP metadata changes on rebuild.
- Fresh independent reviews identified account-change feedback, Settings export, usage, transient-refresh, retry timing, and approved-draft logout races. The findings were corrected with focused regression checks. The final return review found no unresolved material issue in the account-isolation change; it inspected the corrected source and ZIP but did not independently rerun the reported suites.

## Rollout and recovery

Chrome Web Store upload and publication were not performed. The developer console blocks automation of its package page in this session. In the item's Package tab, upload the 1.0.19 ZIP, confirm the draft version and permissions, then submit for review. Disable automatic publication in the review dialog if a separate manual publish decision is desired. The published 1.0.17 item remains in place during review. Before publication, manually test an A → B account switch and A → null → A token refresh in an unpacked or trusted-test install, and compare the submitted package's manifest to the local artifact. If publication causes a regression, publish a higher-numbered corrected package; retain the prior version/ZIP for rollback options offered by the Store.
