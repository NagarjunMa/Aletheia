export const LOG_SCHEMA_VERSION = 1;
export const MAX_LOG_STRING_LENGTH = 160;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROHIBITED_FIELD_PATTERN =
  /authorization|cookie|token|secret|password|api.?key|session|prompt|completion|message|body|profile|resume|job.?description|question|answer|email|user.?metadata|content|draft|headers?|url|search/i;
const ERROR_FIELD_PATTERN = /^(?:err|error)$/i;
const PRIVATE_FACT_PATTERN =
  /^(?:fact_?review|facts|claims|supporting_?excerpt|excerpt)$/i;

export type SafeLogFields = Record<string, unknown>;

export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function normalizeLogString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, MAX_LOG_STRING_LENGTH);
}

function isProhibitedField(key: string) {
  return PROHIBITED_FIELD_PATTERN.test(key) || PRIVATE_FACT_PATTERN.test(key);
}

function isErrorField(key: string) {
  return ERROR_FIELD_PATTERN.test(key);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 4) return "[truncated]";
  if (value instanceof Error) {
    return Object.fromEntries(
      Object.entries({
        name: normalizeLogString(value.name),
        code: "code" in value ? (value as { code?: unknown }).code : undefined,
        status:
          "status" in value
            ? (value as { status?: unknown }).status
            : undefined,
      }).filter(([, fieldValue]) => fieldValue !== undefined),
    );
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    return sanitizeLogFields(value as SafeLogFields, depth + 1);
  }
  if (typeof value === "string") return normalizeLogString(value);
  if (
    typeof value === "boolean" ||
    typeof value === "number" ||
    value === null
  ) {
    return value;
  }
  return undefined;
}

export function sanitizeLogFields(
  fields: SafeLogFields,
  depth = 0,
): SafeLogFields {
  const result: SafeLogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    // Error values can contain upstream response bodies, user input, and
    // credentials. Callers must emit a stable errorCode instead.
    if (isErrorField(key) || isProhibitedField(key)) continue;
    const safeKey = normalizeLogString(key);
    if (!safeKey) continue;
    const safeValue = sanitizeValue(value, depth);
    if (safeValue !== undefined) {
      result[safeKey] =
        /user.?id/i.test(safeKey) && typeof safeValue === "string"
          ? safeValue.slice(0, 12)
          : safeValue;
    }
  }
  return result;
}

export function createCorrelationId(value: unknown, createId: () => string) {
  return isValidCorrelationId(value) ? value.toLowerCase() : createId();
}

export function safeDurationMs(startedAt: number, now = Date.now()) {
  return Math.max(0, Math.round(now - startedAt));
}
