# Aletheia — Function Reference

Complete reference for every function in the codebase, organized by layer.
Each entry answers: **what it does**, **where it is called from**, **why it exists**, and **when it runs**.

---

## Navigation

- [Section 1 — AI Pipeline (`lib/ai/`)](#section-1--ai-pipeline-libai)
- [Section 2 — Utilities (`lib/`)](#section-2--utilities-lib)
- [Section 3 — API Routes (`app/api/`)](#section-3--api-routes-appapi)
- [Section 4 — Middleware & App Shell](#section-4--middleware--app-shell)
- [Section 5 — Chrome Extension: Background & Auth](#section-5--chrome-extension-background--auth)
- [Section 6 — Chrome Extension: Content Scripts & UI](#section-6--chrome-extension-content-scripts--ui)

---

## Section 1 — AI Pipeline (`lib/ai/`)

The AI pipeline is the core differentiator of the product. It generates outreach messages, detects AI writing patterns, humanizes the output, and learns the user's personal voice over time.

---

### 1.1 `lib/ai/sanitizer.ts`

The sanitization layer sits between Claude's raw output and the final response returned to the extension. It enforces safety, removes harmful content, strips AI-isms, and provides platform-specific wrappers.

---

#### `stripSurrogates(str: string): string` — **exported**

**What it does:** Removes unpaired Unicode surrogate characters (U+D800–U+DFFF) from a string using a regex that matches lone high or low surrogates. Valid surrogate pairs (such as emoji) are preserved.

**Called from / Used in:** Called inside `app/api/extension/generate/route.ts` on every user-supplied string field (name, headline, location, about, resume, jd) before they are passed to the prompt builder.

**Why it exists:** The Anthropic API throws a JSON serialization error if the request body contains unpaired surrogates. These can appear when content is copy-pasted from certain web pages or sourced from LinkedIn's DOM.

**When it runs:** On every `POST /api/extension/generate` request, synchronously, before any async work begins.

---

#### `sanitizeAIOutput(content: string, options?: SanitizationOptions): Promise<SanitizationResult>` — **exported**

**What it does:** The primary sanitization function. Runs content through a 10-step pipeline: input validation → blocked content detection → encoding validation → length truncation → HTML sanitization (via DOMPurify) → harmful pattern redaction (SSN, SQL injection, etc.) → profanity filtering → AI fingerprint detection and humanization → whitespace normalization → final validation. Returns a detailed result object recording every modification applied.

**Called from / Used in:** Called in `generate/route.ts` for every category (LinkedIn connection, cold email, InMail). Also called internally by `quickSanitize`, `sanitizeForLinkedIn`, `sanitizeForEmail`, `sanitizeForExport`, `validateForStorage`, and `sanitizeWithCaching`.

**Why it exists:** Claude's output, while generally high-quality, can contain AI-isms, HTML artifacts, PII accidentally included in training data, or patterns that LinkedIn's spam filters flag. This function is the single chokepoint that enforces all safety and quality requirements before content reaches the user.

**When it runs:** After Claude returns a response, before the route handler constructs its JSON reply.

---

#### `quickSanitize(content: string): Promise<string>` — **exported**

**What it does:** A convenience wrapper around `sanitizeAIOutput` with preset options (HTML off, 5000-char limit, profanity on, AI detection on, humanization on). Returns only the sanitized string rather than the full result object, or an empty string if sanitization fails.

**Called from / Used in:** Intended for display contexts where a simple string is needed rather than the full audit trail. Not currently called from route handlers (those use the full result), but available for future use in client-side preview features.

**Why it exists:** Most callers only need the sanitized string, not the modification log. This removes boilerplate from call sites.

**When it runs:** On demand at any point where cleaned text is needed for display.

---

#### `sanitizeForLinkedIn(content: string): Promise<SanitizationResult>` — **exported**

**What it does:** Platform-specific wrapper that calls `sanitizeAIOutput` with `platform: 'linkedin'`, `maxLength: 2000`, and humanization enabled. The `linkedin` platform scope activates LinkedIn-specific fingerprint patterns (e.g., `background_attention`, `linkedin_post_reference`).

**Called from / Used in:** Called in `generate/route.ts` for `linkedin_connection` category responses after Claude generates the message.

**Why it exists:** LinkedIn connection requests have a 270-character hard limit in the product. The 2000-character cap here allows room for the route to apply additional truncation logic. LinkedIn-specific patterns require a different detection scope than email.

**When it runs:** After Claude's response is received, inside the `linkedin_connection` branch of the POST handler.

---

#### `sanitizeForEmail(content: string): Promise<SanitizationResult>` — **exported**

**What it does:** Platform-specific wrapper with `platform: 'email'`, `maxLength: 5000`, humanization enabled. Activates email-specific patterns like `email_greeting` ("I hope this email finds you well").

**Called from / Used in:** Called in `generate/route.ts` for `cold_email` and `linkedin_inmail` body content.

**Why it exists:** Email content has different length limits and a different set of AI-ism patterns than LinkedIn messages. Using a dedicated wrapper ensures the correct detection scope without the caller needing to pass options manually.

**When it runs:** Inside the cold email / InMail parsing branch, after JSON or regex extraction of the body field.

---

#### `sanitizeForExport(content: string): Promise<SanitizationResult>` — **exported**

**What it does:** Sanitizes content for external sharing or export with no platform-specific AI fingerprint scope. Runs HTML stripping, encoding validation, and profanity filtering, but uses default `detectAIFingerprints: true` behavior.

**Called from / Used in:** Available for future export features. Not currently invoked by production route handlers.

**Why it exists:** Provides a clean export path where profanity filtering is retained but no platform-specific truncation limits apply.

**When it runs:** On demand when content needs to be prepared for external consumption.

---

#### `validateForStorage(content: string): Promise<boolean>` — **exported**

**What it does:** Runs `sanitizeAIOutput` and returns `true` only if the result is successful AND the warnings array is empty. Any redaction (PII, harmful patterns) generates a warning, causing this to return `false`.

**Called from / Used in:** Available as a pre-write guard before inserting generated content into the database. Not currently called from route handlers (content is inserted without this check), but available for future hardening.

**Why it exists:** Prevents PII or harmful content from being persisted in `generated_drafts` even if it somehow passed earlier checks.

**When it runs:** Intended to run immediately before a database insert of generated content.

---

#### `sanitizeResponseMetadata(metadata: any): { valid: boolean; sanitized: AIResponseMetadata; errors: string[] }` — **exported**

**What it does:** Validates and sanitizes AI response metadata fields: `cplScore` (must be 1–100, rounds to integer), `wordCount` (must be ≥0, floors to integer), `characterCount` (same), `processingTime` (must be ≥0), `draftType` (must be one of `grammar_fix`, `adaptive_polish`, `creative_enhancement`). Returns a structured result with a validity flag and a list of errors.

**Called from / Used in:** Available for validating metadata returned alongside generated drafts. Not currently called from production handlers but designed for use when metadata is stored in `generated_drafts`.

**Why it exists:** Prevents invalid numeric ranges or unknown draft types from being persisted or displayed to users, which would corrupt analytics and the voice profile learning system.

**When it runs:** On demand when AI-generated metadata needs to be validated before storage or display.

---

#### `sanitizeWithCaching(content: string, options?: SanitizationOptions): Promise<SanitizationResult>` — **exported**

**What it does:** Wraps `sanitizeAIOutput` with a 5-minute TTL in-memory cache. Cache key is built from a 32-bit hash of the content combined with the stringified options. Only successful results are cached. Calls `cleanupCache()` after each operation to evict stale entries.

**Called from / Used in:** Available for high-frequency display scenarios where the same content might be sanitized repeatedly (e.g., a live preview panel). Not called from current route handlers.

**Why it exists:** Sanitization involves DOMPurify (async import) and fingerprint detection (regex-heavy). Repeated calls with the same content waste CPU. The cache prevents redundant work.

**When it runs:** On demand, on any repeated sanitization call.

---

#### `getDOMPurify()` — **internal**

**What it does:** Lazily imports `isomorphic-dompurify` on first call and caches the module. If the import fails (e.g., JSDOM not available), falls back to a minimal regex-based sanitizer that strips `<script>` tags and all HTML tags.

**Called from / Used in:** Called inside `sanitizeAIOutput` at step 5 (HTML sanitization), only when `allowHtml: true` or when stripping HTML tags.

**Why it exists:** `isomorphic-dompurify` is an ESM module that cannot be statically imported in all environments. The dynamic import with fallback ensures the sanitizer works in both Node.js (API routes) and edge environments.

**When it runs:** On the first HTML sanitization call per module lifecycle.

---

#### `hashContent(content: string): string` — **internal**

**What it does:** Computes a simple 32-bit integer hash of a string using bitwise shifts (`hash = ((hash << 5) - hash) + charCode`), then converts to base-36 for a compact string key.

**Called from / Used in:** Called by `sanitizeWithCaching` to build the cache key.

**Why it exists:** A full content string is too large to use as a map key directly. A short hash provides a compact, deterministic key with acceptable collision probability for a 5-minute TTL cache.

**When it runs:** On every `sanitizeWithCaching` call.

---

#### `cleanupCache()` — **internal**

**What it does:** Iterates over the `sanitizationCache` Map and deletes any entry whose `timestamp` is older than `CACHE_TTL` (5 minutes).

**Called from / Used in:** Called at the end of every `sanitizeWithCaching` call.

**Why it exists:** Prevents unbounded memory growth in long-running server processes where many unique strings are sanitized over time.

**When it runs:** After every `sanitizeWithCaching` call, synchronously.

---

### 1.2 `lib/ai/ai-fingerprint-detector.ts`

Detects patterns in AI-generated text that make it sound robotic or formulaic, calculates an authenticity score, and produces a humanized version by replacing or removing detected patterns.

---

#### `detectAIFingerprints(content: string, platform?: 'linkedin' | 'email' | 'general'): AIFingerprintResult` — **exported**

**What it does:** Runs 21 named regex patterns against the content, filtering for platform scope (some patterns only apply to `linkedin` or `email`). For each match, records the pattern name and severity (HIGH = 25 pts, MEDIUM = 15 pts, LOW = 5 pts). Calls `calculateAuthenticityScore` to produce a 0–100 score, then calls `cleanupSanitizedContent` on the humanized version. Returns the full `AIFingerprintResult` with detected patterns, sanitized content, confidence percentage, and modification list.

**Called from / Used in:** Called in `sanitizeAIOutput` (step 8) and directly in `generate/route.ts` for subject-line fingerprint logging. Also called internally by `isLikelyAIGenerated`, `sanitizeAIFingerprints`, and `analyzeContentAuthenticity`.

**Why it exists:** The product's core differentiator is that generated messages sound like the user, not like ChatGPT. This function is the detection engine that identifies the 21 patterns most associated with AI-generated outreach (em-dashes, "hope this finds you well", "would you be open to", etc.).

**When it runs:** After every Claude generation, before the response is returned to the extension.

---

#### `isLikelyAIGenerated(content: string, platform?: 'linkedin' | 'email' | 'general'): boolean` — **exported**

**What it does:** Calls `detectAIFingerprints` and returns `true` if `confidence >= 30` OR `authenticityScore < 50`. Provides a simple yes/no answer without exposing the full detection result.

**Called from / Used in:** Available for quick pre-checks. Not currently called from route handlers (they use `detectAIFingerprints` directly for the full result), but available for guard conditions in future features.

**Why it exists:** Many call sites only need a binary decision ("is this AI-generated?") rather than the full audit trail. This function avoids repeated inline threshold comparisons.

**When it runs:** On demand, wherever a quick AI-detection check is needed.

---

#### `sanitizeAIFingerprints(content: string, platform?: 'linkedin' | 'email' | 'general'): string` — **exported**

**What it does:** Calls `detectAIFingerprints` and returns only the `sanitizedContent` field — the version of the text with AI patterns replaced (e.g., em-dash `—` → ` - `, excessive formality phrases removed or rewritten).

**Called from / Used in:** Available as a standalone humanization function. Not currently called from production handlers (they use `sanitizeAIOutput` which calls `detectAIFingerprints` internally).

**Why it exists:** Provides a clean, string-returning interface for humanization when callers do not need the full result object.

**When it runs:** On demand wherever humanization is needed without a full sanitization pass.

---

#### `analyzeContentAuthenticity(content: string, platform?: 'linkedin' | 'email' | 'general'): { authenticity: 'high' | 'medium' | 'low'; score: number; issues: string[]; suggestions: string[] }` — **exported**

**What it does:** Runs `detectAIFingerprints` and maps the result to a higher-level analysis. Assigns a categorical rating: `high` (score ≥ 70), `medium` (40–69), `low` (< 40). Generates human-readable suggestions based on detected patterns (e.g., "Use regular hyphens (-) instead of em-dashes" when `em_dash_usage` detected).

**Called from / Used in:** Designed for the extension popup's authenticity feedback UI and the web settings page voice profile section. Not currently wired into production handlers but available for both surfaces.

**Why it exists:** The raw score and pattern list from `detectAIFingerprints` are not user-facing. This function translates them into actionable guidance that a non-technical user can act on.

**When it runs:** When the extension popup or settings page needs to display an authenticity breakdown to the user.

---

#### `calculateAuthenticityScore(content, platform, detectedPatterns)` — **internal**

**What it does:** Starts at 100 and deducts points based on detected pattern count (8 pts each, max 80 pts deduction) and sentence length regularity. Adds bonus points for informality (contractions, casual words), personal pronoun usage, and sentence length variation. Clamps the result to 0–100.

**Called from / Used in:** Called only by `detectAIFingerprints`.

**Why it exists:** The raw pattern count is not a sufficient proxy for authenticity. A message with many short informal sentences but one AI-ism should score higher than a very formal message with zero AI-isms. This function balances multiple signals.

**When it runs:** Inside every `detectAIFingerprints` call.

---

#### `calculateInformalityScore(content: string): number` — **internal**

**What it does:** Counts contractions (e.g., "I'm", "you've"), casual words (e.g., "hey", "yeah", "cool"), and exclamation marks as a ratio of total word count. Returns a 0–1 score.

**Called from / Used in:** Called by `calculateAuthenticityScore` to determine the informality bonus.

**Why it exists:** Authentic human outreach tends to use contractions and casual language. Detecting this positively biases the authenticity score toward messages that sound genuinely personal.

**When it runs:** Inside every `calculateAuthenticityScore` call.

---

#### `calculateVariation(numbers: number[]): number` — **internal**

**What it does:** Computes the coefficient of variation (standard deviation divided by mean) for an array of numbers. Returns 0 if the array is empty or mean is 0.

**Called from / Used in:** Called by `calculateAuthenticityScore` with an array of sentence lengths.

**Why it exists:** Human writing has irregular sentence lengths — some long, some short. AI-generated text tends to have suspiciously uniform sentence lengths. High variation is a signal of human authorship and contributes to the authenticity score.

**When it runs:** Inside every `calculateAuthenticityScore` call.

---

#### `cleanupSanitizedContent(content: string): string` — **internal**

**What it does:** After pattern replacements, the sanitized content may have double spaces, orphaned punctuation, or empty lines. This function collapses multiple spaces, removes blank lines created by deletions, and ensures the text ends with a sentence-terminating character.

**Called from / Used in:** Called by `detectAIFingerprints` as the final step before returning `sanitizedContent`.

**Why it exists:** Pattern replacements (e.g., removing an em-dash and its surrounding text) leave behind whitespace artifacts that would be visible to the user. This function ensures the humanized output is clean and readable.

**When it runs:** After all pattern replacements in every `detectAIFingerprints` call.

---

### 1.3 `lib/ai/style-analyzer.ts`

The style learning system. Extracts writing patterns from approved messages and merges them into a cumulative profile that informs future generation.

---

#### `analyzeStyle(message: string): StylePatterns` — **exported**

**What it does:** Extracts a `StylePatterns` object from a single message. Measures: average sentence length, formality score (0–100, based on formal vocabulary ratio), greeting style (first word/phrase before punctuation), closing style (last sentence), contraction usage (boolean), question count, and top common bigrams. Pure function — no I/O.

**Called from / Used in:** Called in `processStyleFeedback` (inside `feedback/route.ts`) when a user approves a generated message. Also tested directly in `lib/ai/style-analyzer.test.ts`.

**Why it exists:** The product learns the user's voice over time. When a user approves a message, its style characteristics are extracted and merged into their profile so future generations match their natural writing patterns.

**When it runs:** Asynchronously, fire-and-forget, after the feedback route returns 200 to the extension.

---

#### `mergeStylePatterns(existing: StylePatterns, incoming: StylePatterns, weight?: number): StylePatterns` — **exported**

**What it does:** Weighted merge of two `StylePatterns` objects. By default, new data (`incoming`) gets 20% influence and existing data gets 80%. Numeric fields (sentence length, formality, question count) are blended proportionally. Boolean fields (contractions) use latest-signal-wins. Phrase lists are merged by frequency and capped at 8. Pure function.

**Called from / Used in:** Called in `processStyleFeedback` after `analyzeStyle` extracts patterns from a newly approved message. Merges into the existing profile stored in `user_preferences.style_patterns`.

**Why it exists:** A single approved message should not override the user's established voice. The 80/20 weighting means the profile evolves gradually, requiring many approvals before it changes significantly. This prevents a single atypical message from distorting the learned style.

**When it runs:** Same as `analyzeStyle` — asynchronously after feedback approval.

---

#### `extractCommonPhrases(text: string): string[]` — **internal**

**What it does:** Tokenizes text into lowercase words, generates all adjacent word pairs (bigrams), counts their frequency, and returns the top 5 bigrams that appear at least once. Filters out stop-word-only pairs.

**Called from / Used in:** Called by `analyzeStyle` to populate the `commonPhrases` field of the returned `StylePatterns`.

**Why it exists:** Bigrams capture a user's habitual phrasing (e.g., "sounds great", "quick question") more reliably than single words. These phrases are injected into future prompts to nudge Claude toward the user's natural vocabulary.

**When it runs:** Inside every `analyzeStyle` call.

---

#### `mergePhraseLists(existing: string[], incoming: string[]): string[]` — **internal**

**What it does:** Counts frequency of all phrases across both lists, doubles the count for phrases already in `existing` (to give them preference), sorts by frequency, and returns the top 8.

**Called from / Used in:** Called by `mergeStylePatterns` to merge the `commonPhrases` arrays from the existing and incoming style profiles.

**Why it exists:** A user's habitual phrases should persist across many approvals. The frequency doubling for existing phrases prevents a new approval from displacing well-established vocabulary patterns.

**When it runs:** Inside every `mergeStylePatterns` call.

---

### 1.4 `lib/ai/prompts/linkedin-connection.ts`

Assembles the user-facing prompt sent to Claude and provides a runtime sanitization safety net for any AI-isms that slip through generation.

---

#### `LINKEDIN_CONNECTION_PROMPT` — **exported constant**

**What it does:** System prompt for LinkedIn connection request generation. Enforces a 270-character hard limit, mandates a 3-part structure (acknowledgment ~60c + personal intro ~70c + CTA ~80c), bans 70+ phrases (em-dashes, "hope this finds you well", "delighted", etc.), and provides tone guidance by target seniority level.

**Used in:** Returned by `getSystemPrompt('linkedin_connection')`, passed as `system` parameter to Anthropic `messages.create()` in `generate/route.ts`.

**Why it exists:** Without a strong system prompt enforcing constraints, Claude produces messages that are too long, too formal, or full of AI-isms. The system prompt is the primary mechanism for shaping output quality.

**When it runs:** On every `POST /api/extension/generate` request for `category: 'linkedin_connection'`.

---

#### `COLD_EMAIL_PROMPT` — **exported constant**

**What it does:** System prompt for cold email generation. Hard limits: subject 5–9 words, body 100–150 words, 6–8 sentences. Bans 30+ subject-line and body-level AI phrases. Includes an extensive grounding rule: Claude may only reference skills, projects, and companies from the user's resume — no invented metrics or systems. Output must be valid JSON: `{ subject_line, body, word_count }`.

**Used in:** Returned by `getSystemPrompt('cold_email')`.

**Why it exists:** Cold emails are the highest-stakes generation type — if they mention a project the user didn't work on, the user's credibility is damaged. The grounding rule and JSON output format are both critical quality requirements.

**When it runs:** On every `POST /api/extension/generate` for `category: 'cold_email'`.

---

#### `LINKEDIN_INMAIL_PROMPT` — **exported constant**

**What it does:** System prompt for LinkedIn InMail generation. Shorter than cold email (subject 5–8 words, body 80–120 words, 5–6 sentences). More casual tone, no formal greeting/closing. Same grounding rules as cold email. Output: JSON `{ subject_line, body, word_count }`.

**Used in:** Returned by `getSystemPrompt('linkedin_inmail')`.

**Why it exists:** InMails are displayed inline on LinkedIn and need to match the platform's casual, conversational register. A separate prompt ensures the tone and length are calibrated correctly.

**When it runs:** On every `POST /api/extension/generate` for `category: 'linkedin_inmail'`.

---

#### `NEGATIVE_LEXICON` — **exported constant**

**What it does:** A `const string[]` of 30+ phrases that are stripped from any output that passes through `sanitize()`. Includes AI vocabulary ("delve", "tapestry", "leverage", "synergy"), cold email killers ("I hope this email finds you well", "proven track record"), and jargon ("thought leader", "game-changer").

**Used in:** Iterated by `sanitize()` to build regex patterns for each entry.

**Why it exists:** The system prompts instruct Claude to avoid these phrases, but Claude occasionally includes them regardless. The lexicon is a runtime safety net that catches any that slip through.

**When it runs:** The constant is loaded once at module initialization. Its entries are applied on every `sanitize()` call.

---

#### `sanitize(text: string): string` — **exported**

**What it does:** Iterates over every entry in `NEGATIVE_LEXICON`, builds a case-insensitive regex (word-boundary for single words, literal match for multi-word phrases), and removes any matches from the text. After all removals, collapses double spaces and fixes orphaned punctuation (space before period/comma). Logs each caught phrase at `warn` level via Pino.

**Called from / Used in:** Not currently called in production route handlers (the system prompt is the primary enforcement mechanism). Designed as a post-generation safety net available for any code path that produces final user-facing text.

**Why it exists:** Defense in depth. If Claude ignores the prompt's prohibition list, this function ensures the phrases never reach the user regardless.

**When it runs:** On demand, after generation, as an optional post-processing step.

---

#### `buildPrompt(input: GenerateInput): string` — **exported**

**What it does:** Assembles the multi-section user message sent to Claude. Sections included (in order): `USER_BACKGROUND` (resume or fallback text), `ADDITIONAL_PROJECTS` (optional), `TARGET_PROFILE` (name, headline, location, about, experiences, posts, skills), `INTENT`, `LEARNED_STYLE` (if `styleProfile` provided with 3+ approvals), `JOB_DESCRIPTION` (optional), `ACCEPTED_EXAMPLES` (up to 3, optional). All user-supplied strings are wrapped in `<user_input>` XML tags with an explicit instruction to treat the contents as data, not instructions. Sections are joined with `\n\n---\n\n`.

**Called from / Used in:** Called in `generate/route.ts` just before the Anthropic `messages.create()` call.

**Why it exists:** Claude needs all context in a single structured message. The XML tag wrapping is a prompt injection mitigation — it prevents a malicious target profile or resume from containing text that overrides the system prompt. The learned style injection is what enables the personalization differentiator.

**When it runs:** On every `POST /api/extension/generate` request, after authentication and rate limit checks pass.

---

#### `getSystemPrompt(category: string): string` — **exported**

**What it does:** Switch statement on category value. Returns `LINKEDIN_CONNECTION_PROMPT` for `'linkedin_connection'`, `COLD_EMAIL_PROMPT` for `'cold_email'`, `LINKEDIN_INMAIL_PROMPT` for `'linkedin_inmail'`. Falls back to `LINKEDIN_CONNECTION_PROMPT` for unknown values.

**Called from / Used in:** Called in `generate/route.ts` to select the correct system prompt before constructing the Anthropic request.

**Why it exists:** Centralizes the system prompt selection logic so the route handler doesn't need to contain a switch statement. If a new category is added, only this file and the route need to change.

**When it runs:** On every `POST /api/extension/generate` request.

---

## Section 2 — Utilities (`lib/`)

---

### 2.1 `lib/cors.ts`

---

#### `getCorsHeaders(request: NextRequest, options?: { allowCredentials?: boolean; methods?: string }): Record<string, string>` — **exported**

**What it does:** Reads the `origin` and `x-extension-source` headers from the incoming request. Tests origin against three allowed patterns: `chrome-extension://` (any extension), `localhost` (any port), and `NEXT_PUBLIC_APP_URL` (exact match, regex-escaped). Constructs and returns the CORS headers object. If origin matches: `Access-Control-Allow-Origin` = origin value. If null origin + extension source header: ACAO = `*`. Otherwise: ACAO = empty string (CORS blocked). Sets `Access-Control-Allow-Credentials: true` only when `allowCredentials: true` AND origin is allowed (not wildcard — this would violate the CORS spec).

**Called from / Used in:** Called in every route handler's `OPTIONS` handler and in the response from `POST`, `GET`, `PATCH` handlers that serve extension requests: `generate/route.ts`, `feedback/route.ts`, `config/route.ts`, `session/route.ts`, `auth/me/route.ts`.

**Why it exists:** The Chrome extension makes cross-origin requests from `chrome-extension://` to the Next.js server. Standard browser CORS policies require proper headers. Extension service workers send a null origin (no `origin` header), which needs special handling via the custom `x-extension-source` header.

**When it runs:** On every API request from the extension or from localhost during development.

---

#### `buildAllowedPatterns()` — **internal**

**What it does:** Constructs the array of `RegExp` objects that define allowed origins. Always includes `/^chrome-extension:\/\//` and `/^https?:\/\/localhost(:\d+)?$/`. If `NEXT_PUBLIC_APP_URL` is set in the environment, adds a regex that exactly matches it (with special characters escaped).

**Called from / Used in:** Called once at module load time. Result stored in the module-level `ALLOWED_PATTERNS` constant.

**Why it exists:** CORS pattern matching requires regex. Building the patterns once at load time avoids recreating them on every request. The regex escaping of `APP_URL` handles URLs with dots (e.g., `app.example.com` → `app\.example\.com`).

**When it runs:** Once, when `lib/cors.ts` is first imported.

---

### 2.2 `lib/logger.ts`

---

#### `createLogger(module: string): pino.Logger` — **exported**

**What it does:** Returns a Pino child logger with the `module` field set. Log level is controlled by `LOG_LEVEL` env var, defaulting to `debug` in development and `info` in production. Output uses ISO timestamps.

**Called from / Used in:** Used at the top of nearly every module: `const log = createLogger('sanitizer')`, `createLogger('generate')`, `createLogger('feedback')`, etc.

**Why it exists:** `console.log` produces unstructured output that is hard to query in production. Pino produces structured JSON logs that work with log aggregation tools (Datadog, Papertrail, etc.). The child logger pattern tags every log line with the source module, making log traces easy to filter.

**When it runs:** Once per module import (at module load time).

---

#### `createRequestLogger(module: string, request: { method, url, headers }, extra?: Record<string, unknown>): pino.Logger` — **exported**

**What it does:** Creates a Pino child logger scoped to a specific HTTP request. Extracts `method`, `pathname` (from `new URL(request.url, 'http://localhost')`), and `origin` header. Merges optional `extra` fields. Returns a logger pre-loaded with request context.

**Called from / Used in:** Called at the start of route handler functions that want per-request structured logging: `generate/route.ts`, `feedback/route.ts`, `auth/me/route.ts`.

**Why it exists:** Request-scoped logging makes it trivial to correlate all log lines for a single request (e.g., "which user triggered this generation, from which origin, at what timestamp") without manually attaching these fields to every `log.info()` call.

**When it runs:** On every incoming HTTP request to routes that use it.

---

### 2.3 `lib/supabase/server.ts`

Server-side Supabase client factory. Used in Server Components, Route Handlers, and the middleware.

---

#### `createClient(): SupabaseClient<Database>` — **exported**

**What it does:** Creates a Supabase SSR client using the anon key and cookie-based session management. Reads and writes cookies via Next.js `cookies()`. The client respects Row-Level Security (RLS) — queries run as the authenticated user.

**Called from / Used in:** Used in `middleware.ts` for session refresh, in `app/settings/route.ts` (PATCH) for cookie-auth user identification, and in any Server Component that reads user-scoped data.

**Why it exists:** Next.js server components and middleware cannot use the browser client. The SSR client reads the session from cookies rather than `localStorage`, making it compatible with the server-side rendering model.

**When it runs:** On each server-side request that needs database access or authentication.

---

#### `createServiceClient(): SupabaseClient<Database>` — **exported**

**What it does:** Creates a Supabase client using the service role key. Bypasses RLS and can read/write any row in any table. Must only be used in server-side admin contexts.

**Called from / Used in:** Used in `processStyleFeedback` (feedback route), `getUsage` (auth/me route), and any background job that needs to read or write across users.

**Why it exists:** Some operations (updating another user's style profile, reading rate limit data without a JWT) require RLS bypass. The service key client is isolated to server-side code and never exposed to the browser.

**When it runs:** In background/admin contexts on the server side.

---

#### `getUser(): Promise<User | null>` — **exported**

**What it does:** Calls `createClient().auth.getUser()` and returns the user object, or `null` on error.

**Called from / Used in:** Available as a convenience for Server Components that only need the user object, not the full Supabase client.

**Why it exists:** Reduces boilerplate — callers don't need to create a client, call `auth.getUser()`, destructure the result, and check for errors.

**When it runs:** On demand in Server Components and route handlers.

---

#### `getUserProfile(userId?: string): Promise<any | null>` — **exported**

**What it does:** Fetches the full row from the `profiles` table for the given user ID. If no `userId` is provided, first calls `getUser()` to get the current authenticated user's ID.

**Called from / Used in:** Used in `app/profile/page.tsx` and `app/dashboard/page.tsx` to load the user's profile data for display.

**Why it exists:** Profile data (full name, avatar URL, CPL score) is needed in multiple pages. This helper centralizes the query and null-check logic.

**When it runs:** During Server Component rendering for the profile and dashboard pages.

---

#### `ensureUserProfile(user: User): Promise<any>` — **exported**

**What it does:** Checks if a row exists in `profiles` for the given user. If not, inserts a new row with defaults: `theme: 'system'`, `language: 'en'`, `notifications_enabled: true`. Returns the existing or newly created profile.

**Called from / Used in:** Called in `app/auth/callback/route.ts` after successful OAuth or email sign-in to guarantee the profile row exists before the user reaches the dashboard.

**Why it exists:** Supabase Auth creates a user in `auth.users` but does not automatically create the corresponding row in the application's `profiles` table. Without this, profile queries would return null for new users.

**When it runs:** Immediately after a user successfully authenticates for the first time.

---

#### `getServerTables()` — **exported**

**What it does:** Returns a typed object with methods for querying each active table (`profiles`, `generated_drafts`, `user_feedback`, `user_preferences`, `extension_rate_limits`) using the anon (RLS-enforced) client.

**Called from / Used in:** Available for Server Components that need type-safe table access without constructing raw Supabase queries.

**Why it exists:** Provides a centralized, type-safe query interface so callers don't need to remember table names or handle the Supabase client creation boilerplate.

**When it runs:** On demand in server-side contexts.

---

#### `getServiceTables()` — **exported**

**What it does:** Same as `getServerTables()` but uses the service role client (RLS bypassed).

**Called from / Used in:** Available for admin/background operations that need to write across users.

**Why it exists:** Separates admin-level table access from user-level access at the call site, making it obvious which operations bypass RLS.

**When it runs:** In admin/background contexts on the server side.

---

### 2.4 `lib/supabase/client.ts`

---

#### `createClient(): SupabaseClient<Database>` — **exported**

**What it does:** Creates a browser-side Supabase SSR client using the public anon key. Stores the session in cookies (not `localStorage`) for SSR compatibility. Safe to use in client components (`'use client'`).

**Called from / Used in:** Used in client components that need to query Supabase from the browser (e.g., real-time subscriptions, client-side auth flows).

**Why it exists:** The server client imports `next/headers` (a server-only API) and cannot be used in client components. This separate client is safe for browser contexts.

**When it runs:** On demand in client-side React code.

---

## Section 3 — API Routes (`app/api/`)

---

### 3.1 `app/api/extension/generate/route.ts`

The core generation endpoint. Receives a LinkedIn profile + user resume + intent from the extension, builds a Claude prompt, runs the response through the sanitization pipeline, and returns the final message with an authenticity score.

---

#### `POST(request: NextRequest): Promise<NextResponse>` — **handler**

**What it does:** Orchestrates the full generation flow: authenticate Bearer token → check 30/day rate limit → fetch learned style profile (non-blocking) → validate and sanitize request body → build system prompt + user prompt → call Claude (claude-sonnet-4-6, temp 0.8, max 600 tokens) → parse response by category (connection: plain text; email/inmail: JSON with 3-tier fallback parsing) → apply sanitization and word limits → return `{ message, authenticityScore, isAIGenerated, modificationsApplied }`.

**Called from / Used in:** Called by the Chrome extension popup when the user clicks "Generate". Also used directly by developers for testing via `curl` or Postman.

**Why it exists:** The central API that drives the extension's core use case. All authentication, rate limiting, prompt building, generation, and sanitization are coordinated here.

**When it runs:** On demand when a user clicks generate in the extension popup.

---

#### `GET(request: NextRequest): Promise<NextResponse>` — **handler**

**What it does:** Health check that requires a valid Bearer token. Returns `{ service, version, status: 'ok', endpoints, authenticated: true }`. Used by the extension settings page to verify the connection is working.

**Called from / Used in:** Called by `handleHealthCheck()` in `service-worker.js` when the user clicks "Test Connection" in extension settings.

**Why it exists:** Allows the extension to verify connectivity and authentication without triggering a generation. Provides a cheap endpoint to check if the API key / session is still valid.

**When it runs:** When the user tests the connection in extension settings.

---

#### `OPTIONS(request: NextRequest): Promise<Response>` — **handler**

**What it does:** Responds to CORS preflight with `Access-Control-*` headers and `max-age: 86400` (24 hours). Returns 200 with no body.

**Called from / Used in:** Called automatically by the browser/extension before the first cross-origin POST or GET request.

**Why it exists:** CORS preflights are required by the browser for cross-origin requests with non-simple methods or custom headers (like `Authorization`). Without this, the browser blocks the request before it reaches the server.

**When it runs:** Automatically, before the first cross-origin request from a given origin in a 24-hour window.

---

#### `authenticateRequest(request: NextRequest)` — **internal**

**What it does:** Extracts the Bearer token from the `Authorization` header and calls `getSupabaseAuth().auth.getUser(token)`. Returns `{ userId, email }` on success, `null` on failure.

**Called from / Used in:** Called at the start of the `POST` and `GET` handlers.

**Why it exists:** Auth logic is shared between the two handlers. Extracting it into a helper keeps the handlers focused on their business logic and makes the auth contract explicit.

**When it runs:** On every `POST` and `GET` request to this route.

---

#### `checkRateLimit(userId: string)` — **internal**

**What it does:** Calls the `check_and_increment_rate_limit` Supabase RPC with the user ID and a limit of 30. If the RPC succeeds, returns `{ allowed, remainingRequests, resetTime }`. If the RPC throws (e.g., database unavailable), **fails open** — returns `{ allowed: true }` and logs the error. This prevents a database hiccup from locking users out.

**Called from / Used in:** Called in the `POST` handler after authentication, before prompt building.

**Why it exists:** The 30-requests/day limit is a product constraint that prevents abuse and controls Anthropic API costs. The RPC atomically increments the counter and checks the limit in a single database operation, preventing race conditions.

**When it runs:** On every authenticated POST request before generation begins.

---

#### `countWords(text: string): number` — **internal**

**What it does:** Splits text on whitespace (`/\s+/`) and filters out empty strings. Returns the count of non-empty tokens.

**Called from / Used in:** Used in the cold email / InMail parsing branch to check whether the generated body exceeds the word limit (150 for email, 120 for InMail).

**Why it exists:** Word limits are a product constraint. Claude sometimes generates slightly over the limit. A pure word count function is needed to enforce the cutoff before returning the response.

**When it runs:** Inside the POST handler's cold email / InMail response branch.

---

#### `truncateToWordLimit(text: string, maxWords: number): string` — **internal**

**What it does:** Splits text into words, slices to `maxWords`, and rejoins with spaces.

**Called from / Used in:** Called when `countWords(body) > maxWords` in the email/InMail response branch.

**Why it exists:** When Claude's output exceeds the word limit, the response needs to be truncated before being returned. A word-based truncation (rather than character-based) avoids cutting mid-word.

**When it runs:** When a generated email or InMail body exceeds its word limit.

---

#### `extractSubjectFromText(content: string): string` — **internal**

**What it does:** Regex fallback for extracting a subject line when JSON parsing fails. Looks for a "Subject: ..." pattern on the first line. If not found, uses the first line of text. Falls back to "Quick connect" if empty.

**Called from / Used in:** Called in Tier 3 fallback parsing (regex extraction) for cold email and InMail responses.

**Why it exists:** Claude occasionally returns output that isn't valid JSON despite being instructed to do so. This function ensures a subject line is always extracted, even from malformed output.

**When it runs:** Only when both JSON parsing (Tier 1) and sanitize-then-retry (Tier 2) fail.

---

#### `extractBodyFromText(content: string): string` — **internal**

**What it does:** Removes the "Subject: ..." line (if present) from content and returns the remainder as the email body.

**Called from / Used in:** Called alongside `extractSubjectFromText` in Tier 3 fallback.

**Why it exists:** Complements `extractSubjectFromText` — together they decompose non-JSON output into the two required fields.

**When it runs:** Same conditions as `extractSubjectFromText`.

---

#### `stripMarkdownCodeFences(content: string): string` — **internal**

**What it does:** Detects triple-backtick markdown code fences (`` ``` `` or ` ```json `). If found, extracts and returns only the content between the fences. If not found, returns the original content unchanged.

**Called from / Used in:** Called in Tier 2 fallback parsing before attempting to re-parse Claude's output as JSON.

**Why it exists:** Claude sometimes wraps JSON output in a markdown code block despite being instructed not to. Stripping the fences before parsing recovers valid JSON that would otherwise fail Tier 1 parsing.

**When it runs:** In Tier 2 parsing, after Tier 1 JSON parse fails.

---

#### `getAnthropic()`, `getSupabaseService()`, `getSupabaseAuth()` — **lazy factories**

**What they do:** Each returns a new SDK client instance (Anthropic or Supabase). Defined as functions rather than module-level constants.

**Why they exist:** Module-level SDK instantiation causes cold start issues on Vercel edge functions. Lazy factories ensure the clients are only created when a request actually arrives.

**When they run:** On first call within each request handler.

---

### 3.2 `app/api/extension/feedback/route.ts`

---

#### `POST(request: NextRequest): Promise<NextResponse>` — **handler**

**What it does:** Authenticates the request, validates the feedback payload (message, approved, category, optional subjectLine and rejectionReason) via Zod, returns `{ success: true }` immediately (200), then fires-and-forgets `processStyleFeedback`. This ensures the extension is never blocked waiting for style analysis to complete.

**Called from / Used in:** Called by the extension popup after the user clicks Approve or Reject on a generated message.

**Why it exists:** Style learning is a background concern — the user should see immediate confirmation without waiting for database writes. The fire-and-forget pattern keeps the response time under 100ms.

**When it runs:** Each time the user approves or rejects a generated message in the extension popup.

---

#### `processStyleFeedback(userId, message, approved, category, subjectLine?)` — **internal async**

**What it does:** On approval: fetches current `user_preferences` (style_patterns, approved_message_count), calls `analyzeStyle` on the approved message, merges with `mergeStylePatterns` (or creates new patterns if first approval), increments `approved_message_count`, upserts to `user_preferences`. On rejection: only increments `rejected_message_count`. Logs any errors but does not throw (fire-and-forget context).

**Called from / Used in:** Spawned by the `POST` handler as an unhandled promise.

**Why it exists:** This is the core of the voice-learning feature. Every approval teaches the system what writing style the user prefers. Over 3+ approvals, the learned style is injected into future prompts via `buildPrompt`.

**When it runs:** Asynchronously after every feedback submission, in the background.

---

### 3.3 `app/api/extension/config/route.ts`

---

#### `GET(request: NextRequest): Promise<NextResponse>` — **handler**

**What it does:** Returns the Supabase URL and anon key as JSON. No authentication required. Logs the requesting origin for debugging.

**Called from / Used in:** Called by the extension's `auth.js` during initialization to bootstrap the Supabase client without hardcoding credentials in the extension bundle.

**Why it exists:** The extension needs the Supabase URL and anon key to initialize its own Supabase client for cookie-based session retrieval. Fetching them from the API allows the values to be changed server-side without updating the extension package.

**When it runs:** Once during extension initialization, before authentication.

---

### 3.4 `app/api/extension/session/route.ts`

---

#### `GET(request: NextRequest): Promise<NextResponse>` — **handler**

**What it does:** Validates the origin (CORS check), reads the session cookie (`sb-*-auth-token`), calls `getSession()` once, validates the JWT via `getUser(token)`, and returns `{ accessToken, refreshToken, user, supabaseUrl, supabaseAnonKey }`. Returns 401 if the session is stale or missing. This route is deliberately excluded from the auth middleware to avoid refresh token race conditions.

**Called from / Used in:** Called by `fetchSessionFromWebApp` in `auth.js` when the extension needs to bootstrap from the web app's existing session (e.g., user is already logged in on the web).

**Why it exists:** The extension cannot read `httpOnly` cookies directly. This endpoint acts as a secure session bridge — it reads the server-side session and returns the tokens the extension needs to make authenticated API calls.

**When it runs:** When the extension detects no stored auth token and the user may already be logged into the web app.

---

### 3.5 `app/api/auth/me/route.ts`

---

#### `GET(request: NextRequest): Promise<NextResponse>` — **handler**

**What it does:** Tries Bearer token authentication first (for extension), then falls back to cookie session (for web). Returns `{ authenticated, user: { id, email, fullName }, usage: { count, limit, reset_time } }`. If neither auth method succeeds, returns `{ authenticated: false }`.

**Called from / Used in:** Called by the extension popup on load to check authentication status and display usage stats. Also used by the web app to get the current user's info.

**Why it exists:** Both the extension (Bearer token) and the web app (cookies) need a single endpoint to check who the current user is and how many requests they've used today. The dual auth fallback accommodates both surfaces.

**When it runs:** On popup open, on page load in the web app, and whenever the UI needs to refresh the user's status.

---

#### `getUsage(userId: string)` — **internal**

**What it does:** Queries `extension_rate_limits` for the user's current window. If `window_start` is older than 24 hours, treats the count as 0. Returns `{ count, limit: 30, reset_time }`.

**Called from / Used in:** Called by the `GET` handler after authentication.

**Why it exists:** The extension popup shows "X / 30 requests used today". This function provides that data. The 24-hour window check ensures the count resets correctly for users who haven't generated since the previous day.

**When it runs:** On every `GET /api/auth/me` request.

---

### 3.6 `app/api/settings/route.ts`

---

#### `PATCH(request: NextRequest): Promise<NextResponse>` — **handler**

**What it does:** Authenticates via cookie session, parses the JSON body, validates via `settingsSchema` (Zod), and upserts into `user_preferences`. Special case: if `reset_style: true` is present in the body, sets `style_patterns: null`, `approved_message_count: 0`, `rejected_message_count: 0` — clearing all learned style data. Returns the updated preferences row.

**Called from / Used in:** Called by the web settings page (`app/settings/page.tsx`) when the user saves preferences or clicks "Reset style".

**Why it exists:** Allows users to change formality level, theme, and analytics sharing. The `reset_style` flag gives users a way to start fresh if they feel the learned style has drifted from their preferences.

**When it runs:** When the user saves settings or resets their voice profile from the web app.

---

### 3.7 `app/api/health/route.ts`

---

#### `GET(): Promise<NextResponse>` — **handler**

**What it does:** Returns `{ status: 'ok', timestamp: ISO-string }`. No authentication required.

**Called from / Used in:** Used by uptime monitors (e.g., UptimeRobot, Vercel health checks) to verify the server is responding.

**Why it exists:** A standard health check endpoint allows external monitoring systems to alert on outages without needing to authenticate.

**When it runs:** On demand by monitoring systems, typically every 1–5 minutes.

---

### 3.8 `app/api/feedback/route.ts`

---

#### `POST(req: NextRequest): Promise<NextResponse>` — **handler**

**What it does:** Validates the feedback body (name, email, message, optional rating) via Zod. Includes a honeypot field check — if the honeypot field is populated, returns 200 silently (bots think they succeeded). Inserts valid feedback into the `user_feedback` table with referer and user-agent. Returns 200 on success, 400 on validation error, 500 on DB error.

**Called from / Used in:** Called from the web app's feedback form (e.g., landing page or in-app feedback widget).

**Why it exists:** Collects user feedback for product improvement. The honeypot check silently discards bot submissions without revealing that they were rejected.

**When it runs:** When a user submits the feedback form.

---

## Section 4 — Middleware & App Shell

---

### 4.1 `middleware.ts`

---

#### `middleware(request: NextRequest): Promise<NextResponse>` — **default export**

**What it does:** Runs on every request matching the config (all routes except static files and `_next`). Performs: (1) Creates Supabase SSR client and calls `auth.getUser()` to refresh the session cookie. (2) Handles `refresh_token_already_used` error — redirects to login for page requests, returns 401 for API requests. (3) For protected routes (`/dashboard`, `/profile`, `/settings`, `/chat`): redirects unauthenticated users to `/auth/login`. (4) For auth pages (`/auth/login`, `/auth/register`): redirects authenticated users to `/dashboard` (unless `?source=extension`). (5) Adds security headers to every response: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`. (6) Sets a Content-Security-Policy that allows scripts from self and trusted CDNs, connects to Supabase, PostHog, and Sentry.

**Called from / Used in:** Invoked automatically by Next.js on every matching request.

**Why it exists:** Centralizes auth session refreshing, route protection, and security header injection. Without this, every page and route would need to independently check authentication and add headers.

**When it runs:** On every HTTP request to the Next.js server, before any route handler or Server Component runs.

---

### 4.2 `app/providers.tsx`

---

#### `Providers({ children })` — **React component**

**What it does:** Wraps the app with `ThemeProvider` (from `next-themes`, supports light/dark/system modes) and `PostHogProvider` (optional analytics, gated on `NEXT_PUBLIC_POSTHOG_KEY`). All child components inherit the theme context and PostHog instance.

**Called from / Used in:** Used in `app/layout.tsx` to wrap the entire application tree.

**Why it exists:** React context providers must wrap the component tree at or near the root. Collecting all providers in one component keeps `layout.tsx` clean and makes it easy to add/remove providers in one place.

**When it runs:** On every page render (server and client).

---

### 4.3 `app/layout.tsx`

---

#### `RootLayout({ children })` — **React component**

**What it does:** Defines the root HTML document structure: sets `lang="en"`, loads Inter, DM Sans, and Cormorant font families via `next/font`, applies base CSS classes, and wraps `{children}` in `<Providers>`.

**Called from / Used in:** Used implicitly by Next.js App Router as the outermost layout for all routes.

**Why it exists:** Next.js requires a root layout to define the `<html>` and `<body>` elements. Fonts and global providers are loaded here so they are available everywhere in the app without duplication.

**When it runs:** On every page load; the layout is rendered server-side and reused across client-side navigations.

---

## Section 5 — Chrome Extension: Background & Auth

---

### 5.1 `ascendia-extension/background/service-worker.js`

The Manifest V3 service worker acts as the extension's backend. It manages the generation API calls, authentication state, usage tracking, and Chrome event handling.

---

#### `recoverPendingLogin()` — **IIFE on startup**

**What it does:** On service worker cold start, checks `chrome.storage.local` for a `pendingLogin` flag. If found and not expired, attempts to resume the login flow. If expired, clears the flag.

**Why it exists:** Service workers can be terminated and restarted at any time by Chrome. If the user was mid-login when the worker was killed, this function recovers gracefully rather than leaving the user in a broken state.

**When it runs:** Immediately on service worker startup (IIFE).

---

#### `getEffectiveApiUrl()` — **exported**

**What it does:** Reads the API URL from `chrome.storage.sync` first (shared across devices), then `chrome.storage.local`, then falls back to the hardcoded production URL.

**Called from / Used in:** Called before every API request in `makeAPIRequest` and `handleHealthCheck`.

**Why it exists:** Users with self-hosted deployments or developers can override the API URL in extension settings. The sync storage lookup means the override applies on all their Chrome instances automatically.

**When it runs:** Before every outbound API call.

---

#### `initializeDefaultSettings()` — **internal**

**What it does:** On first extension install, populates `chrome.storage.local` with default values: empty resume, default settings (auto-fill on, notifications on, 10 daily usage limit), and production API URL.

**Called from / Used in:** Called inside `chrome.runtime.onInstalled` listener when `reason === 'install'`.

**Why it exists:** Ensures the extension has sensible defaults immediately on install, before the user visits the settings page.

**When it runs:** Once, on first extension install.

---

#### `handleAuthenticate()` — **internal**

**What it does:** First tries `getValidAccessToken()` to see if a session already exists. If so, returns the existing user info. If not, calls `waitForLogin()` which opens the web app login page and waits for the user to complete authentication.

**Called from / Used in:** Dispatched by `chrome.runtime.onMessage` when the popup sends an `'authenticate'` message.

**Why it exists:** The popup needs a single "connect" action that handles both "already logged in" and "need to log in" cases without the popup needing to know which state it's in.

**When it runs:** When the user clicks "Connect to Aletheia" in the extension popup.

---

#### `handleLogout()` — **internal**

**What it does:** Calls `clearAuth()` to remove all stored auth data from `chrome.storage.local`.

**Called from / Used in:** Dispatched by `chrome.runtime.onMessage` when the popup sends a `'logout'` message.

**Why it exists:** Provides a clean logout that removes the session without requiring the user to navigate to the web app.

**When it runs:** When the user clicks "Disconnect" in the popup or settings.

---

#### `handleGenerateRequest(payload)` — **internal**

**What it does:** Gets a valid access token, checks the local daily usage limit, retrieves the last 3 accepted examples (for style context), and makes a POST to `/api/extension/generate` with Bearer auth. On 401, retries with a fresh token (up to 2 fallback strategies: proactive refresh, then full re-fetch from web app). On success, calls `logUsage(category)`. Returns the generation result.

**Called from / Used in:** Dispatched by `chrome.runtime.onMessage` when the popup sends a `'generate'` message.

**Why it exists:** The popup cannot make authenticated API calls directly — it has no access to the session token. The service worker holds the token and makes requests on behalf of the popup. The 401 retry logic handles token expiry gracefully without requiring user interaction.

**When it runs:** When the user clicks "Generate" in the extension popup.

---

#### `makeAPIRequest(endpoint, options, baseUrl)` — **internal**

**What it does:** Generic HTTP client with 3-retry exponential backoff (0ms, 1s, 2s), 30-second timeout per attempt, and structured error parsing. Returns parsed JSON on success, throws on terminal failure.

**Called from / Used in:** Called by `handleGenerateRequest`, `handleHealthCheck`, and token refresh functions.

**Why it exists:** Centralizes retry, timeout, and error-parsing logic so individual callers don't need to implement it. Also provides consistent error message format across all API calls.

**When it runs:** On every outbound API call from the service worker.

---

#### `handleHealthCheck()` — **internal**

**What it does:** Gets a valid token and makes a GET request to `/api/extension/generate`. Returns `{ success: true, data }` or `{ success: false, error }`.

**Called from / Used in:** Dispatched when the settings page sends a `'healthCheck'` message.

**Why it exists:** The settings page "Test Connection" button needs to verify both connectivity (network) and authentication (valid token) without triggering a generation.

**When it runs:** When the user clicks "Test Connection" in extension settings.

---

#### `checkUsageLimit()` — **internal**

**What it does:** Reads the daily usage counter from `chrome.storage.local`, compares against the `maxDailyUsage` setting. Throws an error if the limit is exceeded.

**Called from / Used in:** Called at the start of `handleGenerateRequest`.

**Why it exists:** Provides a client-side usage check before making an API call. This gives instant feedback to users who've hit their local limit without a round-trip to the server. (The server also enforces its own rate limit independently.)

**When it runs:** Before every generation attempt.

---

#### `logUsage(category: string)` — **internal**

**What it does:** Reads current usage data, increments `totalToday`, increments the category-specific counter, and removes usage records older than 30 days. Writes back to `chrome.storage.local`.

**Called from / Used in:** Called after every successful generation in `handleGenerateRequest`.

**Why it exists:** Tracks per-category usage for the settings page analytics export and enforces the client-side daily limit.

**When it runs:** After every successful generation.

---

### 5.2 `ascendia-extension/background/auth.js`

Token lifecycle management for the extension. Handles storage, validation, refresh, and session bootstrapping from the web app.

---

#### `getStoredAuth()` — **exported**

**What it does:** Reads and parses the `aletheia_auth` key from `chrome.storage.local`. Returns the auth object or `null` if not found.

**When it runs:** On every operation that needs to check the current token.

---

#### `storeAuth(authData)` — **exported**

**What it does:** Computes `expires_at` from the access token's `expires_in` field and stores the full auth object to `chrome.storage.local`.

**When it runs:** After login, after token refresh, and after session fetch from web app.

---

#### `clearAuth()` — **exported**

**What it does:** Removes `aletheia_auth` from `chrome.storage.local`.

**When it runs:** On logout or when a refresh fails unrecoverably.

---

#### `isTokenValid(auth)` — **exported**

**What it does:** Returns `true` if `auth.expires_at > Date.now()`. Returns `false` if auth is null or expired.

**When it runs:** Before returning a stored token to a caller.

---

#### `needsRefresh(auth)` — **exported**

**What it does:** Returns `true` if the token expires within the next 5 minutes (`expires_at - Date.now() < 300_000`).

**When it runs:** Inside `getValidAccessToken` and `proactiveRefresh`.

---

#### `fetchSessionFromWebApp(apiUrl)` — **exported**

**What it does:** Calls `GET /api/extension/session` with `credentials: 'include'` to retrieve the session from the web app. If the endpoint fails, falls back to reading `sb-*-auth-token` cookies directly via `chrome.cookies.getAll()`. Uses a coalescing guard to deduplicate concurrent calls.

**Called from / Used in:** Called by `getValidAccessToken` when no stored token is available or all refresh strategies fail.

**Why it exists:** Users who are already logged into the web app should not need to log in again in the extension. This function bridges the two auth contexts.

**When it runs:** When the extension has no valid stored token and needs to bootstrap from the web app session.

---

#### `refreshToken(auth)` — **exported**

**What it does:** Posts to Supabase `/auth/v1/token?grant_type=refresh_token` with the stored refresh token. On success, stores the new auth. Uses an in-flight guard to prevent duplicate refresh calls.

**Called from / Used in:** Called by `getValidAccessToken` when the token needs refresh.

**Why it exists:** Access tokens expire (typically after 1 hour). The refresh token allows getting a new access token without user interaction.

**When it runs:** When `needsRefresh(auth)` returns true.

---

#### `getValidAccessToken(apiUrl)` — **exported**

**What it does:** Entry point for all token retrieval. Strategy: (1) Return stored token if valid. (2) Refresh if stored token is valid but expiring soon. (3) Fetch fresh session from web app if no stored token or refresh fails. Throws if all strategies fail.

**Called from / Used in:** Called by `handleGenerateRequest` and `handleHealthCheck` before every API call.

**Why it exists:** Centralizes all token acquisition logic into a single function. Callers don't need to know about refresh cycles or session bridging — they just call this and get a token.

**When it runs:** Before every API call from the service worker.

---

#### `waitForLogin(apiUrl)` — **exported**

**What it does:** Opens the web app login page in a new tab, sets a keepalive alarm to prevent service worker termination, and calls `pollUntilSession` to wait for the user to authenticate. Resolves with the session when login completes, rejects after 5 minutes.

**Called from / Used in:** Called by `handleAuthenticate` when no existing session is found.

**Why it exists:** The extension cannot show a login form inline (CSP restrictions). It must redirect to the web app. This function manages the asynchronous wait for the user to complete that external login flow.

**When it runs:** When the user clicks "Connect" and has no existing session.

---

#### `injectAuthBridge(tabId)` — **internal**

**What it does:** Injects the `auth-bridge.js` content script into the login tab. This script monitors the page for a completed session and relays it to the service worker.

**Called from / Used in:** Called when the login tab finishes loading (tab `onUpdated` listener).

**Why it exists:** The service worker cannot read the page's cookies or localStorage directly. The content script runs in the page context and can access them, then relays the session via `chrome.runtime.sendMessage`.

**When it runs:** When the web app login tab fully loads.

---

#### `handleAuthBridgeSession(sessionData)` — **exported**

**What it does:** Receives the session from `auth-bridge.js`, stores it via `storeAuth`, and resolves the pending `waitForLogin` promise.

**Called from / Used in:** Called in the `onMessage` listener when `action === 'authBridgeSession'`.

**When it runs:** When the auth bridge content script detects a completed login.

---

#### `pollUntilSession(apiUrl, tabId, timeoutAt)` — **internal**

**What it does:** Polls `GET /api/extension/session` with exponential backoff (3s → 5s → 8s → 13s → 15s). Also watches for cookie changes and tab completion events. Coalesces concurrent auth-bridge messages. Resolves on first successful session fetch. Rejects if `timeoutAt` is reached.

**Called from / Used in:** Called by `waitForLogin`.

**Why it exists:** Login completion on the web app is an asynchronous event. Polling with backoff balances responsiveness (not too slow) with server load (not too frequent). The cookie change watcher provides a faster signal when available.

**When it runs:** During the login flow, while the user is completing authentication on the web app.

---

#### `proactiveRefresh(apiUrl)` — **exported**

**What it does:** Called by the 20-minute token refresh alarm. Reads stored auth, refreshes if needed, or fetches a fresh session from the web app if refresh fails.

**Called from / Used in:** Called by `chrome.alarms.onAlarm` when alarm name is `'tokenRefresh'`.

**Why it exists:** Ensures the token is always valid when the user opens the popup. Without proactive refresh, the first generation after an hour would incur a token refresh round-trip, adding latency.

**When it runs:** Every 20 minutes while the extension is installed.

---

## Section 6 — Chrome Extension: Content Scripts & UI

---

### 6.1 `ascendia-extension/content/linkedin-reader.js`

Runs on LinkedIn profile pages. Extracts profile data from the DOM and sends it to the popup.

---

#### `initializeProfileReader()` — **entry point**

**What it does:** Validates the page is a LinkedIn profile URL, sets up the MutationObserver, registers the message listener, and triggers initial extraction.

**When it runs:** On `DOMContentLoaded` on any LinkedIn page matching the content script URL pattern.

---

#### `isLinkedInProfilePage()` — **internal**

**What it does:** Returns `true` if `window.location.href` matches the `/in/*` LinkedIn profile URL pattern.

**When it runs:** On every page load and navigation check.

---

#### `extractLinkedInProfile()` — **exported (via message)**

**What it does:** Calls each individual extractor in sequence and assembles the profile object: `{ name, headline, location, about, experiences, recentPosts, skills, profileUrl }`. Returns `null` if name extraction fails (indicating this is not a valid profile page).

**Called from / Used in:** Called directly by `extractAndNotifyProfile` and in response to `'getProfile'` messages from the popup.

**Why it exists:** The popup needs the target's profile to build the generation prompt. This is the single function that delivers the complete profile object.

**When it runs:** On page load, on DOM mutations, and when the popup requests a profile refresh.

---

#### `extractName()`, `extractHeadline()`, `extractLocation()`, `extractAbout()` — **internal**

**What they do:** Each tries 4–12 CSS selectors in order of reliability, validates the extracted text (length, content checks), and returns the value or `null`. LinkedIn's DOM changes frequently; multiple selectors provide resilience.

**Why they exist:** LinkedIn does not expose a stable API. Selector-based extraction is the only option, and the selectors must be maintained as LinkedIn updates its UI.

**When they run:** Inside every `extractLinkedInProfile()` call.

---

#### `extractExperiences()` — **internal**

**What it does:** Finds the experience section, extracts up to 5 recent jobs as `{ title, company }` pairs.

**When it runs:** Inside every `extractLinkedInProfile()` call.

---

#### `extractRecentPosts()` — **internal**

**What it does:** Finds the activity/posts section, extracts up to 3 recent post texts of 20+ characters.

**When it runs:** Inside every `extractLinkedInProfile()` call.

---

#### `extractSkills()` — **internal**

**What it does:** Finds the skills section, extracts up to 10 skill names.

**When it runs:** Inside every `extractLinkedInProfile()` call.

---

#### `extractAndNotifyProfile()` — **internal**

**What it does:** Debounces profile extraction (500ms), compares the result to the last extracted profile via `hasProfileChanged`, and if changed, sends a `'profileUpdated'` message to the popup.

**Why it exists:** LinkedIn's SPA triggers many DOM mutations. Debouncing prevents repeated extraction on every small change, and change comparison prevents redundant messages to the popup.

**When it runs:** On DOM mutations observed by `observeProfileChanges()` and on page navigation.

---

#### `observeProfileChanges()` — **internal**

**What it does:** Attaches a `MutationObserver` to `document.body` that calls `extractAndNotifyProfile` when `main` or `section` elements are added to the DOM.

**Why it exists:** LinkedIn loads profile content dynamically after the initial page render. The observer ensures profile data is extracted after each lazy-loaded section appears.

**When it runs:** Once on init, then continuously while on a LinkedIn profile page.

---

#### `checkForNavigation()` — **internal**

**What it does:** Polls `window.location.href` every 1 second via `setInterval`. On URL change, determines if the new URL is a profile page and re-extracts or clears the profile accordingly.

**Why it exists:** LinkedIn is a single-page application — page navigations do not trigger a full page reload, so `DOMContentLoaded` does not fire on internal navigation. `setInterval` polling is the reliable fallback for detecting SPA navigations.

**When it runs:** Continuously while the content script is active.

---

### 6.2 `ascendia-extension/content/auto-filler.js`

Fills LinkedIn message compose boxes and Apollo email composers with the generated message after the user clicks "Auto-fill" in the popup.

---

#### `performAutoFill(data)` — **core**

**What it does:** Detects the current platform (Apollo or LinkedIn), identifies the active composition context (compose window, sequence builder, InMail form), fills the subject and body fields, and shows a visual confirmation toast.

**Called from / Used in:** Dispatched by `chrome.runtime.onMessage` when the popup sends an `'autoFill'` message.

**When it runs:** When the user clicks "Fill" in the popup after generation.

---

#### `detectContext(platformConfig)` — **internal**

**What it does:** Tests CSS selectors from the platform config against the current page DOM to identify which composition UI is active (compose, sequence, messaging, InMail).

**Why it exists:** Different LinkedIn and Apollo contexts use different DOM selectors. Detecting the context before filling prevents targeting the wrong input fields.

**When it runs:** Inside every `performAutoFill` call.

---

#### `fillField(selector, content, fieldName)` — **internal**

**What it does:** Finds the DOM element matching `selector`, sets its value/innerHTML, and dispatches `input`, `change`, and `blur` events to trigger React/Vue state updates. Records success or failure.

**Why it exists:** Simply setting `.value` is not enough for modern React/Vue apps — they listen to synthetic events, not direct property mutations. Dispatching these events tricks the framework into treating the fill as a user action.

**When it runs:** For each field (subject, body) inside `fillFields`.

---

#### `highlightFilledElement(element)` — **internal**

**What it does:** Applies a blue border to the filled element and removes it after 2 seconds.

**Why it exists:** Provides visual feedback so the user knows exactly which field was filled.

**When it runs:** After each successful `fillField` call.

---

### 6.3 `ascendia-extension/content/auth-bridge.js`

Injected into the web app login tab. Relays the completed session back to the service worker.

---

#### `findSession()` — **internal**

**What it does:** Tries to parse the Supabase session from `document.cookie` (`sb-*-auth-token`), then falls back to `localStorage`. Returns the parsed session object or `null`.

**When it runs:** On page load and on storage/cookie change events.

---

#### `sendSessionToExtension(session)` — **internal**

**What it does:** Sends the session data to the service worker via `chrome.runtime.sendMessage({ action: 'authBridgeSession', session })`.

**When it runs:** When `findSession()` returns a valid session.

---

### 6.4 `ascendia-extension/popup/popup.js`

The extension popup UI controller. Manages the generate-display-feedback loop.

---

#### `initializePopup()` — **entry point**

**What it does:** Checks auth status, performs a silent auth check for existing web app sessions, and renders either the "connect" screen or the main generate UI with usage stats and last generation restored.

**When it runs:** On popup `DOMContentLoaded`.

---

#### `generateMessage()` — **core action**

**What it does:** Collects the JD text, category, and intent from the form, retrieves the resume from storage, assembles the payload, and sends a `'generate'` message to the service worker. Displays a loading state while waiting. On success, calls `displayOutput`.

**When it runs:** When the user clicks "Generate".

---

#### `displayOutput(output)` — **core UI**

**What it does:** Renders the generated message, updates character count, shows the subject line (for email categories), displays validation feedback, and calls `renderScoreMeter`.

**When it runs:** After a successful generation response from the service worker.

---

#### `renderScoreMeter(output)` — **internal UI**

**What it does:** Shows the authenticity score as an animated bar (green ≥70, amber 40–69, red <40) and a collapsible list of detected AI patterns that were removed.

**Why it exists:** The score meter is the product's visible proof of value — it shows the user that the message has been humanized and explains exactly what was changed.

**When it runs:** Inside `displayOutput` after every successful generation.

---

### 6.5 `ascendia-extension/settings/settings.js`

The extension settings page controller. Manages API URL, resume upload, preferences, and connection status.

---

#### `initializeSettings()` — **entry point**

**What it does:** Loads API URL (from sync and local storage), resume content, personal info, and all toggle/slider settings. Populates form fields and calls `updateStatusIndicators`.

**When it runs:** On settings page `DOMContentLoaded`.

---

#### `processResumeFile(file)` — **core feature**

**What it does:** Validates file type (PDF, DOC, DOCX, TXT) and size (< 5MB). For text files, reads content directly. For PDFs, calls `extractPDFText` using pdf.js. Stores the result in `chrome.storage.local` and shows a preview.

**Why it exists:** The resume is the primary input for the user background section of every generated message. Storing it locally means the user only needs to upload it once.

**When it runs:** When the user selects or drops a resume file.

---

#### `extractPDFText(arrayBuffer)` — **internal**

**What it does:** Uses pdf.js to render each page of the PDF and extract its text content. Concatenates all pages.

**Why it exists:** PDFs are the most common resume format. Without PDF extraction, users would need to manually copy-paste their resume text.

**When it runs:** When the uploaded file is a PDF.

---

#### `saveAllSettings()` — **core action**

**What it does:** Saves the API URL to `chrome.storage.sync` (device-shared) and all other settings to `chrome.storage.local`. Then calls `checkConnectionStatus`.

**When it runs:** When the user clicks "Save Settings".

---

#### `clearAllData()` — **destructive action**

**What it does:** After user confirmation, clears all `chrome.storage.local` and `chrome.storage.sync` data, resets `currentSettings`, and reloads the settings page.

**Why it exists:** Provides a clean reset path for debugging or when a user wants to start fresh.

**When it runs:** When the user clicks "Clear All Data" and confirms.

---

#### `exportUsageData()` — **utility action**

**What it does:** Reads usage statistics from `chrome.storage.local`, serializes to JSON, creates a Blob, and triggers a browser download.

**Why it exists:** Users may want to export their usage data for personal records or to analyze their outreach patterns.

**When it runs:** When the user clicks "Export Data".

---

## Summary

| Layer | Functions documented |
|-------|---------------------|
| AI Pipeline (`lib/ai/`) | 26 |
| Utilities (`lib/`) | 14 |
| API Routes (`app/api/`) | 28 |
| Middleware & App Shell | 3 |
| Extension Background & Auth | 22 |
| Extension Content Scripts & UI | 24 |
| **Total** | **~117** |
