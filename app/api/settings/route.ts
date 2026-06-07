import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { getCorsHeaders } from "@/lib/cors";
import { settingsSchema } from "./schema";

const log = createLogger("settings-api");

export async function PATCH(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "GET, PATCH, OPTIONS",
  });

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    log.info({ err: authError?.message }, "Unauthenticated settings request");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  log.debug(
    { userId: user.id.substring(0, 8) },
    "Authenticated settings request",
  );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders },
    );
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
      { status: 400, headers: corsHeaders },
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
    .upsert(upsertData as never, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    log.error({ err: error.message }, "Failed to update user preferences");
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500, headers: corsHeaders },
    );
  }

  log.info(
    { userId: user.id.substring(0, 8), resetStyle: reset_style ?? false },
    "Settings updated",
  );
  return NextResponse.json(
    { success: true, preferences: data },
    { headers: corsHeaders },
  );
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "GET, PATCH, OPTIONS",
  });

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    log.info({ err: authError?.message }, "Unauthenticated GET /api/settings");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  log.debug(
    { userId: user.id.substring(0, 8) },
    "GET /api/settings — fetching profile resume/JD",
  );

  const { data, error } = await supabase
    .from("profiles")
    .select("resume, target_job_description, resume_updated_at")
    .eq("id", user.id)
    .single();

  if (error) {
    log.error({ err: error.message }, "Failed to fetch profile resume/JD");
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    {
      resume: data?.resume ?? null,
      target_job_description: data?.target_job_description ?? null,
      resume_updated_at: data?.resume_updated_at ?? null,
    },
    { headers: corsHeaders },
  );
}

export async function OPTIONS(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "GET, PATCH, OPTIONS",
  });
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
