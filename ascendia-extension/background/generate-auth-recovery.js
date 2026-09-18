// Deterministic auth recovery for generation requests. This deliberately keeps
// Chrome APIs out of the state machine so each transition can be regression
// tested without a service worker runtime.

export const AUTH_REQUIRED_CODE = "AUTH_REQUIRED";
export const AUTH_TIMEOUT_CODE = "AUTH_TIMEOUT";

export function isAuthenticationFailure(error) {
  if (!error) return false;

  if (error.status === 401) return true;

  return [
    AUTH_REQUIRED_CODE,
    AUTH_TIMEOUT_CODE,
    "SESSION_UNAVAILABLE",
    "SESSION_REFRESH_REJECTED",
    "SESSION_USER_INVALID",
    "SESSION_COOKIE_INVALID",
    "REFRESH_TOKEN_ALREADY_USED",
    "refresh_token_already_used",
  ].includes(error.code);
}

function recoveryError(error, fallbackCause) {
  const timedOut =
    error?.code === AUTH_TIMEOUT_CODE ||
    /timed out/i.test(error?.message || "");
  const result = new Error(
    timedOut
      ? "AUTH_TIMEOUT: Sign-in timed out. Please reconnect the extension and try again."
      : "AUTH_REQUIRED: Please reconnect the extension to continue.",
  );

  result.code = timedOut ? AUTH_TIMEOUT_CODE : AUTH_REQUIRED_CODE;
  result.status = 401;
  result.authCause = error?.authCause || error?.code || fallbackCause;
  return result;
}

/**
 * Runs a generation request with exactly one silent recovery and one
 * interactive sign-in. A non-auth failure from any generation attempt is
 * returned immediately; it must never prompt the user to sign in again.
 */
export async function generateWithAuthRecovery({
  getAccessToken,
  generate,
  recoverSilently,
  clearAuth,
  authenticateInteractively,
  resumeAfterInteractive = true,
}) {
  async function generateOnce() {
    const accessToken = await getAccessToken();
    return generate(accessToken);
  }

  try {
    return await generateOnce();
  } catch (error) {
    if (!isAuthenticationFailure(error)) throw error;
  }

  try {
    await recoverSilently();
  } catch (_silentRecoveryError) {
    // A fresh web-app session is optional at this point. The next bounded
    // transition is the user-directed sign-in flow below.
  }

  try {
    return await generateOnce();
  } catch (error) {
    if (!isAuthenticationFailure(error)) throw error;
  }

  try {
    await clearAuth();
    await authenticateInteractively();
    if (!resumeAfterInteractive)
      return {
        success: false,
        code: "AUTH_RECONNECTED",
        message:
          "Connected. Your application draft is ready. Select Generate to continue.",
      };
    return await generateOnce();
  } catch (error) {
    throw recoveryError(error, "INTERACTIVE_AUTH_REJECTED");
  }
}
