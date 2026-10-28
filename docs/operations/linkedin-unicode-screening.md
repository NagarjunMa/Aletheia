# ALE-46 Unicode screening repair

## Contract and execution context — 2026-10-28

Branch: `fix/ale-46-unicode-injection-screening`, based on main `25aa229`.
Risk: **Critical** — shared untrusted-input screening affects private candidate
context. Full engineering record, scoped to this repair; ALE-46 remains In Progress.

Production diagnostics identified `high_non_ascii:0.06` and `hidden_unicode`.
They establish which rules rejected the request, not the original character or
an actual attack. Synthetic French text and a developer emoji reproduce the
false positives. Rejection removes target sources and yields pre-model 422.

## Decisions and boundaries

1. Remove language-density rejection: non-ASCII proportion is not instruction intent.
2. Inspect an NFKC copy with recognized emoji replaced by word boundaries.
   Collapse invisible runs to one marker. Compile the existing fixed instruction
   patterns to allow this marker between literal letters and at whitespace;
   retain their word boundaries and required spacing. This handles mixed
   in-word/between-word obfuscation without enumerating permutations or treating
   an unrelated joiner as permission to match concatenated words. No untrusted
   input becomes a regular expression. Never use the inspection copy as a source
   fact, prompt replacement, or provenance value.
3. Preserve conservative rejection of bidi control sequences and invisible tag
   payloads outside recognized Unicode emoji. Ordinary joiners, direction marks,
   BOMs and international text alone are not evidence of injection.
4. Keep existing instruction and encoded-blob checks, fail-closed caller behavior,
   source exclusions, complete facts, final claim coverage, 300-character limit,
   quota/refund semantics and private ledgers. No classifier, extra model call,
   dependency, schema, token-budget or extension change.

Scanner ownership stays in `lib/ai/prompts/injection-heuristic.ts`; consumers are
outreach context preparation, outreach service and YC prompt construction.
This is heuristic screening, not exhaustive detection or proof of safe content.
NFKC does not resolve all cross-script confusables; server-owned source selection,
output validation and least privilege remain necessary.

## Acceptance and verification

| Criterion                                          | Check that rejects a wrong implementation                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| International text and ordinary emoji are accepted | Scanner cases above the old length/ratio threshold; real route preparation with blank and supplied JD |
| Obfuscated known instructions still trigger        | Fullwidth and zero-width override/role/exfiltration cases; no RPC/model call through route            |
| Encoded controls do not become an allowlist bypass | Bidi and Unicode tag payload cases, including payload appended to valid emoji                         |
| Source text is preserved                           | Original Unicode exact source content and successful final-body route assertions                      |
| Grounding/privacy remain enforced                  | Existing excluded/overlength/claim coverage/refund/public-response tests plus safe reason assertions  |
| Shared callers remain compatible                   | Outreach, YC, guardrails and repository coverage/static/build checks                                  |

Implemented in the shared scanner only; caller production code and public contracts
are unchanged. Tests cover scanner, real outreach preparation/HTTP route with
mocked provider/storage, all three outreach categories, and YC prompt construction.
Existing tests retain exclusion, unsupported-claim, overlength, compensation and
private-response boundary coverage.

Passed on Node 24.16.0:

- TDD: 15 new regressions failed before repair; an additional invisible-word-
  separator regression failed before adding the second inspection view.
- Final focused four-file suite: 232 tests.
- `npm run test:coverage -- --run`: 1,443 tests in 106 files.
- `npm run test:guardrails -- --run`: 15 tests.
- `npm run lint`: no errors; inherited unused `status` warning in refund-admin.
- `npm run type-check`, `npm run policy:check`, `git diff --check`.
- `npm run security:audit`: zero vulnerabilities, unchanged lockfiles.
- `npm run build`: placeholder Supabase settings; no live I/O.

Not run: hosted CI, real Claude/original-profile replay, production deployment,
browser/extension packaging (no UI or extension source changed). No migration.
Final fresh-context independent review is recorded outside the source tree in
`/tmp/ale46-unicode-review-report.md`; freshness packet in
`/tmp/ale46-unicode-review-r2-corrected.json`. These are local evidence, not committed artifacts.
Initial command logs: `/tmp/ale46-unicode-*.log`.

Lesson: neither language density nor the presence of a joiner identifies an
instruction attempt. Preserve source representation; inspect known patterns in
normalized inspection copies. Recognized emoji do not exempt adjacent invisible tags.
The old ratio/blanket-joiner test expectations were deliberately replaced with
legitimate-language and obfuscated-instruction cases, not disabled.

## Independent review correction

Round 1 confirmed ALE46-UNICODE-R1 (introduced P1): simultaneous in-word joiners
and invisible word separators bypassed the two-view attempt and retained private
candidate sources. Five regression assertions failed before the first correction.
Round 2 found trailing invisible boundaries (DAN + mode) still bypassed the
whitespace-tolerant attempt. R1 remained open; the original reports are
`/tmp/ale46-unicode-review-round1.md` and `...-round2.md`.

Replaced destructive inspection with marker-preserving matching: fixed pattern
literal characters permit the marker, existing whitespace includes it, and word
boundaries remain. Reproduced mixed-role boundary failures at scanner, context
and HTTP levels before correction. New regressions also protect a benign
`showResume()` description and exercise obfuscation throughout all phrase families.
Singular instruction/rule regressions also verify optional-letter quantifiers survive pattern compilation. The earlier two-view/whitespace-tolerance attempts are superseded. Final return
review status and source fingerprint belong in the external receipt above.

Round 3 independently resolved R1 but confirmed new R2 (P1): retained markers
consumed the persona pattern's 40-character filler window. Three tests reproduced
it at scanner, context and HTTP boundaries. The bounded window now counts visible
characters with optional markers; all three regressions and 232 focused tests pass.
The immutable review is `/tmp/ale46-unicode-review-round3.md`.

The user authorized one additional independent review. Round 4 returned
**no material findings**, independently resolving R1 and R2 on the corrected
snapshot. The reviewer passed 232 focused tests, 15 guardrails, 388 additional
adversarial assertions, diff checks and before/after source freshness checks.
The report is `/tmp/ale46-unicode-review-round4.md`; current receipt is
`/tmp/ale46-unicode-current-status.json`. This paragraph and the progress entry
record that completed review; production code and tests remain byte-identical
to the reviewed snapshot.

The reviewer documented an existing quadratic newline-scanning limitation in
the role-marker pattern, also reachable with newly supported invisible-marker
whitespace. Input bounds limit the work; local probes did not establish a
material release-blocking resource failure. This is not a production load test
or a claim of linear-time scanning. Risk remains Critical because screening
controls a private-data boundary, not because a review finding remains open.

## Rollout and remaining limits

Backend redeploy only; existing extension compatible. After deployment, retest the
original profile with blank and supplied JD and correlate safe reason codes. Raw
profile/JD, candidate data and generated text must not be added to logs. Local
mocked tests cannot prove the original unavailable payload or hosted/model behavior.
Revert the backend commit and redeploy to roll back; no migration required.

Research basis: [OWASP injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html),
[Unicode emoji](https://www.unicode.org/reports/tr51/) and
[Unicode confusables](https://www.unicode.org/reports/tr39/), inspected 2026-10-28.
