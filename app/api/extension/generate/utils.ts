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
  const match = trimmed.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match?.[1] ? match[1].trim() : trimmed;
}

// Extract the first complete JSON object from a string.
// Handles cases where Claude prepends reasoning text before outputting JSON.
export function extractJsonFromText(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return content;
  return content.slice(start, end + 1);
}
