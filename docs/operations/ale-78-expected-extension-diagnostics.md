# ALE-78 expected extension diagnostics

## Contract and design

The user requested that expected evidence guidance and account switches stop
appearing as extension errors, while retaining clear recovery guidance and local
diagnostics. The complete 15-section contract is in Linear ALE-78.

Risk is Significant because the existing shared extension logger owns console
severity and the diagnostic buffer. Authentication, grounding, retries, billing
and response contracts are unchanged. No new dependency or transport is added.

`lib/logger-core.js` classifies only handled failure completion events:

- Evidence codes `GROUNDING_PROFILE_INCOMPLETE` and `INSUFFICIENT_GROUNDING`
  require HTTP 422.
- `AUTH_ACCOUNT_CHANGED` requires HTTP 409 or an internal cancellation without
  an HTTP status.
- Only generation, HTTP request, runtime message and interactive-auth completion
  events qualify. Unknown codes, mismatched statuses, explicit errors and
  unhandled exceptions retain their severity.

Classification uses exact input values before display normalization. Initial
independent review found ALE78-R1: malformed codes could normalize into a known
code in worker/popup diagnostics. Five code/event/outcome regressions reproduced
the gap before correction; malformed values now retain their warning severity.

Canonical event metadata overrides fields so diagnostic fields cannot disguise
an unhandled error as an expected cancellation. `lib/logger.js` uses the final
event level for console output and stores that same redacted event. Event names,
codes, outcomes, correlation fields, duration, the 80-event cap and one-hour
expiry are preserved. No historical entries are removed or rewritten.

## Implementation and evaluation

- Logger regressions verify expected info-level console output, preserved local
  events, redaction and warning/error visibility for unexpected outcomes. Nine
  expected-outcome cases failed before the fix. A separate metadata-override
  regression also failed before its correction.
- Worker HTTP tests exercise real request handling, error serialization and
  question-4 guidance with mocked network I/O, proving no automatic retry.
- Popup browser tests exercise actual console output and the local buffer,
  preserve all five questions and job description, retain review/skip recovery,
  explain account changes, and keep a genuine provider-contract failure visible.
- Packaged metadata advances from 1.0.33 to 1.0.34; permissions are unchanged.

Passed on Node 24: all 371 extension tests (25 files), all 18 local popup browser
scenarios, extension lint/type checks/security audit (zero vulnerabilities), root
type/policy checks, 11 version tests, version policy and production ZIP packaging.
The browser harness intercepts all requests and uses synthetic local data.

The macOS `make` wrapper is blocked by the local Xcode license prompt. Its npm
audit/type/lint/test commands passed individually; ZIP packaging invokes the
production extension builder. No license was accepted to run the checks.

## Handoff and limits

Branch: `fix/ale-78-expected-extension-diagnostics`, based on main `6039665`.
The isolated worktree preserves unrelated root-checkout changes. Fresh review
and source receipts are recorded outside source at `/tmp/ale78-review/`.

No production request, deployment, installed-extension reload or Store upload
was performed. Existing Chrome warning entries remain historical. Verify the
installed package after release; ALE-78 stays In Progress until that release gate.
Rollback restores the two logger modules and package metadata; no persisted-data
migration is required.
