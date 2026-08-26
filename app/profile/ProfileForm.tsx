"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "./actions";

type Props = {
  initialFullName: string;
  initialTargetJobDescription: string;
};

export default function ProfileForm({
  initialFullName,
  initialTargetJobDescription,
}: Props) {
  const [fullName, setFullName] = useState(initialFullName);
  const [jd, setJd] = useState(initialTargetJobDescription);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await updateProfile({
        full_name: fullName,
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
          <span className="text-xs text-accent" role="status">
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
