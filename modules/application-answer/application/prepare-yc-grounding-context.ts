import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import {
  loadCandidateGroundingData,
  type CandidateContextCaller,
} from "../infrastructure/candidate-context.repository";
import { buildYcGroundingContext } from "./build-yc-grounding-context";

const log = createLogger("yc-grounding-context");

type GroundingTelemetry = {
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
  jobDescription: string;
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
  const operationLog = dependencies.logger ?? log;
  const complete = startTimedStage(operationLog, "yc.grounding_prepare", {
    userId: input.caller.userId,
  });
  let context: YcGroundingContext;
  try {
    const candidate = dependencies.loadCandidateData
      ? await dependencies.loadCandidateData(input.caller)
      : await loadCandidateGroundingData(input.caller, {
          logger: operationLog,
        });
    context = buildYcGroundingContext({
      question: input.question,
      jobDescription: input.jobDescription,
      candidate,
    });
  } catch (error) {
    complete("failure", { errorCode: "YC_GROUNDING_UNAVAILABLE" });
    throw error;
  }
  const telemetry: GroundingTelemetry = {
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
