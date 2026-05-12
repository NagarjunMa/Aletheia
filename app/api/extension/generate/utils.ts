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

export function stripMarkdownCodeFences(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/```(?:\w+)?\s*\n?([\s\S]*?)\n?\s*```/);
  return match?.[1] ? match[1].trim() : trimmed;
}
