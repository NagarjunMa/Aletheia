import {
  collectReviewedEvidence,
  reviewedDraftsEnabled,
  recheckReviewedEvidence,
  safeReviewedDraftInput,
} from "@/modules/grounding/application/reviewed-draft";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import type { GenerationTiming } from "@/lib/generation-timing";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import {
  loadCandidateGroundingData,
  type CandidateContextCaller,
} from "../infrastructure/candidate-context.repository";
import { buildYcGroundingContext } from "./build-yc-grounding-context";

const log = createLogger("yc-grounding-context");

type GroundingTelemetry = {
  selection: YcGroundingContext["selectionDiagnostics"];
  sourceCounts: {
    evidence: number;
    profile: number;
    resume: number;
  };
  readiness: {
    ready: boolean;
    missingFieldCount: number;
    recommendedFieldCount: number;
  };
};

type PrepareYcGroundingContextDependencies = {
  loadCandidateData?: typeof loadCandidateGroundingData;
  recordGrounding?: (_telemetry: GroundingTelemetry) => void;
  logger?: SafeLogger;
};

type PrepareYcGroundingContextInput = {
  caller: CandidateContextCaller;
  question: string;
  questions?: string[];
  jobDescription: string;
  selectedEvidenceIds?: readonly string[];
  timing?: GenerationTiming;
  logger?: SafeLogger;
};

function recordGrounding(telemetry: GroundingTelemetry): void {
  log.info(telemetry, "YC grounding context prepared");
}

/**
 * Prepares caller-owned YC grounding before any model, billing, or rate-limit
 * work. Telemetry is deliberately derived from the bounded result and never
 * contains candidate text, target text, identifiers, or credentials.
 */
export async function prepareYcGroundingContext(
  input: PrepareYcGroundingContextInput,
  dependencies: PrepareYcGroundingContextDependencies = {},
): Promise<YcGroundingContext> {
  const operationLog = input.logger ?? dependencies.logger ?? log;
  const complete = startTimedStage(operationLog, "yc.grounding_prepare", {
    userId: input.caller.userId,
  });
  let context: YcGroundingContext;
  try {
    input.timing?.enter("groundingLoad");
    const load = () =>
      dependencies.loadCandidateData
        ? dependencies.loadCandidateData(input.caller)
        : loadCandidateGroundingData(input.caller, {
            logger: operationLog,
            includeResumeReviews: true,
          });
    const candidate = await load();
    input.timing?.enter("groundingBuild");
    const reviewedEvidence =
      reviewedDraftsEnabled() &&
      safeReviewedDraftInput(
        [...(input.questions ?? [input.question]), input.jobDescription].join(
          "\n",
        ),
      )
        ? collectReviewedEvidence(candidate, input.selectedEvidenceIds)
        : undefined;
    if (reviewedEvidence) {
      const { facts, requiredRoots, excludedClaims } = reviewedEvidence;
      const evidenceCount = new Set(facts.map(({ rootId }) => rootId)).size;
      context = {
        reviewedEvidence: {
          ...reviewedEvidence,
          recheck: recheckReviewedEvidence(load),
        },
        question: input.question,
        jobDescription: input.jobDescription,
        sources: reviewedEvidence.sources,
        atomicSources: facts,
        excludedClaims,
        requiredEvidenceRoots: requiredRoots,
        readiness: {
          ready: facts.length > 0,
          missingFields: facts.length ? [] : ["confirmed_evidence"],
          recommendedFields: [],
        },
        metadata: {
          profileFieldCount: 0,
          confirmedEvidenceCount: evidenceCount,
          resumeSource: facts.some(({ rootId }) =>
            rootId?.startsWith("evidence:resume-"),
          )
            ? candidate.resume.source
            : "none",
        },
      };
    } else
      context = buildYcGroundingContext({
        question: input.question,
        ...(input.questions ? { questions: input.questions } : {}),
        jobDescription: input.jobDescription,
        candidate,
        ...(input.selectedEvidenceIds
          ? { selectedEvidenceIds: input.selectedEvidenceIds }
          : {}),
      });
  } catch (error) {
    complete("failure", { errorCode: "YC_GROUNDING_UNAVAILABLE" });
    throw error;
  }
  const telemetry: GroundingTelemetry = {
    selection: context.selectionDiagnostics,
    sourceCounts: {
      evidence: context.sources.filter((source) => source.type === "evidence")
        .length,
      profile: context.sources.filter((source) => source.type === "profile")
        .length,
      resume: context.sources.filter((source) => source.type === "resume")
        .length,
    },
    readiness: {
      ready: context.readiness.ready,
      missingFieldCount: context.readiness.missingFields.length,
      recommendedFieldCount: context.readiness.recommendedFields.length,
    },
  };

  (dependencies.recordGrounding ?? recordGrounding)(telemetry);
  complete("success", { ready: context.readiness.ready });
  return context;
}
