// CPL React Query Hooks
// Created: December 8, 2024
// Purpose: React Query hooks for CPL analysis and management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, queryErrorHandler, mutationErrorHandler } from '../client'
import {
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
} from '@/lib/actions'

// Types
interface CPLAnalysisData {
  text: string
  includeBaseline?: boolean
  detailedAnalysis?: boolean
  cacheResults?: boolean
}

interface CPLBenchmarkData {
  cplScore: number
  userType: 'student' | 'professional' | 'writer' | 'general'
  category?: string
}

interface CPLSuggestionsData {
  cplScore: any // CPL score object
  targetScore?: number
}

// Query hooks
export const useAnalyzeCPL = (data: CPLAnalysisData, enabled = false) => {
  return useQuery({
    queryKey: queryKeys.cpl.score(data.text),
    queryFn: async () => {
      const formData = new FormData()
      formData.append('text', data.text)
      if (data.includeBaseline !== undefined) {
        formData.append('includeBaseline', data.includeBaseline.toString())
      }
      if (data.detailedAnalysis !== undefined) {
        formData.append('detailedAnalysis', data.detailedAnalysis.toString())
      }
      if (data.cacheResults !== undefined) {
        formData.append('cacheResults', data.cacheResults.toString())
      }

      const result = await analyzeCPLScore(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: enabled && !!data.text && data.text.length >= 10,
    staleTime: 1000 * 60 * 10, // 10 minutes (CPL analysis is expensive)
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

export const useCPLTrends = (
  timeframe: 'week' | 'month' | 'quarter' | 'year' = 'month',
  enabled = false // PERFORMANCE: Default to disabled to prevent auto-loading
) => {
  return useQuery({
    queryKey: queryKeys.cpl.trends(timeframe),
    queryFn: async () => {
      const formData = new FormData()
      formData.append('timeframe', timeframe)

      const result = await getUserCPLTrendsAction(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled, // Only fetch when explicitly enabled
    staleTime: 1000 * 60 * 5, // 5 minutes
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

export const useCPLStatistics = (enabled = false) => {
  return useQuery({
    queryKey: queryKeys.cpl.statistics(),
    queryFn: async () => {
      const result = await getUserCPLStatistics()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled, // Only fetch when explicitly enabled
    staleTime: 1000 * 60 * 2, // 2 minutes
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

export const useCPLBenchmarks = (data: CPLBenchmarkData) => {
  return useQuery({
    queryKey: queryKeys.cpl.benchmarks(data.userType, data.category),
    queryFn: async () => {
      const formData = new FormData()
      formData.append('cplScore', data.cplScore.toString())
      formData.append('userType', data.userType)
      if (data.category) formData.append('category', data.category)

      const result = await compareCPLToBenchmarks(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: !!data.cplScore && data.cplScore > 0,
    staleTime: 1000 * 60 * 15, // 15 minutes (benchmarks don't change often)
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

export const useCPLLeaderboard = () => {
  return useQuery({
    queryKey: ['cpl-leaderboard'],
    queryFn: async () => {
      const result = await getCPLLeaderboard()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    staleTime: 1000 * 60 * 30, // 30 minutes (leaderboard updates slowly)
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

// Mutation hooks
export const useAnalyzeCPLMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CPLAnalysisData) => {
      const formData = new FormData()
      formData.append('text', data.text)
      if (data.includeBaseline !== undefined) {
        formData.append('includeBaseline', data.includeBaseline.toString())
      }
      if (data.detailedAnalysis !== undefined) {
        formData.append('detailedAnalysis', data.detailedAnalysis.toString())
      }
      if (data.cacheResults !== undefined) {
        formData.append('cacheResults', data.cacheResults.toString())
      }

      const result = await analyzeCPLScore(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: (data, variables) => {
      // Cache the result
      queryClient.setQueryData(
        queryKeys.cpl.score(variables.text),
        data
      )

      // Invalidate statistics to get updated data
      queryClient.invalidateQueries({
        queryKey: queryKeys.cpl.statistics(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

export const useCPLSuggestionsMutation = () => {
  return useMutation({
    mutationFn: async (data: CPLSuggestionsData) => {
      const formData = new FormData()
      formData.append('cplScore', JSON.stringify(data.cplScore))
      if (data.targetScore) {
        formData.append('targetScore', data.targetScore.toString())
      }

      const result = await getCPLSuggestions(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

export const useUpdateCPLBaseline = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const result = await updateUserCPLBaselineAction()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: () => {
      // Invalidate user statistics and trends
      queryClient.invalidateQueries({
        queryKey: queryKeys.cpl.statistics(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.cpl.all(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

export const useSetCPLTarget = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (targetScore: number) => {
      const formData = new FormData()
      formData.append('targetScore', targetScore.toString())

      const result = await setUserCPLTarget(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: () => {
      // Invalidate user profile and statistics
      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.profile(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.cpl.statistics(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

// Real-time CPL analysis hook with debouncing
import { useState, useEffect, useCallback } from 'react'
import { debounce } from '@/lib/utils'

export const useRealTimeCPLAnalysis = (
  text: string,
  options: Partial<CPLAnalysisData> = {},
  delay = 2000
) => {
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
    if (text !== debouncedText) {
      setIsAnalyzing(true)
      debouncedSetText(text)
    }
  }, [text, debouncedText, debouncedSetText])

  const analysisQuery = useAnalyzeCPL(
    {
      text: debouncedText,
      ...options,
    },
    debouncedText.length >= 10
  )

  return {
    ...analysisQuery,
    isAnalyzing: isAnalyzing || analysisQuery.isFetching,
    text: debouncedText,
  }
}

// CPL comparison hook
export const useCPLComparison = (scores: number[]) => {
  return useQuery({
    queryKey: ['cpl-comparison', scores],
    queryFn: async () => {
      if (scores.length < 2) return null

      // Calculate improvement metrics
      const latest = scores[scores.length - 1]
      const previous = scores[scores.length - 2]
      const first = scores[0]

      const shortTermChange = latest - previous
      const longTermChange = latest - first
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length

      const trend = scores.length >= 3 ?
        scores.slice(-3).reduce((sum, score, index, arr) => {
          if (index === 0) return 0
          return sum + (score - arr[index - 1])
        }, 0) / 2 : 0

      return {
        latest,
        previous,
        first,
        shortTermChange,
        longTermChange,
        average: Math.round(average),
        trend,
        isImproving: shortTermChange > 0,
        improvementPercentage: previous > 0 ? ((shortTermChange / previous) * 100) : 0,
      }
    },
    enabled: scores.length >= 2,
  })
}

// Prefetching helpers
export const useCPLPrefetch = () => {
  const queryClient = useQueryClient()

  const prefetchCPLTrends = (timeframe: string) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.cpl.trends(timeframe),
      queryFn: async () => {
        const formData = new FormData()
        formData.append('timeframe', timeframe)

        const result = await getUserCPLTrendsAction(formData)
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.data
      },
    })
  }

  const prefetchCPLStatistics = () => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.cpl.statistics(),
      queryFn: async () => {
        const result = await getUserCPLStatistics()
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.data
      },
    })
  }

  return {
    prefetchCPLTrends,
    prefetchCPLStatistics,
  }
}

// NEW: Find similar content in user's CPL history
export const useSimilarCPLContent = (
  text: string,
  options: {
    minScore?: number
    maxScore?: number
    minSimilarity?: number
    limit?: number
    enabled?: boolean
  } = {}
) => {
  const {
    minScore = 0,
    maxScore = 100,
    minSimilarity = 0.7,
    limit = 5,
    enabled = true
  } = options

  return useQuery({
    queryKey: ['cpl-similar-content', text, minScore, maxScore, minSimilarity, limit],
    queryFn: async () => {
      const formData = new FormData()
      formData.append('text', text)
      formData.append('minScore', minScore.toString())
      formData.append('maxScore', maxScore.toString())
      formData.append('minSimilarity', minSimilarity.toString())
      formData.append('limit', limit.toString())

      const result = await findSimilarCPLContentAction(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: enabled && text.length >= 10,
    staleTime: 1000 * 60 * 5, // 5 minutes (history doesn't change often)
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

// NEW: Get user's CPL improvement trajectory
export const useCPLImprovementTrajectory = () => {
  return useQuery({
    queryKey: ['cpl-improvement-trajectory'],
    queryFn: async () => {
      const result = await getCPLImprovementTrajectoryAction()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    staleTime: 1000 * 60 * 15, // 15 minutes (trajectory analysis is expensive)
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

// NEW: Get contextual CPL suggestions
export const useContextualCPLSuggestions = (
  text: string,
  currentScore: number,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['cpl-contextual-suggestions', text, currentScore],
    queryFn: async () => {
      const formData = new FormData()
      formData.append('text', text)
      formData.append('currentScore', currentScore.toString())

      const result = await getContextualCPLSuggestionsAction(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: enabled && text.length >= 10 && currentScore > 0,
    staleTime: 1000 * 60 * 10, // 10 minutes
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

// NEW: Enhanced real-time CPL analysis with vector-based insights
export const useEnhancedCPLAnalysis = (
  text: string,
  options: Partial<CPLAnalysisData> = {},
  delay = 2000
) => {
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
    if (text !== debouncedText) {
      setIsAnalyzing(true)
      debouncedSetText(text)
    }
  }, [text, debouncedText, debouncedSetText])

  // Basic CPL analysis
  const cplAnalysis = useAnalyzeCPL(
    { text: debouncedText, ...options },
    debouncedText.length >= 10
  )

  // Similar content in user's history
  const similarContent = useSimilarCPLContent(debouncedText, {
    enabled: debouncedText.length >= 10 && !cplAnalysis.isLoading
  })

  // Contextual suggestions based on current score
  const contextualSuggestions = useContextualCPLSuggestions(
    debouncedText,
    cplAnalysis.data?.overall || 0,
    !cplAnalysis.isLoading && !!cplAnalysis.data
  )

  return {
    // Basic analysis
    cplScore: cplAnalysis.data,
    isAnalyzing: isAnalyzing || cplAnalysis.isFetching,
    analysisError: cplAnalysis.error,

    // Enhanced insights from vector database
    similarContent: similarContent.data || [],
    isLoadingSimilar: similarContent.isLoading,

    // Personalized suggestions
    contextualSuggestions: contextualSuggestions.data,
    isLoadingSuggestions: contextualSuggestions.isLoading,

    // Overall status
    hasEnhancedData: !similarContent.isLoading && !contextualSuggestions.isLoading,
    text: debouncedText,
  }
}