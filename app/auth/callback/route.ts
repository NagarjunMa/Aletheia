import { NextResponse } from "next/server";
import { createClient, ensureUserProfile } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth-callback");

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawRedirect = searchParams.get("redirectTo") || "/dashboard";
  let redirectTo = "/dashboard";
  try {
    const decoded = decodeURIComponent(rawRedirect);
    if (decoded.startsWith("/") && !decoded.startsWith("//"))
      redirectTo = decoded;
  } catch {
    /* malformed encoding — default to '/dashboard' */
  }
  const source = searchParams.get("source");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      try {
        await ensureUserProfile(data.user);
      } catch (firstErr) {
        log.warn(
          { err: firstErr },
          "Profile creation failed, retrying once...",
        );
        try {
          await ensureUserProfile(data.user);
        } catch (retryErr) {
          log.error(
            { err: retryErr },
            "Profile creation failed after retry — user logged in without profile",
          );
        }
      }

      // If signup came from extension, redirect to login page so the
      // auth-bridge content script can detect the session and auto-close the tab
      if (source === "extension") {
        return NextResponse.redirect(`${origin}/auth/login?source=extension`);
      }

      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/login?error=Could not verify email`,
  );
}
