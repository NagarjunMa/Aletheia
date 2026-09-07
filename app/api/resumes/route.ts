import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  createStatelessServiceClient,
} from "@/lib/supabase/server";
import type { SafeLogger } from "@/lib/logger";
import { getCorsHeaders } from "@/lib/cors";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import {
  listUserResumes,
  uploadUserResume,
  MAX_RESUMES_PER_USER,
} from "@/lib/resumes/service";

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
  return withRequestLifecycle("resumes-api", request, (log) =>
    handleGet(request, log),
  );
}

async function handleGet(request: NextRequest, log: SafeLogger) {
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
  } catch {
    log.error(
      { errorCode: "RESUME_LIST_FAILED", userId: user.id.substring(0, 12) },
      "Failed to list resumes",
    );
    return NextResponse.json(
      { error: "Failed to list resumes" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: NextRequest) {
  return withRequestLifecycle("resumes-api", request, (log) =>
    handlePost(request, log),
  );
}

async function handlePost(request: NextRequest, log: SafeLogger) {
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

  if (process.env.NEXT_PUBLIC_RESUME_DIRECT_UPLOAD_ENABLED !== "true") {
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
    try {
      const result = await uploadUserResume(
        supabase,
        user.id,
        file,
        undefined,
        createStatelessServiceClient(),
      );
      return NextResponse.json(
        { success: true, ...result },
        { status: 201, headers: corsHeaders },
      );
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Upload failed";
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
        {
          errorCode: "LEGACY_RESUME_UPLOAD_FAILED",
          userId: user.id.substring(0, 12),
          status,
        },
        "Legacy resume upload failed",
      );
      const publicMessage =
        status === 413
          ? "The resume must be 5 MB or smaller."
          : status === 415
            ? "Only PDF and UTF-8 TXT resumes are supported."
            : status === 409
              ? "Delete an existing resume before uploading another one."
              : status === 422
                ? "The resume does not contain enough readable text."
                : "Resume uploads are temporarily unavailable. Please try again.";
      return NextResponse.json(
        { error: publicMessage },
        { status, headers: corsHeaders },
      );
    }
  }

  log.warn(
    {
      errorCode: "LEGACY_RESUME_UPLOAD_DEPRECATED",
      userId: user.id.substring(0, 12),
      status: 410,
    },
    "Legacy multipart resume upload rejected",
  );
  return NextResponse.json(
    {
      error: "Multipart resume uploads are no longer supported.",
      code: "LEGACY_RESUME_UPLOAD_DEPRECATED",
      uploadEndpoint: "/api/resumes/uploads",
    },
    { status: 410, headers: corsHeaders },
  );
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
