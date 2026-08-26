"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily:
            '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
          background:
            "radial-gradient(circle at 15% 105%, #285d49 0%, #091814 28%, #020403 66%)",
          color: "#f7faf9",
        }}
      >
        <div
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "1rem",
            padding: "2rem",
            width: "100%",
            maxWidth: "28rem",
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div
            style={{
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                height: "4rem",
                width: "4rem",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.2)",
              }}
            >
              <svg
                style={{ height: "2rem", width: "2rem", color: "#ef4444" }}
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

          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#aebdb7",
              marginBottom: "1.5rem",
            }}
          >
            {error.message || "An unexpected error occurred. Please try again."}
          </p>

          <button
            onClick={reset}
            style={{
              borderRadius: "0.5rem",
              background: "#285d49",
              padding: "0.625rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#f7faf9",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
