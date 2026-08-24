/** Compatibility surface while YC migrates to the shared ownership module. */
export {
  CandidateContextRepositoryError,
  loadCandidateGroundingData,
  type CandidateContextRepositoryDependencies,
} from "@/modules/candidate-context/infrastructure/candidate-context.repository";

export type { CandidateContextCaller } from "@/modules/candidate-context/domain/candidate-context.types";
