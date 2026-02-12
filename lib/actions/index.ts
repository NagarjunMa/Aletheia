// Server Actions Index
// Created: December 7, 2024
// Purpose: Central export for all server actions

// Authentication actions
export {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  resetPassword,
  updatePassword,
  signOut,
  getCurrentUser,
  refreshSession,
} from './auth'

// Conversation actions
export {
  createConversation,
  updateConversation,
  getConversations,
  getConversation,
  archiveConversation,
  deleteConversation,
  getConversationCategories,
  duplicateConversation,
} from './conversations'

// User input and draft actions
export {
  createUserInput,
  createBulkUserInputs,
  getUserInputs,
  updateInputProcessingStatus,
  generateDraft,
  submitDraftFeedback,
  getUserInput,
  deleteUserInput,
} from './inputs'

// Profile and analytics actions
export {
  updateUserProfile,
  updateUserPreferences,
  getUserDashboardStats,
  submitUserFeedback,
  logAnalyticsEvent,
  exportUserData,
  updateUserCPLScore,
  getUserActivitySummary,
  deleteUserAccount,
} from './profile'

// AI processing actions
export {
  generateDraftFromInput,
  analyzeTextContent,
  regenerateDraft,
  processBatchInputs,
  getAIProcessingStats,
  cancelProcessing,
} from './ai'

// Streaming processing actions
export {
  startStreamingProcessing,
  getStreamingSessionStatus,
  cancelStreamingProcessing,
  getUserActiveStreamingSessions,
  checkStreamingAvailability,
  getStreamingServiceHealth,
  resumeStreamingSession,
  cleanupUserSessions,
} from './streaming'

// CPL scoring system actions
export {
  analyzeCPLScore,
  getUserCPLTrendsAction,
  compareCPLToBenchmarks,
  getCPLSuggestions,
  updateUserCPLBaselineAction,
  getUserCPLStatistics,
  getCPLLeaderboard,
  setUserCPLTarget,
  findSimilarCPLContentAction,
  getCPLImprovementTrajectoryAction,
  getContextualCPLSuggestionsAction,
} from './cpl'

// Voice learning system actions
export {
  analyzeWritingSampleAction,
  buildVoiceProfileAction,
  getVoiceAwareSuggestionsAction,
  findSimilarVoiceExamplesAction,
  getVoiceLearningAnalyticsAction,
  refreshVoiceProfileAction,
} from './voice-learning'

// Dual draft generation with streaming
export {
  generateDualDraftsAction,
  createDualDraftStreamAction,
  getDualDraftAnalyticsAction,
  getActiveStreamCountAction,
  cancelUserStreamsAction,
} from './dual-drafts'

// Type exports for use in components
export type {
  ProfileUpdate,
  UserPreferences,
  CreateConversation,
  UpdateConversation,
  UserInput,
  GenerateDraft,
  DraftFeedback,
  AIProcessing,
  Search,
  FileUpload,
  AnalyticsEvent,
  UserFeedback,
  ApiResponse,
  ExportData,
} from '../validations/schemas'