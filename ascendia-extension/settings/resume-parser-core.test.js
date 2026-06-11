import { beforeEach, describe, expect, it, vi } from "vitest";
import "./resume-parser-core.js";

const parser = globalThis.AletheiaResumeParser;

function makeFile(content, name, type) {
  return new File([content], name, { type });
}

beforeEach(async () => {
  vi.mocked(fetch).mockReset();
  await chrome.storage.local.clear();
});

describe("resume parser core", () => {
  it("reads text files locally", async () => {
    const file = makeFile("Nagarjun resume text", "resume.txt", "text/plain");

    await expect(parser.readFileContent(file)).resolves.toBe(
      "Nagarjun resume text",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts PDF files to the authenticated server parser", async () => {
    await chrome.storage.local.set({
      aletheia_auth: { access_token: "access-token" },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "Extracted PDF resume" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const file = makeFile("%PDF", "resume.pdf", "application/pdf");
    const text = await parser.readFileContent(file, {
      apiUrl: "https://www.aletheia.live/",
    });

    expect(text).toBe("Extracted PDF resume");
    expect(fetch).toHaveBeenCalledWith(
      "https://www.aletheia.live/api/profile/parse-resume",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
          "X-Extension-Source": "aletheia-extension",
        },
        body: expect.any(FormData),
      }),
    );
  });

  it("requires connection before uploading a PDF", async () => {
    const file = makeFile("%PDF", "resume.pdf", "application/pdf");

    await expect(parser.readFileContent(file)).rejects.toThrow(
      "Not connected. Please connect the extension before uploading a PDF resume.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps unparseable PDFs to a user-facing message", async () => {
    await chrome.storage.local.set({
      aletheia_auth: { access_token: "access-token" },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Failed to parse file" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }),
    );

    const file = makeFile("%PDF", "scan.pdf", "application/pdf");

    await expect(parser.readFileContent(file)).rejects.toThrow(
      "PDF could not be parsed. If it is scanned or image-based, please convert it to text format.",
    );
  });
});
