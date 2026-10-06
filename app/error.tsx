"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 w-full max-w-md animate-fade-in text-center">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--destructive))]/20">
            <svg
              className="h-8 w-8 text-[hsl(var(--destructive))]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-white hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))] transition-all"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-[hsl(var(--border))] px-6 py-2.5 text-sm font-medium text-white hover:bg-[hsl(var(--accent))] focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))] transition-all"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
