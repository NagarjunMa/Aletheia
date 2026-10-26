import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBearerServiceClient } from "@/lib/supabase/server";
import type { SafeLogger } from "@/lib/logger";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import { checkFeedbackAdmission } from "@/lib/feedback/admission";

const feedbackSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(320),
  message: z.string().min(10).max(5000),
  rating: z.number().int().min(1).max(5).optional(),
});

function getSupabaseAdmin() {
  return createBearerServiceClient();
}

class FeedbackBodyTooLarge extends Error {}

async function readFeedbackBody(request: Request): Promise<unknown> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 24 * 1024) {
        await reader.cancel();
        throw new FeedbackBodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
  );
}

export async function POST(req: NextRequest) {
  return withRequestLifecycle("feedback", req, (log) => handlePost(req, log));
}

async function handlePost(req: NextRequest, log: SafeLogger) {
  try {
    const body = await readFeedbackBody(req);

    // Honeypot check before schema validation — bots see silent success
    if (
      body &&
      typeof body === "object" &&
      "honeypot" in body &&
      body.honeypot
    ) {
      log.info("Honeypot triggered — bot submission discarded");
      return NextResponse.json({ success: true });
    }

    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      log.info(
        {
          invalidFieldCount: Object.keys(parsed.error.flatten().fieldErrors)
            .length,
        },
        "Feedback validation failed",
      );
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const admission = await checkFeedbackAdmission(req);
    if (!admission.allowed) {
      const unavailable = admission.unavailable;
      log.warn(
        {
          errorCode: unavailable
            ? "FEEDBACK_ADMISSION_UNAVAILABLE"
            : "FEEDBACK_LIMIT_REACHED",
        },
        "Feedback admission denied",
      );
      return NextResponse.json(
        {
          error: unavailable
            ? "Feedback is temporarily unavailable"
            : "Too many feedback submissions",
          code: unavailable ? "FEEDBACK_UNAVAILABLE" : "FEEDBACK_LIMIT_REACHED",
        },
        {
          status: unavailable ? 503 : 429,
          ...(unavailable
            ? {}
            : {
                headers: {
                  "Retry-After": String(
                    Math.max(
                      1,
                      Math.ceil((admission.retryTime - Date.now()) / 1000),
                    ),
                  ),
                },
              }),
        },
      );
    }
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("feedback").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
      rating: parsed.data.rating ?? null,
      page_url: req.headers.get("referer") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    if (error) {
      log.error(
        { errorCode: "FEEDBACK_INSERT_FAILED" },
        "Feedback insert error",
      );
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 },
      );
    }

    log.info({ rating: parsed.data.rating ?? null }, "Feedback submitted");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof FeedbackBodyTooLarge) {
      return NextResponse.json(
        { error: "Feedback request is too large" },
        { status: 413 },
      );
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
