import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { getCorsHeaders } from "@/lib/cors";
import {
  listUserResumes,
  uploadUserResume,
  MAX_RESUMES_PER_USER,
} from "@/lib/resumes/service";

const log = createLogger("resumes-api");

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

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "GET, POST, OPTIONS",
  });

  const { supabase, user, error } = await requireUser();
  if (error || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  try {
    const resumes = await listUserResumes(supabase, user.id);
    return NextResponse.json(
      {
        resumes,
        count: resumes.length,
        max: MAX_RESUMES_PER_USER,
        has_primary: resumes.some((resume) => resume.is_primary),
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    log.error(
      { err, userId: user.id.substring(0, 12) },
      "Failed to list resumes",
    );
    return NextResponse.json(
      { error: "Failed to list resumes" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "GET, POST, OPTIONS",
  });

  const { supabase, user, error } = await requireUser();
  if (error || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart body" },
      { status: 400, headers: corsHeaders },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' field" },
      { status: 400, headers: corsHeaders },
    );
  }

  const label = formData.get("label");

  try {
    const result = await uploadUserResume(
      supabase,
      user.id,
      file,
      typeof label === "string" ? label : undefined,
    );

    log.info(
      {
        userId: user.id.substring(0, 12),
        mime: file.type,
        bytes: file.size,
        outputChars: result.resume.parsed_text_chars,
        truncated: result.truncated,
      },
      "Resume uploaded",
    );

    return NextResponse.json(
      { success: true, ...result },
      { status: 201, headers: corsHeaders },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = message.includes("5 MB")
      ? 413
      : message.includes("Unsupported")
        ? 415
        : message.includes("limit")
          ? 409
          : message.includes("extractable")
            ? 422
            : 500;

    log.warn(
      { err: message, userId: user.id.substring(0, 12), status },
      "Resume upload failed",
    );

    return NextResponse.json(
      { error: message },
      { status, headers: corsHeaders },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request, {
      allowCredentials: true,
      methods: "GET, POST, OPTIONS",
    }),
  });
}
