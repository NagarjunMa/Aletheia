// Synthetic browser fixtures; never imported by a production route.
import type { DashboardData } from "@/app/dashboard/load-dashboard";
import { profileProgress } from "@/modules/dashboard/domain/dashboard-metrics";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";

export function dashboardFixture(
  mode = "populated",
  owner = "a",
): DashboardData {
  const empty = mode === "empty";
  const resumeBackground =
    mode === "resume_only" ||
    mode === "resume_removed" ||
    mode === "resume_outage";
  const hasResume = !empty && mode !== "resume_removed" && mode !== "role_only";
  const profile = candidateProfileInputSchema.parse(
    empty
      ? {}
      : {
          currentRole: resumeBackground
            ? ""
            : owner === "a"
              ? "Platform Engineer"
              : "Product Engineer",
          currentResponsibilities: "I maintain TypeScript services.",
          startupMotivation: "Build useful tools.",
          careerGoals: "Reliable systems",
          githubUrl: "https://github.com/example",
          location: "London",
        },
  );
  const evidence: CandidateEvidenceRecord[] = empty
    ? []
    : [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ].map((id, index) => {
        const record: CandidateEvidenceRecord = {
          id,
          kind: index === 0 ? "technical_project" : "ai_usage",
          title: "PRIVATE_SOURCE_CANARY",
          actions: "I built TypeScript tools.",
          context: "",
          outcome: "",
          skills: [],
          links: [],
          metrics: [],
          confirmed: true,
          sortOrder: index,
        };
        return {
          ...record,
          factReview: prepareFactReview(record, [
            { id, kind: "action", excerpt: record.actions, confirmed: true },
          ]),
        };
      });
  const application = { profile, evidence };
  const counts = empty
    ? [0, 0, 0, 0]
    : owner === "a"
      ? [12, 4, 6, 2]
      : [1, 0, 0, 0];
  return {
    profileName: owner === "a" ? "Alex Morgan" : "Sam Chen",
    application,
    metrics:
      mode === "unavailable" || mode === "resume_outage"
        ? null
        : {
            period: {
              from: "2026-10-20T00:00:00Z",
              to: "2026-11-18T12:00:00Z",
              days: 30,
              timeZone: "UTC",
            },
            coverage: {
              recordingStartedAt: "2026-11-01T00:00:00Z",
              availableFrom: "2026-11-01T00:00:00Z",
              capture: "best_effort",
            },
            activity: {
              requests: counts.reduce((a, b) => a + b, 0),
              successfulRequests: empty ? 0 : owner === "a" ? 22 : 1,
              failedRequests: empty ? 0 : owner === "a" ? 2 : 0,
              outputs: empty ? 0 : owner === "a" ? 30 : 1,
              providerAttempts: empty ? 0 : 24,
              unknownProviderRequests: 0,
              successRate: empty ? null : owner === "a" ? 91.67 : 100,
              byCategory: (
                [
                  "linkedin_connection",
                  "linkedin_inmail",
                  "cold_email",
                  "yc_application",
                ] as const
              ).map((category, index) => ({
                category,
                requests: counts[index]!,
                successes:
                  counts[index]! -
                  (owner === "a" && !empty && category === "cold_email"
                    ? 2
                    : 0),
                failures:
                  owner === "a" && !empty && category === "cold_email" ? 2 : 0,
                outputs:
                  category === "yc_application"
                    ? counts[index]! * 5
                    : counts[index]! -
                      (owner === "a" && !empty && category === "cold_email"
                        ? 2
                        : 0),
              })),
              daily: [],
            },
            reviews: {
              approved: empty ? 0 : 8,
              rejected: empty ? 0 : 2,
              approvalRate: empty ? null : 80,
              rejectionReasons: empty
                ? []
                : [
                    { reason: "too_generic", count: 1 },
                    { reason: "weak_target_relevance", count: 1 },
                  ],
            },
            quota: {
              used: empty ? 0 : 7,
              limit: 30,
              remaining: empty ? 30 : 23,
              resetAt: empty ? null : "2026-11-19T09:00:00Z",
            },
            profile: profileProgress(application, hasResume),
          },
    resumes:
      mode === "unavailable" || mode === "resume_outage"
        ? null
        : !hasResume
          ? []
          : [
              {
                id: "33333333-3333-4333-8333-333333333333",
                label: "Platform engineering",
                file_name: "alex-resume.pdf",
                file_mime: "application/pdf",
                file_size: 12000,
                is_primary: true,
                created_at: "2026-11-01T00:00:00Z",
                updated_at: "2026-11-01T00:00:00Z",
                parsed_text_chars: 2400,
                has_storage_file: true,
              },
            ],
    recent:
      mode === "unavailable"
        ? null
        : empty
          ? []
          : [
              {
                id: "44444444-4444-4444-8444-444444444444",
                content:
                  "Hi Jordan, I build platform tools that make everyday engineering simpler. I would enjoy connecting over reliable developer experiences.",
                draft_type: "adaptive_polish",
                is_accepted: true,
                created_at: "2026-11-17T00:00:00Z",
              },
            ],
  };
}
