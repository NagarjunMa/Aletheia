import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
}));
import { requireRefundAdmin } from "./refund-admin";
const id = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.stubEnv("REFUND_ADMIN_USER_IDS", id);
  auth.getUser.mockResolvedValue({
    data: { user: { id, is_anonymous: false } },
    error: null,
  });
});
afterEach(() => vi.unstubAllEnvs());
it("authorizes only a server-verified configured account", async () => {
  expect(await requireRefundAdmin()).toBe(id);
  expect(auth.getUser).toHaveBeenCalled();
});
it.each(["", "*", "bad-id", id + ",bad-id"])(
  "fails closed for invalid config %s",
  async (value) => {
    vi.stubEnv("REFUND_ADMIN_USER_IDS", value);
    await expect(requireRefundAdmin()).rejects.toThrow();
  },
);
it("does not trust user metadata or an unlimited billing email", async () => {
  auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: "33333333-3333-4333-8333-333333333333",
        email: "nagarjunmallesh@gmail.com",
        user_metadata: { admin: true },
      },
    },
    error: null,
  });
  await expect(requireRefundAdmin()).rejects.toThrow();
});
it.each([
  { data: { user: null }, error: null },
  { data: { user: { id } }, error: {} },
  { data: { user: { id, is_anonymous: true } }, error: null },
])("denies invalid authentication", async (result) => {
  auth.getUser.mockResolvedValue(result);
  await expect(requireRefundAdmin()).rejects.toThrow();
});
it("does not expose authentication errors", async () => {
  auth.getUser.mockRejectedValue(new Error("SECRET"));
  await expect(requireRefundAdmin()).rejects.toThrow(
    "REFUND_ADMIN_UNAVAILABLE",
  );
});
