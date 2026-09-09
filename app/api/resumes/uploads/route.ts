import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/cors";
import type { SafeLogger } from "@/lib/logger";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import { MAX_RESUME_BYTES, RESUME_MIME_TYPES } from "@/lib/resumes/contracts";
import {
  isResumeUploadServiceError,
  reserveResumeUpload,
} from "@/lib/resumes/upload-service";
import { createClient } from "@/lib/supabase/server";
import { formatZodDetails } from "@/lib/zod-details";

const MAX_RESERVATION_BODY_BYTES = 4_096;
const controlCharacters = /[\u0000-\u001f\u007f]/u;
const reservationSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine((value) => !controlCharacters.test(value), {
        message: "File name contains unsupported characters",
      }),
    declaredMime: z.enum(RESUME_MIME_TYPES),
    declaredSize: z.number().int().min(1).max(MAX_RESUME_BYTES),
  })
  .strict()
  .superRefine((value, context) => {
    const extension = value.fileName.split(".").pop()?.toLowerCase();
    const expected = value.declaredMime === "application/pdf" ? "pdf" : "txt";
    if (extension !== expected) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fileName"],
        message: `File name must end in .${expected}`,
      });
    }
  });

class PayloadTooLargeError extends Error {}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RESERVATION_BODY_BYTES
  ) {
    throw new PayloadTooLargeError();
  }
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESERVATION_BODY_BYTES) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

export async function POST(request: NextRequest) {
  return withRequestLifecycle("resume-upload-reservation-api", request, (log) =>
    handlePost(request, log),
  );
}

async function handlePost(request: NextRequest, log: SafeLogger) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "POST, OPTIONS",
  });
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415, headers: corsHeaders },
    );
  }

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

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof PayloadTooLargeError
            ? "Request body is too large"
            : "Invalid JSON",
      },
      {
        status: error instanceof PayloadTooLargeError ? 413 : 400,
        headers: corsHeaders,
      },
    );
  }

  const parsed = reservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: formatZodDetails(parsed.error) },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const reservation = await reserveResumeUpload(supabase, parsed.data, log);
    return NextResponse.json(reservation, {
      status: 201,
      headers: corsHeaders,
    });
  } catch (error) {
    const known = isResumeUploadServiceError(error);
    const status = known ? error.status : 503;
    const code = known ? error.code : "UPLOAD_SERVICE_UNAVAILABLE";
    log.warn(
      { errorCode: code, userId: user.id.substring(0, 12), status },
      "Resume upload reservation failed",
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
