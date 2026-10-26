export type FeedbackAdmission =
  | { allowed: true }
  | { allowed: false; unavailable: true }
  | { allowed: false; unavailable: false; retryTime: number };

export async function checkFeedbackAdmission(
  request: Request,
): Promise<FeedbackAdmission> {
  try {
    // Vercel overwrites this header. Never trust caller-provided forwarding
    // headers on an arbitrary self-hosted production server.
    const address =
      process.env.VERCEL === "1"
        ? request.headers.get("x-vercel-forwarded-for")?.trim()
        : process.env.NODE_ENV !== "production"
          ? "local-development"
          : undefined;
    if (!address || (process.env.VERCEL === "1" && !isIP(address))) {
      return { allowed: false, unavailable: true };
    }
    const secret =
      process.env.FEEDBACK_RATE_LIMIT_SECRET ??
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) return { allowed: false, unavailable: true };
    const subject = createHmac("sha256", secret)
      .update(`public-feedback:${address}`)
      .digest("hex");
    const { data, error } = await createBearerServiceClient().rpc(
      "reserve_public_feedback_slot",
      { p_subject_hash: subject },
    );
    const row = data?.[0];
    if (error || !row) return { allowed: false, unavailable: true };
    if (row.allowed === true) return { allowed: true };
    const retryTime = new Date(row.retry_time).getTime();
    return row.allowed === false && Number.isFinite(retryTime)
      ? { allowed: false, unavailable: false, retryTime }
      : { allowed: false, unavailable: true };
  } catch {
    return { allowed: false, unavailable: true };
  }
}
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createBearerServiceClient } from "@/lib/supabase/server";
