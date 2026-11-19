"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Pause, Play, ArrowUpRight, RefreshCw } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { DashboardMetrics } from "@/modules/dashboard/domain/dashboard-metrics";
import { stageLabels } from "./dashboard-presentation";
import styles from "./dashboard.module.css";

gsap.registerPlugin(useGSAP);

export function RefreshDashboard() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={styles.quietButton}
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      <RefreshCw size={14} aria-hidden="true" />
      {pending ? "Refreshing…" : "Refresh dashboard"}
    </button>
  );
}

export default function ProfileBeam({
  profile,
}: {
  profile: DashboardMetrics["profile"] | null;
}) {
  const root = useRef<HTMLElement>(null);
  const sweep = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  useGSAP(
    () => {
      if (!profile || !sweep.current) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const tween = gsap.fromTo(
          sweep.current,
          { xPercent: -110 },
          {
            xPercent: 400,
            duration: 7,
            ease: "none",
            repeat: -1,
            paused: paused || document.hidden,
          },
        );
        const sync = () => {
          tween.paused(paused || document.hidden);
        };
        document.addEventListener("visibilitychange", sync);
        return () => {
          document.removeEventListener("visibilitychange", sync);
        };
      });
      return () => media.revert();
    },
    {
      scope: root,
      dependencies: [paused, Boolean(profile)],
      revertOnUpdate: true,
    },
  );

  return (
    <section
      ref={root}
      className={styles.beam}
      aria-labelledby="profile-progress-title"
    >
      <div className={styles.beamHeading}>
        <div>
          <p className={styles.eyebrow} id="profile-progress-title">
            Your profile, taking shape
          </p>
          <p className={styles.beamDescription}>
            {profile
              ? profile.ready
                ? "Ready for grounded drafting. Keep your experience current."
                : `Next: ${stageLabels[profile.nextStage ?? ""] ?? "review your profile"}.`
              : "Profile progress unavailable. Your saved details have not been changed."}
          </p>
        </div>
        <div className={styles.beamActions}>
          {profile && (
            <>
              <strong className={styles.percent}>
                {profile.completionPercent}%
              </strong>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.motionToggle}`}
                aria-label={
                  paused
                    ? "Resume profile animation"
                    : "Pause profile animation"
                }
                aria-pressed={paused}
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? (
                  <Play size={14} aria-hidden="true" />
                ) : (
                  <Pause size={14} aria-hidden="true" />
                )}
              </button>
            </>
          )}
          <Link href="#candidate-profile" className={styles.actionLink}>
            {profile?.ready ? "Edit profile" : "Continue profile"}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
      {profile && (
        <>
          <div
            className={styles.beamRail}
            role="progressbar"
            aria-label="Profile completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={profile.completionPercent}
          >
            <span
              className={styles.beamFill}
              style={{ width: `${profile.completionPercent}%` }}
            />
            <span ref={sweep} className={styles.beamSweep} aria-hidden="true" />
          </div>
          <ol className={styles.stages} aria-label="Profile completion stages">
            {profile.stages.map((stage) => (
              <li key={stage.id} data-complete={stage.complete}>
                <span className={styles.stageMark} aria-hidden="true">
                  {stage.complete ? <Check size={11} /> : <span />}
                </span>
                <span>
                  {stageLabels[stage.id] ?? "Profile detail"}
                  <span className="sr-only">
                    :{" "}
                    {stage.complete
                      ? "complete"
                      : stage.required
                        ? "required, incomplete"
                        : "optional, incomplete"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.beamFootnote}>
            Readiness reflects reviewed facts and background, not a match to
            every role. Other steps are optional.
          </p>
        </>
      )}
    </section>
  );
}
