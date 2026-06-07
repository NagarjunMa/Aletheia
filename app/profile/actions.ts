"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("profile-actions");

const ProfileUpdateSchema = z.object({
  full_name: z.string().trim().max(120).optional().default(""),
  resume: z
    .string()
    .max(50_000, { message: "resume must be 50000 chars or fewer" })
    .default(""),
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
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: "auth required" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name || null,
      resume: parsed.data.resume || null,
      target_job_description: parsed.data.target_job_description || null,
      resume_updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    log.error(
      { err: error.message, userId: user.id.substring(0, 12) },
      "Profile update failed",
    );
    return {
      ok: false,
      error: "Could not save profile. Please try again.",
    };
  }
  return { ok: true };
}
