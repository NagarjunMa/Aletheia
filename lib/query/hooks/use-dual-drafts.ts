// Dual Draft Generation React Query Hooks
// Purpose: Hooks for dual draft generation with streaming support

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, queryErrorHandler, mutationErrorHandler } from '../client'
import {
  generateDualDraftsAction,
  getDualDraftAnalyticsAction,
  getActiveStreamCountAction,
  cancelUserStreamsAction,
} from '@/lib/actions'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { StreamingUpdate } from '@/lib/drafts/dual-generation'

// Types for dual draft generation
interface DualDraftOptions {
  content: string
  targetCPL?: number
  preserveVoice?: boolean
  urgentMode?: boolean
  customInstructions?: string
}

interface StreamingProgress {
  grammarProgress: number
  styleProgress: number
  currentStage: string
  isComplete: boolean
  error: string | null
}

// Query hooks

export const useDualDraftAnalytics = () => {
  return useQuery({
    queryKey: queryKeys.drafts.analytics(),
    queryFn: async () => {
      const result = await getDualDraftAnalyticsAction()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

export const useActiveStreamCount = () => {
  return useQuery({
    queryKey: ['dual-drafts', 'stream-count'],
    queryFn: async () => {
      const result = await getActiveStreamCountAction()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 1000 * 3, // 3 seconds
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

// Mutation hooks

export const useGenerateDualDrafts = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: DualDraftOptions) => {
      const formData = new FormData()
      formData.append('content', data.content)
      if (data.targetCPL) formData.append('targetCPL', data.targetCPL.toString())
      if (data.preserveVoice !== undefined) formData.append('preserveVoice', data.preserveVoice.toString())
      if (data.urgentMode) formData.append('urgentMode', 'true')
      if (data.customInstructions) formData.append('customInstructions', data.customInstructions)

      const result = await generateDualDraftsAction(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: () => {
      // Invalidate analytics to reflect new drafts
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.analytics(),
      })

      // Invalidate user dashboard stats
      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.profile(),
      })

      // Invalidate voice learning data if voice was preserved
      queryClient.invalidateQueries({
        queryKey: queryKeys.voice.all(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

export const useCancelUserStreams = () => {
  return useMutation({
    mutationFn: async () => {
      const result = await cancelUserStreamsAction()
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

// Advanced streaming hook for real-time dual draft generation
export const useStreamingDualDrafts = (
  options: DualDraftOptions,
  enabled: boolean = false
) => {
  const [streamingProgress, setStreamingProgress] = useState<StreamingProgress>({
    grammarProgress: 0,
    styleProgress: 0,
    currentStage: 'Waiting to start...',
    isComplete: false,
    error: null
  })

  const [result, setResult] = useState<any>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const streamRef = useRef<ReadableStreamDefaultReader<StreamingUpdate> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const startStreaming = useCallback(async () => {
    if (isStreaming || !enabled) return

    try {
      setIsStreaming(true)
      setStreamingProgress({
        grammarProgress: 0,
        styleProgress: 0,
        currentStage: 'Initializing dual draft generation...',
        isComplete: false,
        error: null
      })

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController()

      // Create streaming endpoint
      const response = await fetch('/api/drafts/dual-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body for streaming')
      }

      // Process stream
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TransformStream({
          transform(chunk, controller) {
            // Parse SSE format: "data: {json}\n\n"
            const lines = chunk.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  controller.enqueue(data as StreamingUpdate)
                } catch (e) {
                  console.warn('Failed to parse streaming data:', line)
                }
              }
            }
          }
        }))
        .getReader()

      streamRef.current = reader

      // Process streaming updates
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        const update = value as StreamingUpdate

        // Update progress based on update type
        setStreamingProgress(prev => {
          const newProgress = { ...prev }

          switch (update.type) {
            case 'grammar_progress':
              newProgress.grammarProgress = Math.round(update.progress)
              newProgress.currentStage = update.stage
              break

            case 'style_progress':
              newProgress.styleProgress = Math.round(update.progress)
              newProgress.currentStage = update.stage
              break

            case 'analysis_complete':
              newProgress.currentStage = update.stage
              break

            case 'final_result':
              newProgress.isComplete = true
              newProgress.currentStage = 'Generation complete!'
              newProgress.grammarProgress = 100
              newProgress.styleProgress = 100
              if (update.content) {
                setResult(update.content)
              }
              break

            case 'error':
              newProgress.error = update.error || 'Unknown error occurred'
              newProgress.currentStage = 'Error occurred'
              break
          }

          return newProgress
        })

        // Break on completion or error
        if (update.type === 'final_result' || update.type === 'error') {
          break
        }
      }

    } catch (error) {
      console.error('Streaming error:', error)
      setStreamingProgress(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Streaming failed',
        currentStage: 'Streaming failed'
      }))
    } finally {
      setIsStreaming(false)
      if (streamRef.current) {
        streamRef.current.releaseLock()
        streamRef.current = null
      }
      abortControllerRef.current = null
    }
  }, [options, enabled, isStreaming])

  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (streamRef.current) {
      streamRef.current.cancel()
      streamRef.current = null
    }

    setIsStreaming(false)
    setStreamingProgress(prev => ({
      ...prev,
      currentStage: 'Cancelled by user',
      error: 'Cancelled'
    }))
  }, [])

  const resetStreaming = useCallback(() => {
    setStreamingProgress({
      grammarProgress: 0,
      styleProgress: 0,
      currentStage: 'Ready to start',
      isComplete: false,
      error: null
    })
    setResult(null)
    setIsStreaming(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelStreaming()
    }
  }, [cancelStreaming])

  return {
    // Streaming state
    isStreaming,
    progress: streamingProgress,
    result,

    // Controls
    startStreaming,
    cancelStreaming,
    resetStreaming,

    // Status helpers
    canStart: !isStreaming && enabled && options.content.length >= 10,
    isComplete: streamingProgress.isComplete,
    hasError: !!streamingProgress.error,

    // Progress details
    overallProgress: Math.round((streamingProgress.grammarProgress + streamingProgress.styleProgress) / 2),
    grammarProgress: streamingProgress.grammarProgress,
    styleProgress: streamingProgress.styleProgress,
    currentStage: streamingProgress.currentStage
  }
}

// Hook for enhanced dual draft generation with real-time feedback
export const useEnhancedDualDrafts = (
  content: string,
  options: {
    targetCPL?: number
    preserveVoice?: boolean
    urgentMode?: boolean
    customInstructions?: string
    autoStart?: boolean
    streamingMode?: boolean
  } = {}
) => {
  const {
    targetCPL = 75,
    preserveVoice = true,
    urgentMode = false,
    customInstructions,
    autoStart = false,
    streamingMode = false
  } = options

  // Regular generation mutation
  const generateMutation = useGenerateDualDrafts()

  // Streaming generation
  const streaming = useStreamingDualDrafts({
    content,
    targetCPL,
    preserveVoice,
    urgentMode,
    customInstructions
  }, streamingMode)

  // Analytics for context
  const analytics = useDualDraftAnalytics()

  // Auto-start logic
  useEffect(() => {
    if (autoStart && content.length >= 10 && !generateMutation.isPending && !streaming.isStreaming) {
      if (streamingMode) {
        streaming.startStreaming()
      } else {
        generateMutation.mutate({
          content,
          targetCPL,
          preserveVoice,
          urgentMode,
          customInstructions
        })
      }
    }
  }, [autoStart, content, streamingMode])

  // Manual generation function
  const generate = useCallback(() => {
    if (streamingMode) {
      streaming.startStreaming()
    } else {
      generateMutation.mutate({
        content,
        targetCPL,
        preserveVoice,
        urgentMode,
        customInstructions
      })
    }
  }, [content, targetCPL, preserveVoice, urgentMode, customInstructions, streamingMode])

  // Get the active result
  const activeResult = streamingMode ? streaming.result : generateMutation.data

  return {
    // Generation results
    result: activeResult,
    hasResult: !!activeResult,

    // Generation state
    isGenerating: streamingMode ? streaming.isStreaming : generateMutation.isPending,
    isComplete: streamingMode ? streaming.isComplete : generateMutation.isSuccess,
    error: streamingMode ? streaming.progress.error : generateMutation.error?.message,

    // Controls
    generate,
    cancel: streamingMode ? streaming.cancelStreaming : () => generateMutation.reset(),
    reset: streamingMode ? streaming.resetStreaming : () => generateMutation.reset(),

    // Progress (streaming only)
    progress: streamingMode ? {
      overall: streaming.overallProgress,
      grammar: streaming.grammarProgress,
      style: streaming.styleProgress,
      stage: streaming.currentStage
    } : null,

    // Analytics context
    analytics: analytics.data,
    analyticsLoading: analytics.isLoading,

    // Status helpers
    canGenerate: content.length >= 10 && !generateMutation.isPending && !streaming.isStreaming,
    recommendStreamMode: content.length > 1000, // Recommend streaming for longer content

    // Result analysis
    summary: activeResult ? {
      grammarChanges: activeResult.grammarDraft?.changes?.length || 0,
      styleImprovements: activeResult.styleDraft?.improvements?.length || 0,
      cplImprovement: activeResult.metadata?.expectedImprovements?.styleEnhanced || 0,
      voiceAlignment: activeResult.styleDraft?.voiceAlignment || 0,
      processingTime: activeResult.metadata?.totalProcessingTime || 0,
      costSavings: activeResult.metadata?.costSavings?.estimatedSavings || 0
    } : null
  }
}