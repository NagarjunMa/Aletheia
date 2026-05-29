// Supabase Server Configuration
// Created: December 7, 2024
// Purpose: Server-side Supabase client for Server Actions and SSR

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/database/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("supabase-server");

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}

// Service Role client for admin operations (use carefully!)
// The service role key is read once and never logged or exposed.
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY environment variable is not set",
    );
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is not set");
  }
  const cookieStore = cookies();

  return createServerClient<Database>(supabaseUrl, serviceRoleKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Handle cookie setting errors
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Handle cookie removal errors
        }
      },
    },
  });
}

// Cookie-less service-role client for Bearer-token API routes (extension
// endpoints). Use this instead of the cookie-bound `createServiceClient()`
// when the route is not part of the SSR cookie flow — i.e. when auth is
// validated via Bearer JWT, not session cookies.
//
// Validates env vars at call time. Reads the service role key into a local
// variable; never logged, never returned.
//
// Intentionally NOT generic over Database: the bearer routes historically
// used the untyped `createClient` form and rely on JSONB / dynamic table
// access. Tightening to `Database` requires a sweep of those routes; do
// that as a follow-up, not in the security refactor.
export function createBearerServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY environment variable is not set",
    );
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is not set");
  }
  return createSupabaseJsClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Anon-key Supabase client used by extension routes only to validate Bearer
// JWTs via `auth.getUser(accessToken)`. Validates env vars at call time.
export function createBearerAuthClient() {
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
  return createSupabaseJsClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Helper function to get authenticated user
export async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    log.error({ err: error.message }, "Error getting user");
    return null;
  }

  return user;
}

// Helper function to get user profile
export async function getUserProfile(userId?: string) {
  const supabase = createClient();

  let targetUserId = userId;
  if (!targetUserId) {
    const user = await getUser();
    if (!user) return null;
    targetUserId = user.id;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", targetUserId)
    .single();

  if (error) {
    log.error({ err: error.message }, "Error getting profile");
    return null;
  }

  return profile;
}

// Helper function to check if user exists and create profile if needed
export async function ensureUserProfile(user: User) {
  const supabase = createClient();

  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (existingProfile) {
    return existingProfile;
  }

  // Create profile if it doesn't exist
  const insert: TablesInsert<"profiles"> = {
    id: user.id,
    email: user.email ?? "",
    full_name:
      (user.user_metadata?.full_name as string) ??
      user.email?.split("@")[0] ??
      null,
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    preferences: {
      theme: "system",
      language: "en",
      notifications: true,
      auto_save: true,
      default_category: "general",
    },
  };

  const { data: newProfile, error } = await supabase
    .from("profiles")
    .insert(insert)
    .select()
    .single();

  if (error) {
    log.error({ err: error.message }, "Error creating profile");
    throw error;
  }

  log.info({ userId: user.id.substring(0, 12) }, "Profile created");
  return newProfile;
}

// Type-safe table access helpers for server
export function getServerTables() {
  const supabase = createClient();

  return {
    profiles: () => supabase.from("profiles"),
    generated_drafts: () => supabase.from("generated_drafts"),
    user_feedback: () => supabase.from("user_feedback"),
    user_preferences: () => supabase.from("user_preferences"),
    extension_rate_limits: () => supabase.from("extension_rate_limits"),
  };
}

// Service role table access (admin operations only)
export function getServiceTables() {
  const supabase = createServiceClient();

  return {
    profiles: () => supabase.from("profiles"),
    generated_drafts: () => supabase.from("generated_drafts"),
    user_feedback: () => supabase.from("user_feedback"),
    user_preferences: () => supabase.from("user_preferences"),
    extension_rate_limits: () => supabase.from("extension_rate_limits"),
  };
}
