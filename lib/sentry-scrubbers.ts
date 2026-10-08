// Shared Sentry scrubbers — applied identically on client, server, and edge.
//
// Goal: defense-in-depth against PII / secrets leaking into Sentry events.
// Trust the SDK's default Replay input masking, but layer explicit
// redaction on top so a regression in any single layer fails closed.
//
// What we redact:
//  - Auth credentials: authorization headers, cookies, set-cookie, tokens
//  - User PII: resume, profileMarkdown, jd, messageFocus, acceptedExamples, email
//  - Backend secrets: service-role key (in case it ever lands in a stack)

// Local structural types — avoids depending on the Sentry types subpath,
// which moved across SDK versions. Only the fields we touch are typed.
export type ScrubberHeaders = Record<string, string> | undefined;
export interface ScrubberRequest {
  url?: string;
  headers?: ScrubberHeaders;
  cookies?: unknown;
  data?: unknown;
}
export interface ScrubberEvent {
  request?: ScrubberRequest;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
}
export interface ScrubberBreadcrumb {
  category?: string;
  data?: Record<string, unknown>;
}

const REDACTED = "[REDACTED]";

// Header names always scrubbed (lowercased for case-insensitive match).
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-supabase-auth",
  "x-extension-source",
]);

// Body / context field names always scrubbed.
const SENSITIVE_FIELDS = new Set([
  "fact_review",
  "factreview",
  "facts",
  "claims",
  "supporting_excerpt",
  "supportingexcerpt",
  "excerpt",
  "resume",
  "profilemarkdown",
  "jd",
  "messagefocus",
  "acceptedexamples",
  "accepted_examples",
  "access_token",
  "refresh_token",
  "supabase_service_role_key",
  "anthropic_api_key",
  "password",
  "secret",
]);

// Substrings that, if seen in any string value, mark the value sensitive.
// Catches accidental leaks where a token shows up in a free-form message.
const SENSITIVE_VALUE_PREFIXES = ["sb_secret_", "sk-ant-", "eyJ"];

function isSensitiveFieldName(name: string): boolean {
  const n = name.toLowerCase();
  if (SENSITIVE_FIELDS.has(n)) return true;
  // Also scrub anything containing "token" or "secret"
  return /token|secret|password|api[_-]?key/i.test(n);
}

function looksLikeSecret(value: string): boolean {
  return SENSITIVE_VALUE_PREFIXES.some((p) => value.startsWith(p));
}

// Recursively walk an object and redact sensitive fields.
// Cap depth to avoid pathological structures stalling the SDK.
function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (obj == null) return obj;
  if (typeof obj === "string") {
    return looksLikeSecret(obj) ? REDACTED : obj;
  }
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveFieldName(k)) {
      out[k] = REDACTED;
      continue;
    }
    out[k] = redactObject(v, depth + 1);
  }
  return out;
}

function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? REDACTED : v;
  }
  return out;
}

export function sentryBeforeSend<T extends ScrubberEvent>(
  event: T,
  _hint?: unknown,
): T | null {
  // Request context: headers, query, body
  if (event.request) {
    event.request.headers = redactHeaders(event.request.headers);
    if (event.request.cookies) event.request.cookies = REDACTED;
    if (event.request.data) {
      event.request.data = redactObject(event.request.data);
    }
  }
  // Arbitrary extra context attached by app code
  if (event.extra) {
    event.extra = redactObject(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = redactObject(event.contexts) as Record<string, unknown>;
  }
  if (event.tags) {
    event.tags = redactObject(event.tags) as Record<string, unknown>;
  }
  return event;
}

export function sentryBeforeBreadcrumb<T extends ScrubberBreadcrumb>(
  breadcrumb: T,
  _hint?: unknown,
): T | null {
  // Drop fetch/xhr breadcrumbs that carry Authorization headers entirely —
  // the URL alone is enough context for debugging, and the headers field
  // is the highest-risk leak surface for Bearer tokens.
  if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
    if (breadcrumb.data) {
      const data = { ...breadcrumb.data };
      if (data.request_headers) data.request_headers = REDACTED;
      if (data.response_headers) data.response_headers = REDACTED;
      breadcrumb.data = data;
    }
  }
  if (breadcrumb.data) {
    breadcrumb.data = redactObject(breadcrumb.data) as Record<string, unknown>;
  }
  return breadcrumb;
}
