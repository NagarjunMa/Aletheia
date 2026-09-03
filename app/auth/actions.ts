"use server";

import { redirect } from "next/navigation";
import { ensureUserProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger, startTimedStage } from "@/lib/logger";

const log = createLogger("auth-actions");

export async function ensureProfileAction() {
  const supabase = await createClient();
  const completeAuth = startTimedStage(log, "auth.profile.auth_lookup");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    completeAuth("failure", { errorCode: "AUTH_REQUIRED", status: 401 });
    return { error: "Not authenticated" };
  }
  completeAuth("success", { userId: user.id });

  const completeProfile = startTimedStage(log, "auth.profile.ensure", {
    userId: user.id,
  });
  try {
    await ensureUserProfile(user);
    completeProfile("success");
    return { success: true };
  } catch {
    completeProfile("failure", { errorCode: "PROFILE_ENSURE_FAILED" });
    return { error: "Failed to create profile" };
  }
}

export async function signOutAction() {
  const supabase = await createClient();
  const completeSignOut = startTimedStage(log, "auth.sign_out");
  try {
    await supabase.auth.signOut();
    completeSignOut("success");
  } catch (error) {
    completeSignOut("failure", { errorCode: "SIGN_OUT_FAILED" });
    throw error;
  }
  redirect("/auth/login");
}
