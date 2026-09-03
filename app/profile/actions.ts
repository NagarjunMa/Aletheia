"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createLogger, startTimedStage } from "@/lib/logger";

const log = createLogger("profile-actions");

const ProfileUpdateSchema = z.object({
  full_name: z.string().trim().max(120).optional().default(""),
  target_job_description: z
    .string()
    .max(20_000, {
      message: "target_job_description must be 20000 chars or fewer",
    })
    .default(""),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

export type ProfileUpdateResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(
  input: ProfileUpdateInput,
): Promise<ProfileUpdateResult> {
  const parsed = ProfileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid input",
    };
  }

  const supabase = await createClient();
  const completeAuth = startTimedStage(log, "profile.settings.auth_lookup");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    completeAuth("failure", { errorCode: "AUTH_REQUIRED", status: 401 });
    return { ok: false, error: "auth required" };
  }
  completeAuth("success");

  const completeUpdate = startTimedStage(log, "profile.settings.update", {
    userId: user.id,
  });
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name || null,
      target_job_description: parsed.data.target_job_description || null,
    })
    .eq("id", user.id);

  if (error) {
    completeUpdate("failure", {
      errorCode: "PROFILE_SETTINGS_UPDATE_FAILED",
    });
    log.error(
      {
        errorCode: "PROFILE_SETTINGS_UPDATE_FAILED",
        userId: user.id.substring(0, 12),
      },
      "Profile update failed",
    );
    return {
      ok: false,
      error: "Could not save profile. Please try again.",
    };
  }
  completeUpdate("success");
  return { ok: true };
}
