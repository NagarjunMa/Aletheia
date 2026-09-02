export const EXTENSION_LOG_SCHEMA_VERSION = 1;
export const DIAGNOSTIC_BUFFER_KEY = "aletheia_diagnostic_events_v1";
export const MAX_DIAGNOSTIC_EVENTS = 80;
export const DIAGNOSTIC_EVENT_TTL_MS = 60 * 60 * 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROHIBITED_KEY =
  /authorization|cookie|token|secret|password|api.?key|session|prompt|completion|message|body|profile|resume|job.?description|question|answer|email|user.?metadata|content|draft|headers?|url|search/i;

export function isValidOperationId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function createOperationId(value, createId = () => crypto.randomUUID()) {
  return isValidOperationId(value) ? value.toLowerCase() : createId();
}

function normalizeString(value) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, 160)
    : undefined;
}

function sanitizeValue(value, depth) {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (value && typeof value === "object") return redactFields(value, depth + 1);
  if (typeof value === "string") return normalizeString(value);
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  return undefined;
}

export function redactFields(fields = {}, depth = 0) {
  const result = {};
  for (const [key, value] of Object.entries(fields)) {
    if (PROHIBITED_KEY.test(key)) continue;
    const safeKey = normalizeString(key);
    const safeValue = sanitizeValue(value, depth);
    if (!safeKey || safeValue === undefined) continue;
    result[safeKey] =
      /user.?id/i.test(safeKey) && typeof safeValue === "string"
        ? safeValue.slice(0, 12)
        : safeValue;
  }
  return result;
}

export function buildDiagnosticEvent({
  module,
  level = "info",
  event,
  operationId,
  fields = {},
  now = Date.now(),
}) {
  return {
    schemaVersion: EXTENSION_LOG_SCHEMA_VERSION,
    time: new Date(now).toISOString(),
    level,
    module: normalizeString(module) || "extension",
    event: normalizeString(event) || "extension.event",
    ...(isValidOperationId(operationId)
      ? { operationId: operationId.toLowerCase() }
      : {}),
    ...redactFields(fields),
  };
}

export function appendDiagnosticEvent(existing, event, now = Date.now()) {
  const active = (Array.isArray(existing) ? existing : []).filter(
    (entry) =>
      entry &&
      typeof entry.time === "string" &&
      now - Date.parse(entry.time) <= DIAGNOSTIC_EVENT_TTL_MS,
  );
  return [...active, event].slice(-MAX_DIAGNOSTIC_EVENTS);
}
