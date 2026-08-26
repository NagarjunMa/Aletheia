"use client";

import { useRef, useState } from "react";
import type { ResumeListItem } from "@/lib/resumes/service";

type Props = {
  initialResumes: ResumeListItem[];
  maxResumes: number;
};

type Status = { type: "idle" | "success" | "error"; message: string };

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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshResumes = async () => {
    const res = await fetch("/api/resumes", { method: "GET" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not refresh resumes");
    setResumes(data.resumes ?? []);
  };

  const uploadResume = async (file: File) => {
    setUploading(true);
    setStatus({ type: "idle", message: "" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      await refreshResumes();
      setStatus({
        type: "success",
        message: data.truncated
          ? "Resume uploaded. Parsed text was trimmed to 50,000 characters."
          : "Resume uploaded.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        <p
          className={`text-xs ${
            status.type === "success" ? "text-accent" : "text-red-400"
          }`}
          role={status.type === "error" ? "alert" : "status"}
        >
          {status.message}
        </p>
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
