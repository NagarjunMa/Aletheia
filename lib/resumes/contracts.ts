export const RESUME_MIME_TYPES = ["application/pdf", "text/plain"] as const;
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export type ResumeMimeType = (typeof RESUME_MIME_TYPES)[number];
export type ResumeValidationStatus = "ready" | "warning" | "rejected";
export type ResumeUploadState =
  | "reserved"
  | "uploaded"
  | "validating"
  | "ready"
  | "rejected"
  | "failed"
  | "canceled"
  | "expired";

export type ResumeRejectionCode =
  | "FILE_EMPTY"
  | "FILE_TOO_LARGE"
  | "SIZE_MISMATCH"
  | "UNSUPPORTED_TYPE"
  | "EXTENSION_MISMATCH"
  | "SIGNATURE_MISMATCH"
  | "INVALID_UTF8"
  | "BINARY_TEXT"
  | "MALFORMED_PDF"
  | "ENCRYPTED_PDF"
  | "PDF_ACTIVE_CONTENT"
  | "PDF_EMBEDDED_FILE"
  | "PDF_XFA"
  | "PDF_PAGE_LIMIT"
  | "VALIDATION_TIMEOUT"
  | "NO_EXTRACTABLE_TEXT"
  | "INSUFFICIENT_TEXT"
  | "CORRUPTED_TEXT";

export type ResumeUploadFailureCode =
  | ResumeRejectionCode
  | "DUPLICATE_RESUME"
  | "PERSISTENCE_FAILURE"
  | "TEMPORARY_PROCESSING_FAILURE";

export type ResumeQualityCode =
  | "TEXT_TRUNCATED"
  | "LOW_TEXT_DENSITY"
  | "HIGH_REPETITION"
  | "UNUSUAL_CHARACTER_RATIO"
  | "SHORT_USABLE_TEXT";

export type ResumeValidationInput = {
  bytes: Uint8Array;
  fileName: string;
  declaredMime: string;
  declaredSize: number;
};

export type ResumeQualityMetrics = {
  byteCount: number;
  characterCount: number;
  letterCount: number;
  wordCount: number;
  pageCount: number | null;
  charactersPerPage: number | null;
  repeatedLineRatio: number;
  suspiciousCharacterCount: number;
  suspiciousCharacterRatio: number;
  truncated: boolean;
};

export type AcceptedResumeValidation = {
  status: "ready" | "warning";
  detectedMime: ResumeMimeType;
  parsedText: string;
  contentSha256: string;
  qualityCodes: ResumeQualityCode[];
  metrics: ResumeQualityMetrics;
};

export type RejectedResumeValidation = {
  status: "rejected";
  code: ResumeRejectionCode;
  publicMessage: string;
};

export type ResumeValidationResult =
  AcceptedResumeValidation | RejectedResumeValidation;

export type ReserveResumeUploadRequest = {
  fileName: string;
  declaredMime: ResumeMimeType;
  declaredSize: number;
};

export type ReserveResumeUploadResponse = {
  uploadId: string;
  bucketId: "resume-quarantine";
  storagePath: string;
  expiresAt: string;
  uploadOptions: {
    contentType: ResumeMimeType;
    upsert: false;
  };
};

export type FinalizeResumeUploadResponse =
  | {
      status: "ready" | "warning";
      uploadId: string;
      resumeId: string;
      qualityCodes: ResumeQualityCode[];
      metrics: {
        pageCount: number | null;
        characterCount: number;
      };
    }
  | {
      status: "rejected" | "failed";
      uploadId: string;
      code: ResumeUploadFailureCode;
      message: string;
      retryable: boolean;
    };

export const RESUME_REJECTION_MESSAGES: Record<ResumeRejectionCode, string> = {
  FILE_EMPTY: "The selected resume is empty.",
  FILE_TOO_LARGE: "The resume must be 5 MB or smaller.",
  SIZE_MISMATCH: "The uploaded resume size did not match the reservation.",
  UNSUPPORTED_TYPE: "Upload a PDF or UTF-8 text file.",
  EXTENSION_MISMATCH: "The file extension does not match the selected format.",
  SIGNATURE_MISMATCH: "The file contents do not match the selected format.",
  INVALID_UTF8: "The text resume must use valid UTF-8 encoding.",
  BINARY_TEXT: "The text resume contains unsupported binary content.",
  MALFORMED_PDF: "The PDF could not be safely processed.",
  ENCRYPTED_PDF: "Password-protected or encrypted PDFs are not supported.",
  PDF_ACTIVE_CONTENT: "PDFs containing actions or scripts are not supported.",
  PDF_EMBEDDED_FILE: "PDFs containing embedded files are not supported.",
  PDF_XFA: "XFA-based PDFs are not supported.",
  PDF_PAGE_LIMIT: "The PDF must contain between 1 and 20 pages.",
  VALIDATION_TIMEOUT:
    "The resume took too long to process. Please try another file.",
  NO_EXTRACTABLE_TEXT: "The resume does not contain extractable text.",
  INSUFFICIENT_TEXT: "The resume does not contain enough meaningful text.",
  CORRUPTED_TEXT:
    "The extracted resume text contains too many unreadable characters.",
};

export const RESUME_UPLOAD_FAILURE_MESSAGES: Record<
  Exclude<ResumeUploadFailureCode, ResumeRejectionCode>,
  string
> = {
  DUPLICATE_RESUME: "This resume has already been uploaded.",
  PERSISTENCE_FAILURE:
    "The resume could not be saved safely. Please upload it again.",
  TEMPORARY_PROCESSING_FAILURE:
    "The resume could not be processed right now. Please try again.",
};

export const RESUME_QUALITY_MESSAGES: Record<ResumeQualityCode, string> = {
  TEXT_TRUNCATED: "Parsed text was trimmed to 50,000 characters.",
  LOW_TEXT_DENSITY:
    "Some pages contain little readable text. Review the generated draft carefully.",
  HIGH_REPETITION:
    "The resume contains repeated text. Review the generated draft carefully.",
  UNUSUAL_CHARACTER_RATIO:
    "Some characters could not be read cleanly. Review the generated draft carefully.",
  SHORT_USABLE_TEXT:
    "Only a small amount of usable text was found. Review the generated draft carefully.",
};
