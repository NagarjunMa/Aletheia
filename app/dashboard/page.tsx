import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  Gauge,
  Mail,
  MessageSquare,
  Settings,
  Sparkles,
  Upload,
  User,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import ShaderBackground from "@/components/ShaderBackground";
import SignOutButton from "@/components/SignOutButton";
import CreditsPanel from "./CreditsPanel";
import {
  listUserResumes,
  MAX_RESUMES_PER_USER,
  type ResumeListItem,
} from "@/lib/resumes/service";

type FeedbackCategory =
  | "linkedin_connection"
  | "cold_email"
  | "linkedin_inmail";

type FeedbackMetadata = {
  category?: unknown;
};

type CategoryStat = {
  key: FeedbackCategory;
  label: string;
  count: number;
};

const DAILY_LIMIT = Number(process.env.EXTENSION_DAILY_LIMIT) || 30;

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  linkedin_connection: "LinkedIn connection",
  cold_email: "Cold email",
  linkedin_inmail: "LinkedIn InMail",
};

function getFeedbackCategory(metadata: unknown): FeedbackCategory | null {
  if (!metadata || typeof metadata !== "object") return null;
  const category = (metadata as FeedbackMetadata).category;
  if (
    category === "linkedin_connection" ||
    category === "cold_email" ||
    category === "linkedin_inmail"
  ) {
    return category;
  }
  return null;
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateMessage(content: string | null, maxLength = 120): string {
  if (!content) return "Draft content unavailable";
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength).trim()}...`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  const [
    profileResult,
    rateLimitResult,
    draftsResult,
    recentResult,
    preferencesResult,
    feedbackResult,
    resumesResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("extension_rate_limits")
      .select("request_count")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("generated_drafts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("generated_drafts")
      .select("id, content, cpl_score, draft_type, is_accepted, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("user_preferences")
      .select("approved_message_count, rejected_message_count")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_feedback")
      .select("feedback_type, metadata, created_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    listUserResumes(supabase, user.id).catch(() => [] as ResumeListItem[]),
  ]);

  const profile = profileResult.data;
  const todayUsage = rateLimitResult.data?.request_count ?? 0;
  const totalDrafts = draftsResult.count ?? 0;
  const recentDrafts = recentResult.data ?? [];
  const cplScore = profile?.cpl_score ?? 0;
  const feedbackRows = feedbackResult.data ?? [];
  const totalMessages = feedbackResult.count ?? feedbackRows.length;
  const resumes = resumesResult;
  const primaryResume = resumes.find((resume) => resume.is_primary);

  const approvedCount =
    preferencesResult.data?.approved_message_count ??
    feedbackRows.filter((row) => row.feedback_type === "approved").length;
  const rejectedCount =
    preferencesResult.data?.rejected_message_count ??
    feedbackRows.filter((row) => row.feedback_type === "rejected").length;
  const reviewedCount = approvedCount + rejectedCount;
  const approvalRate = formatPercent(approvedCount, reviewedCount);
  const rejectRate = formatPercent(rejectedCount, reviewedCount);

  const categoryCounts = feedbackRows.reduce<Record<FeedbackCategory, number>>(
    (acc, row) => {
      const category = getFeedbackCategory(row.metadata);
      if (category) acc[category] += 1;
      return acc;
    },
    {
      linkedin_connection: 0,
      cold_email: 0,
      linkedin_inmail: 0,
    },
  );
  const categoryStats = (
    Object.keys(CATEGORY_LABELS) as FeedbackCategory[]
  ).map<CategoryStat>((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    count: categoryCounts[key],
  }));
  const categoryTotal = categoryStats.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  const displayName = profile?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div className="landing min-h-[100dvh] px-4 py-10 sm:px-6 lg:px-8">
      <ShaderBackground />
      <div className="mx-auto max-w-6xl animate-fade-in">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.24em] text-[#DAF1DE]/70">
              Profile command center
            </p>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              Welcome back, {displayName}
            </h1>
            <p className="mt-2 text-sm text-[#CBEFEB]/70">{user.email}</p>
          </div>
          <SignOutButton />
        </div>

        <section
          className="grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12"
          aria-label="Profile activity overview"
        >
          <MetricTile
            title="Today's usage"
            value={todayUsage.toString()}
            suffix={`/ ${DAILY_LIMIT}`}
            note={`${Math.max(DAILY_LIMIT - todayUsage, 0)} drafts left today`}
            icon={MessageSquare}
            className="md:col-span-3 xl:col-span-3"
          />
          <MetricTile
            title="Drafts generated"
            value={totalDrafts.toLocaleString()}
            note="Stored draft history"
            icon={FileText}
            className="md:col-span-3 xl:col-span-3"
          />
          <MetricTile
            title="CPL score"
            value={cplScore.toFixed(1)}
            note="Current profile baseline"
            icon={Zap}
            className="md:col-span-3 xl:col-span-3"
          />
          <BentoCard className="md:col-span-3 xl:col-span-3">
            <div className="flex h-full flex-col justify-between gap-5">
              <div>
                <TileHeader icon={Sparkles} title="Quick actions" />
                <p className="mt-3 text-sm text-[#CBEFEB]/70">
                  Jump into the places that keep generation quality sharp.
                </p>
              </div>
              <div className="grid gap-2">
                <ActionLink href="/profile" icon={User}>
                  Manage profile
                </ActionLink>
                <ActionLink href="/settings" icon={Settings}>
                  Writing settings
                </ActionLink>
              </div>
            </div>
          </BentoCard>

          <div className="md:col-span-6 xl:col-span-12">
            <CreditsPanel />
          </div>

          <BentoCard className="md:col-span-6 xl:col-span-6 xl:row-span-2">
            <div className="flex h-full flex-col">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <TileHeader icon={Mail} title="Recent messages" />
                  <p className="mt-2 text-sm text-[#CBEFEB]/65">
                    Latest generated drafts saved to your workspace.
                  </p>
                </div>
                <span className="rounded-full border border-[#DAF1DE]/15 bg-[#DAF1DE]/10 px-3 py-1 text-xs text-[#DAF1DE]">
                  {recentDrafts.length} shown
                </span>
              </div>

              {recentDrafts.length > 0 ? (
                <div className="grid gap-3">
                  {recentDrafts.map((draft) => (
                    <article
                      key={draft.id}
                      className="rounded-lg border border-[#DAF1DE]/12 bg-[#06191d]/45 p-4 transition-colors hover:border-[#DAF1DE]/24 hover:bg-[#0c2529]/55"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm leading-6 text-white">
                            {truncateMessage(draft.content)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#CBEFEB]/62">
                            <span className="capitalize">
                              {(draft.draft_type ?? "message").replace(
                                /_/g,
                                " ",
                              )}
                            </span>
                            <span>•</span>
                            <span>{formatDate(draft.created_at)}</span>
                            {draft.is_accepted && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-300">
                                  Approved
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {draft.cpl_score != null && (
                          <span className="shrink-0 rounded-md border border-[#DAF1DE]/12 bg-[#DAF1DE]/10 px-2.5 py-1 text-sm font-semibold text-[#DAF1DE]">
                            {Math.round(draft.cpl_score)}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex flex-1 flex-col justify-center rounded-lg border border-dashed border-[#DAF1DE]/20 bg-[#DAF1DE]/8 p-6">
                  <p className="text-base font-semibold text-white">
                    No recent messages yet.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#CBEFEB]/70">
                    Upload a primary resume, open a LinkedIn profile, and
                    generate your first draft from the extension.
                  </p>
                  <Link
                    href="/profile"
                    className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg border border-[#DAF1DE]/20 bg-[#DAF1DE]/12 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#DAF1DE]/18"
                  >
                    Add resume
                    <ArrowRight className="h-4 w-4" aria-hidden={true} />
                  </Link>
                </div>
              )}
            </div>
          </BentoCard>

          <MetricTile
            title="Approval rate"
            value={approvalRate}
            note={`${approvedCount.toLocaleString()} approved`}
            icon={CheckCircle2}
            className="md:col-span-2 xl:col-span-2"
            tone="success"
          />
          <MetricTile
            title="Reject rate"
            value={rejectRate}
            note={`${rejectedCount.toLocaleString()} rejected`}
            icon={XCircle}
            className="md:col-span-2 xl:col-span-2"
            tone="danger"
          />
          <MetricTile
            title="Total messages"
            value={totalMessages.toLocaleString()}
            note="Feedback events recorded"
            icon={Gauge}
            className="md:col-span-2 xl:col-span-2"
          />

          <BentoCard className="md:col-span-6 xl:col-span-6">
            <TileHeader icon={BarChart3} title="Message categories" />
            <div className="mt-5 grid gap-4">
              {categoryStats.map((stat) => (
                <CategoryMeter
                  key={stat.key}
                  stat={stat}
                  total={categoryTotal}
                />
              ))}
            </div>
          </BentoCard>

          <BentoCard className="md:col-span-6 xl:col-span-12">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <TileHeader icon={FileText} title="Your resume" />
                <h2 className="mt-4 text-2xl font-semibold text-white">
                  {primaryResume
                    ? primaryResume.label
                    : "No primary resume selected"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#CBEFEB]/72">
                  {primaryResume
                    ? `${primaryResume.file_name} is powering resume-aware generation across the extension.`
                    : "Upload a resume in your profile so Aletheia can ground messages in your real background."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-2">
                <ResumeFact
                  label="Uploaded"
                  value={`${resumes.length} / ${MAX_RESUMES_PER_USER}`}
                />
                <ResumeFact
                  label="Primary"
                  value={primaryResume ? "Ready" : "Missing"}
                />
                <ResumeFact
                  label="Parsed"
                  value={
                    primaryResume
                      ? primaryResume.parsed_text_chars.toLocaleString()
                      : "0"
                  }
                  suffix="chars"
                />
                <ResumeFact
                  label="File size"
                  value={
                    primaryResume ? formatSize(primaryResume.file_size) : "-"
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#DAF1DE]/20 bg-[#DAF1DE]/14 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#DAF1DE]/22"
                >
                  <Upload className="h-4 w-4" aria-hidden={true} />
                  {primaryResume ? "Manage resumes" : "Upload resume"}
                </Link>
              </div>
            </div>
          </BentoCard>
        </section>
      </div>
    </div>
  );
}

function BentoCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[#DAF1DE]/16 bg-[#CBEFEB]/10 p-5 shadow-[0_22px_70px_rgba(4,18,22,0.24)] backdrop-blur-2xl transition-colors hover:border-[#DAF1DE]/24 hover:bg-[#CBEFEB]/13 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function TileHeader({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#DAF1DE]/14 bg-[#DAF1DE]/12 text-[#DAF1DE]">
        <Icon className="h-5 w-5" aria-hidden={true} />
      </span>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DAF1DE]/72">
        {title}
      </p>
    </div>
  );
}

function MetricTile({
  title,
  value,
  suffix,
  note,
  icon,
  className,
  tone = "default",
}: {
  title: string;
  value: string;
  suffix?: string;
  note: string;
  icon: LucideIcon;
  className?: string;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-300"
      : tone === "danger"
        ? "text-rose-300"
        : "text-white";

  return (
    <BentoCard className={className ?? ""}>
      <div className="flex h-full flex-col justify-between gap-7">
        <TileHeader icon={icon} title={title} />
        <div>
          <p className={`text-4xl font-bold leading-none ${toneClass}`}>
            {value}
            {suffix && (
              <span className="ml-2 text-base font-normal text-[#CBEFEB]/62">
                {suffix}
              </span>
            )}
          </p>
          <p className="mt-3 text-sm text-[#CBEFEB]/68">{note}</p>
        </div>
      </div>
    </BentoCard>
  );
}

function ActionLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border border-[#DAF1DE]/12 bg-[#06191d]/42 px-3.5 py-3 text-sm font-semibold text-white transition-colors hover:border-[#DAF1DE]/24 hover:bg-[#DAF1DE]/12"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-[#DAF1DE]/72" aria-hidden={true} />
        {children}
      </span>
      <ArrowRight className="h-4 w-4 text-[#DAF1DE]/60" aria-hidden={true} />
    </Link>
  );
}

function CategoryMeter({ stat, total }: { stat: CategoryStat; total: number }) {
  const percentage = total > 0 ? Math.round((stat.count / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white">{stat.label}</span>
        <span className="text-xs text-[#CBEFEB]/65">
          {stat.count.toLocaleString()} - {percentage}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#06191d]/55">
        <div
          className="h-full rounded-full bg-[#DAF1DE]/70"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ResumeFact({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-[#DAF1DE]/12 bg-[#06191d]/42 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[#DAF1DE]/58">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-white">
        {value}
        {suffix && (
          <span className="ml-1 text-xs font-normal text-[#CBEFEB]/62">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}
