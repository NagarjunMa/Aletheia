import { z } from "zod";
export const refundEmailPayloadSchema = z
  .object({
    from: z.string().email().max(254),
    to: z.array(z.string().email().max(254)).length(1),
    subject: z.string().min(1).max(100),
    text: z.string().min(1).max(2000),
  })
  .strict();
export type RefundEmailPayload = z.infer<typeof refundEmailPayloadSchema>;
/** One attempt only. The durable outbox owns retry timing and uncertainty. */
export async function sendRefundEmail(
  id: string,
  payload: RefundEmailPayload,
  key: string,
): Promise<string> {
  z.string().uuid().parse(id);
  refundEmailPayloadSchema.parse(payload);
  if (!key) throw new Error("EMAIL_NOT_CONFIGURED");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `refund-receipt/${id}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 8192) {
          await reader.cancel();
          throw new Error();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return z
      .object({ id: z.string().uuid() })
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8"))).id;
  } catch {
    throw new Error("EMAIL_UNCONFIRMED");
  }
}
