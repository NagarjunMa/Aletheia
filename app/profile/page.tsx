import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ShaderBackground from "@/components/ShaderBackground";
import ProfileForm from "./ProfileForm";
import ResumeManager from "./ResumeManager";
import { listUserResumes, MAX_RESUMES_PER_USER } from "@/lib/resumes/service";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const resumes = await listUserResumes(supabase, user.id).catch(() => []);

  const displayName = profile?.full_name || user.email?.split("@")[0] || "User";
  const email = profile?.email || user.email || "";
  const avatarUrl = profile?.avatar_url;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  // Extract initials for fallback avatar
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="product-shell min-h-[100dvh] px-4 py-12 sm:px-6 lg:px-8">
      <ShaderBackground />
      <div className="mx-auto max-w-2xl animate-fade-in">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-white transition-colors mb-4"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">Profile</h1>
        </div>

        {/* Profile Card */}
        <div className="glass rounded-2xl p-8 mb-6">
          <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
            {/* Avatar */}
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={80}
                height={80}
                className="h-20 w-20 rounded-full border-2 border-[hsl(var(--border))] object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--primary))]/20 border-2 border-[hsl(var(--border))]">
                <span className="text-2xl font-bold text-[hsl(var(--primary))]">
                  {initials}
                </span>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-white">{displayName}</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {email}
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-5">Details</h3>
          <div className="space-y-4">
            <DetailRow label="Full Name" value={displayName} />
            <DetailRow label="Email" value={email} />
            <DetailRow label="Member Since" value={memberSince} />
          </div>
        </div>

        <section className="glass my-6 rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-accent">
            Candidate source of truth
          </p>
          <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">
                Application profile
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                Add verified achievements, difficult projects, startup goals,
                links, and application logistics for grounded YC startup role
                answers.
              </p>
            </div>
            <Link
              href="/dashboard#candidate-profile"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90"
            >
              Edit details in dashboard
            </Link>
          </div>
        </section>

        <ProfileForm
          initialFullName={profile?.full_name ?? ""}
          initialTargetJobDescription={profile?.target_job_description ?? ""}
        />

        <ResumeManager
          initialResumes={resumes}
          maxResumes={MAX_RESUMES_PER_USER}
        />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
      <span className="text-sm text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}
