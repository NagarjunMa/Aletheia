# ALE-50 grounded response rollout gate

## Initial change contract

2026-11-03 America/New_York. Branch `feat/ale-50-grounded-response-release-gate`
is stacked on the ALE-51 candidate `7990f5e` while its CI runs. The local
`main` reference was verified against the remote at `78438aa`. Rebase only the
ALE-50 commits onto updated `main` after ALE-51 merges, then revalidate the
combined tree before opening an ALE-50 PR.

**Risk: Critical** for the complete gate, which will exercise authenticated
generation, private data handling, billing and rollback. This first slice is
offline and only produces evidence. Its risk is Significant because an
incorrect comparison can mislead a later release decision.

The offline command must reproduce the saved Phase 3 report exactly, compare the
actual enabled composers using the same locked corpus, preserve negative
controls and source coverage, and reuse the Phase 3 diversity threshold.
Report per-group pattern deltas and denominators. Failed checks fail the command.
Even passing offline checks must explicitly hold rollout and identify outstanding
evidence. The command takes no credential, network or provider input, does not
change deployment flags, and emits no prompts, drafts, source text or source IDs.

## Full release-gate requirements

- Require a manually dispatched workflow and a reviewed protected environment.
  Before authentication or mutations, attest both flag-off and flag-on targets
  against the expected commit and approved isolated deployment and Supabase
  identities. Reject production aliases, mismatched projects and redirects.
- Use dedicated synthetic accounts and fixtures. Exercise supported extension
  and API contracts in both modes, including target provenance, injection
  fallback, invalid-output refunds and feedback ownership. Keep credential
  scopes and evidence retention narrow.
- Fix the paired workload, timing and token/cost methodology, sample sizes and
  non-inferiority limits before collecting hosted observations. Use Phase 3's
  established coverage and diversity rules for the offline comparison, and
  Phase 5's consent and cohort floors for human outcome evidence. Audit exported
  logs for prohibited text and identifiers.
- Record the final outcome decision, named approver, monitoring owner and
  rollback instructions. Enablement requires separate explicit authorization.
  If approved later, rollback is disabling the rhetorical flag and redeploying.

A local pass remains insufficient for activation. This offline slice leaves hosted execution pending, with the rhetorical flag defaulting off.

## Run the offline check

Run `npm run gate:grounded-response:offline` with Node 24. Its JSON report
expresses pattern rates as fractions and `deltaPercentagePoints` as candidate
minus baseline. Sample counts are the existing eligible-pattern denominators.
A zero exit status records an offline pass, while `releaseDecision: "hold"`
records the decision until the remaining evidence is reviewed.

The current synthetic comparison reduced the dominant pattern by 33.33 points
for initial cold email (3 samples) and InMail (3 samples), and by 20 points for
YC (5 samples). These are structural measurements from the existing corpus.

## Protected mode-check implementation contract

2026-11-03 America/New_York. **Risk: Critical.** The branch now starts from
merged ALE-51 on `main` at `375e719`. Both protected Preview
deployments must be immutable URLs for the isolated Vercel project, use the same
isolated Supabase project, and attest the workflow commit and their opposite
runtime flag values before either fixture account signs in. The workflow takes
no deployment input from the dispatch form. It uses protected environment
configuration, refuses production identities, and never follows redirects.

Run the same fixed synthetic cases in each mode. Use one matched fixture
account per mode to keep the short-window budgets independent. Exercise the
current popup's request and response functions, the headerless legacy LinkedIn
path, and current cold email, InMail and two-question YC contracts. Require
source-backed LinkedIn candidate and target text, a clean profile-only fallback,
and a grounding refusal for a profile that mixes a valid headline with an injection.
Run at most six generation requests per mode, with no test retries.
Emit only projected results. Keep rollout on hold after a pass. Forced
provider-failure refunds, hosted log privacy, statistical quality/latency and
human review remain separate release gates.

## Configure and run the protected check

1. In GitHub, create the `grounded-response-production-gate` environment.
   Restrict deployment branches to `main` and require a reviewer who can check
   the targets, credentials, and budget before approving. Verify that required
   reviewers are available for the repository plan before provisioning secrets.
   The YAML's environment reference alone does not enforce human approval.
2. Use a separate Vercel project with Deployment Protection and Automation
   Bypass enabled. In that project, create two **Preview** deployments of the
   same full GitHub `main` SHA. For Git-backed previews, point two integration
   branches at that exact commit and use branch-scoped Preview overrides for
   `RHETORICAL_PLANS_ENABLED=false` and `RHETORICAL_PLANS_ENABLED=true`. Set
   `GROUNDED_RESPONSE_GATE_ATTESTATION=true` only on these previews and expose
   Vercel's system environment variables. Use the generated URL of each
   deployment, rather than a branch alias that can move while the gate runs.
   Configure both previews with the isolated Supabase project's URL and
   keys. Use an isolated provider credential and an operator-approved budget.
   Keep production configuration outside this workflow.
3. Apply the current migrations to the isolated Supabase project and create
   two confirmed, password-enabled `@example.test` accounts. On both, set
   the same synthetic identity, current role and evidence from
   [the checked-in fixture](../../scripts/grounded-response-hosted-fixture.ts).
   Keep the evidence order and all text exact. Confirm both evidence stories.
   In Fact Review, mark the complete `actions` and `outcome` of each story as
   `action` and `outcome`, respectively. Also review the first story's complete
   `context` as an `action` fact. Leave other fields, resumes, exclusions,
   and accepted examples empty. The local fixture test checks these facts
   against the real outreach composers and both enabled YC question plans. Both
   accounts need the same billing mode and enough admission and credit headroom
   before every run. Under credit billing the five successful cases require
   16 credits per account. Check the available balance before repeating a run.
4. Set these GitHub environment **variables** (each name begins with
   `GROUNDED_GATE_`).

   | Suffix                                    | Value                                       |
   | ----------------------------------------- | ------------------------------------------- |
   | `OFF_URL`, `ON_URL`                       | Generated immutable Preview origins         |
   | `PROJECT_ID`, `PRODUCTION_PROJECT_ID`     | Distinct Vercel project IDs                 |
   | `SUPABASE_URL`, `PRODUCTION_SUPABASE_URL` | Distinct canonical Supabase project origins |
   | `PRODUCTION_APP_URL`                      | Production app origin                       |

   Add these environment **secrets**, also with the `GROUNDED_GATE_` prefix.
   Use the isolated Vercel project's `VERCEL_BYPASS`, the isolated Supabase
   `SUPABASE_PUBLISHABLE_KEY`, and both synthetic accounts' `OFF_USER_ID` /
   `ON_USER_ID`, `OFF_EMAIL` / `ON_EMAIL`, and `OFF_PASSWORD` / `ON_PASSWORD`.
   GitHub does not need a Supabase service-role key, a provider key, or any
   production credential.

5. After merging the workflow and building both previews, dispatch **Grounded
   Response Production Gate** from `main`, enter `yes`, and approve the
   environment job after checking its targets. A successful run has a
   `grounded-response-gate-evidence` artifact. Verify its full SHA against both
   deployments and keep its run link with ALE-50. A skipped job has no evidence.
   Routine local tests use mock transports and require no credentials. Invoking
   the hosted runner directly with missing configuration fails before networking.

The runner alternates matching scenarios across flag modes with one sample per
scenario, measures elapsed time from the HTTP request through the decoded
response, and retains only case names, status, timing, prompt version and token
counts for successes. Each run sends at most twelve generation requests. Ten
should reach the provider (19,000 combined output tokens at current route caps). The two
expected 422 cases should stop before provider admission. If that boundary
regresses, the configured request count still bounds the allowance to 20,200
output tokens at the current caps. Input and cache billing still require separate evidence. The smoke sample is too small
for p95, finalization/refund rates, cost or quality claims. A failed case stops
the run and emits only a fixed stage and error classification. GitHub retains
the success artifact for 14 days.

The current popup request/response functions run against the Preview API in
Node, with a separate replay of the headerless legacy path. The gate does not
install a packaged extension or automate a real browser on either preview.
Use the native extension smoke suite for browser behavior and keep the hosted
browser check separate if required by the release approver. A successful run
still holds rollout. Production enablement remains a separate approval, and
rollback remains setting the production flag false and redeploying.
