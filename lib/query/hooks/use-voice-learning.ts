// Voice Learning React Query Hooks
// Purpose: Hooks for voice learning and style analysis with vector storage

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, queryErrorHandler, mutationErrorHandler } from '../client'
import {
  analyzeWritingSampleAction,
  buildVoiceProfileAction,
  getVoiceAwareSuggestionsAction,
  findSimilarVoiceExamplesAction,
  getVoiceLearningAnalyticsAction,
  refreshVoiceProfileAction,
} from '@/lib/actions'
import { useState, useEffect, useCallback } from 'react'
import { debounce } from '@/lib/utils'

// Types for voice learning
interface WritingSampleAnalysis {
  content: string
  storeInHistory?: boolean
}

interface VoiceAwareSuggestions {
  currentText: string
  targetVoiceStrength?: number
}

interface SimilarVoiceExamples {
  queryText: string
  minSimilarity?: number
  maxExamples?: number
  voicePatternFilter?: string[]
}

// Query hooks

export const useVoiceLearningAnalytics = () => {
  return useQuery({
    queryKey: queryKeys.voice.analytics(),
    queryFn: async () => {
      const result = await getVoiceLearningAnalyticsAction()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

export const useVoiceAwareSuggestions = (
  currentText: string,
  targetVoiceStrength: number = 0.8,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: queryKeys.voice.suggestions(currentText, targetVoiceStrength),
    queryFn: async () => {
      const formData = new FormData()
      formData.append('currentText', currentText)
      formData.append('targetVoiceStrength', targetVoiceStrength.toString())

      const result = await getVoiceAwareSuggestionsAction(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: enabled && currentText.length >= 10,
    staleTime: 1000 * 60 * 10, // 10 minutes
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

export const useSimilarVoiceExamples = (
  queryText: string,
  options: {
    minSimilarity?: number
    maxExamples?: number
    voicePatternFilter?: string[]
    enabled?: boolean
  } = {}
) => {
  const {
    minSimilarity = 0.7,
    maxExamples = 10,
    voicePatternFilter,
    enabled = true
  } = options

  return useQuery({
    queryKey: queryKeys.voice.examples(queryText, minSimilarity, maxExamples, voicePatternFilter),
    queryFn: async () => {
      const formData = new FormData()
      formData.append('queryText', queryText)
      formData.append('minSimilarity', minSimilarity.toString())
      formData.append('maxExamples', maxExamples.toString())
      if (voicePatternFilter) {
        formData.append('voicePatternFilter', JSON.stringify(voicePatternFilter))
      }

      const result = await findSimilarVoiceExamplesAction(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: enabled && queryText.length >= 10,
    staleTime: 1000 * 60 * 5, // 5 minutes
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

// Mutation hooks

export const useAnalyzeWritingSample = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: WritingSampleAnalysis) => {
      const formData = new FormData()
      formData.append('content', data.content)
      formData.append('storeInHistory', (data.storeInHistory !== false).toString())

      const result = await analyzeWritingSampleAction(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: () => {
      // Invalidate voice analytics to reflect new sample
      queryClient.invalidateQueries({
        queryKey: queryKeys.voice.analytics(),
      })

      // Invalidate user style data
      queryClient.invalidateQueries({
        queryKey: queryKeys.voice.all(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

export const useBuildVoiceProfile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const result = await buildVoiceProfileAction()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: () => {
      // Invalidate all voice-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.voice.all(),
      })

      // Invalidate user profile data
      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.profile(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

export const useRefreshVoiceProfile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const result = await refreshVoiceProfileAction()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: () => {
      // Invalidate all voice-related and user data
      queryClient.invalidateQueries({
        queryKey: queryKeys.voice.all(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.embeddings.all(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.profile(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

// Advanced hooks for real-time voice analysis

export const useRealTimeVoiceAnalysis = (
  text: string,
  options: {
    enabled?: boolean
    storeInHistory?: boolean
    targetVoiceStrength?: number
    delay?: number
  } = {}
) => {
  const {
    enabled = true,
    storeInHistory = true,
    targetVoiceStrength = 0.8,
    delay = 3000 // 3 seconds for voice analysis (longer than CPL)
  } = options

  const [debouncedText, setDebouncedText] = useState(text)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const debouncedSetText = useCallback(
    debounce((newText: string) => {
      setDebouncedText(newText)
      setIsAnalyzing(false)
    }, delay),
    [delay]
  )

  useEffect(() => {
    if (text !== debouncedText && text.length >= 50) {
      setIsAnalyzing(true)
      debouncedSetText(text)
    }
  }, [text, debouncedText, debouncedSetText])

  // Analyze the writing sample
  const analyzeMutation = useAnalyzeWritingSample()

  // Get voice-aware suggestions
  const voiceSuggestions = useVoiceAwareSuggestions(
    debouncedText,
    targetVoiceStrength,
    debouncedText.length >= 10 && !analyzeMutation.isPending
  )

  // Find similar examples
  const similarExamples = useSimilarVoiceExamples(debouncedText, {
    enabled: debouncedText.length >= 10 && !analyzeMutation.isPending
  })

  // Trigger analysis when text is ready
  useEffect(() => {
    if (
      enabled &&
      debouncedText.length >= 50 &&
      !isAnalyzing &&
      !analyzeMutation.isPending &&
      text === debouncedText // Only analyze when user has stopped typing
    ) {
      analyzeMutation.mutate({
        content: debouncedText,
        storeInHistory
      })
    }
  }, [debouncedText, enabled, storeInHistory, text])

  return {
    // Analysis results
    analysis: analyzeMutation.data,
    isAnalyzing: isAnalyzing || analyzeMutation.isPending,
    analysisError: analyzeMutation.error,

    // Voice suggestions
    voiceSuggestions: voiceSuggestions.data,
    isLoadingSuggestions: voiceSuggestions.isLoading,
    suggestionsError: voiceSuggestions.error,

    // Similar examples
    similarExamples: similarExamples.data,
    isLoadingExamples: similarExamples.isLoading,
    examplesError: similarExamples.error,

    // Overall status
    hasVoiceData: !voiceSuggestions.isLoading && !similarExamples.isLoading,
    text: debouncedText,

    // Manual controls
    forceAnalyze: () => analyzeMutation.mutate({
      content: text,
      storeInHistory
    })
  }
}

// Hook for voice profile management
export const useVoiceProfileManager = () => {
  const analytics = useVoiceLearningAnalytics()
  const buildProfile = useBuildVoiceProfile()
  const refreshProfile = useRefreshVoiceProfile()

  const isProfileReady = analytics.data?.profileSummary?.confidenceScore > 0.5
  const needsMoreSamples = (analytics.data?.profileSummary?.sampleCount || 0) < 10
  const profileCompleteness = analytics.data?.profileSummary?.profileCompleteness || 0

  return {
    // Profile data
    analytics: analytics.data,
    isLoading: analytics.isLoading,
    error: analytics.error,

    // Profile status
    isProfileReady,
    needsMoreSamples,
    profileCompleteness,
    confidenceScore: analytics.data?.profileSummary?.confidenceScore || 0,
    sampleCount: analytics.data?.profileSummary?.sampleCount || 0,

    // Actions
    buildProfile: buildProfile.mutate,
    refreshProfile: refreshProfile.mutate,
    isBuildingProfile: buildProfile.isPending || refreshProfile.isPending,

    // Profile insights
    dominantPatterns: analytics.data?.voiceCharacteristics?.dominantPatterns || [],
    recommendations: analytics.data?.improvements?.recommendations || [],
    voiceMetrics: analytics.data?.voiceCharacteristics?.voiceMetrics,

    // Progress tracking
    weeklyGrowth: analytics.data?.progress?.weeklyGrowth || 0,
    consistencyScore: analytics.data?.progress?.consistencyScore || 0
  }
}

// Hook for voice-enhanced writing assistance
export const useVoiceEnhancedWriting = (
  text: string,
  options: {
    targetVoiceStrength?: number
    showSimilarExamples?: boolean
    autoAnalyze?: boolean
  } = {}
) => {
  const {
    targetVoiceStrength = 0.8,
    showSimilarExamples = true,
    autoAnalyze = true
  } = options

  const voiceAnalysis = useRealTimeVoiceAnalysis(text, {
    enabled: autoAnalyze,
    targetVoiceStrength
  })

  const profileManager = useVoiceProfileManager()

  // Calculate overall voice match score
  const voiceMatchScore = voiceAnalysis.analysis?.analysis?.voiceStrength || 0

  // Get actionable suggestions
  const actionableSuggestions = voiceAnalysis.voiceSuggestions?.suggestions?.filter(
    s => s.confidence > 0.6 && s.voiceMatch >= targetVoiceStrength * 0.8
  ) || []

  // Get relevant examples if enabled
  const relevantExamples = showSimilarExamples
    ? voiceAnalysis.similarExamples?.examples?.slice(0, 3) || []
    : []

  return {
    // Current text analysis
    text,
    voiceMatchScore,
    isAnalyzing: voiceAnalysis.isAnalyzing,

    // Suggestions for improvement
    suggestions: actionableSuggestions,
    hasSuggestions: actionableSuggestions.length > 0,

    // Similar examples for inspiration
    examples: relevantExamples,
    hasExamples: relevantExamples.length > 0,

    // Voice profile context
    profileReady: profileManager.isProfileReady,
    profileCompleteness: profileManager.profileCompleteness,
    needsMoreSamples: profileManager.needsMoreSamples,

    // Actions
    forceAnalyze: voiceAnalysis.forceAnalyze,
    refreshProfile: profileManager.refreshProfile,

    // Status indicators
    isLoading: voiceAnalysis.isAnalyzing || voiceAnalysis.isLoadingSuggestions,
    hasVoiceData: voiceAnalysis.hasVoiceData && profileManager.isProfileReady,

    // Error handling
    error: voiceAnalysis.analysisError || voiceAnalysis.suggestionsError || profileManager.error
  }
}