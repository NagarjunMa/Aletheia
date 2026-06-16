import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockListUserResumes = vi.hoisted(() => vi.fn());
const mockUploadUserResume = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
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

function makeMultipart(file?: File): Request {
  const formData = new FormData();
  if (file) formData.append("file", file);
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

  it("POST uploads a resume and returns created metadata", async () => {
    mockUploadUserResume.mockResolvedValue({
      resume: MOCK_RESUME,
      truncated: false,
    });

    const file = new File([new Uint8Array([1, 2, 3])], "resume.pdf", {
      type: "application/pdf",
    });
    const res = await POST(makeMultipart(file) as never);

    expect(res.status).toBe(201);
    const uploadArgs = mockUploadUserResume.mock.calls[0]!;
    expect(uploadArgs[1]).toBe(MOCK_USER.id);
    expect(uploadArgs[2]).toEqual(
      expect.objectContaining({ name: "resume.pdf", type: "application/pdf" }),
    );
    expect(uploadArgs[3]).toBeUndefined();
    const body = await res.json();
    expect(body.resume).toEqual(MOCK_RESUME);
    expect(body.success).toBe(true);
  });

  it("POST rejects missing files", async () => {
    const res = await POST(makeMultipart() as never);

    expect(res.status).toBe(400);
    expect(mockUploadUserResume).not.toHaveBeenCalled();
  });

  it("POST maps resume limit failures to 409", async () => {
    mockUploadUserResume.mockRejectedValue(new Error("Resume limit exceeded"));

    const file = new File(["resume"], "resume.txt", { type: "text/plain" });
    const res = await POST(makeMultipart(file) as never);

    expect(res.status).toBe(409);
  });
});
