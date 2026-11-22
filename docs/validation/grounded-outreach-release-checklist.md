# ALE-32 grounded outreach validation

[Linear issue](https://linear.app/aletheia-connection-builder/issue/ALE-32/44-run-full-rollout-validation-and-complete-project-handoff) · [Operator runbook](../runbooks/grounded-outreach-rollout.md) · [Versioned evaluations](../evals/eval-log.md)

## Execution context

Started 2026-11-22 from `main` `a44a22d4aac59f6f430d6121cd2a05e219e4f1f8`
on `test/ale-32-grounded-outreach-rollout`. ALE-29, ALE-30, and ALE-31 are
Done. The PR #166 CI run is [historical evidence](https://github.com/NagarjunMa/Aletheia/actions/runs/45079888249)
for the identical application tree. Each local result below is tied to the
pinned source. The release decision is **hold** until the hosted acceptance
and rollback checks have evidence.

Risk is **Significant** for integrated validation across the web app, extension
and provider boundaries. Hosted authentication, authorization and metering
checks use isolated test accounts and a bounded budget. Verify the actual
target and package before any hosted request. Work in this branch is
release evidence and documentation. Run the existing tests as
characterization checks. If a scoped defect requires a code fix, add a
failing regression first and reassess risk.

## Package and deployment identity

| Surface             | Observation                                                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local ZIP           | Manifest version `1.0.35`, API `1`, source `a44a22d`. The artifact used by Chromium has SHA-256 `c10d006addec0bbb1c8bfebf7422623f574919d9ebd513ad8d3419159891a4ac`, verified against the packaging metadata. The ZIP is an ignored local artifact. |
| Public web endpoint | `GET /api/extension/version` returned deployment `a44a22d4aac5`, source `1.0.35`, advertised published version `1.0.9`, and minimum client `1.0.2` on 2026-11-22. This is a read-only observation.                                                 |
| Hosted browser      | Pending. Record the isolated test build's extension ID, version, installation source, ZIP hash, and Preview deployment SHA. Record the installed Web Store item and its connectivity separately when authorized.                                   |

## Automated gates

Use Node 24 and the repository's native commands. For the build and Chromium
smoke, use the build-only configuration in the [CI workflow](../../.github/workflows/ci.yml).
The browser fixtures intercept extension traffic. The database checks use
disposable socket-only PostgreSQL with synthetic rows. Use the binary path
variables declared in each database script. Finish the extension build and
coverage suite before ZIP smoke. The package test in the coverage suite rebuilds
the ZIP and updates its hash. Record the hash after the last build.

| Area                   | Commands                                                                                                                                                                                                                               | Result                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App and offline output | `npm run test:coverage -- --run`, `npm run test:guardrails -- --run`, `npm run test:resume-security`, and `npm run gate:grounded-response:offline`. Focused suites include the API, candidate context, grounding, outreach, and evals. | Passed. 2,084 focused, 3,382 full coverage, 15 guardrail, and 146 résumé-security tests. Offline gate passed with zero provider calls.                              |
| App static and build   | `npm run policy:check`, `npm run lint`, `npm run type-check`, `npm run security:audit`, and `npm run build`.                                                                                                                           | Policy, lint, types and audit threshold passed. The first build failed on the Next.js advisory. The same build passed on retry while emitting the advisory warning. |
| Database               | `test:dashboard:db`, `test:quality-feedback:db`, `test:candidate-fact-review:db`, and `test:generation-admission-db`.                                                                                                                  | Passed all four on disposable PostgreSQL 17. Verified owner isolation, consent/privacy, stale facts and admissions, including unique release and concurrency.       |
| Extension              | `node scripts/check-extension-version.mjs origin/main`, `make extension-ci`, and `npm run build:extension`.                                                                                                                            | Passed. 371 extension tests, audit clear, lint, types, version policy, unpacked build, and pinned ZIP.                                                              |
| Chromium               | Local health and version routes, `npm run test:dashboard:ui`, `npm run test:candidate-fact-review:ui`, and the four Playwright specs specified by CI, run serially.                                                                    | Passed. 66 Chromium cases, 22 dashboard scenarios, and fact review at 375, 900 and 1440 px. The packaged test used intercepted requests.                            |

The local web audit reported 12 moderate vulnerabilities, including advisories
for the pinned Next.js `16.4.3`. The retry verified compilation and left those
advisories present. Their disposition remains open for the rollout decision.
Lint reported the existing unused parameter warning in `refund-admin.ts`.

## Hosted acceptance matrix

The release ZIP permits only production API hosts. Use it for intercepted
Chromium smoke. For live isolated browser checks, follow the
[existing Preview test-build procedure](../operations/message-focus-rollout.md#complete-the-hosted-comparison-before-release).
Use a separate unpublished build scoped to the attested Preview origin and
verify its effective API and auth destinations before signing in. A production
destination invalidates the isolated test.

Use reviewed synthetic profile, AI-workflow and infrastructure facts. Save
only test data and leave drafts unsent. Record pass, failure or blocker per
scenario with the deployment SHA, package identity, status/error code, and
approved aggregate usage. Keep credentials, account IDs, source excerpts,
prompts and actual draft bodies out of the shared record.

| Case                               | Expected result and evidence                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Grounded drafts and reviewed facts | Create and confirm synthetic AI and technical evidence. Draft a LinkedIn note with and without a JD, a Nordnet-style cold email, and an InMail follow-up. Confirm eligible reviewed facts, complete qualifications, and CTA and channel limits. For LinkedIn, record the selected 200/300 limit and compare with the composer counter. Verify Auto-Fill without sending. |
| Fallback and older clients         | Check sparse/blank targets, explicit selected-story failure, and target-only LinkedIn. Profile and résumé are compatibility classifications. Reviewed-fact paths still require eligible proof. Confirm an older response clears the indicator when metadata is absent. Verify no reply carries raw source IDs or excerpts in metadata.                                   |
| Exclusion and unsafe context       | Use existing synthetic controls. Excluded claims stay absent. Instruction-like target context receives the expected safe handling. Where preflight refuses, verify zero provider attempts and zero charge.                                                                                                                                                               |
| Auth, ownership and feedback       | Use two distinct synthetic accounts. Verify owner-only evidence/review access and signed-out behavior. Check auth, generation and feedback in the Preview-scoped test build. Verify rejection reasons and consent-aware telemetry projections without source text.                                                                                                       |
| Log and storage privacy            | Place distinct synthetic markers in selected test inputs. Inspect the matching server logs, app-side provider telemetry, extension diagnostics and extension storage for those markers under the applicable retention policy. Record case counts and outcomes only.                                                                                                      |
| Admission and compensation         | On an isolated metered target, verify a real limit returns 429 with retry information and a service outage returns 503. Verify output-format and timeout failures restore a charged credit and release the successful-generation slot once, while preserving the abuse budget for attempts that reached the model. Check these paths with controlled faults.             |
| Application answers                | Verify one and five supported questions retain order and stay grounded at 50–150 words and at most 3,000 characters per answer. Check unsupported questions and no partial output on batch failure.                                                                                                                                                                      |
| Recovery                           | Record the previous known-compatible web deployment and the published package. Rehearse applicable flag-off rollback in isolation, then recheck generation and feedback. Use the [operator runbook](../runbooks/grounded-outreach-rollout.md) for unflagged recovery.                                                                                                    |

### Hosted setup and decision

The protected GitHub environment exists with required reviewers and a branch
policy. The flag-off/on Preview URLs, isolated Supabase URL and publishable
key, and fixture-account settings are absent from its configured names.
The [existing hosted gate](../operations/grounded-response-production-gate.md)
documents the isolated setup and provider budget. It exercises the API
contract. The Preview-scoped browser build and its auth configuration,
controlled refund tests, log audit and rollback rehearsal need separate evidence.
The local gates and public version response are evidence for their listed
checks. Hosted acceptance is blocked until an eligible isolated setup is
available.
