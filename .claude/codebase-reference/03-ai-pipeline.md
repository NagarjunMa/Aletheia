# 03 — AI Pipeline

The product moat. Lives entirely under `lib/ai/`. Called from `app/api/extension/generate/route.ts` and `app/api/extension/feedback/route.ts`.

## File map

```
lib/ai/
  sanitizer.ts                  output cleaning, PII redaction, fingerprint orchestration
  ai-fingerprint-detector.ts    21 AI-tell patterns + rewrites
  style-analyzer.ts             analyzeStyle, mergeStylePatterns (pure)
  prompts/
    linkedin-connection.ts      3 system prompts + buildPrompt + escapeForXmlTag + sanitize lexicon
```

## Pipeline order (single generate request)

Line numbers below are from `app/api/extension/generate/route.ts` at the time of writing.

| # | Stage | Code | What |
|---|-------|------|------|
| 1 | Auth | `authenticateRequest()` (L53) | `Authorization: Bearer <jwt>` → `supabase.auth.getUser()` |
| 2 | Style fetch | L129–151 | Read `user_preferences.style_patterns` if `approved_message_count >= 1` (else `styleProfile` undefined) |
| 3 | Rate limit | `checkRateLimit()` (L83) | `check_and_increment_rate_limit` RPC, **fail-closed** on error → `allowed: false` + 1 min reset |
| 4 | Validate | L177 | `generateRequestSchema.parse(body)` (Zod) |
| 5 | Strip surrogates | L191–196 | `stripSurrogates()` on profileMarkdown, resume, jd, each acceptedExample |
| 6 | Build prompt | L198–211 | `getSystemPrompt(category)` + `buildPrompt(input)` — assembles user prompt with `escapeForXmlTag()` on every injected field |
| 7 | Claude call | L214–223 | `anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 600, temperature: 0.8, ... }, { timeout: 30_000 })` |
| 8 | Extract text | L226–234 | Find first `type: 'text'` block; throw if missing (no silent swallow) |
| 9 | Sanitize (cold_email / inmail) | L272–322 | `stripMarkdownCodeFences()` → `JSON.parse()` → `sanitize()` → `sanitizeForLinkedIn()` for subject + body → word-limit truncate |
| 9b | Sanitize (linkedin_connection) | L362–399 | `sanitize()` → `sanitizeForLinkedIn()` → sentence-boundary truncate to 270 chars |
| 10 | Return | L324 / L401 | JSON response + rate limit headers (`X-RateLimit-{Limit,Remaining,Reset}`) |

`sanitizeForLinkedIn()` internally calls `sanitizeAIOutput()` which runs `detectAIFingerprints()` — so AI-fingerprint stripping is part of stage 9, not a separate stage.

Feedback / style learning loop runs from `app/api/extension/feedback/route.ts` after the user thumbs-up — see "Style learning" below.

## `sanitizer.ts`

### Exports

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `stripSurrogates(str)` | `(string) => string` | Removes unpaired UTF-16 surrogate halves that break JSON serialization to Anthropic |
| `sanitizeAIOutput(content, options?)` | `async` | The full pipeline (HTML strip → harmful → profanity → email → fingerprint detect/rewrite → whitespace) |
| `sanitizeForLinkedIn(content)` | `async` | Wraps `sanitizeAIOutput()` with LinkedIn settings (2000 char max, email redaction enabled) |
| `sanitizeForEmail(content)` | `async` | Wraps with email settings (5000 char max, email redaction **disabled** — signatures need addresses) |

### Pattern categories (internal)

| Constant | Count | Examples (paraphrased) |
|----------|-------|------------------------|
| `HARMFUL_PATTERNS` | 9 | SSN, CC numbers, `<script>`, `javascript:`, event handlers, SQL (`UNION SELECT`, `DROP TABLE`), shell (`\| rm -rf`, `\| wget`) |
| `BLOCKED_CONTENT_PATTERNS` | 4 groups | Hate-speech variants + leet-speak obfuscation (`n@zi`, `k1ll`), self-harm encouragement, weapons/drug references, slurs with char-obfuscation |
| `PROFANITY_PATTERNS` | 5 groups | 52+ terms covering stretched / compound forms / repeated chars |
| `EMAIL_PATTERN` | 1 | Standard `[A-Za-z0-9._%+-]+@…` — applied **only on linkedin/general platforms**, preserved for cold email |

### Sanitization order (inside `sanitizeAIOutput`)

1. Reject if `BLOCKED_CONTENT_PATTERNS` match (`success: false`).
2. UTF-8 validity check (`new TextDecoder('utf-8', { fatal: true })`).
3. Hard truncate to `maxLength`.
4. Strip HTML tags via `/<[^>]*>/g` regex — AI output never rendered as HTML, so regex is sufficient (DOMPurify path was deleted in Phase 24).
5. `HARMFUL_PATTERNS` → `[REDACTED]`.
6. Email redaction (platform-aware).
7. Profanity → first char + `****`.
8. `detectAIFingerprints()` (rewrites 21 patterns).
9. Whitespace normalize: CRLF→LF, collapse spaces, clamp consecutive line breaks.

Return: `SanitizationResult { success, sanitizedContent, originalLength, sanitizedLength, modificationsApplied[], warnings[], error?, aiFingerprints? }`.

## `ai-fingerprint-detector.ts`

21 patterns. Verified count: `grep -c "name:" lib/ai/ai-fingerprint-detector.ts` → `21`.

### Pattern categories

| Category | Count | Example transform |
|----------|-------|-------------------|
| Typography | 2 | `—` → ` - `, Unicode `…` → `...` |
| Politeness formulas | 5 | "hope this finds you well" → removed |
| LinkedIn-specific | 2 | "found your post on LinkedIn" → "saw your post" |
| Email-specific | 2 | "please don't hesitate to" → "feel free to" |
| Structure | 2 | Perfect 3+ paragraph break + uppercase starts flagged; list intros removed |
| Formality | 2 | "delighted to" → "I'd love to"; "at your earliest convenience" → "when you have a chance" |
| Transitions | 2 | "that being said", "with that in mind" → removed |
| Buzzwords | 4 | "leverage / synergy / game-changer / industry leader" → natural equivalents |

### Exports

| Symbol | Purpose |
|--------|---------|
| `AI_FINGERPRINT_PATTERNS` | The full array (consumed by `detectAIFingerprints`) |
| `detectAIFingerprints(content, platform='general')` | Apply only patterns tagged for `platform` or untagged. Returns `{ detectedPatterns[], rewrittenContent, modificationsApplied[], warnings[] }` |
| `cleanupSanitizedContent(text)` | Collapse double spaces, fix orphaned punctuation — final whitespace pass |

Authenticity scoring (`calculateAuthenticityScore`, `isLikelyAIGenerated`, etc.) was deleted in Phase 24 — we strip-or-not, no score UI.

## `style-analyzer.ts`

Pure functions. No I/O. Safe to import anywhere.

### `analyzeStyle(message)` → `StylePatterns`

```ts
interface StylePatterns {
  avgSentenceLength: number       // words per sentence
  formality: number               // 0 (casual) – 100 (formal)
  greetingStyle: string           // "hi" | "hey" | "hello" | "dear" | "greetings" | ""
  closingStyle: string            // from CLOSING_RE
  useContractions: boolean        // contractionRatio > 0.02
  questionCount: number           // count of "?"
  commonPhrases: string[]         // top bigrams
}
```

Formality heuristic:
- Base 50.
- `FORMAL_MARKERS` (12 words like "therefore", "furthermore", "pursuant", "whom", "shall") → +10 each.
- `INFORMAL_MARKERS` (10 words like "hey", "yeah", "btw", "gonna") → −10 each.
- `−contractionRatio × 100`.
- Clamp 0–100.

### `mergeStylePatterns(existing, incoming, weight = 0.2)` → `StylePatterns`

Default `weight = 0.2` — new approval gets 20% influence, prevents overfitting. `mergePhraseLists` guards `existing` / `incoming` with `Array.isArray()` checks (defense against Supabase JSONB returning `null` despite the TS type).

## `prompts/linkedin-connection.ts`

### Exports

| Symbol | Purpose |
|--------|---------|
| `PROMPT_VERSION` | `"1.0.0"` — bumped on prompt change for eval / regression analysis. Echoed in `evalMetadata` on every generate response; round-trips back via feedback payload into `user_feedback.metadata`. Bump format: major.minor.patch (major = structural, minor = wording, patch = typo). |
| `LINKEDIN_CONNECTION_PROMPT` | System prompt for 270-char notes |
| `COLD_EMAIL_PROMPT` | System prompt for 100–150 word emails (JSON output) |
| `LINKEDIN_INMAIL_PROMPT` | System prompt for 80–120 word InMails (JSON output) |
| `NEGATIVE_LEXICON` | Banned-phrase array for `sanitize()` |
| `escapeForXmlTag(content)` | Replaces `</user_input>` and `</linkedin_profile>` with entity-encoded forms — **prompt-injection defense** |
| `sanitize(text)` | Quick `NEGATIVE_LEXICON` filter after Claude returns |
| `getSystemPrompt(category)` | Route category → correct system prompt template |
| `buildPrompt(input)` | Assemble multi-section user message |

### `buildPrompt` assembly order

1. `USER_BACKGROUND` (resume; empty fallback if absent).
2. `ADDITIONAL_PROJECTS` (if provided).
3. `TARGET_PROFILE` (the LinkedIn `profileMarkdown`).
4. `INTENT` (one of `networking` / `referral` / `mentorship` / `job_inquiry`).
5. `LEARNED_STYLE` — only injected if a `styleProfile` is passed (route only fetches it when `approved_message_count >= 1`).
6. `JOB_DESCRIPTION` (if provided).
7. `ACCEPTED_EXAMPLES` (up to 3 prior approved messages, included verbatim as style anchors).

Every field is wrapped in XML-tagged scaffolding (`<user_input>...</user_input>`) and **escaped via `escapeForXmlTag()`** before injection.

### Per-category constraints

| Category | Output format | Length limit | Truncation strategy |
|----------|---------------|--------------|---------------------|
| `linkedin_connection` | Plain text | 270 chars hard | Last `.` ≥ char 150 → truncate there. Else last space. |
| `cold_email` | JSON `{ subject_line, body, word_count }` | 150 words | `truncateToWordLimit(body, 150)` from `utils.ts` |
| `linkedin_inmail` | JSON `{ subject_line, body, word_count }` | 120 words | Same util, 120 |

## Style learning loop

In `app/api/extension/feedback/route.ts`:

1. Auth + Zod validate (including `evalMetadataSchema.strict()`).
2. INSERT into `user_feedback` (sync — blocks). Row carries `feedback_type` (approved/rejected), `rating` (5/1), `comment` (rejection reason), `metadata` (category + message length + has_subject + entire `evalMetadata` blob).
3. **Return 200 immediately.** Caller proceeds.
4. Background `processStyleFeedback()`:
   - If `approved`: `analyzeStyle(message + subjectLine)` → `mergeStylePatterns(existing, incoming, 0.2)` → atomic `increment_approved_count(p_user_id, p_style_patterns)` RPC. Fallback: non-atomic upsert if RPC missing.
   - If rejected: `increment_rejected_count(p_user_id)` RPC.

Next generate request reads merged `style_patterns` from `user_preferences` and injects it into `buildPrompt` as `styleProfile`.

## Cross-references

- Generate route line-by-line → `02-web-app-routes.md#post-apiextensiongenerate`
- RPCs `check_and_increment_rate_limit` / `increment_approved_count` / `increment_rejected_count` → `05-database.md#rpc-functions`
- Guardrail test contract (adversarial sanitizer inputs) → `07-testing.md#guardrails`
- Tier-1 security fixes (timeout, prompt-XML escape, fail-closed rate limit) → `08-conventions-and-security.md`
