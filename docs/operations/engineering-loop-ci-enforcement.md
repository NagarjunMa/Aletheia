# Engineering-loop CI enforcement

## Change contract

2026-10-27, branch `chore/engineering-loop-ci-enforcement`, base `c91c8fa`.
This PR is independent of `docs/production-migration-history-records`.
Risk: Significant (shared contributor/CI execution contract); no application,
extension, database, deployment or production credential changes.

Restore and adapt the archived policy validator, tests and PR template without
replacing current repository guidance or CI gates. Preserve the existing Linear
implementation/audit templates and authorization boundaries. Use existing Node24,
TypeScript, Vitest, ESLint and Prettier; no new dependency or action required.

Initial evaluations: policy validation rejects missing instructions/template or
required sections, succeeds on a complete installation and does not modify files.
Observe failing tests before correction. Validate actual CLI exit behavior and
CI/hook wiring, not only a function mock. CI must keep its current audit, type,
coverage, guardrail, extension and browser gates.

## Implemented behavior and acceptance criteria

- `npm run policy:check` validates repository instruction/template installation,
  script lint and scoped formatting. The existing pre-commit hook and CI call it.
- The independent `Engineering Policy` workflow validates PR descriptions on
  opening, reopening, synchronization, editing and readiness changes. It requires
  `Risk: <tier> — <reason>` and a Verification/Validation section containing an
  explicit Passed, Failed, Blocked or Not run outcome with supporting detail.
  Equivalent concise Markdown is accepted; hidden template markers are optional
  in PR descriptions. Unfilled placeholders and commented/code examples fail.
- GitHub event JSON is read from the quoted `GITHUB_EVENT_PATH` by native Node24,
  without installing dependencies or interpolating PR text into shell commands.
  Malformed, missing and oversized event inputs fail with content-free errors.
- The workflow has read-only permissions, a five-minute timeout and no secrets,
  deployments, provider calls or `pull_request_target` trigger. Existing audit,
  type, coverage, guardrail, extension and browser gates remain unchanged.
- Policy-file validation establishes structural presence only. It cannot prove
  policy semantics, review performance, evidence truth or passing acceptance
  criteria. Reviewers and existing CI retain those responsibilities. A PR can
  modify its own policy/workflow, so this is not an adversarial authorization
  boundary; workflow changes still need review.

## Verification approach and implementation evidence

The archived draft supplied installation checks, not PR evidence enforcement.
Added test-first PR evidence and actual subprocess checks. The first PR contract
run failed 10 tests before implementation. A second regression found that
`TODO:` prefixes were accepted; it failed before the prefix rejection fix.
The initial 22 tests passed, including real Node24 exits, missing instructions,
malformed/oversized event files and diagnostics that omit a synthetic secret.
The policy CLI also initially failed against missing repository markers before
adding the complete repository instructions.

The validator owns structural rules; the CLI owns file/process boundaries;
workflows and hook only invoke it. No production runtime, schema, public API,
provider token budget or dependency versions change. Work is bounded to 65,536
PR characters and a 2 MiB event file; no measurable runtime speed claim is made.

2026-10-27 local checks: **Passed** `npm run policy:check`, full
`npm run test:coverage -- --run` (1,345 tests / 106 files; configured thresholds
passed), `npm run test:guardrails -- --run` (15), `npm run type-check`,
`npm run lint` (one unchanged unused-argument warning), `npm run build`,
`npm run security:audit` (zero advisories), changed-file Prettier,
`git diff --check` and `sh -n .husky/pre-commit`. Parsed both workflow YAML files
with the installed YAML parser and compared existing CI to origin/main after
removing only the new policy step: all original configuration is identical.
Actual Node24 CLI tests verify exit behavior and no synthetic canary disclosure.
Earlier expected failing TDD outcomes are resolved, with no failing local gate.

**Not run:** hosted GitHub Actions, browser smoke and extension rebuild (no
application/extension code or dependencies changed; original jobs preserved).
No live model, database or production evaluation applies to this change.
Fresh-context independent round 1 found two confirmed, introduced P2 issues:

- **EP-001:** Verification child headings and optional closing ATX hashes rejected
  valid evidence. The parser now retains the parent section until a sibling or
  ancestor begins and normalizes closing hashes. Two acceptance regressions and
  an exit-section negative regression cover the correction.
- **EP-002:** An unclosed HTML comment could count as evidence. Comment removal
  now extends through end of input. A hidden-evidence regression covers it.

Three new cases failed before the corrections (23 passed / 3 failed), then all
26 focused tests, 1,345 root coverage tests, type checks and policy checks passed. Return review is pending; final
source snapshot, immutable reviewer reports and dispositions are retained
separately from inspected source to avoid self-hashing. Reviewer independence
is fresh-context, same model with exact identifier unavailable; no human or
cross-model review is claimed.
Hosted GitHub execution is not run until a PR exists. Required-status branch protection is not configured
by these source changes; an administrator must select the Engineering Policy
check to prevent merges on failure. Local hooks can be bypassed and are only a
contributor convenience.

Rollback is reverting the repository policy checker/wiring. No app/schema
migration or runtime feature rollback is involved. Hosted GitHub execution and
required-status branch protection must be reported separately from local checks.
