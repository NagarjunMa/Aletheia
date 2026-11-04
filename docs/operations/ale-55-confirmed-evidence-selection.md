# ALE-55 confirmed evidence selection

## Phase 1 contract

Started November 4, 2026 from merged main at `41fb71d`. Risk tier is
**Critical** because a client-supplied identifier will eventually affect the
private candidate context sent to a model. This increment establishes the
request boundary before adding the authenticated story lookup and picker.
ALE-54's deterministic ranking is present on main at `71c9e25`. Linear
still tracks its acceptance as open.

- Accept optional `selectedEvidenceIds` for LinkedIn connection notes, cold
  email, InMail and both single-question and batched application answers.
  Accept one or two distinct UUIDs and compare them case-insensitively. An
  omitted or empty selection uses the existing automatic path.
- Reject malformed, duplicate and over-limit selections with HTTP 400.
  Reject well-formed nonempty selections with a recoverable HTTP 409 during
  this increment. A request carrying a selection must never silently use
  automatic ranking. Fail before loading candidate context, reserving quota
  or credit, or calling the provider. Echo neither IDs nor story content.
- Preserve legacy request fields and YC batch validation. Do not advertise
  support to the extension until ownership, current confirmation, exclusions
  and channel feasibility checks can all be enforced.

The next phase owns the minimal authenticated list and caller-scoped selection
validation. Its behavioral checks must prove that stale, cross-account,
unconfirmed, excluded and unfit stories cannot reach a model and that an
eligible selected story survives the channel's generation and validation.
The extension picker and hosted rollout follow that phase.

## Phase 1 evidence

- The initial contract and route run reproduced 28 failures. The previous
  outreach parser discarded the new field, and the application parser rejected
  it as unknown. The final API checks cover normalization, duplicates,
  malformed and oversized selections, cleared selections, both application
  shapes, and the absence of model calls, reservations, and private IDs on
  rejected requests.
- The final full run with `npm run test:coverage -- --maxWorkers=2` passed
  1,939 tests. Guardrails passed 15 tests. Type-check, production build with
  placeholders, lint, policy validation, formatting, and the configured
  high-severity dependency audit passed. Lint reported the inherited
  refund-admin warning, and audit reported 20 moderate advisories.
- An earlier concurrent coverage run timed out in an existing offline
  release-gate test. The test passed in the bounded-worker rerun without
  changes. Type-check on the first implementation caught a missing timing
  code. The final route regression checks that only the fixed code is logged.
- A fresh independent review found no material issue on the final runtime
  snapshot and passed 407 focused tests. The subsequent test-only assertion
  verifies that an oversized list produces a single size error.
- Phase 2 ownership and eligibility checks, Phase 3 picker and hosted
  verification remain pending. Phase 1 can be reverted independently.

## Phase 2 contract

November 4, 2026. Risk remains **Critical**. Add an authenticated, non-cacheable
list of up to 50 confirmed story summaries. The repository uses the verified
caller's bearer client with explicit ownership and confirmation filters. Only
ID, title and kind leave the endpoint.

Revalidate every requested story against the caller's current grounding snapshot
before quota, credits or model calls. The existing exclusion, injection, review,
source and channel budgets remain authoritative. Cold email and application
answers can use two stories if both fit. LinkedIn connection and InMail use the
existing one-story budgets. Each offered draft, and each answer in an explicit
application batch, must use the requested stories. Legacy free-form application
output must prove the same coverage at final validation. Return the same private
422 for missing, foreign, unconfirmed or unusable selections. Keep automatic
ranking for empty or omitted selections. The extension picker is Phase 3.

### Phase 2 implementation

- `GET /api/extension/evidence` uses the existing extension bearer verification
  and a caller-JWT Supabase query. The response is private and uncached, and
  includes only the ID, title and kind for each confirmed story summary.
- Generation reads the current caller-scoped snapshot and validates the selected
  IDs again. Excluded, stale, unsafe or over-budget choices cannot reserve quota
  or start model work. Valid options retain all selected stories. A free-form YC
  answer that omits a selected story fails final validation and follows the
  existing refund path.
- Local tests exercise account isolation at the API/repository boundary, revoked
  confirmation, stale reviews, unsafe inputs, channel limits, complete
  selection coverage and legacy behavior. The extension picker, real
  two-account hosted verification, and deployment remain pending. Roll back
  before releasing the picker by reverting the server change and redeploying.

Independent review found four gaps in the initial implementation. LinkedIn now
offers and resolves the exact same prevalidated notes and shares only their
vetted candidate facts with the chooser. Explicit outreach scans submitted
target inputs before admission using provider-normalized text. With no submitted
job description, explicit outreach uses the current recipient context instead
of hydrating a saved job description after preflight. Email retains distinct
story citations when two stories share wording. The free-form application
preflight uses its own existing 12-claim ceiling and bounded search, while the
rhetorical-plan path retains its smaller option contract.

The free-form application preflight also accepts approved target facts that can
complete an answer with the selected candidate facts. It identifies each
required story's atomic IDs in the private model prompt and rechecks coverage
after sanitation. Search is limited to 4,096 candidate visits and 256 full
validations per question. Hosted provider adherence and timing still require
release evidence.

A return review also reproduced sensitive details reaching the provider
alongside a usable fact. The explicit path now projects only reviewed,
channel-safe facts into its story context across outreach and applications.
Raw saved story fields and unused unsafe excerpts stay server-side. Free-form
application feasibility considers all approved wordings without using two
forms of the same fact in one candidate answer.

Two distinct selected stories may share the same saved description and have
different reviewed facts. Explicit source budgeting deduplicates those
stories by ID. Automatic ranking still deduplicates source wording, and
composition rejects repeated facts.

## Phase 3 and review corrections

Risk remains Critical. The side panel will fetch confirmed story summaries
through the authenticated worker, keep story titles and selections in memory,
and reset choices on account or draft context changes. An explicit submission
uses a POST on the story endpoint so older deployments cannot silently accept
it as automatic generation. Stale choices require the user to reload or
clear them. An empty selection continues through the existing generation
endpoint. No changes to permissions, billing, or storage schema.

Budget complete, reviewed story excerpts before applying the existing
channel caps. Keep exclusion and injection checks on the full saved record.
Use a long unreviewed prefix and a short reviewed outcome as a regression.
Verify the installed client flow with an isolated browser and mocked API,
including account switching, context reset, unavailable selections, and
older backend responses. Hosted two-account and provider gates remain
separate from local evidence.

### Phase 3 implementation and rollback

The side panel loads up to 50 confirmed summaries on demand. LinkedIn and
InMail accept one choice. Email and application answers accept two. The
worker requires the extension panel as the message sender and verifies the
owner and token before the fetch and before returning a list. The panel
checks the active owner again before rendering. Selected drafts remain
in memory unless the user explicitly saves feedback. There is no automatic
generation retry after an explicit selection fails or its server endpoint is
unsupported. The extension build version is 1.0.22.

The source fix keeps whole-record exclusion and injection checks, then
projects complete, safe reviewed excerpts before applying the channel budget.
Automatic requests keep their existing ranking and generation endpoint.
Publish the backend before the extension. With an older backend the picker
reports unavailable and the automatic mode remains usable. An explicit
submission that encounters an older backend fails and requires the user to
clear the choice before generating automatically.

An independent browser reproduction showed that refreshing A's token while
opening the picker could overwrite B's newly connected session. Listing and
explicit generation now read only the current unexpired bearer. They check the
owner around the request and never refresh or clear auth. The browser regression
covers near-expiry listing and generation and rejects a delayed response after
an account switch.

The panel subscribes to account changes before startup reads and watches tab
changes before the first profile read. A delayed profile response is applied
only if its tab and URL are still active. A browser test stalls an initial
profile read, then verifies the new profile and account independently before
the old response is released. Explicit story exclusion checks also cover
saved links even though links never reach the model.

For an expired startup session, the popup still tries to renew the existing
extension credentials before checking the web session. Refreshes share work
only for the same refresh token and apply responses only while the original
stored session matches. The web fallback also checks the original session and
logout epoch before writing. Chromium covers both successful renewal without a
web session and an old refresh completing after another account connects.

To rerun the local extension integration checks, build the package with
`npm --prefix ascendia-extension run build:ext`, then run
`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3135 npx playwright test e2e/extension-evidence-picker.spec.ts --project=chromium`.
The tests intercept the API and need no running application server or secrets.

### Auth recovery follow-up

Account changes terminate an old generation before further recovery. Automatic
token and website session exchanges are scoped to their starting session.
Writes and clears compare that session inside one worker queue, so responses
cannot undo an account change or logout. Shared refreshes no longer choose a
caller's rejection cleanup. A rejected refresh leaves popup startup free to
try the website session, while proactive refresh applies its own cleanup after
its fallback. If the website belongs to another account, automatic recovery
requires an explicit reconnect before switching.

The local regressions cover delayed refresh and web responses, a storage
read/write interleaving, shared rejection, logout during a web lookup, and a
packaged Chromium request that receives a late 401 after switching accounts.

Explicit Connect may adopt the web account after the user chooses to reconnect.
Shared successful exchanges write the session once. Startup ignores expired
website credentials, and logout cancels a pending interactive sign-in and
invalidates delayed results.
