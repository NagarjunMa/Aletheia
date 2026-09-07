import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockReserveResumeUpload = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}));
vi.mock("@/lib/resumes/upload-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/resumes/upload-service")>();
  return { ...actual, reserveResumeUpload: mockReserveResumeUpload };
});

import { POST } from "./route";

const USER = { id: "00000000-0000-4000-8000-000000000001" };
const VALID_BODY = {
  fileName: "resume.pdf",
  declaredMime: "application/pdf",
  declaredSize: 1024,
};

describe("POST /api/resumes/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
  });

  it("authenticates before reserving an upload", async () => {
    mockReserveResumeUpload.mockResolvedValue({ uploadId: "upload-1" });
    const response = await POST(
      makeRequest({ method: "POST", body: VALID_BODY }),
    );
    expect(response.status).toBe(201);
    expect(mockReserveResumeUpload).toHaveBeenCalledWith(
      expect.anything(),
      VALID_BODY,
    );
  });

  it("rejects unauthenticated requests", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await POST(
      makeRequest({ method: "POST", body: VALID_BODY }),
    );
    expect(response.status).toBe(401);
    expect(mockReserveResumeUpload).not.toHaveBeenCalled();
  });

  it("returns field details for mismatched extensions and oversized metadata", async () => {
    const response = await POST(
      makeRequest({
        method: "POST",
        body: {
          ...VALID_BODY,
          fileName: "resume.txt",
          declaredSize: 5_242_881,
        },
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "fileName" }),
        expect.objectContaining({ field: "declaredSize" }),
      ]),
    );
  });

  it("rejects request bodies over the reservation payload limit", async () => {
    const response = await POST(
      makeRequest({
        method: "POST",
        body: { ...VALID_BODY, unexpected: "x".repeat(5_000) },
      }),
    );
    expect(response.status).toBe(413);
    expect(mockReserveResumeUpload).not.toHaveBeenCalled();
  });

  it("maps stable service errors", async () => {
    const { ResumeUploadServiceError } =
      await import("@/lib/resumes/upload-service");
    mockReserveResumeUpload.mockRejectedValue(
      new ResumeUploadServiceError(
        "ACTIVE_UPLOAD_LIMIT_REACHED",
        409,
        "Finish an upload first.",
      ),
    );
    const response = await POST(
      makeRequest({ method: "POST", body: VALID_BODY }),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "ACTIVE_UPLOAD_LIMIT_REACHED",
    });
  });

  it("maps unexpected reservation failures without exposing provider errors", async () => {
    mockReserveResumeUpload.mockRejectedValue(
      new Error("private database connection details"),
    );
    const response = await POST(
      makeRequest({ method: "POST", body: VALID_BODY }),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Resume uploads are temporarily unavailable. Please try again.",
      code: "UPLOAD_SERVICE_UNAVAILABLE",
    });
  });
});
