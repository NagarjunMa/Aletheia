import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

const mockCleanupExpiredResumeUploads = vi.hoisted(() => vi.fn());
const mockCreateServiceClient = vi.hoisted(() =>
  vi.fn(() => ({ service: true })),
);

vi.mock("@/lib/supabase/server", () => ({
  createStatelessServiceClient: mockCreateServiceClient,
}));
vi.mock("@/lib/resumes/upload-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/resumes/upload-service")>();
  return {
    ...actual,
    cleanupExpiredResumeUploads: mockCleanupExpiredResumeUploads,
  };
});

import { GET } from "./route";

describe("GET /api/internal/resumes/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "a-secure-test-secret";
  });

  it("rejects a missing or invalid cron secret before privileged access", async () => {
    const missing = await GET(makeRequest({ method: "GET" }));
    const invalid = await GET(
      makeRequest({
        method: "GET",
        headers: { authorization: "Bearer wrong" },
      }),
    );

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
    expect(mockCleanupExpiredResumeUploads).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(
      makeRequest({
        method: "GET",
        headers: { authorization: "Bearer undefined" },
      }),
    );

    expect(response.status).toBe(503);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it("runs one bounded cleanup batch for an authenticated invocation", async () => {
    mockCleanupExpiredResumeUploads.mockResolvedValue({
      claimed: 2,
      removed: 2,
    });
    const response = await GET(
      makeRequest({
        method: "GET",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockCleanupExpiredResumeUploads).toHaveBeenCalledWith(
      expect.anything(),
      100,
      expect.anything(),
    );
    await expect(response.json()).resolves.toEqual({
      success: true,
      claimed: 2,
      removed: 2,
      saturated: false,
    });
  });

  it("returns a stable retryable response without exposing provider errors", async () => {
    mockCleanupExpiredResumeUploads.mockRejectedValue(
      new Error("private storage path and provider details"),
    );
    const response = await GET(
      makeRequest({
        method: "GET",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: "RESUME_CLEANUP_FAILED",
    });
  });

  it("caps cleanup at five batches even while every batch is full", async () => {
    mockCleanupExpiredResumeUploads.mockResolvedValue({
      claimed: 100,
      removed: 100,
    });
    const response = await GET(
      makeRequest({
        method: "GET",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockCleanupExpiredResumeUploads).toHaveBeenCalledTimes(5);
    await expect(response.json()).resolves.toEqual({
      success: true,
      claimed: 500,
      removed: 500,
      saturated: true,
    });
  });
});
