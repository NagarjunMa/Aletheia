import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockCreateServiceClient = vi.hoisted(() =>
  vi.fn(() => ({ service: true })),
);
const mockFinalizeResumeUpload = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createStatelessServiceClient: mockCreateServiceClient,
}));
vi.mock("@/lib/resumes/upload-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/resumes/upload-service")>();
  return { ...actual, finalizeResumeUpload: mockFinalizeResumeUpload };
});

import { POST } from "./route";

const USER = { id: "00000000-0000-4000-8000-000000000001" };
const UPLOAD_ID = "00000000-0000-4000-8000-000000000002";
const PARAMS = { params: Promise.resolve({ id: UPLOAD_ID }) };

describe("POST /api/resumes/uploads/[id]/finalize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
  });

  it("authenticates and passes a lazy privileged-client factory", async () => {
    mockFinalizeResumeUpload.mockResolvedValue({
      status: "ready",
      uploadId: UPLOAD_ID,
      resumeId: "resume-1",
      qualityCodes: [],
      metrics: { pageCount: null, characterCount: 400 },
    });
    const response = await POST(makeRequest({ method: "POST" }), PARAMS);
    expect(response.status).toBe(200);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
    expect(mockFinalizeResumeUpload).toHaveBeenCalledWith(
      expect.anything(),
      mockCreateServiceClient,
      USER.id,
      UPLOAD_ID,
      expect.anything(),
    );
  });

  it("does not create a privileged client for unauthenticated callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await POST(makeRequest({ method: "POST" }), PARAMS);
    expect(response.status).toBe(401);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it("rejects invalid upload IDs before privileged access", async () => {
    const response = await POST(makeRequest({ method: "POST" }), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      details: [{ field: "id", message: expect.any(String) }],
    });
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it("rejects request bodies because finalization is metadata-free", async () => {
    const response = await POST(
      makeRequest({ method: "POST", body: { file: "not-accepted" } }),
      PARAMS,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be empty",
    });
    expect(mockFinalizeResumeUpload).not.toHaveBeenCalled();
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it("returns retryable processing failures with 503", async () => {
    mockFinalizeResumeUpload.mockResolvedValue({
      status: "failed",
      uploadId: UPLOAD_ID,
      code: "TEMPORARY_PROCESSING_FAILURE",
      message: "Please retry.",
      retryable: true,
    });
    const response = await POST(makeRequest({ method: "POST" }), PARAMS);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ retryable: true });
  });

  it("maps owner-scoped service errors to stable API responses", async () => {
    const { ResumeUploadServiceError } =
      await import("@/lib/resumes/upload-service");
    mockFinalizeResumeUpload.mockRejectedValue(
      new ResumeUploadServiceError(
        "UPLOAD_NOT_FOUND",
        404,
        "Resume upload not found.",
      ),
    );
    const response = await POST(makeRequest({ method: "POST" }), PARAMS);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Resume upload not found.",
      code: "UPLOAD_NOT_FOUND",
    });
  });

  it("does not expose unexpected finalization errors", async () => {
    mockFinalizeResumeUpload.mockRejectedValue(
      new Error("private storage response"),
    );
    const response = await POST(makeRequest({ method: "POST" }), PARAMS);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Resume uploads are temporarily unavailable. Please try again.",
      code: "UPLOAD_SERVICE_UNAVAILABLE",
    });
  });
});
