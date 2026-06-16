import { NextRequest, NextResponse } from "next/server";
import { createBearerAuthClient, createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { getCorsHeaders } from "@/lib/cors";
import { parseResumeFile, validateResumeFile } from "@/lib/resumes/parser";

const log = createLogger("profile-parse-resume");

async function authenticateRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const accessToken = authHeader.slice(7);
    return createBearerAuthClient().auth.getUser(accessToken);
  }

  const supabase = await createClient();
  return supabase.auth.getUser();
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "POST, OPTIONS",
  });

  const authResult = await authenticateRequest(request);
  const user = authResult?.data?.user ?? null;
  const authError = authResult?.error;

  if (authError || !user) {
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

  const fileField = formData.get("file");
  if (!(fileField instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' field" },
      { status: 400, headers: corsHeaders },
    );
  }

  const validationError = validateResumeFile(fileField);
  if (validationError?.includes("5 MB")) {
    return NextResponse.json(
      { error: validationError },
      { status: 413, headers: corsHeaders },
    );
  }

  if (validationError) {
    return NextResponse.json(
      { error: validationError },
      { status: 415, headers: corsHeaders },
    );
  }

  try {
    const { text, truncated } = await parseResumeFile(fileField);

    log.info(
      {
        userId: user.id.substring(0, 12),
        mime: fileField.type,
        bytes: fileField.size,
        outputChars: text.length,
        truncated,
      },
      "Resume parsed",
    );

    return NextResponse.json({ text, truncated }, { headers: corsHeaders });
  } catch (err) {
    log.error({ err }, "Failed to extract resume text");
    return NextResponse.json(
      { error: "Failed to parse file" },
      { status: 422, headers: corsHeaders },
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
