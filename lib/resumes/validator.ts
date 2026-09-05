import { createHash } from "node:crypto";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import {
  RESUME_MIME_TYPES,
  RESUME_REJECTION_MESSAGES,
  type ResumeMimeType,
  type ResumeQualityCode,
  type ResumeQualityMetrics,
  type ResumeRejectionCode,
  type ResumeValidationInput,
  type ResumeValidationResult,
} from "./contracts";
import {
  inspectPdfBytes,
  MAX_RESUME_BYTES,
  MAX_RESUME_PDF_PAGES,
  MAX_RESUME_TEXT_LENGTH,
  type InspectedPdf,
} from "./parser";

const DEFAULT_VALIDATION_TIMEOUT_MS = 10_000;
const MIN_NORMALIZED_CHARACTERS = 200;
const MIN_MEANINGFUL_LETTERS = 100;
const SHORT_USABLE_CHARACTERS = 400;
const SHORT_USABLE_LETTERS = 200;
const LOW_PDF_CHARACTERS_PER_PAGE = 120;
const HIGH_REPETITION_RATIO = 0.4;
const SUSPICIOUS_CHARACTER_WARNING_RATIO = 0.005;
const SUSPICIOUS_CHARACTER_REJECTION_RATIO = 0.02;
const BINARY_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const SUSPICIOUS_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]/gu;
const log = createLogger("resume-validator");

export type ResumeValidatorOptions = {
  timeoutMs?: number;
  logger?: SafeLogger;
  inspectPdf?: (
    _bytes: Uint8Array,
    _timeoutMs: number,
  ) => Promise<InspectedPdf>;
};

function reject(
  code: ResumeRejectionCode,
  complete: ReturnType<typeof startTimedStage>,
): ResumeValidationResult {
  complete("failure", { errorCode: code });
  return {
    status: "rejected",
    code,
    publicMessage: RESUME_REJECTION_MESSAGES[code],
  };
}

function fileExtension(fileName: string): string | null {
  const baseName = fileName.split(/[\\/]/).pop() ?? "";
  const index = baseName.lastIndexOf(".");
  return index > 0 ? baseName.slice(index + 1).toLowerCase() : null;
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function decodeStrictUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function containsBinaryText(text: string): boolean {
  return BINARY_CONTROL_CHARACTERS.test(text);
}

type NormalizedText = {
  text: string;
  truncated: boolean;
  suspiciousCharacterCount: number;
  suspiciousCharacterRatio: number;
};

function normalizeText(rawText: string): NormalizedText {
  const canonical = rawText.normalize("NFC").replace(/\r\n?/g, "\n");
  const suspiciousCharacterCount =
    canonical.match(SUSPICIOUS_CHARACTERS)?.length ?? 0;
  const suspiciousCharacterRatio = canonical.length
    ? suspiciousCharacterCount / canonical.length
    : 0;
  const normalized = canonical
    .replace(SUSPICIOUS_CHARACTERS, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const truncated = normalized.length > MAX_RESUME_TEXT_LENGTH;

  return {
    text: truncated
      ? normalized.slice(0, MAX_RESUME_TEXT_LENGTH).trimEnd()
      : normalized,
    truncated,
    suspiciousCharacterCount,
    suspiciousCharacterRatio,
  };
}

function repeatedLineRatio(text: string): number {
  const lines = text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length >= 8);
  if (lines.length < 4) return 0;
  return (lines.length - new Set(lines).size) / lines.length;
}

function evaluateQuality(
  text: string,
  byteCount: number,
  pageCount: number | null,
  truncated: boolean,
  suspiciousCharacterCount: number,
  suspiciousCharacterRatio: number,
): { metrics: ResumeQualityMetrics; qualityCodes: ResumeQualityCode[] } {
  const letterCount = text.match(/\p{L}/gu)?.length ?? 0;
  const wordCount =
    text.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  const charactersPerPage = pageCount
    ? Math.floor(text.length / pageCount)
    : null;
  const repetition = repeatedLineRatio(text);
  const qualityCodes: ResumeQualityCode[] = [];

  if (truncated) qualityCodes.push("TEXT_TRUNCATED");
  if (
    charactersPerPage !== null &&
    charactersPerPage < LOW_PDF_CHARACTERS_PER_PAGE
  ) {
    qualityCodes.push("LOW_TEXT_DENSITY");
  }
  if (repetition >= HIGH_REPETITION_RATIO) {
    qualityCodes.push("HIGH_REPETITION");
  }
  if (suspiciousCharacterRatio >= SUSPICIOUS_CHARACTER_WARNING_RATIO) {
    qualityCodes.push("UNUSUAL_CHARACTER_RATIO");
  }
  if (
    text.length < SHORT_USABLE_CHARACTERS ||
    letterCount < SHORT_USABLE_LETTERS
  ) {
    qualityCodes.push("SHORT_USABLE_TEXT");
  }

  return {
    qualityCodes,
    metrics: {
      byteCount,
      characterCount: text.length,
      letterCount,
      wordCount,
      pageCount,
      charactersPerPage,
      repeatedLineRatio: repetition,
      suspiciousCharacterCount,
      suspiciousCharacterRatio,
      truncated,
    },
  };
}

function isResumeMime(value: string): value is ResumeMimeType {
  return (RESUME_MIME_TYPES as readonly string[]).includes(value);
}

export async function validateResumeBytes(
  input: ResumeValidationInput,
  options: ResumeValidatorOptions = {},
): Promise<ResumeValidationResult> {
  const logger = options.logger ?? log;
  const complete = startTimedStage(logger, "validation.resume_document", {
    byteCount: input.bytes.byteLength,
  });

  if (input.bytes.byteLength === 0 || input.declaredSize === 0) {
    return reject("FILE_EMPTY", complete);
  }
  if (
    input.bytes.byteLength > MAX_RESUME_BYTES ||
    input.declaredSize > MAX_RESUME_BYTES
  ) {
    return reject("FILE_TOO_LARGE", complete);
  }
  if (input.declaredSize !== input.bytes.byteLength) {
    return reject("SIZE_MISMATCH", complete);
  }
  if (!isResumeMime(input.declaredMime)) {
    return reject("UNSUPPORTED_TYPE", complete);
  }

  const expectedExtension =
    input.declaredMime === "application/pdf" ? "pdf" : "txt";
  if (fileExtension(input.fileName) !== expectedExtension) {
    return reject("EXTENSION_MISMATCH", complete);
  }

  const pdfSignature = hasPdfSignature(input.bytes);
  if (
    (input.declaredMime === "application/pdf" && !pdfSignature) ||
    (input.declaredMime === "text/plain" && pdfSignature)
  ) {
    return reject("SIGNATURE_MISMATCH", complete);
  }

  let rawText: string;
  let pageCount: number | null = null;
  if (input.declaredMime === "text/plain") {
    const decoded = decodeStrictUtf8(input.bytes);
    if (decoded === null) return reject("INVALID_UTF8", complete);
    if (containsBinaryText(decoded)) return reject("BINARY_TEXT", complete);
    rawText = decoded;
  } else {
    try {
      const inspection = await (options.inspectPdf ?? inspectPdfBytes)(
        input.bytes,
        options.timeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS,
      );
      pageCount = inspection.pageCount;

      if (pageCount < 1 || pageCount > MAX_RESUME_PDF_PAGES) {
        return reject("PDF_PAGE_LIMIT", complete);
      }
      if (inspection.hasJavaScript || inspection.hasOpenAction) {
        return reject("PDF_ACTIVE_CONTENT", complete);
      }
      if (inspection.hasAttachments) {
        return reject("PDF_EMBEDDED_FILE", complete);
      }
      if (inspection.hasXfa) return reject("PDF_XFA", complete);
      rawText = inspection.text;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ResumeValidationTimeoutError"
      ) {
        return reject("VALIDATION_TIMEOUT", complete);
      }
      if (error instanceof Error && error.name === "PasswordException") {
        return reject("ENCRYPTED_PDF", complete);
      }
      return reject("MALFORMED_PDF", complete);
    }
  }

  const {
    text,
    truncated,
    suspiciousCharacterCount,
    suspiciousCharacterRatio,
  } = normalizeText(rawText);
  if (!text) return reject("NO_EXTRACTABLE_TEXT", complete);
  if (suspiciousCharacterRatio >= SUSPICIOUS_CHARACTER_REJECTION_RATIO) {
    return reject("CORRUPTED_TEXT", complete);
  }

  const quality = evaluateQuality(
    text,
    input.bytes.byteLength,
    pageCount,
    truncated,
    suspiciousCharacterCount,
    suspiciousCharacterRatio,
  );
  if (
    quality.metrics.characterCount < MIN_NORMALIZED_CHARACTERS ||
    quality.metrics.letterCount < MIN_MEANINGFUL_LETTERS
  ) {
    return reject("INSUFFICIENT_TEXT", complete);
  }

  const qualityCodes = quality.qualityCodes;
  const status = qualityCodes.length > 0 ? "warning" : "ready";
  complete("success", {
    outcomeCode: status === "ready" ? "RESUME_READY" : "RESUME_WARNING",
    pageCount,
    characterCount: quality.metrics.characterCount,
    qualityCodeCount: qualityCodes.length,
  });

  return {
    status,
    detectedMime: input.declaredMime,
    parsedText: text,
    contentSha256: createHash("sha256").update(input.bytes).digest("hex"),
    qualityCodes,
    metrics: quality.metrics,
  };
}
