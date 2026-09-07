"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_RESUME_BYTES,
  RESUME_QUALITY_MESSAGES,
  RESUME_REJECTION_MESSAGES,
  RESUME_UPLOAD_FAILURE_MESSAGES,
  type FinalizeResumeUploadResponse,
  type ReserveResumeUploadResponse,
  type ResumeMimeType,
  type ResumeQualityCode,
} from "@/lib/resumes/contracts";
import type { ResumeListItem } from "@/lib/resumes/service";

type Props = {
  initialResumes: ResumeListItem[];
  maxResumes: number;
};

type UploadPhase =
  "reserving" | "uploading" | "validating" | "canceling" | null;
type RetryAction =
  { type: "restart"; file: File } | { type: "finalize"; uploadId: string };
type Status = {
  type: "idle" | "success" | "warning" | "error";
  message: string;
  qualityCodes?: ResumeQualityCode[];
  retry?: RetryAction;
};

const RESERVATION_FAILURE_MESSAGES: Record<string, string> = {
  ACTIVE_UPLOAD_LIMIT_REACHED:
    "Finish or cancel an existing resume upload before starting another.",
  RESUME_LIMIT_REACHED:
    "Delete an existing resume before uploading another one.",
  UPLOAD_RATE_LIMIT_REACHED:
    "You have reached the hourly resume upload limit. Please try again later.",
  UPLOAD_PROCESSING:
    "This resume is still being checked. Please wait a moment and try again.",
  UPLOAD_EXPIRED:
    "This upload expired before it could finish. Please upload the resume again.",
  UPLOAD_RETRY_LIMIT_REACHED:
    "This upload cannot be retried. Please upload the resume again.",
  QUARANTINE_OBJECT_MISSING:
    "The resume upload did not finish. Please upload it again.",
  UPLOAD_SERVICE_UNAVAILABLE:
    "Resume uploads are temporarily unavailable. Please try again.",
};

function inferMime(file: File): ResumeMimeType | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const inferred =
    extension === "pdf"
      ? "application/pdf"
      : extension === "txt"
        ? "text/plain"
        : null;
  if (!inferred || (file.type && file.type !== inferred)) return null;
  return inferred;
}

function preflightResume(
  file: File,
): { mime: ResumeMimeType } | { error: string } {
  if (file.size === 0) return { error: RESUME_REJECTION_MESSAGES.FILE_EMPTY };
  if (file.size > MAX_RESUME_BYTES) {
    return { error: RESUME_REJECTION_MESSAGES.FILE_TOO_LARGE };
  }
  const mime = inferMime(file);
  if (!mime) return { error: RESUME_REJECTION_MESSAGES.UNSUPPORTED_TYPE };
  return { mime };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return isObject(value) ? value : {};
  } catch {
    return {};
  }
}

function isReservation(
  value: Record<string, unknown>,
  mime: ResumeMimeType,
): value is ReserveResumeUploadResponse {
  return (
    typeof value.uploadId === "string" &&
    value.bucketId === "resume-quarantine" &&
    typeof value.storagePath === "string" &&
    value.storagePath.length > 0 &&
    typeof value.expiresAt === "string" &&
    isObject(value.uploadOptions) &&
    value.uploadOptions.contentType === mime &&
    value.uploadOptions.upsert === false
  );
}

function stableFailureMessage(code: unknown): string {
  if (typeof code !== "string") {
    return "Resume uploads are temporarily unavailable. Please try again.";
  }
  if (Object.hasOwn(RESUME_REJECTION_MESSAGES, code)) {
    return RESUME_REJECTION_MESSAGES[
      code as keyof typeof RESUME_REJECTION_MESSAGES
    ];
  }
  if (Object.hasOwn(RESUME_UPLOAD_FAILURE_MESSAGES, code)) {
    return RESUME_UPLOAD_FAILURE_MESSAGES[
      code as keyof typeof RESUME_UPLOAD_FAILURE_MESSAGES
    ];
  }
  return (
    RESERVATION_FAILURE_MESSAGES[code] ??
    "Resume uploads are temporarily unavailable. Please try again."
  );
}

function safeQualityCodes(value: unknown): ResumeQualityCode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (code): code is ResumeQualityCode =>
      typeof code === "string" && Object.hasOwn(RESUME_QUALITY_MESSAGES, code),
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function ResumeManager({ initialResumes, maxResumes }: Props) {
  const [resumes, setResumes] = useState(initialResumes);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canceledUploadsRef = useRef(new Set<string>());

  const refreshResumes = async () => {
    const res = await fetch("/api/resumes", { method: "GET" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not refresh resumes");
    setResumes(data.resumes ?? []);
  };

  const finalizeReservation = async (uploadId: string) => {
    setUploading(true);
    setUploadPhase("validating");
    setActiveUploadId(uploadId);
    setStatus({ type: "idle", message: "" });
    try {
      const response = await fetch(
        `/api/resumes/uploads/${uploadId}/finalize`,
        {
          method: "POST",
        },
      );
      const data = await readJson(response);
      if (
        response.ok &&
        (data.status === "ready" || data.status === "warning")
      ) {
        const result = data as FinalizeResumeUploadResponse & {
          status: "ready" | "warning";
        };
        await refreshResumes();
        setStatus({
          type: result.status === "warning" ? "warning" : "success",
          message:
            result.status === "warning"
              ? "Resume saved with a quality note."
              : "Resume ready.",
          qualityCodes: safeQualityCodes(result.qualityCodes),
        });
        setActiveUploadId(null);
        return;
      }

      const retryable =
        data.retryable === true ||
        response.status >= 500 ||
        data.code === "UPLOAD_PROCESSING";
      setStatus({
        type: "error",
        message: stableFailureMessage(data.code),
        ...(retryable
          ? { retry: { type: "finalize" as const, uploadId } }
          : {}),
      });
      if (!retryable) setActiveUploadId(null);
    } catch {
      setStatus({
        type: "error",
        message:
          "Resume uploads are temporarily unavailable. Please try again.",
        retry: { type: "finalize", uploadId },
      });
    } finally {
      setUploading(false);
      setUploadPhase(null);
    }
  };

  const cancelReservation = async (uploadId: string) => {
    canceledUploadsRef.current.add(uploadId);
    setUploadPhase("canceling");
    setStatus({ type: "idle", message: "" });
    try {
      const response = await fetch(`/api/resumes/uploads/${uploadId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("cancel failed");
      setStatus({ type: "success", message: "Resume upload canceled." });
    } catch {
      setStatus({
        type: "error",
        message:
          "Cancellation could not be confirmed. The reserved upload will expire automatically.",
      });
    } finally {
      setActiveUploadId(null);
      setUploadPhase(null);
    }
  };

  const uploadThroughRollbackTransport = async (file: File) => {
    setUploading(true);
    setStatus({ type: "idle", message: "" });
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
      });
      const data = await readJson(response);
      if (!response.ok) {
        setStatus({
          type: "error",
          message:
            typeof data.error === "string"
              ? data.error
              : "Resume uploads are temporarily unavailable. Please try again.",
        });
        return;
      }
      await refreshResumes();
      setStatus({
        type: "success",
        message:
          data.truncated === true
            ? "Resume uploaded. Parsed text was trimmed to 50,000 characters."
            : "Resume uploaded.",
      });
    } catch {
      setStatus({
        type: "error",
        message:
          "Resume uploads are temporarily unavailable. Please try again.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const uploadResume = async (file: File) => {
    const preflight = preflightResume(file);
    if ("error" in preflight) {
      setStatus({ type: "error", message: preflight.error });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (process.env.NEXT_PUBLIC_RESUME_DIRECT_UPLOAD_ENABLED !== "true") {
      await uploadThroughRollbackTransport(file);
      return;
    }

    setUploading(true);
    setUploadPhase("reserving");
    setStatus({ type: "idle", message: "" });
    let uploadId: string | null = null;
    try {
      const reserveResponse = await fetch("/api/resumes/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          declaredMime: preflight.mime,
          declaredSize: file.size,
        }),
      });
      const reservationData = await readJson(reserveResponse);
      if (
        !reserveResponse.ok ||
        !isReservation(reservationData, preflight.mime)
      ) {
        setStatus({
          type: "error",
          message: stableFailureMessage(reservationData.code),
          retry: { type: "restart", file },
        });
        return;
      }

      uploadId = reservationData.uploadId;
      setActiveUploadId(uploadId);
      setUploadPhase("uploading");
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("resume-quarantine")
        .upload(reservationData.storagePath, file, {
          contentType: preflight.mime,
          upsert: false,
        });

      if (canceledUploadsRef.current.has(uploadId)) return;
      if (error) {
        await fetch(`/api/resumes/uploads/${uploadId}`, {
          method: "DELETE",
        }).catch(() => undefined);
        setActiveUploadId(null);
        setStatus({
          type: "error",
          message: "The resume could not be uploaded. Please try again.",
          retry: { type: "restart", file },
        });
        return;
      }

      await finalizeReservation(uploadId);
    } catch {
      if (uploadId) {
        await fetch(`/api/resumes/uploads/${uploadId}`, {
          method: "DELETE",
        }).catch(() => undefined);
      }
      setActiveUploadId(null);
      setStatus({
        type: "error",
        message:
          "Resume uploads are temporarily unavailable. Please try again.",
        retry: { type: "restart", file },
      });
    } finally {
      setUploading(false);
      setUploadPhase(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const retryUpload = async (retry: RetryAction) => {
    if (retry.type === "finalize") {
      await finalizeReservation(retry.uploadId);
      return;
    }
    await uploadResume(retry.file);
  };

  const setPrimary = async (id: string) => {
    setStatus({ type: "idle", message: "" });
    const previous = resumes;
    setResumes((items) =>
      items.map((item) => ({ ...item, is_primary: item.id === id })),
    );

    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not set primary");
      await refreshResumes();
    } catch (err) {
      setResumes(previous);
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Could not set primary",
      });
    }
  };

  const renameResume = async (id: string, currentLabel: string) => {
    const label = window.prompt("Resume label", currentLabel)?.trim();
    if (!label || label === currentLabel) return;

    setRenamingId(id);
    setStatus({ type: "idle", message: "" });

    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not rename resume");
      await refreshResumes();
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Could not rename resume",
      });
    } finally {
      setRenamingId(null);
    }
  };

  const deleteResume = async (id: string, label: string) => {
    const confirmed = window.confirm(`Delete "${label}"?`);
    if (!confirmed) return;

    setStatus({ type: "idle", message: "" });
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete resume");
      await refreshResumes();
      setStatus({ type: "success", message: "Resume deleted." });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Could not delete resume",
      });
    }
  };

  const atLimit = resumes.length >= maxResumes;

  return (
    <section className="glass rounded-2xl p-6 space-y-5" aria-label="Resumes">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Resumes</h3>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Upload up to {maxResumes} PDF or TXT resumes and choose one default
            for generation.
          </p>
        </div>
        <div>
          <button
            type="button"
            disabled={uploading || atLimit}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload resume"}
          </button>
          <input
            ref={fileInputRef}
            aria-label="Choose resume file"
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="sr-only"
            disabled={uploading || atLimit}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadResume(file);
            }}
          />
        </div>
      </div>

      {status.type !== "idle" && (
        <div role={status.type === "error" ? "alert" : "status"}>
          <p
            className={`text-xs ${
              status.type === "error"
                ? "text-red-400"
                : status.type === "warning"
                  ? "text-amber-300"
                  : "text-accent"
            }`}
          >
            {status.message}
          </p>
          {status.qualityCodes && status.qualityCodes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-200">
              {status.qualityCodes.map((code) => (
                <li key={code}>{RESUME_QUALITY_MESSAGES[code]}</li>
              ))}
            </ul>
          )}
          {status.retry && (
            <button
              type="button"
              className="mt-2 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(var(--secondary))]"
              onClick={() => void retryUpload(status.retry!)}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {uploadPhase && (
        <div
          className="flex flex-col gap-3 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-white">
            {uploadPhase === "reserving"
              ? "Preparing a private upload…"
              : uploadPhase === "uploading"
                ? "Uploading securely…"
                : uploadPhase === "validating"
                  ? "Checking the resume…"
                  : "Canceling the upload…"}
          </p>
          {activeUploadId && uploadPhase === "uploading" && (
            <button
              type="button"
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(var(--secondary))]"
              onClick={() => void cancelReservation(activeUploadId)}
            >
              Cancel upload
            </button>
          )}
        </div>
      )}

      {atLimit && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Delete an existing resume before uploading another one.
        </p>
      )}

      <div className="space-y-3">
        {resumes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-5 text-sm text-[hsl(var(--muted-foreground))]">
            No resume uploaded yet.
          </div>
        ) : (
          resumes.map((resume) => (
            <article
              key={resume.id}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="break-words text-sm font-semibold text-white">
                      {resume.label}
                    </h4>
                    {resume.is_primary && (
                      <span className="rounded-full border border-accent/35 px-2 py-0.5 text-[11px] uppercase tracking-widest text-accent">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-words text-xs text-[hsl(var(--muted-foreground))]">
                    {resume.file_name} - {formatSize(resume.file_size)} -{" "}
                    {resume.parsed_text_chars.toLocaleString()} parsed chars -{" "}
                    {formatDate(resume.updated_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!resume.is_primary && (
                    <button
                      type="button"
                      onClick={() => void setPrimary(resume.id)}
                      className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(var(--secondary))]"
                    >
                      Set primary
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={renamingId === resume.id}
                    onClick={() => void renameResume(resume.id, resume.label)}
                    className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(var(--secondary))] disabled:opacity-50"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteResume(resume.id, resume.label)}
                    className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
