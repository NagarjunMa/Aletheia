import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export class RefundAdminError extends Error {
  constructor(
    public readonly status: number,
    code: string,
  ) {
    super(code);
  }
}
/** Server configuration, never a client claim or billing exemption. */
export async function requireRefundAdmin(): Promise<string> {
  const configured = z
    .array(z.string().uuid())
    .min(1)
    .max(10)
    .safeParse(
      (process.env.REFUND_ADMIN_USER_IDS ?? "").split(",").map((v) => v.trim()),
    );
  if (!configured.success)
    throw new RefundAdminError(503, "REFUND_ADMIN_NOT_CONFIGURED");
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) throw new RefundAdminError(401, "AUTH_REQUIRED");
    if (user.is_anonymous || !configured.data.includes(user.id))
      throw new RefundAdminError(403, "REFUND_ADMIN_FORBIDDEN");
    return user.id;
  } catch (error) {
    if (error instanceof RefundAdminError) throw error;
    throw new RefundAdminError(503, "REFUND_ADMIN_UNAVAILABLE");
  }
}
