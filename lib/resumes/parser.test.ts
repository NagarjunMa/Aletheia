import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExtractText = vi.hoisted(() => vi.fn());
const mockGetResolvedPDFJS = vi.hoisted(() => vi.fn());

vi.mock("unpdf", () => ({
  extractText: mockExtractText,
  getResolvedPDFJS: mockGetResolvedPDFJS,
}));

import {
  ACCEPTED_RESUME_MIME,
  MAX_RESUME_BYTES,
  MAX_RESUME_TEXT_LENGTH,
  inspectPdfBytes,
  parseResumeFile,
  validateResumeFile,
} from "./parser";

function makeFile(
  content: BlobPart,
  name: string,
  type: string,
  sizeOverride?: number,
): File {
  const file = new File([content], name, { type });
  if (sizeOverride === undefined) return file;

  return Object.defineProperty(file, "size", {
    configurable: true,
    value: sizeOverride,
  });
}

describe("validateResumeFile", () => {
  it("accepts supported resume MIME types within the size limit", () => {
    for (const mime of ACCEPTED_RESUME_MIME) {
      const file = makeFile("resume", `resume.${mime}`, mime);
      expect(validateResumeFile(file)).toBeNull();
    }
  });

  it("rejects files larger than the configured limit", () => {
    const file = makeFile(
      "resume",
      "resume.pdf",
      "application/pdf",
      MAX_RESUME_BYTES + 1,
    );

    expect(validateResumeFile(file)).toBe("File exceeds 5 MB limit");
  });

  it("rejects unsupported MIME types", () => {
    const file = makeFile("resume", "resume.docx", "application/msword");

    expect(validateResumeFile(file)).toBe(
      "Unsupported file type: application/msword",
    );
  });
});

describe("parseResumeFile", () => {
  beforeEach(() => {
    mockExtractText.mockReset();
  });

  it("reads plain-text resumes, strips null bytes, and trims whitespace", async () => {
    const file = makeFile(
      " \u0000 Backend engineer with AWS experience. \n",
      "resume.txt",
      "text/plain",
    );

    await expect(parseResumeFile(file)).resolves.toEqual({
      text: "Backend engineer with AWS experience.",
      truncated: false,
    });
    expect(mockExtractText).not.toHaveBeenCalled();
  });

  it("extracts PDF text from array page output", async () => {
    mockExtractText.mockResolvedValueOnce({
      text: ["Page one. ", "Page two."],
    });
    const file = makeFile(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      "resume.pdf",
      "application/pdf",
    );

    await expect(parseResumeFile(file)).resolves.toEqual({
      text: "Page one. Page two.",
      truncated: false,
    });
    expect(mockExtractText).toHaveBeenCalledWith(expect.any(Uint8Array), {
      mergePages: false,
    });
  });

  it("handles PDF extractors that return a single text string", async () => {
    mockExtractText.mockResolvedValueOnce({
      text: " Single page PDF resume. ",
    });
    const file = makeFile(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      "resume.pdf",
      "application/pdf",
    );

    await expect(parseResumeFile(file)).resolves.toEqual({
      text: "Single page PDF resume.",
      truncated: false,
    });
  });

  it("truncates parsed text at the resume text limit", async () => {
    const longText = "x".repeat(MAX_RESUME_TEXT_LENGTH + 25);
    const file = makeFile(longText, "resume.txt", "text/plain");

    const result = await parseResumeFile(file);

    expect(result.text).toHaveLength(MAX_RESUME_TEXT_LENGTH);
    expect(result.truncated).toBe(true);
  });

  it("throws when no extractable text remains after normalization", async () => {
    const file = makeFile(" \u0000 \n\t ", "resume.txt", "text/plain");

    await expect(parseResumeFile(file)).rejects.toThrow(
      "Resume did not contain extractable text",
    );
  });

  it("throws when a PDF extractor returns no text", async () => {
    mockExtractText.mockResolvedValueOnce({ text: null });
    const file = makeFile(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      "resume.pdf",
      "application/pdf",
    );

    await expect(parseResumeFile(file)).rejects.toThrow(
      "Resume did not contain extractable text",
    );
  });
});

describe("inspectPdfBytes", () => {
  beforeEach(() => {
    mockExtractText.mockReset();
    mockGetResolvedPDFJS.mockReset();
  });

  function createDocument(overrides: Record<string, unknown> = {}) {
    const page = {
      getJSActions: vi.fn().mockResolvedValue(null),
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: "Resume text" }],
      }),
      cleanup: vi.fn(),
    };
    return {
      numPages: 1,
      isPureXfa: false,
      allXfaHtml: null,
      getJSActions: vi.fn().mockResolvedValue(null),
      getOpenAction: vi.fn().mockResolvedValue(null),
      getAttachments: vi.fn().mockResolvedValue(null),
      getMetadata: vi.fn().mockResolvedValue({ info: {} }),
      getPage: vi.fn().mockResolvedValue(page),
      ...overrides,
    };
  }

  it("inspects PDF structure with strict extraction and destroys resources", async () => {
    const document = createDocument();
    const destroy = vi.fn().mockResolvedValue(undefined);
    await expect(
      inspectPdfBytes(new Uint8Array([1, 2, 3]), 100, {
        createLoadingTask: vi.fn().mockResolvedValue({
          promise: Promise.resolve(document),
          destroy,
        }),
      }),
    ).resolves.toEqual({
      text: "Resume text",
      pageCount: 1,
      hasJavaScript: false,
      hasOpenAction: false,
      hasAttachments: false,
      hasXfa: false,
    });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("configures PDF.js for strict non-evaluating local parsing", async () => {
    const document = createDocument();
    const destroy = vi.fn().mockResolvedValue(undefined);
    const getDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve(document),
      destroy,
    });
    mockGetResolvedPDFJS.mockResolvedValue({ getDocument });

    await inspectPdfBytes(new Uint8Array([1, 2, 3]), 100);

    expect(getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Uint8Array),
        isEvalSupported: false,
        stopAtErrors: true,
        useWorkerFetch: false,
        maxImageSize: 25_000_000,
        verbosity: 0,
      }),
    );
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("detects page-level JavaScript actions", async () => {
    const page = {
      getJSActions: vi.fn().mockResolvedValue({ PageOpen: ["script"] }),
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: "Resume text" }],
      }),
      cleanup: vi.fn(),
    };
    const document = createDocument({
      getPage: vi.fn().mockResolvedValue(page),
    });

    await expect(
      inspectPdfBytes(new Uint8Array([1]), 100, {
        createLoadingTask: vi.fn().mockResolvedValue({
          promise: Promise.resolve(document),
          destroy: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    ).resolves.toMatchObject({ hasJavaScript: true });
    expect(page.cleanup).toHaveBeenCalledOnce();
  });

  it("continues scanning later pages for JavaScript after reaching the text cap", async () => {
    const firstPage = {
      getJSActions: vi.fn().mockResolvedValue(null),
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: "x".repeat(MAX_RESUME_TEXT_LENGTH + 1) }],
      }),
      cleanup: vi.fn(),
    };
    const secondPage = {
      getJSActions: vi.fn().mockResolvedValue({ PageOpen: ["script"] }),
      getTextContent: vi.fn(),
      cleanup: vi.fn(),
    };
    const document = createDocument({
      numPages: 2,
      getPage: vi
        .fn()
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce(secondPage),
    });

    await expect(
      inspectPdfBytes(new Uint8Array([1]), 100, {
        createLoadingTask: vi.fn().mockResolvedValue({
          promise: Promise.resolve(document),
          destroy: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    ).resolves.toMatchObject({ hasJavaScript: true });
    expect(secondPage.getTextContent).not.toHaveBeenCalled();
    expect(firstPage.cleanup).toHaveBeenCalledOnce();
    expect(secondPage.cleanup).toHaveBeenCalledOnce();
  });

  it("detects hybrid XFA metadata before extracting page content", async () => {
    const document = createDocument({
      getMetadata: vi.fn().mockResolvedValue({
        info: { IsXFAPresent: true },
      }),
    });

    await expect(
      inspectPdfBytes(new Uint8Array([1]), 100, {
        createLoadingTask: vi.fn().mockResolvedValue({
          promise: Promise.resolve(document),
          destroy: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    ).resolves.toMatchObject({ hasXfa: true, text: "" });
    expect(document.getPage).not.toHaveBeenCalled();
  });

  it("rejects excessive page counts before extracting page content", async () => {
    const document = createDocument({ numPages: 21 });

    await expect(
      inspectPdfBytes(new Uint8Array([1]), 100, {
        createLoadingTask: vi.fn().mockResolvedValue({
          promise: Promise.resolve(document),
          destroy: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    ).resolves.toMatchObject({ pageCount: 21, text: "" });
    expect(document.getPage).not.toHaveBeenCalled();
  });

  it("destroys PDF resources when inspection fails", async () => {
    const document = createDocument({
      getJSActions: vi.fn().mockRejectedValue(new Error("malformed")),
    });
    const destroy = vi.fn().mockResolvedValue(undefined);

    await expect(
      inspectPdfBytes(new Uint8Array([1]), 100, {
        createLoadingTask: vi.fn().mockResolvedValue({
          promise: Promise.resolve(document),
          destroy,
        }),
      }),
    ).rejects.toThrow("malformed");
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("times out bounded inspection and destroys the loading task", async () => {
    const document = createDocument({
      getJSActions: vi.fn(() => new Promise(() => undefined)),
    });
    const destroy = vi.fn().mockResolvedValue(undefined);
    const promise = inspectPdfBytes(new Uint8Array([1]), 5, {
      createLoadingTask: vi.fn().mockResolvedValue({
        promise: Promise.resolve(document),
        destroy,
      }),
    });

    await expect(promise).rejects.toMatchObject({
      name: "ResumeValidationTimeoutError",
    });
    expect(destroy).toHaveBeenCalledOnce();
  });
});
