"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "./actions";

type Props = {
  initialFullName: string;
  initialResume: string;
  initialTargetJobDescription: string;
};

export default function ProfileForm({
  initialFullName,
  initialResume,
  initialTargetJobDescription,
}: Props) {
  const [fullName, setFullName] = useState(initialFullName);
  const [resume, setResume] = useState(initialResume);
  const [jd, setJd] = useState(initialTargetJobDescription);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "error"
  >("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("uploading");
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/profile/parse-resume", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadStatus("error");
        setUploadError(data.error ?? "Upload failed");
        return;
      }
      setResume(data.text);
      setUploadStatus("idle");
      e.target.value = "";
    } catch (err) {
      setUploadStatus("error");
      setUploadError(err instanceof Error ? err.message : "Network error");
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await updateProfile({
        full_name: fullName,
        resume,
        target_job_description: jd,
      });
      if (result.ok) {
        setStatus("saved");
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="glass rounded-2xl p-6 space-y-5"
      aria-label="Edit profile"
    >
      <div className="space-y-1.5">
        <label
          htmlFor="full_name"
          className="block text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))]"
        >
          Full name
        </label>
        <input
          id="full_name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={120}
          autoComplete="name"
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-white"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="resume"
          className="block text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))]"
        >
          Resume{" "}
          <span className="lowercase opacity-60">
            (upload .pdf or .txt — or paste below)
          </span>
        </label>
        <div className="flex items-center gap-3">
          <label
            htmlFor="resume-file"
            className="cursor-pointer rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(var(--secondary))]"
          >
            {uploadStatus === "uploading" ? "Parsing…" : "Upload file"}
          </label>
          <input
            id="resume-file"
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            onChange={onFilePick}
            disabled={uploadStatus === "uploading"}
            className="sr-only"
          />
          {uploadStatus === "error" && uploadError && (
            <span className="text-xs text-red-400" role="alert">
              {uploadError}
            </span>
          )}
        </div>
        <textarea
          id="resume"
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          maxLength={50_000}
          rows={10}
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-white font-mono"
        />
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {resume.length.toLocaleString()} / 50,000
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="jd"
          className="block text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))]"
        >
          Target job description{" "}
          <span className="lowercase opacity-60">(optional)</span>
        </label>
        <textarea
          id="jd"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          maxLength={20_000}
          rows={6}
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-white font-mono"
        />
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {jd.length.toLocaleString()} / 20,000
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {status === "saved" && (
          <span className="text-xs text-emerald-400" role="status">
            Saved.
          </span>
        )}
        {status === "error" && error && (
          <span className="text-xs text-red-400" role="alert">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
