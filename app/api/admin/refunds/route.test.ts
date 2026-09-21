import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  review: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("@/lib/auth/refund-admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/refund-admin")>()),
  requireRefundAdmin: mocks.auth,
}));
vi.mock(
  "@/modules/refund-review/infrastructure/refund-review.repository",
  () => ({
    listRefundCases: mocks.list,
    getRefundCase: mocks.get,
    reviewRefundCase: mocks.review,
    executeReviewedRefund: mocks.execute,
  }),
);
import { RefundAdminError } from "@/lib/auth/refund-admin";
import { GET } from "./route";
import { POST, GET as detail } from "./[id]/route";
const id = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ id }) };
const request = (body: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/admin/refunds/" + id, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(id);
  mocks.list.mockResolvedValue({ items: [], hasMore: false });
  mocks.get.mockResolvedValue(null);
  mocks.review.mockResolvedValue({});
  mocks.execute.mockResolvedValue({});
});
it.each([401, 403, 503])(
  "denies reads and writes before database access (%i)",
  async (status) => {
    mocks.auth.mockRejectedValue(new RefundAdminError(status, "DENIED"));
    expect(
      (await GET(new Request("http://localhost/api/admin/refunds"))).status,
    ).toBe(status);
    expect(
      (await detail(new Request("http://localhost"), context)).status,
    ).toBe(status);
    expect(
      (
        await POST(
          request({ action: "approve", note: "Reviewed", actionId: id }),
          context,
        )
      ).status,
    ).toBe(status);
    for (const f of [mocks.list, mocks.get, mocks.review, mocks.execute])
      expect(f).not.toHaveBeenCalled();
  },
);
it("rejects cross-site writes and supplied amounts", async () => {
  expect(
    (
      await POST(
        request({ action: "approve" }, "https://evil.example"),
        context,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(
        request({
          action: "approve",
          note: "Reviewed",
          actionId: id,
          amount: 100,
        }),
        context,
      )
    ).status,
  ).toBe(400);
  expect(mocks.review).not.toHaveBeenCalled();
  expect(mocks.execute).not.toHaveBeenCalled();
});
it("persists approval before execution and reports uncertain recovery", async () => {
  mocks.execute.mockRejectedValue(new Error("PRIVATE"));
  const result = await POST(
    request({ action: "approve", note: "Reviewed", actionId: id }),
    context,
  );
  expect(result.status).toBe(503);
  expect(await result.json()).toMatchObject({
    error: "REFUND_EXECUTION_PENDING",
  });
  expect(mocks.review.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.execute.mock.invocationCallOrder[0] ?? 0,
  );
});
it.each(["comment", "reject"])("%s never executes a credit", async (action) => {
  await POST(request({ action, note: "Reviewed", actionId: id }), context);
  expect(mocks.review).toHaveBeenCalledWith(id, id, action, "Reviewed", id);
  expect(mocks.execute).not.toHaveBeenCalled();
});
it("bounds actual body bytes", async () => {
  expect(
    (await POST(request({ note: "x".repeat(9000) }), context)).status,
  ).toBe(413);
  expect(mocks.review).not.toHaveBeenCalled();
});
it("bounds list pagination and marks data uncached", async () => {
  expect(
    (await GET(new Request("http://localhost/api/admin/refunds?offset=99999")))
      .status,
  ).toBe(400);
  const result = await GET(new Request("http://localhost/api/admin/refunds"));
  expect(result.headers.get("cache-control")).toBe("no-store");
});
