// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockStorageUpload = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({ upload: mockStorageUpload })),
    },
  })),
);

vi.mock("@/lib/supabase/client", () => ({ createClient: mockCreateClient }));

import ResumeManager from "./ResumeManager";

const UPLOAD_ID = "00000000-0000-4000-8000-000000000002";
const STORAGE_PATH = `00000000-0000-4000-8000-000000000001/${UPLOAD_ID}.txt`;
const RESERVATION = {
  uploadId: UPLOAD_ID,
  bucketId: "resume-quarantine",
  storagePath: STORAGE_PATH,
  expiresAt: "2099-01-01T00:00:00.000Z",
  uploadOptions: { contentType: "text/plain", upsert: false },
};
const READY_RESUME = {
  id: "resume-1",
  label: "resume.txt",
  file_name: "resume.txt",
  file_mime: "text/plain",
  file_size: 400,
  is_primary: true,
  created_at: "2026-09-06T00:00:00.000Z",
  updated_at: "2026-09-06T00:00:00.000Z",
  parsed_text_chars: 400,
  has_storage_file: true,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function selectFile(file: File) {
  fireEvent.change(screen.getByLabelText("Choose resume file"), {
    target: { files: [file] },
  });
}

describe("ResumeManager direct upload lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_RESUME_DIRECT_UPLOAD_ENABLED = "true";
    mockStorageUpload.mockResolvedValue({
      data: { path: STORAGE_PATH },
      error: null,
    });
  });

  afterEach(cleanup);

  it("preserves the legacy transport while the direct-upload rollout flag is disabled", async () => {
    process.env.NEXT_PUBLIC_RESUME_DIRECT_UPLOAD_ENABLED = "false";
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse(
          { success: true, resume: READY_RESUME, truncated: false },
          201,
        ),
      )
      .mockImplementationOnce(() =>
        jsonResponse({ resumes: [READY_RESUME], count: 1, max: 5 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumeManager initialResumes={[]} maxResumes={5} />);
    const file = new File(["safe resume text"], "resume.txt", {
      type: "text/plain",
    });

    selectFile(file);

    await screen.findByText("Resume uploaded.");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/resumes");
    expect(fetchMock.mock.calls[0]![1].body).toBeInstanceOf(FormData);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("sends metadata to Next.js, bytes to Supabase, then finalizes", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonResponse(RESERVATION, 201))
      .mockImplementationOnce(() =>
        jsonResponse({
          status: "warning",
          uploadId: UPLOAD_ID,
          resumeId: READY_RESUME.id,
          qualityCodes: ["TEXT_TRUNCATED"],
          metrics: { pageCount: null, characterCount: 50_000 },
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({ resumes: [READY_RESUME], count: 1, max: 5 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumeManager initialResumes={[]} maxResumes={5} />);
    const file = new File(["a".repeat(400)], "resume.txt", {
      type: "text/plain",
    });

    selectFile(file);

    await screen.findByText(/saved with a quality note/i);
    const reserveCall = fetchMock.mock.calls[0]!;
    expect(reserveCall[0]).toBe("/api/resumes/uploads");
    expect(JSON.parse(reserveCall[1].body)).toEqual({
      fileName: "resume.txt",
      declaredMime: "text/plain",
      declaredSize: 400,
    });
    expect(reserveCall[1].body).not.toBe(file);
    expect(mockStorageUpload).toHaveBeenCalledWith(STORAGE_PATH, file, {
      contentType: "text/plain",
      upsert: false,
    });
    expect(fetchMock.mock.calls[1]).toEqual([
      `/api/resumes/uploads/${UPLOAD_ID}/finalize`,
      { method: "POST" },
    ]);
    expect(
      screen.getByText(/trimmed to 50,000 characters/i),
    ).toBeInTheDocument();
  });

  it("rejects files over 5 MiB before creating a reservation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumeManager initialResumes={[]} maxResumes={5} />);

    selectFile(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "resume.pdf", {
        type: "application/pdf",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The resume must be 5 MB or smaller.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("keeps near-5-MiB file bytes out of Next.js requests", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonResponse(RESERVATION, 201))
      .mockImplementationOnce(() =>
        jsonResponse({
          status: "ready",
          uploadId: UPLOAD_ID,
          resumeId: READY_RESUME.id,
          qualityCodes: [],
          metrics: { pageCount: null, characterCount: 400 },
        }),
      )
      .mockImplementationOnce(() => jsonResponse({ resumes: [READY_RESUME] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumeManager initialResumes={[]} maxResumes={5} />);
    const file = new File([new Uint8Array(5 * 1024 * 1024)], "resume.txt", {
      type: "text/plain",
    });

    selectFile(file);

    await screen.findByText("Resume ready.");
    const requestBody = fetchMock.mock.calls[0]![1].body as string;
    expect(requestBody.length).toBeLessThan(512);
    expect(JSON.parse(requestBody).declaredSize).toBe(5 * 1024 * 1024);
    expect(mockStorageUpload.mock.calls[0]![1]).toBe(file);
    expect(
      fetchMock.mock.calls.some(([, options]) => options?.body instanceof File),
    ).toBe(false);
  });

  it("shows a stable rejection message instead of a raw server error", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse(
          {
            ...RESERVATION,
            uploadOptions: { contentType: "application/pdf", upsert: false },
          },
          201,
        ),
      )
      .mockImplementationOnce(() =>
        jsonResponse(
          {
            status: "rejected",
            uploadId: UPLOAD_ID,
            code: "ENCRYPTED_PDF",
            message: "private parser stack and object path",
            retryable: false,
          },
          422,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumeManager initialResumes={[]} maxResumes={5} />);

    selectFile(
      new File(["%PDF-safe-fixture"], "resume.pdf", {
        type: "application/pdf",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Password-protected or encrypted PDFs are not supported.",
    );
    expect(screen.queryByText(/private parser stack/i)).not.toBeInTheDocument();
  });

  it("cancels the reservation when direct Storage upload fails", async () => {
    mockStorageUpload.mockResolvedValue({
      data: null,
      error: new Error("private storage details"),
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonResponse(RESERVATION, 201))
      .mockImplementationOnce(() =>
        jsonResponse({ status: "canceled", uploadId: UPLOAD_ID }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumeManager initialResumes={[]} maxResumes={5} />);

    selectFile(
      new File(["a".repeat(400)], "resume.txt", { type: "text/plain" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The resume could not be uploaded. Please try again.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/resumes/uploads/${UPLOAD_ID}`,
      { method: "DELETE" },
    );
    expect(
      screen.queryByText(/private storage details/i),
    ).not.toBeInTheDocument();
  });

  it("retries only finalization after a retryable processing failure", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonResponse(RESERVATION, 201))
      .mockImplementationOnce(() =>
        jsonResponse(
          {
            status: "failed",
            uploadId: UPLOAD_ID,
            code: "TEMPORARY_PROCESSING_FAILURE",
            message: "temporary",
            retryable: true,
          },
          503,
        ),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          status: "ready",
          uploadId: UPLOAD_ID,
          resumeId: READY_RESUME.id,
          qualityCodes: [],
          metrics: { pageCount: null, characterCount: 400 },
        }),
      )
      .mockImplementationOnce(() => jsonResponse({ resumes: [READY_RESUME] }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ResumeManager initialResumes={[]} maxResumes={5} />);
    selectFile(
      new File(["a".repeat(400)], "resume.txt", { type: "text/plain" }),
    );

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByText("Resume ready.");
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/finalize")),
    ).toHaveLength(2);
  });

  it("cancels an in-flight reservation without finalizing it", async () => {
    let resolveUpload!: (_value: unknown) => void;
    mockStorageUpload.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonResponse(RESERVATION, 201))
      .mockImplementationOnce(() =>
        jsonResponse({ status: "canceled", uploadId: UPLOAD_ID }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ResumeManager initialResumes={[]} maxResumes={5} />);
    selectFile(
      new File(["a".repeat(400)], "resume.txt", { type: "text/plain" }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Cancel upload" }),
    );
    resolveUpload({ data: { path: STORAGE_PATH }, error: null });

    await screen.findByText("Resume upload canceled.");
    await waitFor(() => expect(mockStorageUpload).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/resumes/uploads/${UPLOAD_ID}`,
      {
        method: "DELETE",
      },
    );
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/finalize")),
    ).toBe(false);
  });
});
