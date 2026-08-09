import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

/**
 * Creates a stateless Data API client scoped to a previously verified caller.
 * The public key identifies the project; the Bearer JWT selects the
 * authenticated Postgres role and allows table RLS policies to authorize rows.
 */
export function createBearerUserClient(accessToken: string) {
  const normalizedAccessToken = accessToken.trim();
  if (!normalizedAccessToken) {
    throw new Error("Verified Supabase access token is required");
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalizedAccessToken)) {
    throw new Error("Verified Supabase access token is invalid");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is not set");
  }
  if (!anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not set",
    );
  }

  return createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${normalizedAccessToken}` },
    },
  });
}
