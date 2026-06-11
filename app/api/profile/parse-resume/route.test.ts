import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthGetUser = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { user: { id: "test-user-id" } },
    error: null,
  })),
);
const mockBearerAuthGetUser = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { user: { id: "test-user-id" } },
    error: null,
  })),
);
const mockExtractText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockAuthGetUser },
  })),
  createBearerAuthClient: vi.fn(() => ({
    auth: { getUser: mockBearerAuthGetUser },
  })),
}));

vi.mock("unpdf", () => ({
  extractText: mockExtractText,
}));

vi.mock("@/lib/cors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cors")>();
  return {
    ...actual,
    getCorsHeaders: vi.fn(actual.getCorsHeaders),
  };
});

import { POST } from "./route";

function makeMultipartRequest(opts: {
  file?: { name: string; type: string; size: number; bytes?: Uint8Array };
  bearer?: boolean;
}): Request {
  const formData = new FormData();
  if (opts.file) {
    const content = opts.file.bytes ?? new Uint8Array(opts.file.size);
    const blob = new Blob([content as BlobPart], { type: opts.file.type });
    formData.append(
      "file",
      new File([blob], opts.file.name, { type: opts.file.type }),
    );
  }
  const headers: Record<string, string> = {};
  if (opts.bearer) headers.authorization = "Bearer test";
  return new Request("http://localhost:3000/api/profile/parse-resume", {
    method: "POST",
    headers,
    body: formData,
  });
}

describe("POST /api/profile/parse-resume", () => {
  beforeEach(() => {
    mockAuthGetUser.mockClear();
    mockBearerAuthGetUser.mockClear();
    mockExtractText.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as never);
    const res = await POST(
      makeMultipartRequest({
        file: { name: "x.pdf", type: "application/pdf", size: 100 },
      }) as never,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file field", async () => {
    const res = await POST(makeMultipartRequest({ bearer: true }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/file/i);
  });

  it("returns 413 when file exceeds 5 MB", async () => {
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: {
          name: "huge.pdf",
          type: "application/pdf",
          size: 5 * 1024 * 1024 + 1,
        },
      }) as never,
    );
    expect(res.status).toBe(413);
  });

  it("returns 415 for unsupported MIME (e.g. image/png)", async () => {
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: { name: "x.png", type: "image/png", size: 100 },
      }) as never,
    );
    expect(res.status).toBe(415);
  });

  it("returns 200 with extracted text for valid PDF", async () => {
    mockExtractText.mockResolvedValueOnce({
      text: ["Page 1 content. ", "Page 2 content."],
      totalPages: 2,
    });
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: {
          name: "resume.pdf",
          type: "application/pdf",
          size: 1024,
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Page 1 content. Page 2 content.");
  });

  it("accepts extension bearer auth for valid PDF", async () => {
    mockExtractText.mockResolvedValueOnce({
      text: ["Bearer PDF content."],
      totalPages: 1,
    });

    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: {
          name: "resume.pdf",
          type: "application/pdf",
          size: 1024,
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        },
      }) as never,
    );

    expect(res.status).toBe(200);
    expect(mockBearerAuthGetUser).toHaveBeenCalledWith("test");
    expect(mockAuthGetUser).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.text).toBe("Bearer PDF content.");
  });

  it("returns 200 with raw text for .txt upload", async () => {
    const text = "Plain text resume\nLine 2\nLine 3";
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: {
          name: "resume.txt",
          type: "text/plain",
          size: text.length,
          bytes: new TextEncoder().encode(text),
        },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe(text);
  });

  it("truncates output to 50000 chars and flags it", async () => {
    const longText = "x".repeat(60_000);
    mockExtractText.mockResolvedValueOnce({
      text: [longText],
      totalPages: 1,
    });
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: {
          name: "long.pdf",
          type: "application/pdf",
          size: 1024,
        },
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text.length).toBe(50_000);
    expect(body.truncated).toBe(true);
  });

  it("returns 422 when unpdf throws (corrupt PDF)", async () => {
    mockExtractText.mockRejectedValueOnce(new Error("Invalid PDF structure"));
    const res = await POST(
      makeMultipartRequest({
        bearer: true,
        file: { name: "bad.pdf", type: "application/pdf", size: 100 },
      }) as never,
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/parse|extract|invalid/i);
  });
});
