import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBearerServiceClient } from "@/lib/supabase/server";
import type { SafeLogger } from "@/lib/logger";
import { withRequestLifecycle } from "@/lib/request-lifecycle";

const feedbackSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(320),
  message: z.string().min(10).max(5000),
  rating: z.number().int().min(1).max(5).optional(),
});

function getSupabaseAdmin() {
  return createBearerServiceClient();
}

export async function POST(req: NextRequest) {
  return withRequestLifecycle("feedback", req, (log) => handlePost(req, log));
}

async function handlePost(req: NextRequest, log: SafeLogger) {
  try {
    const body = await req.json();

    // Honeypot check before schema validation — bots see silent success
    if (body?.honeypot) {
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
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
