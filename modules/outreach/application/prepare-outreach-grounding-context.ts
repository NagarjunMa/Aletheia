import { createLogger } from "@/lib/logger";
import type { GenerationTiming } from "@/lib/generation-timing";
import type { AuthenticatedExtensionUser } from "../domain/extension-generate.types";
import {
  OutreachGroundingUnavailableError,
  type OutreachGroundingContext,
  type OutreachGroundingInput,
} from "../domain/outreach-grounding.types";
import { loadCandidateGroundingData } from "@/modules/candidate-context/infrastructure/candidate-context.repository";
import type { CandidateContextCaller } from "@/modules/candidate-context/domain/candidate-context.types";
import { buildOutreachGroundingContext } from "./build-outreach-grounding-context";

const log = createLogger("outreach-grounding-context");

type PrepareOutreachGroundingDependencies = {
  loadCandidateData?: typeof loadCandidateGroundingData;
  buildContext?: typeof buildOutreachGroundingContext;
  recordGrounding?: (_metadata: OutreachGroundingContext["metadata"]) => void;
};

function recordGrounding(metadata: OutreachGroundingContext["metadata"]): void {
  log.info(metadata, "Outreach grounding context prepared");
}

/**
 * Authenticated, pre-billing boundary for candidate grounding. It exposes no
 * repository details, candidate text, IDs, or credentials in telemetry/errors.
 */
export async function prepareOutreachGroundingContext(
  input: {
    caller: AuthenticatedExtensionUser;
    target: OutreachGroundingInput;
    timing?: GenerationTiming;
  },
  dependencies: PrepareOutreachGroundingDependencies = {},
): Promise<OutreachGroundingContext> {
  const caller: CandidateContextCaller = {
    accessToken: input.caller.accessToken,
    userId: input.caller.userId,
  };
  try {
    input.timing?.enter("groundingLoad");
    const candidate = await (
      dependencies.loadCandidateData ?? loadCandidateGroundingData
    )(caller);
    input.timing?.enter("groundingBuild");
    const context = (
      dependencies.buildContext ?? buildOutreachGroundingContext
    )({
      candidate,
      target: input.target,
    });
    (dependencies.recordGrounding ?? recordGrounding)(context.metadata);
    return context;
  } catch {
    throw new OutreachGroundingUnavailableError();
  }
}
