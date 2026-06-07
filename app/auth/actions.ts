"use server";

import { redirect } from "next/navigation";
import { ensureUserProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export async function ensureProfileAction() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "Not authenticated" };
  }

  try {
    await ensureUserProfile(user);
    return { success: true };
  } catch {
    return { error: "Failed to create profile" };
  }
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
