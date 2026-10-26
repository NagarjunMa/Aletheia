import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createBearerServiceClient: () => ({ rpc }),
}));
import { checkFeedbackAdmission } from "./admission";

beforeEach(() => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("NODE_ENV", "production");
  rpc.mockReset().mockResolvedValue({ data: [{ allowed: true }], error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("shared public feedback admission", () => {
  const request = (headers: Record<string, string> = {}) =>
    new Request("https://example.test/api/feedback", { headers });
  it("uses only the trusted Vercel IP and sends a keyed hash, never raw personal data", async () => {
    const headers = {
      "x-vercel-forwarded-for": "192.0.2.1",
      "x-forwarded-for": "198.51.100.1",
    };
    expect(await checkFeedbackAdmission(request(headers))).toEqual({
      allowed: true,
    });
    const first = rpc.mock.calls[0]?.[1];
    await checkFeedbackAdmission(
      request({ ...headers, "x-forwarded-for": "203.0.113.2" }),
    );
    expect(rpc.mock.calls[1]?.[1]).toEqual(first);
    expect(first).toEqual({
      p_subject_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(
      /192\.0\.2|198\.51\.100|203\.0\.113|test-service-key/,
    );
  });
  it.each([
    {},
    { "x-forwarded-for": "192.0.2.1" },
    { "x-vercel-forwarded-for": "192.0.2.1, 203.0.113.1" },
  ])("fails closed without a trustworthy single IP: %j", async (headers) => {
    expect(await checkFeedbackAdmission(request(headers))).toEqual({
      allowed: false,
      unavailable: true,
    });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not trust forwarded headers outside the Vercel production boundary", async () => {
    vi.stubEnv("VERCEL", "");
    expect(
      await checkFeedbackAdmission(
        request({ "x-vercel-forwarded-for": "192.0.2.1" }),
      ),
    ).toEqual({ allowed: false, unavailable: true });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("keeps a genuine limit separate from a database error or malformed response", async () => {
    const req = () => request({ "x-vercel-forwarded-for": "192.0.2.1" });
    rpc.mockResolvedValueOnce({
      data: [{ allowed: false, retry_time: "2026-11-01T00:00:00Z" }],
      error: null,
    });
    expect(await checkFeedbackAdmission(req())).toEqual({
      allowed: false,
      unavailable: false,
      retryTime: Date.parse("2026-11-01T00:00:00Z"),
    });
    for (const response of [
      { data: null, error: { message: "private" } },
      { data: [{ allowed: false, retry_time: "invalid" }], error: null },
    ]) {
      rpc.mockResolvedValueOnce(response);
      expect(await checkFeedbackAdmission(req())).toEqual({
        allowed: false,
        unavailable: true,
      });
    }
    rpc.mockRejectedValueOnce(new Error("private"));
    expect(await checkFeedbackAdmission(req())).toEqual({
      allowed: false,
      unavailable: true,
    });
  });
});
