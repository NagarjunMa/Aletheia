import { extractText, getResolvedPDFJS } from "unpdf";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_TEXT_LENGTH = 50_000;
export const MAX_RESUME_PDF_PAGES = 20;
const PDF_DESTROY_TIMEOUT_MS = 1_000;
export const ACCEPTED_RESUME_MIME = new Set(["application/pdf", "text/plain"]);

export type ParsedResume = {
  text: string;
  truncated: boolean;
};

export type InspectedPdf = {
  text: string;
  pageCount: number;
  hasJavaScript: boolean;
  hasOpenAction: boolean;
  hasAttachments: boolean;
  hasXfa: boolean;
};

type PdfDocumentLike = {
  numPages: number;
  isPureXfa: boolean;
  allXfaHtml: object | null;
  getJSActions(): Promise<object | null>;
  getOpenAction(): Promise<unknown | null>;
  getAttachments(): Promise<Record<string, unknown> | null>;
  getMetadata(): Promise<{ info: { IsXFAPresent?: boolean } }>;
  getPage(_pageNumber: number): Promise<PdfPageLike>;
};

type PdfPageLike = {
  getJSActions(): Promise<object | null>;
  getTextContent(_options: {
    disableNormalization: boolean;
    includeMarkedContent: boolean;
  }): Promise<{
    items: Array<{ str?: unknown; hasEOL?: unknown } | unknown>;
  }>;
  cleanup(): void;
};

type PdfLoadingTaskLike = {
  promise: Promise<PdfDocumentLike>;
  destroy(): Promise<void>;
};

export type PdfInspectionDependencies = {
  createLoadingTask?: (_bytes: Uint8Array) => Promise<PdfLoadingTaskLike>;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("PDF validation timed out");
      error.name = "ResumeValidationTimeoutError";
      reject(error);
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function createPdfLoadingTask(
  bytes: Uint8Array,
): Promise<PdfLoadingTaskLike> {
  const pdfjs = await getResolvedPDFJS();
  return pdfjs.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    stopAtErrors: true,
    useWorkerFetch: false,
    maxImageSize: 25_000_000,
    verbosity: 0,
  }) as PdfLoadingTaskLike;
}

export async function inspectPdfBytes(
  bytes: Uint8Array,
  timeoutMs: number,
  dependencies: PdfInspectionDependencies = {},
): Promise<InspectedPdf> {
  const createLoadingTask =
    dependencies.createLoadingTask ?? createPdfLoadingTask;
  let loadingTask: PdfLoadingTaskLike | null = null;
  const deadline = Date.now() + timeoutMs;
  const beforeDeadline = <T>(promise: Promise<T>) =>
    withTimeout(promise, Math.max(1, deadline - Date.now()));

  try {
    loadingTask = await beforeDeadline(createLoadingTask(bytes));
    const document = await beforeDeadline(loadingTask.promise);
    if (document.numPages < 1 || document.numPages > MAX_RESUME_PDF_PAGES) {
      return {
        text: "",
        pageCount: document.numPages,
        hasJavaScript: false,
        hasOpenAction: false,
        hasAttachments: false,
        hasXfa: document.isPureXfa || document.allXfaHtml !== null,
      };
    }

    const inspection = await beforeDeadline(
      Promise.all([
        document.getJSActions(),
        document.getOpenAction(),
        document.getAttachments(),
        document.getMetadata(),
      ]),
    );
    const [javaScriptActions, openAction, attachments, metadata] = inspection;
    const hasDocumentJavaScript =
      javaScriptActions !== null && Object.keys(javaScriptActions).length > 0;
    const hasOpenAction = openAction !== null;
    const hasAttachments =
      attachments !== null && Object.keys(attachments).length > 0;
    const hasXfa =
      document.isPureXfa ||
      document.allXfaHtml !== null ||
      metadata.info.IsXFAPresent === true;

    if (hasDocumentJavaScript || hasOpenAction || hasAttachments || hasXfa) {
      return {
        text: "",
        pageCount: document.numPages,
        hasJavaScript: hasDocumentJavaScript,
        hasOpenAction,
        hasAttachments,
        hasXfa,
      };
    }

    let hasPageJavaScript = false;
    const pages: string[] = [];
    let extractedCharacters = 0;

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await beforeDeadline(document.getPage(pageNumber));
      try {
        const pageJavaScript = await beforeDeadline(page.getJSActions());
        hasPageJavaScript ||=
          pageJavaScript !== null && Object.keys(pageJavaScript).length > 0;
        if (hasPageJavaScript) break;
        if (extractedCharacters > MAX_RESUME_TEXT_LENGTH) continue;

        const content = await beforeDeadline(
          page.getTextContent({
            disableNormalization: false,
            includeMarkedContent: false,
          }),
        );

        const pageText = content.items
          .map((item) => {
            if (
              typeof item !== "object" ||
              item === null ||
              !("str" in item) ||
              typeof item.str !== "string"
            ) {
              return "";
            }
            return (
              item.str + ("hasEOL" in item && item.hasEOL === true ? "\n" : "")
            );
          })
          .join("");
        const remaining = MAX_RESUME_TEXT_LENGTH + 1 - extractedCharacters;
        if (remaining > 0) {
          const boundedPageText = pageText.slice(0, remaining);
          pages.push(boundedPageText);
          extractedCharacters += boundedPageText.length;
        }
      } finally {
        page.cleanup();
      }
    }

    return {
      text: pages.join("\n"),
      pageCount: document.numPages,
      hasJavaScript: hasPageJavaScript || hasDocumentJavaScript,
      hasOpenAction,
      hasAttachments,
      hasXfa,
    };
  } finally {
    if (loadingTask) {
      await withTimeout(loadingTask.destroy(), PDF_DESTROY_TIMEOUT_MS).catch(
        () => undefined,
      );
    }
  }
}

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
