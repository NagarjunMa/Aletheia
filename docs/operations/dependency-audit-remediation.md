# Dependency audit remediation

## 1. Summary and execution context

2026-10-05 America/New_York. User authorized an isolated dependency fix;
ALE-63 is left untouched. Branch `fix/dependency-audit-remediation`, base
`a9dffaffb889a521944cb29ab2bfa7cef4e4f81a` (freshly verified origin/main).
Initial risk **Significant**; full record because CSS compilation and lint
dependency contracts cross tooling boundaries. No new Linear issue assigned.

## 2. Goal and scope

Remove the inherited vulnerable `braces` chain, pass the existing complete
dependency audit and preserve the current UI and Next.js lint coverage.
No audit suppression, omit-dev workaround, model/SDK/API/billing/auth/data
changes, Chrome package update, or deployment. Unrelated worktrees are preserved.

## 3. Existing system

Next 16/React 19 on Node 24; Tailwind 3/PostCSS generate web styling.
Next ESLint's root-directory discovery uses fast-glob's synchronous API.
Tailwind 3 and fast-glob depend on micromatch/braces. There is no patched
braces release as of this investigation; seven npm high entries represent
one advisory propagated through the dependency graph, not seven demonstrated
production exploits. The required CI audit includes development dependencies.

## 4. Changed locations

- Verified: root manifest/lock, PostCSS/Tailwind config, globals CSS, CI,
  ESLint config, Next plugin `get-root-dirs`, Playwright landing tests.
- Manifest/lock: Tailwind and its PostCSS plugin 4.3.3, tailwind-merge 3.7.0;
  remove direct autoprefixer. Pin eslint-config-next 16.3.6 and scope a
  fast-glob → tinyglobby 0.2.17 npm alias to its Next plugin dependency.
- PostCSS/config/globals: explicit canonical theme loading and web-only source
  scanning; preserve v3 container, ring, cursor and placeholder defaults.
- UI call sites: migrate outline-none to outline-hidden and flex-shrink-0 to
  shrink-0; include translate in transform transitions. No business logic edits.
- scripts/dependency-toolchain.test.ts exercises the actual Next lint consumer,
  dependency absence and Tailwind 4 class merging. e2e/frontend-theme.spec.ts
  covers public/auth UI at three widths and runs in the existing CI smoke job.

## 5. Dependencies and constraints

Use reproducible npm/Node 24 installs. Retain Next 16 lint rules and versions;
do not accept npm's suggested downgrade to Next 14 ESLint. Tailwind 4 requires
a changed PostCSS plugin and compatibility work, not only a version edit.
Preserve Phthalo colors, brand fonts, responsive layout and reduced motion.
Tailwind 4 supports Safari 16.4+, Chrome 111+, Firefox 128+; this change must
document that browser floor, not claim older-browser compatibility.

## 6. Security and privacy

No runtime private-data path changes. Remove vulnerable code, not rename an
unchanged copy to conceal an advisory. New dependencies must be audited;
the aliased dependency is upstream tinyglobby, not an unchanged copy of
fast-glob. No custom adapter was necessary. Do not run real auth/model/storage
actions. The lock refresh changes 60 existing dev-marked entries plus shared
enhanced-resolve 5.23.0→5.26.0 (Sentry webpack/Tailwind compiler) and es-object-atoms
1.1.1→1.1.2 (lint/polyfill helpers), beyond the intended Tailwind/merge changes.
Backend provider/auth direct dependencies and extension lock remain unchanged.

## 7. Implementation sequence

Baseline install/audit → characterize actual lint discovery and CSS output →
observe dependency regression failing → migrate compiler and replace only
affected lint glob boundary → regenerate lock → clean install → focused tests
→ full native checks → browser parity → independent review → evidence.

## 8. Design basis

Retain canonical theme configuration where supported through Tailwind's
explicit config loading. Avoid application redesign. Inspection established
that the actual Next consumer uses globSync with onlyDirectories, which
tinyglobby supports directly. This is a narrowly scoped replacement, not a
general fast-glob compatibility claim. Actual no-html-link-for-pages enforcement
is tested for string, array, backslash and default root settings. Existing lint
rules and audit thresholds are unchanged. Recheck this boundary on Next upgrades.

## 9. Acceptance evaluations

| ID  | Expected result                                                         | Check / plausible wrong implementation                                                                              |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| D1  | Full root audit passes; braces absent                                   | Existing npm audit plus installed/locked dependency assertion; rejects threshold bypass or retained vulnerable tree |
| D2  | Next lint continues enforcing routes with root-directory globs          | Real ESLint rule and fixture routes; rejects a matcher returning no directories                                     |
| D3  | Semantic colors/fonts/responsive utilities and animations still compile | PostCSS characterization and local browser geometry/style tests; rejects config not loaded or missing utilities     |
| D4  | Reproducible clean install and unchanged backend/extension behavior     | npm ci, lint/types/build, coverage/guardrails/resume checks, extension CI                                           |
| D5  | No feature drift or unrelated edits                                     | Merge-base diff, ALE-63/primary checkout preservation, fresh source review                                          |

## 10. Progress

Implementation and repository checks completed locally; fresh independent review
found no material findings. Final risk remains Significant because compiler and lint dependencies
change. No release or production-readiness claim.

## 11. Handoff

Next step: user-authorized commit/push and hosted PR CI.
ALE-63 remains on its separate dirty branch. No commit/push/PR authorized here.

## 12. Decisions and sources

- [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [Tailwind migration guide](https://tailwindcss.com/docs/upgrade-guide)
- [tinyglobby upstream](https://github.com/SuperchupuDev/tinyglobby)

Registry versions and consumer source are checked locally; prior task evidence
is historical, not a passing result for this branch.

## 13. Validation results

Fresh checks on Node 24.16.0, dated 2026-10-05:

- Reproducible root npm ci; full security:audit: zero vulnerabilities.
- Root coverage: 1,135 tests/93 files; statements 88.91%, branches 82.02%,
  functions 89.29%, lines 90.27%; unchanged thresholds pass.
- Guardrails: 15 pass; resume security: 145 pass; lint, type-check and production
  build pass. Build uses placeholder Supabase values, not real credentials.
- Extension npm ci and make extension-ci: zero advisories, 230 tests/23 files,
  types/lint/build pass. Version policy reports no packaged changes.
- Chromium: 29 tests pass (new theme tests plus landing and health smoke).
  Before/after capture: all 27 public/auth page/viewport samples match for the
  sampled geometry, computed styles and overflow. This is not a pixel-perfect
  or authenticated-dashboard verification. External requests were blocked.
- Six tooling contract tests pass, including actual Next lint root discovery
  and Tailwind class merging. Diff whitespace and changed-file formatting pass.
- Full repository format:check fails on 19 files; each is byte-identical to
  main, verified against Git blobs. No unrelated formatting changes made.

TDD: baseline audit reproduced seven high entries; dependency-absence regression
failed while four lint-consumer characterization cases passed before migration.
An initial alias install retained stale nested fast-glob in the lock; rebuilding
the pinned ESLint dependency subtree removed it, verified by npm ci and tests.
The initial Tailwind build/type check rejected the old darkMode tuple; switching
to the compatible class string fixed both. An initial baseline build was blocked
by local disk exhaustion, then passed after deleting only this task's disposable
.next output. These failed attempts are not counted as passing checks.

Non-blocking warnings: inherited unused status declaration in refund-admin;
Tailwind TypeScript config module-type warning; extension Vite future config
loader warning. Hosted PR CI, real provider/auth/Supabase/Vercel interactions,
Safari/Firefox and authenticated dashboard browser checks are not run. Those
are not represented by the mocked/public Chromium checks.

Fresh-context independent review by `/root/dependency_audit_review` on 2026-10-05:
no_material_findings. Exact serving/implementer model identities are unknown;
this is not claimed as cross-model review. Reviewed snapshot
`245648879cca0842133df95d090c73706f59dccba60f50ca4a958d1d1df2d3d8`
against base `a9dffaffb889a521944cb29ab2bfa7cef4e4f81a`. Source writers were
paused; provenance passed before/after review. The reviewer independently ran
1,135 unit tests, six tooling tests, 24 Chromium theme tests, lint, whitespace,
actual PostCSS utility compilation and a missing-config negative control. It
verified installed/locked braces absence and the real alias consumer. A suspected
bare-shadow regression was dismissed by direct compiled CSS evidence: the
installed compiler retains the compatible legacy shadow expression. No finding
IDs or fixes were invented for that unsupported concern.

The review did not rerun registry audit/install, production build, types,
coverage, extension CI or live environments; their passed evidence above is
the implementer's, not the reviewer's. Review report and immutable source packet
are local scratch evidence: /tmp/dependency-review.md and
/tmp/dependency-review-before.json. Subsequent edits only update this evidence
record and progress; implementation/test/config/lock bytes remain reviewed.

### Final pre-merge audit — 2026-10-05

User requested verification using the production-engineering-loop skill at
`/Users/nagarjunmallesh/Documents/ChatGPT/production-engineering-loop/skills/production-engineering-loop`.
Re-read the complete D1–D5 contract and applicable repository instructions;
inspected the entire merge-base diff, including untracked tests and all lock
changes. Remote main, local main, origin/main and HEAD still identify
`a9dffaffb889a521944cb29ab2bfa7cef4e4f81a`. Tested source packet:
`c93ea2f5aa55c3b76e35297d091f3d74a4cb06753ae11d8bd957adc30d604f6f`.

Fresh executions during this audit (Node 24.16.0):

- **Passed:** make ci — root audit zero vulnerabilities; lint zero errors
  with the inherited warning; type generation/type-check; 1,135 tests/93 files;
  15 guardrails; placeholder-environment production build.
- **Passed:** npm run test:coverage -- --run — unchanged thresholds;
  88.91% statements, 82.02% branches, 89.29% functions, 90.27% lines.
- **Passed:** npm run test:resume-security — 145 tests/12 files.
- **Passed:** selected Chromium frontend-theme, landing-navigation and health
  tests — 29 tests against the freshly rebuilt dummy local server; responsive
  layout, fonts/colors, focus and reduced motion checked.
- **Passed:** extension security:audit — zero vulnerabilities; diff whitespace
  and start/end source provenance checks.
- **Retained, not repeated:** unchanged root/extension clean-install evidence,
  extension types/lint/230 tests/build/version policy, 27 baseline parity samples,
  changed-file formatting, and the 19-file byte-identical baseline format failure.
  Implementation, tests and dependency hashes are unchanged from those checks.
- **Not run:** hosted PR CI, authenticated dashboard/settings browser sessions,
  Safari/Firefox and real Supabase/model/Vercel interactions. No blocked local
  gate or newly failed local check remains; these coverage gaps are not passes.

Fresh-context final review by `/root/dependency_premerge_verify` independently
inspected the entire dirty snapshot and actual consumers. Verdict:
no_material_findings. Six toolchain tests, locked/installed dependency absence,
12 representative compiled CSS utilities, missing-config negative control,
direct provider/auth/framework dependency preservation and whitespace passed.
Source provenance passed before/after review; serving model identities unknown,
not cross-model. Immutable local report:
`/tmp/dependency-premerge-independent-review.md`; fresh execution logs:
`/tmp/dependency-premerge-ci.log`, `/tmp/dependency-premerge-coverage.log`,
`/tmp/dependency-premerge-resume.log`, `/tmp/dependency-premerge-browser.log`.

Final risk **Significant**. D1–D5 are satisfied for the documented local scope.
No material correctness, architecture, security/privacy or compatibility defect
was identified. No performance/memory/cost improvement is claimed; model budgets,
data ownership and APIs are unchanged. Modern browser floor and scoped alias
upgrade obligation remain explicit risks. Ready for user-authorized commit/PR
review; hosted CI must pass before merge. No deployment or Linear completion.
Only evidence/progress documentation changed after the final review.

## 14. Rollout, rollback and risks

No rollout in this task. Merge/deploy only after required checks and review.
Rollback by reverting this dependency/toolchain commit and rebuilding; doing
so restores the inherited advisory and is not a long-term security resolution.
Future upstream removal/replacement of the scoped alias must rerun its consumer test.
Live account pages cannot be authenticated without authorized test credentials;
mocked browser coverage must disclose this limit.

## 15. Completion

Local implementation/checks and required independent review complete. Final risk
Significant. No Linear status changed; no commit, push or deployment.
