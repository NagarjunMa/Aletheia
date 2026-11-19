import { z } from "zod";
import type { DashboardMetrics } from "@/modules/dashboard/domain/dashboard-metrics";

export const creditSummarySchema = z
  .object({
    balance: z.number().int().nonnegative().safe().nullable(),
    unlimitedCredits: z.boolean().default(false),
    creditExpiry: z.null(),
  })
  .refine((value) =>
    value.unlimitedCredits ? value.balance === null : value.balance !== null,
  );

export const categoryLabels = {
  linkedin_connection: "LinkedIn connections",
  linkedin_inmail: "LinkedIn InMail",
  cold_email: "Cold email",
  yc_application: "Application answers",
} as const;

export const rejectionLabels: Record<
  DashboardMetrics["reviews"]["rejectionReasons"][number]["reason"],
  string
> = {
  too_generic: "Too generic",
  too_formal: "Too formal",
  too_repetitive: "Repetitive",
  weak_target_relevance: "Weak relevance",
  unsupported_feeling: "Unsupported sentiment",
  wrong_ask: "Wrong ask",
  wrong_tone: "Wrong tone",
  unsupported_claim: "Unsupported claim",
  missed_question: "Missed the question",
  formatting: "Formatting",
  other: "Other",
  unspecified: "Reason not provided",
};

export const stageLabels: Record<string, string> = {
  background: "Background",
  responsibilities: "Responsibilities",
  reviewed_evidence: "Reviewed evidence",
  technical_project: "Technical project",
  motivation: "Motivation",
  ai_usage: "AI tools",
  goals: "Career goals",
  links: "Proof links",
  availability: "Availability",
};

export function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
