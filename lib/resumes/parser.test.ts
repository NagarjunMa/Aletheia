import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExtractText = vi.hoisted(() => vi.fn());

vi.mock("unpdf", () => ({
  extractText: mockExtractText,
}));

import {
  ACCEPTED_RESUME_MIME,
  MAX_RESUME_BYTES,
  MAX_RESUME_TEXT_LENGTH,
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
