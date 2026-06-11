export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function truncateToWordLimit(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  const truncated = words.slice(0, maxWords).join(" ");

  const paragraphBoundary = truncated.lastIndexOf("\n\n");
  if (paragraphBoundary > truncated.length * 0.55) {
    return truncated.slice(0, paragraphBoundary).trim();
  }

  const sentenceBoundary = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("? "),
    truncated.lastIndexOf("! "),
  );
  if (sentenceBoundary > truncated.length * 0.55) {
    return truncated.slice(0, sentenceBoundary + 1).trim();
  }

  return truncated
    .replace(/\s+(?:js APIs|js services|js apps|com\/in\/\S*|com\/\S*)$/i, "")
    .trim();
}

export function stripMarkdownCodeFences(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/```(?:\w+)?\s*\n?([\s\S]*?)\n?\s*```/);
  return match?.[1] ? match[1].trim() : trimmed;
}
