import { extractText } from "unpdf";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_TEXT_LENGTH = 50_000;
export const ACCEPTED_RESUME_MIME = new Set(["application/pdf", "text/plain"]);

export type ParsedResume = {
  text: string;
  truncated: boolean;
};

export function validateResumeFile(file: File): string | null {
  if (file.size > MAX_RESUME_BYTES) {
    return "File exceeds 5 MB limit";
  }

  if (!ACCEPTED_RESUME_MIME.has(file.type)) {
    return `Unsupported file type: ${file.type}`;
  }

  return null;
}

export async function parseResumeFile(file: File): Promise<ParsedResume> {
  let rawText: string;

  if (file.type === "text/plain") {
    rawText = await file.text();
  } else {
    const arrayBuf = await file.arrayBuffer();
    const result = await extractText(new Uint8Array(arrayBuf), {
      mergePages: false,
    });
    rawText = Array.isArray(result.text)
      ? result.text.join("")
      : String(result.text ?? "");
  }

  const normalizedText = rawText.replace(/\u0000/g, "").trim();
  const truncated = normalizedText.length > MAX_RESUME_TEXT_LENGTH;
  const text = truncated
    ? normalizedText.slice(0, MAX_RESUME_TEXT_LENGTH)
    : normalizedText;

  if (!text) {
    throw new Error("Resume did not contain extractable text");
  }

  return { text, truncated };
}
