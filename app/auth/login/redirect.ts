const DEFAULT_POST_AUTH_REDIRECT = "/dashboard";

export function normalizePostAuthRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_POST_AUTH_REDIRECT;
  }
  if (value.includes("\\")) return DEFAULT_POST_AUTH_REDIRECT;

  try {
    const base = new URL("https://aletheia.invalid");
    const destination = new URL(value, base);
    if (destination.origin !== base.origin) return DEFAULT_POST_AUTH_REDIRECT;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return DEFAULT_POST_AUTH_REDIRECT;
  }
}
