/** Exclusion topics are case/separator insensitive; source support is not. */
export function normalizeForExclusion(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function containsExcludedClaim(
  value: string,
  excludedClaims: readonly string[],
): boolean {
  const searchable = ` ${normalizeForExclusion(value)} `;
  return excludedClaims.some((claim) => {
    const topic = normalizeForExclusion(claim);
    return topic.length > 0 && searchable.includes(` ${topic} `);
  });
}
