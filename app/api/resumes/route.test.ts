import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockListUserResumes = vi.hoisted(() => vi.fn());
const mockUploadUserResume = vi.hoisted(() => vi.fn());
const mockStorageServiceClient = vi.hoisted(() => ({
  storage: { from: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
  createStatelessServiceClient: vi.fn(() => mockStorageServiceClient),
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/resumes/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/resumes/service")>();
  return {
    ...actual,
    listUserResumes: mockListUserResumes,
    uploadUserResume: mockUploadUserResume,
  };
});

import { GET, POST } from "./route";

const MOCK_USER = { id: "user-123", email: "user@example.com" };
const MOCK_RESUME = {
  id: "resume-1",
  label: "Main resume",
  file_name: "resume.pdf",
  file_mime: "application/pdf",
  file_size: 1234,
  is_primary: true,
  created_at: "2026-06-15T12:00:00Z",
  updated_at: "2026-06-15T12:00:00Z",
  parsed_text_chars: 3913,
  has_storage_file: true,
};

function makeMultipart(): Request {
  const formData = new FormData();
  formData.append("file", new File(["resume"], "private-name.txt"));
  return new Request("http://localhost:3000/api/resumes", {
    method: "POST",
    body: formData,
  });
}

describe("/api/resumes", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockListUserResumes.mockReset();
    mockUploadUserResume.mockReset();
    process.env.NEXT_PUBLIC_RESUME_DIRECT_UPLOAD_ENABLED = "true";
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("GET returns resume metadata without parsed text", async () => {
    mockListUserResumes.mockResolvedValue([MOCK_RESUME]);

    const res = await GET(makeRequest({ method: "GET" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resumes).toEqual([MOCK_RESUME]);
    expect(body.has_primary).toBe(true);
    expect(body.resumes[0]).not.toHaveProperty("parsed_text");
  });

  it("GET returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await GET(makeRequest({ method: "GET" }));

    expect(res.status).toBe(401);
  });

  it("POST returns the stable direct-upload deprecation contract", async () => {
    const request = makeMultipart();
    const formDataSpy = vi.spyOn(request, "formData");

    const res = await POST(request as never);

    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toEqual({
      error: "Multipart resume uploads are no longer supported.",
      code: "LEGACY_RESUME_UPLOAD_DEPRECATED",
      uploadEndpoint: "/api/resumes/uploads",
    });
    expect(formDataSpy).not.toHaveBeenCalled();
  });

  it("preserves the authenticated legacy transport until rollout is enabled", async () => {
    process.env.NEXT_PUBLIC_RESUME_DIRECT_UPLOAD_ENABLED = "false";
    mockUploadUserResume.mockResolvedValue({
      resume: MOCK_RESUME,
      truncated: false,
    });

    const res = await POST(makeMultipart() as never);

    expect(res.status).toBe(201);
    expect(mockUploadUserResume).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      expect.objectContaining({ name: "private-name.txt" }),
      undefined,
      mockStorageServiceClient,
    );
  });
});
