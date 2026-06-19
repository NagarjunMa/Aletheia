import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/cors";

const DEPRECATED_MESSAGE =
  "Resume parsing has moved to /api/resumes. Upload resumes from the dashboard.";

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: DEPRECATED_MESSAGE,
      code: "RESUME_PARSE_DEPRECATED",
    },
    {
      status: 410,
      headers: getCorsHeaders(request, {
        allowCredentials: true,
        methods: "POST, OPTIONS",
      }),
    },
  );
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
