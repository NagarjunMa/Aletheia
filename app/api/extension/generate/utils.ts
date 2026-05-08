export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function truncateToWordLimit(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

export function extractSubjectFromText(content: string): string {
  const subjectMatch = content.match(/(?:Subject|SUBJECT):\s*(.+)/i);
  if (subjectMatch?.[1]) return subjectMatch[1].trim();
  const firstLine = content.split("\n")[0]?.trim();
  return firstLine || "Quick connect";
}

export function extractBodyFromText(content: string): string {
  const body = content.replace(/(?:Subject|SUBJECT):\s*(.+)\n?/i, "");
  return body.trim();
}

export function stripMarkdownCodeFences(content: string): string {
  const trimmed = content.trim();
  // Match code fence anywhere in content (not just wrapping the entire string).
  // Handles Claude prepending reasoning text before the fenced block.
  const match = trimmed.match(/```(?:\w+)?\s*\n?([\s\S]*?)\n?\s*```/);
  return match?.[1] ? match[1].trim() : trimmed;
}

// Extract the first complete JSON object from a string using balanced brace matching.
// Handles cases where Claude prepends reasoning text before outputting JSON,
// or includes brace-like characters in string values (e.g. "Email {Company}").
export function extractJsonFromText(content: string): string {
  const start = content.indexOf("{");
  if (start === -1) return content;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < content.length; i++) {
    const ch = content[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === "\\") {
      if (inString) escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return content.slice(start, i + 1);
      }
    }
  }

  // No balanced object found — return original content for downstream handling
  return content;
}
