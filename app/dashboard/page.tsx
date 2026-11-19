import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ApplicationProfileEditor from "@/app/profile/application/ApplicationProfileEditor";
import DashboardView from "./DashboardView";
import { loadDashboard } from "./load-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");
  const data = await loadDashboard(supabase, user.id);
  const primary = data.resumes?.find((resume) => resume.is_primary);
  const applicationProfile = data.application;
  return (
    <DashboardView
      key={user.id}
      ownerId={user.id}
      name={data.profileName || user.email?.split("@")[0] || "there"}
      email={user.email ?? ""}
      data={data}
      candidateEditor={
        applicationProfile && data.resumes !== null ? (
          <ApplicationProfileEditor
            key={user.id}
            initialProfile={applicationProfile.profile}
            initialEvidence={applicationProfile.evidence}
            hasPrimaryResume={Boolean(primary)}
            {...(primary?.has_storage_file && {
              uploadedPrimaryResumeId: primary.id,
            })}
          />
        ) : (
          <p role="status">
            Profile context is temporarily unavailable. Refresh to try again;
            your saved details have not been changed.
          </p>
        )
      }
    />
  );
}
