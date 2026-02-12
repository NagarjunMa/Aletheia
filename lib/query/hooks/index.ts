// React Query Hooks Exports
// Created: December 8, 2024
// Purpose: Central export for all React Query hooks

// Conversation hooks
export {
  useConversations,
  useConversation,
  useConversationCategories,
  useCreateConversation,
  useUpdateConversation,
  useDeleteConversation,
  useArchiveConversation,
  useDuplicateConversation,
  useConversationOptimisticUpdate,
  useConversationPrefetch,
} from './use-conversations'

// CPL hooks
export {
  useAnalyzeCPL,
  useCPLTrends,
  useCPLStatistics,
  useCPLBenchmarks,
  useCPLLeaderboard,
  useAnalyzeCPLMutation,
  useCPLSuggestionsMutation,
  useUpdateCPLBaseline,
  useSetCPLTarget,
  useRealTimeCPLAnalysis,
  useCPLComparison,
  useCPLPrefetch,
} from './use-cpl'

// Query client and utilities
export {
  queryClient,
  queryKeys,
  cacheUtils,
  queryErrorHandler,
  mutationErrorHandler,
  devtools,
} from '../client'