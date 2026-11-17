const completedLoginPath = "/auth/login?source=extension";

/** @param {unknown} token */
export function readExtensionSessionId(token) {
  if (typeof token !== "string") return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const { session_id: id } = JSON.parse(
      atob(payload.replace(/-/gu, "+").replace(/_/gu, "/")),
    );
    return typeof id === "string" &&
      /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(id)
      ? id.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

/** @param {unknown} token */
export async function extensionLoginCompletion(token) {
  const id = readExtensionSessionId(token);
  if (!id) return null;
  // Bind the login tab to the session without placing its credentials in a URL.
  const bytes = new TextEncoder().encode(`aletheia-extension-login:${id}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const proof = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${completedLoginPath}#extension-session=${proof}`;
}
