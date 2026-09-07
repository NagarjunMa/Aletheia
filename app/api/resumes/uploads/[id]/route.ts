import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/cors";
import type { SafeLogger } from "@/lib/logger";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import {
  cancelResumeUpload,
  isResumeUploadServiceError,
} from "@/lib/resumes/upload-service";
import {
  createClient,
  createStatelessServiceClient,
} from "@/lib/supabase/server";
import { formatZodDetails } from "@/lib/zod-details";

const uploadIdSchema = z.string().uuid();

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withRequestLifecycle("resume-upload-cancel-api", request, (log) =>
    handleDelete(request, context, log),
  );
}

async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  log: SafeLogger,
) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "DELETE, OPTIONS",
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
    const result = await cancelResumeUpload(
      supabase,
      parsedId.data,
      createStatelessServiceClient,
      log,
    );
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    const known = isResumeUploadServiceError(error);
    const status = known ? error.status : 503;
    const code = known ? error.code : "UPLOAD_SERVICE_UNAVAILABLE";
    log.warn(
      { errorCode: code, userId: user.id.substring(0, 12), status },
      "Resume upload cancellation failed",
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
      methods: "DELETE, OPTIONS",
    }),
  });
}
