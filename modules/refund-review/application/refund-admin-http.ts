import { NextResponse } from "next/server";
import { z } from "zod";
import { RefundAdminError } from "@/lib/auth/refund-admin";
export function adminJson(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function adminError(error: unknown) {
  if (error instanceof RefundAdminError)
    return adminJson({ error: error.message }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return adminJson({ error: "INVALID_REQUEST" }, 400);
  return adminJson({ error: "REFUND_OPERATION_UNAVAILABLE" }, 503);
}
export function requireSameOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (
    !configured ||
    request.headers.get("origin") !== new URL(configured).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new RefundAdminError(403, "INVALID_ORIGIN");
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new RefundAdminError(415, "JSON_REQUIRED");
}
/** Bound actual bytes; Content-Length is not trusted. */
export async function readReviewBody(request: Request): Promise<unknown> {
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 8192) {
        await reader.cancel();
        throw new RefundAdminError(413, "BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
