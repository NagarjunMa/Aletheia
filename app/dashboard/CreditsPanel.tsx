"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { DashboardMetrics } from "@/modules/dashboard/domain/dashboard-metrics";
import { creditSummarySchema, dateLabel } from "./dashboard-presentation";
import type { z } from "zod";
import styles from "./dashboard.module.css";

type State =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "signed_out" }
  | { status: "ready"; summary: z.infer<typeof creditSummarySchema> };

export default function CreditsPanel({
  quota,
  className = "",
}: {
  quota?: DashboardMetrics["quota"] | null;
  className?: string;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState({ status: "loading" });
      try {
        const response = await fetch("/api/billing/credits", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          if (!controller.signal.aborted) setState({ status: "signed_out" });
          return;
        }
        if (!response.ok) throw new Error("Credits unavailable");
        const summary = creditSummarySchema.parse(await response.json());
        if (!controller.signal.aborted) setState({ status: "ready", summary });
      } catch {
        if (!controller.signal.aborted) setState({ status: "unavailable" });
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  return (
    <Card
      role="region"
      className={`${styles.card} ${styles.credits} ${className}`}
      aria-labelledby="credits-title"
    >
      <h2 className={styles.cardTitle} id="credits-title">
        <Coins size={16} aria-hidden="true" />
        Credit balance
      </h2>
      <div
        className={styles.creditContent}
        aria-live="polite"
        aria-atomic="true"
      >
        {state.status === "loading" ? (
          <p className={styles.muted}>Loading credits…</p>
        ) : state.status === "unavailable" ? (
          <>
            <p>Credit balance unavailable</p>
            <button
              className={styles.quietButton}
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Retry credits
            </button>
          </>
        ) : state.status === "signed_out" ? (
          <p>
            <Link className={styles.actionLink} href="/auth/login">
              Sign in again to view credits
            </Link>
          </p>
        ) : (
          <>
            <p className={styles.creditValue}>
              {state.summary.unlimitedCredits ? (
                "Unlimited"
              ) : (
                <>
                  {state.summary.balance!.toLocaleString()}
                  <span>credits</span>
                </>
              )}
            </p>
            <p className={styles.muted}>
              {state.summary.unlimitedCredits
                ? "Developer access · daily safeguards apply"
                : "No expiry · connections 2, other drafts 4"}
            </p>
          </>
        )}
      </div>
      <div className={styles.quota}>
        {quota ? (
          <>
            <div>
              <span className={styles.muted}>24-hour quota</span>
              <strong>
                {quota.used} / {quota.limit}
              </strong>
            </div>
            <div className={styles.barTrack} aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(100, (quota.used / quota.limit) * 100)}%`,
                }}
              />
            </div>
            <p className={styles.muted}>
              {quota.remaining} requests remain
              {quota.resetAt
                ? ` · resets ${dateLabel(quota.resetAt)} at ${new Date(quota.resetAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`
                : " · starts with your next generation"}
            </p>
          </>
        ) : (
          <p className={styles.muted}>Quota unavailable</p>
        )}
      </div>
    </Card>
  );
}
