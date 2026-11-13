export const MESSAGE_FOCUS_MAX_LENGTH = 500;

// Null means invalid, and an empty string means automatic generation.
export function normalizeMessageFocus(value = "") {
  if (typeof value !== "string" || value.length > MESSAGE_FOCUS_MAX_LENGTH)
    return null;
  const normalized = value.normalize("NFKC").replace(/\r\n?/gu, "\n").trim();
  return normalized.length <= MESSAGE_FOCUS_MAX_LENGTH ? normalized : null;
}
