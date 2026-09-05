import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { SafeLogger } from "@/lib/logger";
import type { InspectedPdf } from "./parser";
import { MAX_RESUME_BYTES, MAX_RESUME_TEXT_LENGTH } from "./parser";
import { validateResumeBytes } from "./validator";

function createLogger(): SafeLogger {
  const logger: SafeLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

function textInput(text: string, overrides: Record<string, unknown> = {}) {
  const bytes = new TextEncoder().encode(text);
  return {
    bytes,
    fileName: "resume.txt",
    declaredMime: "text/plain",
    declaredSize: bytes.byteLength,
    ...overrides,
  };
}

function pdfInput(overrides: Record<string, unknown> = {}) {
  const bytes = new TextEncoder().encode("%PDF-1.7 synthetic fixture");
  return {
    bytes,
    fileName: "resume.pdf",
    declaredMime: "application/pdf",
    declaredSize: bytes.byteLength,
    ...overrides,
  };
}

const validPdf: InspectedPdf = {
  text: "Experienced backend engineer building reliable distributed systems for international product teams. Skilled in service design, observability, testing, incident response, database performance, accessible delivery, and cross-functional technical leadership. Consistently improves maintainability while helping colleagues deliver secure products for customers across multiple regions.",
  pageCount: 1,
  hasJavaScript: false,
  hasOpenAction: false,
  hasAttachments: false,
  hasXfa: false,
};

describe("validateResumeBytes", () => {
  it("accepts meaningful Unicode UTF-8 text without English-only assumptions", async () => {
    const input = textInput(
      Array.from(
        { length: 5 },
        () =>
          "Ingeniería de software con experiencia internacional. 設計と運用を担当し、信頼性の高いサービスを構築しました。",
      ).join(" "),
    );

    const result = await validateResumeBytes(input, {
      logger: createLogger(),
    });

    expect(result.status).toBe("ready");
    if (result.status === "rejected") return;
    expect(result.detectedMime).toBe("text/plain");
    expect(result.metrics.letterCount).toBeGreaterThanOrEqual(100);
    expect(result.contentSha256).toBe(
      createHash("sha256").update(input.bytes).digest("hex"),
    );
  });

  it.each([
    ["199 normalized characters", `${"a".repeat(100)}${"1".repeat(99)}`],
    ["99 Unicode letters", `${"a".repeat(99)}${"1".repeat(101)}`],
  ])("rejects content below the approved minimum: %s", async (_case, text) => {
    await expect(
      validateResumeBytes(textInput(text), { logger: createLogger() }),
    ).resolves.toMatchObject({ status: "rejected", code: "INSUFFICIENT_TEXT" });
  });

  it("accepts the exact 200-character and 100-letter boundary with a short-content warning", async () => {
    const result = await validateResumeBytes(
      textInput(`${"a".repeat(100)}${"1".repeat(100)}`),
      { logger: createLogger() },
    );

    expect(result.status).toBe("warning");
    if (result.status === "rejected") return;
    expect(result.metrics.characterCount).toBe(200);
    expect(result.metrics.letterCount).toBe(100);
    expect(result.qualityCodes).toContain("SHORT_USABLE_TEXT");
  });

  it.each([
    ["FILE_EMPTY", textInput("")],
    [
      "FILE_TOO_LARGE",
      textInput("valid content", {
        bytes: new Uint8Array(MAX_RESUME_BYTES + 1),
        declaredSize: MAX_RESUME_BYTES + 1,
      }),
    ],
    ["SIZE_MISMATCH", textInput("valid content", { declaredSize: 999 })],
    [
      "UNSUPPORTED_TYPE",
      textInput("valid content", {
        fileName: "resume.docx",
        declaredMime:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ],
    [
      "EXTENSION_MISMATCH",
      textInput("valid content", { fileName: "resume.pdf" }),
    ],
    [
      "SIGNATURE_MISMATCH",
      textInput("not a pdf", {
        fileName: "resume.pdf",
        declaredMime: "application/pdf",
      }),
    ],
  ])("rejects invalid metadata or byte bounds with %s", async (code, input) => {
    await expect(
      validateResumeBytes(input, { logger: createLogger() }),
    ).resolves.toMatchObject({ status: "rejected", code });
  });

  it("rejects a PDF signature disguised as text", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 disguised");
    await expect(
      validateResumeBytes(
        textInput("ignored", { bytes, declaredSize: bytes.byteLength }),
        { logger: createLogger() },
      ),
    ).resolves.toMatchObject({
      status: "rejected",
      code: "SIGNATURE_MISMATCH",
    });
  });

  it("rejects invalid UTF-8 and binary control content", async () => {
    const invalidUtf8 = new Uint8Array([0xc3, 0x28]);
    await expect(
      validateResumeBytes(
        textInput("ignored", {
          bytes: invalidUtf8,
          declaredSize: invalidUtf8.byteLength,
        }),
        { logger: createLogger() },
      ),
    ).resolves.toMatchObject({ status: "rejected", code: "INVALID_UTF8" });

    await expect(
      validateResumeBytes(textInput("Valid words\u0000with binary content"), {
        logger: createLogger(),
      }),
    ).resolves.toMatchObject({ status: "rejected", code: "BINARY_TEXT" });
  });

  it.each([
    ["PDF_PAGE_LIMIT", { pageCount: 21 }],
    ["PDF_ACTIVE_CONTENT", { hasJavaScript: true }],
    ["PDF_ACTIVE_CONTENT", { hasOpenAction: true }],
    ["PDF_EMBEDDED_FILE", { hasAttachments: true }],
    ["PDF_XFA", { hasXfa: true }],
  ])("rejects unsafe PDF structure with %s", async (code, override) => {
    const inspectPdf = vi.fn().mockResolvedValue({ ...validPdf, ...override });
    await expect(
      validateResumeBytes(pdfInput(), { logger: createLogger(), inspectPdf }),
    ).resolves.toMatchObject({ status: "rejected", code });
  });

  it.each([
    ["ENCRYPTED_PDF", "PasswordException"],
    ["VALIDATION_TIMEOUT", "ResumeValidationTimeoutError"],
    ["MALFORMED_PDF", "InvalidPDFException"],
  ])("maps parser failures to stable %s responses", async (code, errorName) => {
    const parserError = new Error("sensitive parser detail");
    parserError.name = errorName;
    const inspectPdf = vi.fn().mockRejectedValue(parserError);
    const result = await validateResumeBytes(pdfInput(), {
      logger: createLogger(),
      inspectPdf,
    });

    expect(result).toMatchObject({ status: "rejected", code });
    expect(JSON.stringify(result)).not.toContain("sensitive parser detail");
  });

  it.each([
    ["NO_EXTRACTABLE_TEXT", ""],
    ["INSUFFICIENT_TEXT", "Engineer with APIs"],
  ])("rejects unusable extracted text with %s", async (code, text) => {
    await expect(
      validateResumeBytes(pdfInput(), {
        logger: createLogger(),
        inspectPdf: vi.fn().mockResolvedValue({ ...validPdf, text }),
      }),
    ).resolves.toMatchObject({ status: "rejected", code });
  });

  it("returns deterministic warnings for truncation, density, and repetition", async () => {
    const repeated = "Backend engineer delivering reliable systems.";
    const text = `${Array.from({ length: 8 }, () => repeated).join("\n")}\n${"x".repeat(MAX_RESUME_TEXT_LENGTH)}`;
    const result = await validateResumeBytes(pdfInput(), {
      logger: createLogger(),
      inspectPdf: vi.fn().mockResolvedValue({
        ...validPdf,
        text,
        pageCount: 20,
      }),
    });

    expect(result.status).toBe("warning");
    if (result.status === "rejected") return;
    expect(result.qualityCodes).toEqual(
      expect.arrayContaining(["TEXT_TRUNCATED", "HIGH_REPETITION"]),
    );
    expect(result.parsedText).toHaveLength(MAX_RESUME_TEXT_LENGTH);
  });

  it("returns a low-density warning without rejecting meaningful non-English text", async () => {
    const text = Array.from(
      { length: 2 },
      () =>
        "Développeuse expérimentée créant des systèmes fiables pour des équipes internationales et des produits accessibles.",
    ).join(" ");
    const result = await validateResumeBytes(pdfInput(), {
      logger: createLogger(),
      inspectPdf: vi.fn().mockResolvedValue({
        ...validPdf,
        text,
        pageCount: 2,
      }),
    });

    expect(result.status).toBe("warning");
    if (result.status === "rejected") return;
    expect(result.qualityCodes).toContain("LOW_TEXT_DENSITY");
  });

  it("warns for a low suspicious-character ratio and removes those characters", async () => {
    const text = `${"a".repeat(198)}\ufffd\ufffd${"b".repeat(100)}`;
    const result = await validateResumeBytes(pdfInput(), {
      logger: createLogger(),
      inspectPdf: vi.fn().mockResolvedValue({ ...validPdf, text }),
    });

    expect(result.status).toBe("warning");
    if (result.status === "rejected") return;
    expect(result.qualityCodes).toContain("UNUSUAL_CHARACTER_RATIO");
    expect(result.metrics.suspiciousCharacterCount).toBe(2);
    expect(result.metrics.suspiciousCharacterRatio).toBeCloseTo(2 / 300);
    expect(result.parsedText).not.toContain("\ufffd");
  });

  it("rejects text when the suspicious-character ratio reaches the corruption threshold", async () => {
    const text = `${"a".repeat(293)}${"\ufffd".repeat(7)}`;

    await expect(
      validateResumeBytes(pdfInput(), {
        logger: createLogger(),
        inspectPdf: vi.fn().mockResolvedValue({ ...validPdf, text }),
      }),
    ).resolves.toMatchObject({ status: "rejected", code: "CORRUPTED_TEXT" });
  });

  it("logs only bounded codes and counts", async () => {
    const logger = createLogger();
    const secretFileName = "Jane-Doe-Private-Resume.txt";
    const secretText =
      "Private candidate profile with extensive engineering leadership and product delivery experience.";
    await validateResumeBytes(
      textInput(secretText, { fileName: secretFileName }),
      { logger },
    );

    const serializedLogs = JSON.stringify(vi.mocked(logger.info).mock.calls);
    expect(serializedLogs).not.toContain(secretFileName);
    expect(serializedLogs).not.toContain(secretText);
    expect(serializedLogs).not.toMatch(/[0-9a-f]{64}/);
  });
});
