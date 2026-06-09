# Email Generation Quality Implementation Plan

Created: 2026-06-09

## Problem Statement

The cold-email generator is producing technically relevant drafts, but the final output is not consistently matching the user's intended communication style. Two observed failure modes are now clear:

1. Initial outreach emails can be too dense, with long single-block paragraphs, overused hyphen connectors, weak spacing, and grammar that needs external cleanup.
2. Concise clarification or role-fit messages are being expanded into full outreach emails because the current `cold_email` prompt always asks for a 100-150 word, 6-8 sentence structure.

This creates extra manual editing work and weakens trust in generated emails. The product needs email generation that understands the message scenario, preserves concise user intent, formats readable emails deterministically, and can be evaluated against real before/after examples.

## Goals

- Generate cold emails with cleaner grammar, paragraph rhythm, capitalization, and signoff formatting.
- Avoid dense wall-of-text emails.
- Reduce overuse of hyphens and chained clauses.
- Preserve concise user intent when the user asks for a short clarification, role-fit summary, or follow-up.
- Build a golden dataset from real generated-vs-preferred examples.
- Add tests and evals that prevent regressions in email quality.
- Keep the existing Supabase, Anthropic, sanitization, and extension architecture intact.

## Non-Goals

- Do not add a second AI rewrite call as the default path in the first implementation.
- Do not replace the current generation endpoint contract until the extension UI has a clear migration path.
- Do not weaken grounding, sanitization, prompt-injection protection, or rate limiting.
- Do not train a model or fine-tune anything in this phase.

## Current System Context

Main files:

- `lib/ai/prompts/linkedin-connection.ts`
- `app/api/extension/generate/route.ts`
- `app/api/extension/generate/schema.ts`
- `app/api/extension/feedback/route.ts`
- `lib/ai/sanitizer.ts`
- `lib/ai/ai-fingerprint-detector.ts`

Current cold-email behavior:

- Uses a single `cold_email` category.
- Requires 100-150 words.
- Requires 6-8 sentences.
- Expects a first-touch outreach structure: who, time acknowledgment, company hook, why company, why user, ask, close.
- Parses model output as strict JSON.
- Runs sanitizer and AI-fingerprint cleanup.
- Truncates email bodies over 150 words.

Key issue:

The prompt assumes every cold email is an initial outreach email. Scenario 2 was a concise role-fit clarification, but the model expanded it into a full explanatory email because that is what the prompt asks it to do.

## Proposed Architecture

Use a layered quality system:

1. Scenario-aware prompting.
2. Deterministic email formatting.
3. Golden dataset examples.
4. Regression tests and evals.
5. Optional AI editor pass only if the first four layers are insufficient.

This keeps latency and cost stable while giving us strong control over common formatting and style failures.

## Email Modes

Add an `emailMode` concept for `cold_email` and possibly `linkedin_inmail`.

Initial modes:

- `initial_outreach`: first-touch networking, referral, or job inquiry.
- `follow_up`: short continuation after prior context.
- `clarification`: correct or clarify experience, role, responsibilities, or fit.
- `role_fit_summary`: concise summary of relevant background and target role alignment.
- `referral_request`: direct request for referral or routing to the right person.

Default:

- If missing, default to `initial_outreach` for backward compatibility.

Mode selection options:

- First implementation: infer mode server-side from user-provided intent/JD/body hints and add optional request field later.
- Better product implementation: expose a simple segmented control in extension UI so the user can choose mode.

Recommendation:

- Add `emailMode` as an optional API field now with a safe default.
- Add UI selection later after backend behavior is stable.

## Prompt Changes

Refactor the cold-email prompt so it has shared rules plus mode-specific rules.

Shared rules:

- Use only grounded user and target context.
- Keep grammar polished but human.
- Prefer periods over stacked hyphens.
- Use paragraph breaks.
- Keep CTA clear and capitalized.
- No generic corporate language.
- Preserve concise intent.

Mode-specific rules:

`initial_outreach`

- 100-150 words.
- 2-3 paragraphs.
- Use company/target hook and two grounded user experiences.

`clarification`

- 50-90 words.
- 1-2 short paragraphs.
- Do not add a company hook unless user asks.
- Do not over-explain.
- Focus on the corrected role/responsibility/experience.
- End with a simple next-step ask.

`role_fit_summary`

- 60-110 words.
- 1-2 short paragraphs.
- Summarize end-to-end experience compactly.
- Avoid listing every project.
- Use one strong sentence for scope and one for desired contribution.

`follow_up`

- 40-90 words.
- Assume prior context.
- Avoid reintroducing the sender in detail.
- Ask one clear question.

`referral_request`

- 80-130 words.
- Direct and structured.
- Make it easy to forward.

## Deterministic Formatter

Add a formatter after JSON parsing and sanitization, before returning the response.

Candidate file:

- `lib/ai/email-formatter.ts`

Responsibilities:

- Normalize line endings.
- Collapse excessive spaces.
- Preserve intentional paragraph breaks.
- Ensure greeting is followed by a blank line.
- Ensure signoff uses clean lines.
- Capitalize CTA paragraph starts when safe.
- Replace excessive hyphen chaining with sentence boundaries where deterministic.
- Convert common awkward patterns:
  - `Thanks either way. Nagarjun` to `Thanks either way,\nNagarjun`
  - wall-of-text bodies to paragraphs based on sentence count and mode
- Preserve LinkedIn URLs and email signatures.

Rules:

- Formatter must not invent content.
- Formatter must not remove grounded technical context.
- Formatter should be conservative and test-driven.

## Golden Dataset

Create a small local eval dataset from before/after examples.

Candidate path:

- `lib/ai/evals/email-golden-cases.json`

Suggested schema:

```json
{
  "id": "yc-ceo-bountiful-initial-outreach-001",
  "category": "cold_email",
  "emailMode": "initial_outreach",
  "intent": "networking",
  "problemTags": ["wall_of_text", "hyphen_overuse", "paragraphing"],
  "generated": "...",
  "preferred": "...",
  "expectedRules": [
    "has_greeting_blank_line",
    "has_2_to_4_paragraphs",
    "cta_is_capitalized",
    "signature_on_own_line"
  ]
}
```

Use real examples, but clean accidental typo artifacts before storing preferred text. Do not treat accidental Grammarly/text-edit artifacts as target style.

## Evaluation Strategy

Start with deterministic tests before adding model-based evals.

Test categories:

- Formatting:
  - greeting separated by blank line
  - 2-3 paragraphs for initial outreach
  - 1-2 paragraphs for clarification
  - signoff on separate lines
  - no triple blank lines

- Style:
  - no wall-of-text output for emails over 70 words
  - limited hyphen connector usage
  - CTA starts with uppercase when it begins a sentence

- Intent preservation:
  - clarification mode output stays under configured word limit
  - role-fit summary does not expand into company-hook outreach
  - short user intent remains concise

- Safety:
  - sanitizer still strips unsafe patterns
  - prompt escaping still wraps user examples safely
  - no output outside strict JSON for model response tests

## Implementation Phases

### Phase A: Dataset and Test Harness

Branch:

`test/email-generation-golden-evals`

Work:

- Add golden dataset fixture file.
- Add deterministic evaluator utilities.
- Add tests for the two provided scenarios.
- No prompt behavior changes yet.

Exit criteria:

- Tests fail against current formatter/prompt assumptions where expected.
- Dataset format is stable and easy to extend.

### Phase B: Deterministic Formatter

Branch:

`feat/email-output-formatter`

Work:

- Add `formatEmailBody()` and tests.
- Apply formatter in `app/api/extension/generate/route.ts` for `cold_email` and optionally `linkedin_inmail`.
- Keep formatter mode-aware.

Exit criteria:

- Scenario 1 formatting improves without another AI call.
- Existing generation tests pass.
- Formatter does not alter unsafe/sanitizer behavior.

### Phase C: Email Mode API

Branch:

`feat/email-mode-generation`

Work:

- Add optional `emailMode` field to generation schema.
- Update prompt builder input type.
- Add mode-specific prompt instructions.
- Default to `initial_outreach`.
- Add tests for `clarification` and `role_fit_summary`.

Exit criteria:

- Scenario 2 can be generated in concise mode.
- Backward-compatible requests still work.
- Mode-specific word limits are enforced.

### Phase D: Extension UI Mode Selection

Branch:

`feat/extension-email-mode-control`

Work:

- Add a small email mode selector in the popup for email categories.
- Send `emailMode` to `/api/extension/generate`.
- Keep the default path unchanged for users who do not select a mode.

Exit criteria:

- Extension tests pass.
- Manual smoke: initial outreach and clarification modes generate visibly different structures.

### Phase E: Optional AI Editor Pass

Branch:

`feat/email-editor-pass`

Only do this if Phases A-D do not reach acceptable quality.

Work:

- Add opt-in second pass for grammar/style polishing.
- Use same grounding constraints.
- Log and evaluate latency/cost.

Exit criteria:

- Clear quality gain over deterministic formatter.
- No safety regression.
- Cost/latency acceptable.

## Decision Log

### Decision: Do not start with a second AI pass

Reason:

A second AI pass adds latency, cost, and another source of hallucination. The observed issues are mostly scenario selection and deterministic formatting. Prompt modes plus formatter should solve the majority of failures.

### Decision: Add `emailMode`

Reason:

The existing `intent` field is not specific enough. `intent=job_inquiry` can mean first-touch referral, follow-up, clarification, or short role-fit summary. The model needs scenario-level control.

### Decision: Keep golden examples separate from accepted style examples

Reason:

Accepted examples are user voice signals. Golden examples are product-quality evaluation fixtures. Mixing them can overfit one user's examples into every generation request.

## Testing Checklist Per Phase

Run:

- `npm run type-check`
- `npm run lint`
- `npm run test -- --run`
- `npm run test:guardrails -- --run`
- targeted email formatter/eval tests
- `npm run build`

For extension UI phases:

- `npm ci --prefix ascendia-extension`
- `npm --prefix ascendia-extension run security:audit`
- `npm --prefix ascendia-extension run type-check`
- `npm --prefix ascendia-extension run lint`
- `npm --prefix ascendia-extension test`
- `npm --prefix ascendia-extension run build:ext`

## Daily Progress Tracking

Update `docs/progress.txt` every day work is performed.

Each entry should include:

- Date
- Branch
- Problem being addressed
- Implementation decision
- Files changed
- Tests run
- Result
- Follow-up risks/questions

This gives us a durable decision trail for evaluating why email-quality changes were made and whether they worked.
