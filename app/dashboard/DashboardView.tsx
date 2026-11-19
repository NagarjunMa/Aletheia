import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  FileText,
  Gauge,
  Mail,
  Settings,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import SignOutButton from "@/components/SignOutButton";
import type { DashboardMetrics } from "@/modules/dashboard/domain/dashboard-metrics";
import type { DashboardData } from "./load-dashboard";
import ProfileBeam, { RefreshDashboard } from "./ProfileBeam";
import CreditsPanel from "./CreditsPanel";
import {
  categoryLabels,
  rejectionLabels,
  dateLabel,
} from "./dashboard-presentation";
import styles from "./dashboard.module.css";

type Props = {
  ownerId: string;
  name: string;
  email: string;
  data: DashboardData;
  candidateEditor: ReactNode;
};

function MetricCard({
  title,
  id,
  icon,
  children,
  className = "",
}: {
  title: string;
  id: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      role="region"
      aria-labelledby={id}
      className={`${styles.card} ${className}`}
    >
      <h2 id={id} className={styles.cardTitle}>
        {icon}
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Activity({ metrics }: { metrics: DashboardMetrics | null }) {
  const max = Math.max(
    1,
    ...(metrics?.activity.byCategory.map((entry) => entry.requests) ?? []),
  );
  return (
    <MetricCard
      title="Outreach activity"
      id="activity-title"
      icon={<BarChart3 size={16} aria-hidden="true" />}
      className={styles.activity ?? ""}
    >
      {metrics ? (
        <>
          <div className={styles.headline}>
            <strong>{metrics.activity.requests.toLocaleString()}</strong>
            <span>requests</span>
            <p>
              {metrics.activity.outputs.toLocaleString()} drafts &amp; answers
              produced
            </p>
          </div>
          <ul
            className={styles.meters}
            aria-label="Generation requests by channel"
          >
            {(
              Object.keys(categoryLabels) as (keyof typeof categoryLabels)[]
            ).map((category) => {
              const entry = metrics.activity.byCategory.find(
                (row) => row.category === category,
              );
              return (
                <li key={category}>
                  <div>
                    <span>{categoryLabels[category]}</span>
                    <strong>
                      {entry ? entry.requests.toLocaleString() : "Unavailable"}
                      <span className="sr-only"> requests</span>
                    </strong>
                  </div>
                  <div className={styles.barTrack} aria-hidden="true">
                    <span
                      data-channel={category}
                      style={{
                        width: `${entry ? (entry.requests / max) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className={styles.footnote}>
            A batch is one request; each successful answer counts as an output.
          </p>
        </>
      ) : (
        <p className={styles.unavailable}>
          Activity unavailable. Refresh to try again.
        </p>
      )}
    </MetricCard>
  );
}

function Reviews({ metrics }: { metrics: DashboardMetrics | null }) {
  const reviews = metrics?.reviews;
  const max = Math.max(
    1,
    ...(reviews?.rejectionReasons.map((entry) => entry.count) ?? []),
  );
  return (
    <MetricCard
      title="Review health"
      id="review-title"
      icon={<Gauge size={16} aria-hidden="true" />}
      className={styles.reviews ?? ""}
    >
      {reviews ? (
        <>
          <div className={styles.headline}>
            <strong>
              {reviews.approvalRate === null ? "—" : `${reviews.approvalRate}%`}
            </strong>
            <span>approval rate</span>
            <p>
              {reviews.approved} approved · {reviews.rejected} rejected
            </p>
          </div>
          {reviews.approvalRate === null ? (
            <p className={styles.empty}>
              No reviews yet. Accept or reject a generated draft to build your
              feedback picture.
            </p>
          ) : reviews.rejected === 0 ? (
            <p className={styles.empty}>No rejected drafts in this period.</p>
          ) : (
            <>
              <h3 className={styles.smallHeading}>Reasons for rejection</h3>
              <ul
                className={styles.meters}
                aria-label="Rejection reason counts"
              >
                {reviews.rejectionReasons.map(({ reason, count }) => (
                  <li key={reason}>
                    <div>
                      <span>
                        {rejectionLabels[reason] ?? "Reason not provided"}
                      </span>
                      <strong>{count}</strong>
                    </div>
                    <div
                      className={`${styles.barTrack} ${styles.rejectionBar}`}
                      aria-hidden="true"
                    >
                      <span style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.footnote}>
            Approved ÷ all reviewed drafts. This does not measure replies or
            hires.
          </p>
        </>
      ) : (
        <p className={styles.unavailable}>
          Review data unavailable. Refresh to try again.
        </p>
      )}
    </MetricCard>
  );
}

export default function DashboardView({
  ownerId,
  name,
  email,
  data,
  candidateEditor,
}: Props) {
  const { metrics, application, resumes, recent } = data;
  const primary = resumes?.find((resume) => resume.is_primary);
  return (
    <div className={`product-shell ${styles.shell}`}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.identity}>
            <Link className={styles.wordmark} href="/">
              ALETHEIA <span>/ WORKSPACE</span>
            </Link>
            <h1>Good to see you, {name}.</h1>
            <p>
              {application?.profile.currentRole && (
                <>
                  <span>{application.profile.currentRole}</span>
                  <span className={styles.separator} aria-hidden="true">
                    /
                  </span>
                </>
              )}
              {email}
            </p>
          </div>
          <nav aria-label="Workspace actions" className={styles.headerActions}>
            <Link href="/settings" className={styles.quietButton}>
              <Settings size={15} aria-hidden="true" />
              Writing settings
            </Link>
            <SignOutButton />
          </nav>
        </header>

        <ProfileBeam profile={metrics?.profile ?? null} />

        <div className={styles.periodRow}>
          <div>
            <h2>Your outreach, at a glance</h2>
            <p>
              {metrics
                ? `${dateLabel(metrics.period.from)} – ${dateLabel(metrics.period.to)} · ${metrics.period.days} days · UTC`
                : "Dashboard metrics unavailable"}
            </p>
          </div>
          <RefreshDashboard />
        </div>
        <section aria-label="Workspace metrics" className={styles.grid}>
          <CreditsPanel
            key={`${ownerId}:${metrics?.period.to ?? "unavailable"}`}
            quota={metrics?.quota ?? null}
          />
          <Activity metrics={metrics} />
          <Reviews metrics={metrics} />
        </section>
        {metrics && (
          <p className={styles.coverage}>
            Recorded activity available from{" "}
            {dateLabel(metrics.coverage.availableFrom)}. History is best-effort;
            earlier activity and some requests may be missing.
          </p>
        )}

        <section
          aria-labelledby="resume-title"
          className={styles.resumeSection}
        >
          <Card className={`${styles.card} ${styles.resume}`}>
            <div>
              <h2 className={styles.cardTitle} id="resume-title">
                <FileText size={16} aria-hidden="true" />
                Résumé context
              </h2>
              <h3>
                {resumes === null
                  ? "Résumé information unavailable"
                  : primary
                    ? primary.label
                    : "Add context to your experience"}
              </h3>
              <p className={styles.muted}>
                {resumes === null
                  ? "Your saved résumés have not been changed. Refresh to try again."
                  : primary
                    ? primary.file_name
                    : "A résumé is optional when your current role and reviewed experience are ready."}
              </p>
            </div>
            <div className={styles.resumeMeta}>
              {resumes !== null && (
                <>
                  <span>
                    {resumes.length} saved{" "}
                    {resumes.length === 1 ? "résumé" : "résumés"}
                  </span>
                  <span>
                    {primary ? (
                      <>
                        <Check size={14} aria-hidden="true" />
                        Primary selected
                      </>
                    ) : (
                      "No primary selected"
                    )}
                  </span>
                </>
              )}
              <Link href="/profile" className={styles.primaryAction}>
                {resumes === null || primary
                  ? "Manage résumés"
                  : "Add a résumé"}
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </Card>
        </section>

        <section
          id="candidate-profile"
          aria-labelledby="candidate-profile-heading"
          className={styles.candidate}
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>
                The experience behind your drafts
              </p>
              <h2 id="candidate-profile-heading">
                Make your next introduction more you.
              </h2>
            </div>
            <Link className={styles.actionLink} href="/profile/application">
              Open application profile
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {candidateEditor}
        </section>

        <section
          aria-labelledby="recent-title"
          className={styles.recentSection}
        >
          <MetricCard
            title="Recent messages"
            id="recent-title"
            icon={<Mail size={16} aria-hidden="true" />}
          >
            <p className={styles.muted}>
              Your latest saved drafts, ordered by recency.
            </p>
            {recent === null ? (
              <p className={styles.unavailable}>
                Recent messages unavailable. Refresh to try again.
              </p>
            ) : recent.length === 0 ? (
              <div className={styles.empty}>
                <p>No saved drafts yet.</p>
                <Link className={styles.actionLink} href="/install">
                  Open the extension guide
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <ol className={styles.recentList}>
                {recent.map((draft) => (
                  <li key={draft.id}>
                    <p>
                      {draft.content
                        ? draft.content.length > 190
                          ? `${draft.content.slice(0, 190).trim()}…`
                          : draft.content
                        : "Draft content unavailable"}
                    </p>
                    <div className={styles.draftMeta}>
                      <span>
                        {draft.draft_type === "grammar_fix"
                          ? "Grammar correction"
                          : "Adaptive polish"}
                      </span>
                      <time dateTime={draft.created_at}>
                        {dateLabel(draft.created_at)}
                      </time>
                      {draft.is_accepted && <span>Approved</span>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </MetricCard>
        </section>
      </main>
    </div>
  );
}
