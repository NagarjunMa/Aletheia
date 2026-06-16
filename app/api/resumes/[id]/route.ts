import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { getCorsHeaders } from "@/lib/cors";
import {
  deleteUserResume,
  renameUserResume,
  setPrimaryUserResume,
} from "@/lib/resumes/service";

const log = createLogger("resume-detail-api");

const patchSchema = z
  .object({
    label: z.string().trim().min(1).max(120).optional(),
    is_primary: z.boolean().optional(),
  })
  .refine((value) => value.label !== undefined || value.is_primary === true, {
    message: "Provide label or is_primary=true",
  });

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, error };
  }

  return { supabase, user, error: null };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "PATCH, DELETE, OPTIONS",
  });

  const { id } = await params;
  const { supabase, user, error } = await requireUser();
  if (error || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const resume = parsed.data.is_primary
      ? await setPrimaryUserResume(supabase, user.id, id)
      : await renameUserResume(supabase, user.id, id, parsed.data.label ?? "");

    return NextResponse.json(
      { success: true, resume },
      { headers: corsHeaders },
    );
  } catch (err) {
    log.warn(
      { err, userId: user.id.substring(0, 12), resumeId: id },
      "Resume update failed",
    );
    return NextResponse.json(
      { error: "Failed to update resume" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "PATCH, DELETE, OPTIONS",
  });

  const { id } = await params;
  const { supabase, user, error } = await requireUser();
  if (error || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  try {
    const result = await deleteUserResume(supabase, user.id, id);
    return NextResponse.json(
      { success: true, ...result },
      { headers: corsHeaders },
    );
  } catch (err) {
    log.warn(
      { err, userId: user.id.substring(0, 12), resumeId: id },
      "Resume delete failed",
    );
    return NextResponse.json(
      { error: "Failed to delete resume" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request, {
      allowCredentials: true,
      methods: "PATCH, DELETE, OPTIONS",
    }),
  });
}
