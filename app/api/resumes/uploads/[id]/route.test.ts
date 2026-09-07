import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockCreateServiceClient = vi.hoisted(() => vi.fn());
const mockCancelResumeUpload = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createStatelessServiceClient: mockCreateServiceClient,
}));
vi.mock("@/lib/resumes/upload-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/resumes/upload-service")>();
  return { ...actual, cancelResumeUpload: mockCancelResumeUpload };
});

import { DELETE } from "./route";

const USER = { id: "00000000-0000-4000-8000-000000000001" };
const UPLOAD_ID = "00000000-0000-4000-8000-000000000002";
const PARAMS = { params: Promise.resolve({ id: UPLOAD_ID }) };

describe("DELETE /api/resumes/uploads/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
  });

  it("passes a lazy privileged-client factory to owner-scoped cancellation", async () => {
    mockCancelResumeUpload.mockResolvedValue({
      status: "canceled",
      uploadId: UPLOAD_ID,
    });
    const response = await DELETE(makeRequest({ method: "DELETE" }), PARAMS);
    expect(response.status).toBe(200);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
    expect(mockCancelResumeUpload).toHaveBeenCalledWith(
      expect.anything(),
      UPLOAD_ID,
      mockCreateServiceClient,
      expect.anything(),
    );
  });

  it("rejects unauthenticated callers before cancellation", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await DELETE(makeRequest({ method: "DELETE" }), PARAMS);
    expect(response.status).toBe(401);
    expect(mockCancelResumeUpload).not.toHaveBeenCalled();
  });

  it("rejects invalid upload IDs", async () => {
    const response = await DELETE(makeRequest({ method: "DELETE" }), {
      params: Promise.resolve({ id: "invalid" }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      details: [{ field: "id", message: expect.any(String) }],
    });
    expect(mockCancelResumeUpload).not.toHaveBeenCalled();
  });

  it("maps invalid cancellation states without exposing database errors", async () => {
    const { ResumeUploadServiceError } =
      await import("@/lib/resumes/upload-service");
    mockCancelResumeUpload.mockRejectedValue(
      new ResumeUploadServiceError(
        "INVALID_UPLOAD_STATE",
        409,
        "This resume upload cannot be canceled.",
      ),
    );
    const response = await DELETE(makeRequest({ method: "DELETE" }), PARAMS);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "This resume upload cannot be canceled.",
      code: "INVALID_UPLOAD_STATE",
    });
  });

  it("does not expose unexpected cancellation errors", async () => {
    mockCancelResumeUpload.mockRejectedValue(
      new Error("private database response"),
    );
    const response = await DELETE(makeRequest({ method: "DELETE" }), PARAMS);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Resume uploads are temporarily unavailable. Please try again.",
      code: "UPLOAD_SERVICE_UNAVAILABLE",
    });
  });
});
