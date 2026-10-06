import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  Mail,
  MessageSquare,
  Settings,
  Sparkles,
  Upload,
  User,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import ShaderBackground from "@/components/ShaderBackground";
import SignOutButton from "@/components/SignOutButton";
import ApplicationProfileEditor from "@/app/profile/application/ApplicationProfileEditor";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import CreditsPanel from "./CreditsPanel";
import { getApplicationProfileReadiness } from "@/lib/candidate-profile/schema";
import { getCandidateApplicationProfile } from "@/lib/candidate-profile/service";
import {
  listUserResumes,
  MAX_RESUMES_PER_USER,
  type ResumeListItem,
} from "@/lib/resumes/service";

type FeedbackCategory =
  "linkedin_connection" | "cold_email" | "linkedin_inmail";

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
    applicationProfile,
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
      .select("id, content, draft_type, is_accepted, created_at")
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
    getCandidateApplicationProfile(supabase, user.id),
  ]);

  const profile = profileResult.data;
  const todayUsage = rateLimitResult.data?.request_count ?? 0;
  const totalDrafts = draftsResult.count ?? 0;
  const recentDrafts = recentResult.data ?? [];
  const feedbackRows = feedbackResult.data ?? [];
  const totalMessages = feedbackResult.count ?? feedbackRows.length;
  const resumes = resumesResult;
  const primaryResume = resumes.find((resume) => resume.is_primary);
  const applicationReadiness = getApplicationProfileReadiness({
    profile: applicationProfile.profile,
    evidence: applicationProfile.evidence,
    hasPrimaryResume: Boolean(primaryResume),
  });

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

  const dailyUsagePercent = Math.min(
    Math.round((todayUsage / DAILY_LIMIT) * 100),
    100,
  );

  return (
    <div className="product-shell min-h-[100dvh] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <ShaderBackground />
      <main className="mx-auto max-w-7xl animate-fade-in">
        <header className="mb-8 flex flex-col gap-5 border-b border-border/70 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px w-8 bg-primary" aria-hidden="true" />
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-accent">
                Workspace overview
              </p>
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-5xl">
              Good to see you, {displayName}.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <SignOutButton />
        </header>

        <section
          className="grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12"
          aria-label="Profile activity overview"
        >
          <BentoCard className="relative overflow-hidden md:col-span-6 xl:col-span-7">
            <div
              aria-hidden
              className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
            />
            <div className="relative">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <TileHeader icon={MessageSquare} title="Workspace pulse" />
                  <h2 className="mt-7 max-w-md text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-3xl">
                    Your outreach system is ready when you are.
                  </h2>
                </div>
                <Badge variant="outline">
                  Today · {dailyUsagePercent}% used
                </Badge>
              </div>

              <div className="mt-9 grid gap-3 sm:grid-cols-3">
                <StatBlock
                  label="Daily usage"
                  value={todayUsage.toString()}
                  suffix={`/ ${DAILY_LIMIT}`}
                />
                <StatBlock
                  label="Draft archive"
                  value={totalDrafts.toLocaleString()}
                />
                <StatBlock
                  label="Reviewed drafts"
                  value={reviewedCount.toLocaleString()}
                />
              </div>

              <div className="mt-7">
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {Math.max(DAILY_LIMIT - todayUsage, 0)} drafts remain
                  </span>
                  <span>{dailyUsagePercent}%</span>
                </div>
                <Progress
                  value={dailyUsagePercent}
                  aria-label="Daily draft usage"
                />
              </div>
            </div>
          </BentoCard>

          <BentoCard className="md:col-span-6 xl:col-span-5">
            <div className="flex h-full flex-col">
              <TileHeader icon={Sparkles} title="Quick actions" />
              <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
                Keep the context behind each draft current and specific.
              </p>
              <div className="mt-7 grid flex-1 content-end gap-2">
                <ActionLink href="/profile" icon={User}>
                  Manage profile
                </ActionLink>
                <ActionLink href="#candidate-profile" icon={ClipboardCheck}>
                  Edit candidate details
                </ActionLink>
                <ActionLink href="/settings" icon={Settings}>
                  Writing settings
                </ActionLink>
              </div>
            </div>
          </BentoCard>

          <BentoCard className="md:col-span-6 xl:col-span-7">
            <div className="grid h-full gap-7 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
              <div>
                <TileHeader icon={ClipboardCheck} title="Application profile" />
                <div className="mt-7 flex items-baseline gap-3">
                  <p className="text-5xl font-semibold tracking-[-0.04em] text-foreground">
                    {applicationReadiness.completionPercent}%
                  </p>
                  <span className="text-sm text-muted-foreground">
                    complete
                  </span>
                </div>
              </div>
              <div>
                <Progress
                  value={applicationReadiness.completionPercent}
                  aria-label="Application profile completion"
                />
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {applicationReadiness.ready
                    ? "Your verified evidence meets the grounding threshold for role-fit drafts."
                    : (applicationReadiness.missingRequired[0] ??
                      "Add verified context to strengthen role-fit answers.")}
                </p>
                <Link
                  href="#candidate-profile"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-foreground"
                >
                  {applicationReadiness.ready
                    ? "Review application profile"
                    : "Continue building profile"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </BentoCard>

          <div className="md:col-span-6 xl:col-span-5">
            <CreditsPanel className="h-full" />
          </div>

          <BentoCard className="md:col-span-6 xl:col-span-7 xl:row-span-2">
            <div className="flex h-full flex-col">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <TileHeader icon={Mail} title="Recent messages" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Your latest saved drafts, ordered by recency.
                  </p>
                </div>
                <Badge variant="secondary">{recentDrafts.length} shown</Badge>
              </div>

              {recentDrafts.length > 0 ? (
                <div className="grid gap-2">
                  {recentDrafts.map((draft) => (
                    <article
                      key={draft.id}
                      className="group rounded-lg border border-border/65 bg-background/35 p-4 transition-colors hover:border-primary/30 hover:bg-secondary/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm leading-6 text-foreground">
                            {truncateMessage(draft.content)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">
                              {(draft.draft_type ?? "message").replace(
                                /_/g,
                                " ",
                              )}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{formatDate(draft.created_at)}</span>
                            {draft.is_accepted && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-accent">Approved</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex flex-1 flex-col justify-center rounded-lg border border-dashed border-border bg-background/25 p-6">
                  <p className="text-base font-semibold text-foreground">
                    Your draft archive is quiet.
                  </p>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                    Add a primary resume, open a LinkedIn profile, and generate
                    your first reviewed draft from the extension.
                  </p>
                  <Link
                    href="/profile"
                    className="mt-5 inline-flex w-fit items-center gap-2 text-sm font-semibold text-accent hover:text-foreground"
                  >
                    Add a resume
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          </BentoCard>

          <BentoCard className="md:col-span-3 xl:col-span-5">
            <TileHeader icon={Gauge} title="Review health" />
            <div className="mt-7 grid grid-cols-3 divide-x divide-border/70">
              <HealthMetric
                icon={CheckCircle2}
                label="Approved"
                value={approvalRate}
                tone="positive"
              />
              <HealthMetric
                icon={XCircle}
                label="Rejected"
                value={rejectRate}
                tone="negative"
              />
              <HealthMetric
                icon={MessageSquare}
                label="Reviewed"
                value={totalMessages.toLocaleString()}
              />
            </div>
            <p className="mt-6 text-xs leading-5 text-muted-foreground">
              {approvedCount.toLocaleString()} approved ·{" "}
              {rejectedCount.toLocaleString()} rejected
            </p>
          </BentoCard>

          <BentoCard className="md:col-span-3 xl:col-span-5">
            <TileHeader icon={BarChart3} title="Message mix" />
            <div className="mt-6 grid gap-5">
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
            <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <TileHeader icon={FileText} title="Resume context" />
                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                  {primaryResume
                    ? primaryResume.label
                    : "No primary resume selected"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {primaryResume
                    ? `${primaryResume.file_name} is grounding generation across the extension.`
                    : "Upload a resume so Aletheia can ground messages in your real background."}
                </p>
                <Link
                  href="/profile"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {primaryResume ? "Manage resumes" : "Upload resume"}
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
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
                    primaryResume ? formatSize(primaryResume.file_size) : "—"
                  }
                />
              </div>
            </div>
          </BentoCard>
        </section>

        <section
          id="candidate-profile"
          className="scroll-mt-6 pt-14"
          aria-labelledby="candidate-profile-heading"
        >
          <div className="mb-7 max-w-3xl">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px w-8 bg-primary" aria-hidden="true" />
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-accent">
                Candidate source of truth
              </p>
            </div>
            <h2
              id="candidate-profile-heading"
              className="text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
            >
              Your details, editable in one place.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Open a category, update only what changed, and save it without
              leaving the dashboard. Confirmed evidence remains separate from
              stable career and application details.
            </p>
          </div>

          <ApplicationProfileEditor
            key={applicationProfile.evidence.map((item) => item.id).join(":")}
            initialProfile={applicationProfile.profile}
            initialEvidence={applicationProfile.evidence}
            hasPrimaryResume={Boolean(primaryResume)}
          />
        </section>
      </main>
    </div>
  );
}

function BentoCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "p-5 transition-[border-color,background-color,transform,translate] duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card sm:p-6",
        className,
      )}
    >
      {children}
    </Card>
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
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
        <Icon className="h-5 w-5" aria-hidden={true} />
      </span>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
    </div>
  );
}

function StatBlock({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 p-4">
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold leading-none tracking-[-0.035em] text-foreground">
        {value}
        {suffix && (
          <span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
    </div>
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
      className="group flex items-center justify-between gap-3 rounded-lg border border-border/65 bg-background/30 px-3.5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-secondary/60"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-accent" aria-hidden={true} />
        {children}
      </span>
      <ArrowRight
        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
        aria-hidden={true}
      />
    </Link>
  );
}

function HealthMetric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <Icon
        className={cn(
          "mb-3 h-4 w-4 text-muted-foreground",
          tone === "positive" && "text-accent",
          tone === "negative" && "text-rose-300",
        )}
        aria-hidden="true"
      />
      <p className="text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function CategoryMeter({ stat, total }: { stat: CategoryStat; total: number }) {
  const percentage = total > 0 ? Math.round((stat.count / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          {stat.label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {stat.count.toLocaleString()} · {percentage}%
        </span>
      </div>
      <Progress
        value={percentage}
        aria-label={`${stat.label} ${percentage}%`}
      />
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
    <div className="rounded-lg border border-border/60 bg-background/30 p-4">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-foreground">
        {value}
        {suffix && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}
