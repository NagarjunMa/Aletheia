import {
  collectReviewedEvidence,
  ReviewedContextTooLargeError,
  reviewedDraftsEnabled,
  recheckReviewedEvidence,
  safeReviewedDraftInput,
} from "@/modules/grounding/application/reviewed-draft";
import { linkedinTargetHasContradiction } from "@/modules/grounding/domain/atomic-claim";
import { SelectedEvidenceUnavailableError } from "@/modules/candidate-context/application/selected-evidence";
import { createLogger, type SafeLogger } from "@/lib/logger";
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

/**
 * Authenticated, pre-billing boundary for candidate grounding. It exposes no
 * repository details, candidate text, IDs, or credentials in telemetry/errors.
 */
export async function prepareOutreachGroundingContext(
  input: {
    caller: AuthenticatedExtensionUser;
    target: OutreachGroundingInput;
    selectedEvidenceIds?: readonly string[];
    messageFocus?: string;
    timing?: GenerationTiming;
    logger?: SafeLogger;
  },
  dependencies: PrepareOutreachGroundingDependencies = {},
): Promise<OutreachGroundingContext> {
  const caller: CandidateContextCaller = {
    accessToken: input.caller.accessToken,
    userId: input.caller.userId,
  };
  try {
    input.timing?.enter("groundingLoad");
    const useReviewedDraft = reviewedDraftsEnabled() && !input.messageFocus;
    const load = () =>
      dependencies.loadCandidateData
        ? dependencies.loadCandidateData(caller)
        : loadCandidateGroundingData(caller, {
            ...(input.logger ? { logger: input.logger } : {}),
            ...(useReviewedDraft ? { includeResumeReviews: true } : {}),
          });
    const candidate = await load();
    input.timing?.enter("groundingBuild");
    const { target } = input;
    const reviewedEvidence =
      useReviewedDraft &&
      safeReviewedDraftInput(
        [
          target.profileMarkdown,
          target.jobDescription,
          target.conversationContext,
        ].join("\n"),
      ) &&
      !linkedinTargetHasContradiction(
        target.profileMarkdown,
        target.jobDescription,
      )
        ? collectReviewedEvidence(candidate, input.selectedEvidenceIds)
        : undefined;
    const context: OutreachGroundingContext = reviewedEvidence?.facts.length
      ? {
          reviewedEvidence: {
            ...reviewedEvidence,
            recheck: recheckReviewedEvidence(load),
          },
          identity: candidate.identity,
          sources: reviewedEvidence.sources,
          atomicSources: reviewedEvidence.facts,
          excludedClaims: reviewedEvidence.excludedClaims,
          requiredEvidenceRoots: reviewedEvidence.requiredRoots,
          metadata: {
            groundingLevel: "verified_evidence",
            fallbackReason: "none",
            selectedSourceCount: reviewedEvidence.facts.length,
            selectedEvidenceCount: new Set(
              reviewedEvidence.facts.map(({ rootId }) => rootId),
            ).size,
            selectedSourceKinds: ["evidence"],
            injectionSafeMode: false,
          },
        }
      : (dependencies.buildContext ?? buildOutreachGroundingContext)({
          candidate,
          target: input.target,
          ...(input.messageFocus ? { messageFocus: input.messageFocus } : {}),
          ...(input.selectedEvidenceIds
            ? { selectedEvidenceIds: input.selectedEvidenceIds }
            : {}),
        });
    if (dependencies.recordGrounding)
      dependencies.recordGrounding(context.metadata);
    else
      (input.logger ?? log).info(
        {
          event: "outreach.grounding.prepared",
          ...context.metadata,
          selection: context.selectionDiagnostics,
        },
        "Outreach grounding context prepared",
      );
    return context;
  } catch (error) {
    if (
      error instanceof SelectedEvidenceUnavailableError ||
      error instanceof ReviewedContextTooLargeError
    )
      throw error;
    throw new OutreachGroundingUnavailableError();
  }
}
