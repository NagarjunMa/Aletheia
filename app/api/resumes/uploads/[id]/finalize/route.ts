import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/cors";
import type { SafeLogger } from "@/lib/logger";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import {
  finalizeResumeUpload,
  isResumeUploadServiceError,
} from "@/lib/resumes/upload-service";
import {
  createClient,
  createStatelessServiceClient,
} from "@/lib/supabase/server";
import { formatZodDetails } from "@/lib/zod-details";

const uploadIdSchema = z.string().uuid();

async function hasNonEmptyRequestBody(request: NextRequest) {
  if (request.body === null) return false;

  const reader = request.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return false;
      if (value.byteLength > 0) return true;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withRequestLifecycle("resume-upload-finalize-api", request, (log) =>
    handlePost(request, context, log),
  );
}

async function handlePost(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  log: SafeLogger,
) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "POST, OPTIONS",
  });
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  if (await hasNonEmptyRequestBody(request)) {
    return NextResponse.json(
      { error: "Request body must be empty" },
      { status: 400, headers: corsHeaders },
    );
  }

  const parsedId = uploadIdSchema.safeParse((await params).id);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        error: "Invalid upload ID",
        details: formatZodDetails(parsedId.error, "id"),
      },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const result = await finalizeResumeUpload(
      supabase,
      createStatelessServiceClient,
      user.id,
      parsedId.data,
      log,
    );
    return NextResponse.json(result, {
      status:
        result.status === "failed"
          ? 503
          : result.status === "rejected"
            ? 422
            : 200,
      headers: corsHeaders,
    });
  } catch (error) {
    const known = isResumeUploadServiceError(error);
    const status = known ? error.status : 503;
    const code = known ? error.code : "UPLOAD_SERVICE_UNAVAILABLE";
    log.warn(
      { errorCode: code, userId: user.id.substring(0, 12), status },
      "Resume upload finalization failed",
    );
    return NextResponse.json(
      {
        error: known
          ? error.message
          : "Resume uploads are temporarily unavailable. Please try again.",
        code,
      },
      { status, headers: corsHeaders },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request, {
      allowCredentials: true,
      methods: "POST, OPTIONS",
    }),
  });
}
