'use client'

import { useState, useEffect, useCallback } from 'react'
import { styleRAG, type StyleRetrievalResult } from '@/lib/voice/style-rag-integration'
import { useChatStore } from '@/lib/stores/chat-store'
import { createClient } from '@/lib/supabase/client'

export interface UseStyleRAGReturn {
  isInitialized: boolean
  isLoading: boolean
  styleProfile: any | null
  enhancedPrompt: string | null
  styleGuidance: StyleRetrievalResult['styleGuidance'] | null
  relevantExamples: StyleRetrievalResult['relevantExamples']
  confidence: number
  initializeProfile: () => Promise<void>
  getEnhancedPrompt: (input: string, category: string) => Promise<string>
  updateWithFeedback: (content: string, input: string, category: string, accepted: boolean, cplScore?: number) => Promise<void>
  getStyleInsights: () => Promise<StyleInsights>
  error: string | null
}

export interface StyleInsights {
  acceptanceRate: number
  totalGenerations: number
  averageStyleMatch: number
  strongestCategories: string[]
  improvementAreas: string[]
  recentTrends: {
    period: string
    acceptanceRate: number
    styleMatch: number
  }[]
}

/**
 * Hook for style-based RAG integration with real-time learning
 *
 * Features:
 * - Automatic style profile initialization
 * - Real-time prompt enhancement based on user's writing style
 * - Continuous learning from user feedback
 * - Performance analytics and insights
 * - Caching for optimal performance
 */
export function useStyleRAG(): UseStyleRAGReturn {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [styleProfile, setStyleProfile] = useState<any>(null)
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null)
  const [styleGuidance, setStyleGuidance] = useState<StyleRetrievalResult['styleGuidance'] | null>(null)
  const [relevantExamples, setRelevantExamples] = useState<StyleRetrievalResult['relevantExamples']>([])
  const [confidence, setConfidence] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Get current user
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id) {
          setUserId(user.id)
          // Auto-initialize style profile for authenticated users
          await checkAndInitialize(user.id)
        }
      } catch (error) {
        console.error('Failed to get user:', error)
      }
    }

    getCurrentUser()
  }, [])

  /**
   * Check if profile exists and initialize if needed
   */
  const checkAndInitialize = async (currentUserId: string) => {
    try {
      const { data: existingProfile } = await supabase
        .from('user_style_profiles')
        .select('id, updated_at')
        .eq('user_id', currentUserId)
        .single()

      if (!existingProfile) {
        // No profile exists, initialize it
        await initializeProfile()
      } else {
        setIsInitialized(true)
        // Check if profile needs updating (older than 7 days)
        const lastUpdate = new Date(existingProfile.updated_at)
        const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)

        if (daysSinceUpdate > 7) {
          console.log('Style profile outdated, updating...')
          await initializeProfile() // Refresh profile
        }
      }
    } catch (error) {
      console.error('Failed to check profile:', error)
      setError('Failed to load style profile')
    }
  }

  /**
   * Initialize user's style profile
   */
  const initializeProfile = useCallback(async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Initializing style profile for user:', userId)
      const profile = await styleRAG.initializeStyleProfile(userId)

      setStyleProfile(profile)
      setIsInitialized(true)

      console.log('✅ Style profile initialized:', {
        userId,
        contentVectors: profile.vectorEmbeddings.contentVectors.length,
        averageFormality: profile.baselineMetrics.formalityLevel,
        dominantTone: Object.entries(profile.baselineMetrics.toneProfile)
          .sort(([,a], [,b]) => b - a)[0][0]
      })

    } catch (error) {
      console.error('Failed to initialize style profile:', error)
      setError('Failed to initialize style profile')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  /**
   * Get enhanced prompt based on user's writing style
   */
  const getEnhancedPrompt = useCallback(async (input: string, category: string): Promise<string> => {
    if (!userId || !isInitialized) {
      return input // Return original input if not initialized
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Getting style-enhanced prompt:', { input: input.substring(0, 50), category })

      const result = await styleRAG.retrieveStyleGuidance(userId, input, category)

      // Update state with retrieved data
      setEnhancedPrompt(result.enhancedPrompt)
      setStyleGuidance(result.styleGuidance)
      setRelevantExamples(result.relevantExamples)
      setConfidence(result.confidence)

      console.log('✅ Style guidance retrieved:', {
        confidence: result.confidence,
        relevantExamples: result.relevantExamples.length,
        tone: result.styleGuidance.tone,
        formality: result.styleGuidance.formality
      })

      return result.enhancedPrompt

    } catch (error) {
      console.error('Failed to get enhanced prompt:', error)
      setError('Failed to enhance prompt with style guidance')
      return input // Fallback to original input
    } finally {
      setIsLoading(false)
    }
  }, [userId, isInitialized])

  /**
   * Update style profile with user feedback
   */
  const updateWithFeedback = useCallback(async (
    content: string,
    input: string,
    category: string,
    accepted: boolean,
    cplScore: number = 0
  ) => {
    if (!userId) return

    try {
      console.log('Updating style profile with feedback:', {
        contentLength: content.length,
        category,
        accepted,
        cplScore
      })

      await styleRAG.updateStyleProfile(userId, content, input, category, accepted, cplScore)

      // Store feedback in database for analytics
      await supabase
        .from('style_learning_feedback')
        .insert({
          user_id: userId,
          original_input: input,
          generated_content: content,
          category,
          is_accepted: accepted,
          feedback_type: accepted ? 'accept' : 'reject',
          style_match_score: confidence, // Use current confidence as style match
          confidence_score: confidence,
          relevant_examples: relevantExamples,
          style_guidance: styleGuidance
        })

      console.log('✅ Style profile updated with feedback')

      // If it's positive feedback, refresh profile insights
      if (accepted) {
        // Optionally refresh profile data
        // await checkAndInitialize(userId)
      }

    } catch (error) {
      console.error('Failed to update style profile:', error)
      setError('Failed to update style profile')
    }
  }, [userId, confidence, relevantExamples, styleGuidance])

  /**
   * Get style learning insights and analytics
   */
  const getStyleInsights = useCallback(async (): Promise<StyleInsights> => {
    if (!userId) {
      return {
        acceptanceRate: 0,
        totalGenerations: 0,
        averageStyleMatch: 0,
        strongestCategories: [],
        improvementAreas: [],
        recentTrends: []
      }
    }

    try {
      // Get recent feedback data
      const { data: recentFeedback } = await supabase
        .from('style_learning_feedback')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .order('created_at', { ascending: false })

      if (!recentFeedback || recentFeedback.length === 0) {
        return {
          acceptanceRate: 0,
          totalGenerations: 0,
          averageStyleMatch: 0,
          strongestCategories: [],
          improvementAreas: [],
          recentTrends: []
        }
      }

      const totalGenerations = recentFeedback.length
      const acceptedCount = recentFeedback.filter(f => f.is_accepted).length
      const acceptanceRate = (acceptedCount / totalGenerations) * 100

      const averageStyleMatch = recentFeedback
        .filter(f => f.style_match_score !== null)
        .reduce((sum, f) => sum + (f.style_match_score || 0), 0) / totalGenerations

      // Analyze by category
      const categoryStats = recentFeedback.reduce((acc, feedback) => {
        const category = feedback.category
        if (!acc[category]) {
          acc[category] = { total: 0, accepted: 0 }
        }
        acc[category].total++
        if (feedback.is_accepted) acc[category].accepted++
        return acc
      }, {} as Record<string, { total: number; accepted: number }>)

      const strongestCategories = Object.entries(categoryStats)
        .map(([category, stats]) => ({
          category,
          rate: (stats.accepted / stats.total) * 100
        }))
        .filter(c => c.rate >= 70) // 70% acceptance rate threshold
        .sort((a, b) => b.rate - a.rate)
        .map(c => c.category)

      const improvementAreas = Object.entries(categoryStats)
        .map(([category, stats]) => ({
          category,
          rate: (stats.accepted / stats.total) * 100
        }))
        .filter(c => c.rate < 50) // Below 50% acceptance rate
        .sort((a, b) => a.rate - b.rate)
        .map(c => c.category)

      // Weekly trends (last 4 weeks)
      const recentTrends = []
      for (let week = 0; week < 4; week++) {
        const weekStart = new Date(Date.now() - (week + 1) * 7 * 24 * 60 * 60 * 1000)
        const weekEnd = new Date(Date.now() - week * 7 * 24 * 60 * 60 * 1000)

        const weekData = recentFeedback.filter(f => {
          const date = new Date(f.created_at)
          return date >= weekStart && date < weekEnd
        })

        if (weekData.length > 0) {
          const weekAcceptanceRate = (weekData.filter(f => f.is_accepted).length / weekData.length) * 100
          const weekStyleMatch = weekData
            .filter(f => f.style_match_score !== null)
            .reduce((sum, f) => sum + (f.style_match_score || 0), 0) / weekData.length

          recentTrends.push({
            period: `Week ${week + 1}`,
            acceptanceRate: weekAcceptanceRate,
            styleMatch: weekStyleMatch
          })
        }
      }

      return {
        acceptanceRate: Math.round(acceptanceRate),
        totalGenerations,
        averageStyleMatch: Math.round(averageStyleMatch),
        strongestCategories,
        improvementAreas,
        recentTrends: recentTrends.reverse() // Oldest first
      }

    } catch (error) {
      console.error('Failed to get style insights:', error)
      return {
        acceptanceRate: 0,
        totalGenerations: 0,
        averageStyleMatch: 0,
        strongestCategories: [],
        improvementAreas: [],
        recentTrends: []
      }
    }
  }, [userId])

  return {
    isInitialized,
    isLoading,
    styleProfile,
    enhancedPrompt,
    styleGuidance,
    relevantExamples,
    confidence,
    initializeProfile,
    getEnhancedPrompt,
    updateWithFeedback,
    getStyleInsights,
    error
  }
}

/**
 * Usage Example:
 *
 * function ChatInterface() {
 *   const {
 *     isInitialized,
 *     getEnhancedPrompt,
 *     updateWithFeedback,
 *     styleGuidance,
 *     confidence
 *   } = useStyleRAG()
 *
 *   const handleSendMessage = async (message: string, category: string) => {
 *     if (isInitialized) {
 *       // Get style-enhanced prompt
 *       const enhancedPrompt = await getEnhancedPrompt(message, category)
 *       const response = await generateAIResponse(enhancedPrompt)
 *
 *       // Later, when user provides feedback:
 *       await updateWithFeedback(response, message, category, true, cplScore)
 *     }
 *   }
 *
 *   return (
 *     <div>
 *       {styleGuidance && (
 *         <div>
 *           Style: {styleGuidance.tone} | Confidence: {confidence}%
 *         </div>
 *       )}
 *       <ChatInput onSend={handleSendMessage} />
 *     </div>
 *   )
 * }
 */