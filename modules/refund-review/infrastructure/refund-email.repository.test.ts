import { afterEach, expect, it, vi } from "vitest";
import { sendRefundEmail } from "./refund-email.repository";
const id = "22222222-2222-4222-8222-222222222222";
const payload = {
  from: "receipts@example.com",
  to: ["customer@example.com"],
  subject: "Your restored Aletheia credits",
  text: "4 application credits were restored.",
};
afterEach(() => vi.unstubAllGlobals());
it("uses the receipt ID for idempotency and sends only the frozen payload", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  expect(await sendRefundEmail(id, payload, "test-key")).toBe(id);
  expect(fetcher).toHaveBeenCalledWith(
    "https://api.resend.com/emails",
    expect.objectContaining({
      headers: expect.objectContaining({
        "Idempotency-Key": `refund-receipt/${id}`,
      }),
      body: JSON.stringify(payload),
    }),
  );
});
it("does not expose provider errors or retry inside the adapter", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response("PRIVATE", { status: 500 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(sendRefundEmail(id, payload, "test-key")).rejects.toThrow(
    "EMAIL_UNCONFIRMED",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
