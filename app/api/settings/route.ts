import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { settingsSchema } from "./schema";

const log = createLogger("settings-api");

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    log.info({ err: authError?.message }, "Unauthenticated settings request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.debug(
    { userId: user.id.substring(0, 8) },
    "Authenticated settings request",
  );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    log.info(
      {
        userId: user.id.substring(0, 8),
        errors: parsed.error.flatten().fieldErrors,
      },
      "Settings validation failed",
    );
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { reset_style, ...prefs } = parsed.data;

  const upsertData: Record<string, unknown> = {
    user_id: user.id,
    ...prefs,
  };

  if (reset_style) {
    upsertData.style_patterns = null;
    upsertData.approved_message_count = 0;
    upsertData.rejected_message_count = 0;
    log.info({ userId: user.id }, "Resetting user style profile");
  }

  const { data, error } = await supabase
    .from("user_preferences")
    // eslint-disable-next-line
    .upsert(upsertData as never, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    log.error({ err: error.message }, "Failed to update user preferences");
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }

  log.info(
    { userId: user.id.substring(0, 8), resetStyle: reset_style ?? false },
    "Settings updated",
  );
  return NextResponse.json({ success: true, preferences: data });
}
