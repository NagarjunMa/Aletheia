import { z } from "zod";
import { getApplicationProfileReadiness } from "@/lib/candidate-profile/schema";
import { readFactReview } from "@/lib/candidate-profile/fact-review";
import type { CandidateApplicationProfile } from "@/lib/candidate-profile/service";

export const DASHBOARD_CATEGORIES = [
  "linkedin_connection",
  "linkedin_inmail",
  "cold_email",
  "yc_application",
] as const;
const count = z.number().int().nonnegative().safe();
const percent = z.number().min(0).max(100).nullable();
const instant = z.iso.datetime({ offset: true });
export const dashboardAggregateSchema = z
  .object({
    period: z
      .object({
        days: z.number().int().min(1).max(90),
        from: instant,
        to: instant,
        timeZone: z.literal("UTC"),
      })
      .strict(),
    coverage: z
      .object({
        recordingStartedAt: instant,
        availableFrom: instant,
        capture: z.literal("best_effort"),
      })
      .strict(),
    activity: z
      .object({
        requests: count,
        successfulRequests: count,
        failedRequests: count,
        outputs: count,
        providerAttempts: count.nullable(),
        unknownProviderRequests: count,
        successRate: percent,
        byCategory: z
          .array(
            z
              .object({
                category: z.enum(DASHBOARD_CATEGORIES),
                requests: count,
                successes: count,
                failures: count,
                outputs: count,
              })
              .strict(),
          )
          .length(4),
        daily: z
          .array(
            z
              .object({
                day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                requests: count,
                outputs: count,
              })
              .strict(),
          )
          .max(90),
      })
      .strict(),
    reviews: z
      .object({
        approved: count,
        rejected: count,
        approvalRate: percent,
        rejectionReasons: z
          .array(
            z
              .object({
                reason: z.enum([
                  "too_generic",
                  "too_formal",
                  "too_repetitive",
                  "weak_target_relevance",
                  "unsupported_feeling",
                  "wrong_ask",
                  "wrong_tone",
                  "unsupported_claim",
                  "missed_question",
                  "formatting",
                  "other",
                  "unspecified",
                ]),
                count,
              })
              .strict(),
          )
          .max(12),
      })
      .strict(),
    quota: z.object({ used: count, resetAt: instant.nullable() }).strict(),
  })
  .strict();

export function profileProgress(
  application: CandidateApplicationProfile,
  hasPrimaryResume: boolean,
) {
  const { profile } = application;
  const evidence = application.evidence.filter(
    (entry) =>
      entry.confirmed && readFactReview(entry, entry.factReview).length > 0,
  );
  const readiness = getApplicationProfileReadiness({
    profile,
    evidence,
    hasPrimaryResume,
  });
  const stages = [
    {
      id: "background",
      complete: hasPrimaryResume || Boolean(profile.currentRole),
      required: true,
    },
    {
      id: "responsibilities",
      complete: Boolean(profile.currentResponsibilities),
      required: false,
    },
    { id: "reviewed_evidence", complete: evidence.length >= 2, required: true },
    {
      id: "technical_project",
      complete: evidence.some((e) => e.kind === "technical_project"),
      required: false,
    },
    {
      id: "motivation",
      complete: Boolean(profile.startupMotivation),
      required: false,
    },
    {
      id: "ai_usage",
      complete: evidence.some((e) => e.kind === "ai_usage"),
      required: false,
    },
    {
      id: "goals",
      complete: Boolean(profile.careerGoals || profile.targetRoles.length),
      required: false,
    },
    {
      id: "links",
      complete: Boolean(
        profile.githubUrl || profile.linkedinUrl || profile.portfolioUrl,
      ),
      required: false,
    },
    {
      id: "availability",
      complete: Boolean(
        profile.location || profile.workAuthorization || profile.availability,
      ),
      required: false,
    },
  ];
  return {
    ready: readiness.ready,
    completionPercent: readiness.completionPercent,
    stages,
    nextStage:
      stages.find((stage) => stage.required && !stage.complete)?.id ??
      stages.find((stage) => !stage.complete)?.id ??
      null,
    actionUrl: "/profile/application",
  };
}

/** The client may import this type without importing the server data loader. */
export type DashboardMetrics = z.infer<typeof dashboardAggregateSchema> & {
  quota: z.infer<typeof dashboardAggregateSchema>["quota"] & {
    limit: number;
    remaining: number;
  };
  profile: ReturnType<typeof profileProgress>;
};
