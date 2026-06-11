import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";
import { createBearerAuthClient, createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { getCorsHeaders } from "@/lib/cors";

const log = createLogger("profile-parse-resume");

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_LEN = 50_000;

const ACCEPTED_MIME = new Set(["application/pdf", "text/plain"]);

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

  if (fileField.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 5 MB limit" },
      { status: 413, headers: corsHeaders },
    );
  }

  if (!ACCEPTED_MIME.has(fileField.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${fileField.type}` },
      { status: 415, headers: corsHeaders },
    );
  }

  try {
    let rawText: string;

    if (fileField.type === "text/plain") {
      rawText = await fileField.text();
    } else {
      const arrayBuf = await fileField.arrayBuffer();
      const result = await extractText(new Uint8Array(arrayBuf), {
        mergePages: false,
      });
      rawText = Array.isArray(result.text)
        ? result.text.join("")
        : String(result.text ?? "");
    }

    const truncated = rawText.length > MAX_TEXT_LEN;
    const text = truncated ? rawText.slice(0, MAX_TEXT_LEN) : rawText;

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
