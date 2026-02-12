'use server'

import { getUser } from '@/lib/supabase/server'
import { voiceLearningEngine } from '@/lib/voice/voice-learning'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const analyzeWritingSampleSchema = z.object({
  content: z.string().min(50, 'Content must be at least 50 characters'),
  storeInHistory: z.boolean().optional().default(true)
})

const voiceAwareSuggestionsSchema = z.object({
  currentText: z.string().min(10, 'Text must be at least 10 characters'),
  targetVoiceStrength: z.number().min(0).max(1).optional().default(0.8)
})

const similarVoiceExamplesSchema = z.object({
  queryText: z.string().min(10, 'Query text must be at least 10 characters'),
  minSimilarity: z.number().min(0).max(1).optional().default(0.7),
  maxExamples: z.number().min(1).max(20).optional().default(10),
  voicePatternFilter: z.array(z.string()).optional()
})

// Analyze writing sample for voice patterns
export async function analyzeWritingSampleAction(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const rawData = {
      content: formData.get('content') as string,
      storeInHistory: formData.get('storeInHistory') === 'true'
    }

    const validatedData = analyzeWritingSampleSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { content, storeInHistory } = validatedData.data

    const result = await voiceLearningEngine.analyzeWritingSample(
      user.id,
      content,
      storeInHistory
    )

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to analyze writing sample',
      }
    }

    return {
      success: true,
      data: {
        sample: result.sample,
        patterns: result.patterns,
        analysis: {
          voiceStrength: result.patterns?.reduce((sum, p) => sum + p.strength, 0) / (result.patterns?.length || 1),
          dominantPatterns: result.patterns?.filter(p => p.strength > 0.5).map(p => p.patternType) || [],
          confidence: result.sample?.metadata ?
            (result.sample.metadata.vocabularyScore +
             result.sample.metadata.complexityScore +
             result.sample.metadata.formalityScore) / 3 : 0
        }
      },
      message: 'Writing sample analyzed successfully',
    }
  } catch (error) {
    console.error('Analyze writing sample error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Build comprehensive voice profile
export async function buildVoiceProfileAction() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const result = await voiceLearningEngine.buildVoiceProfile(user.id)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to build voice profile',
      }
    }

    // Revalidate dashboard and profile pages
    revalidatePath('/dashboard')
    revalidatePath('/profile')

    return {
      success: true,
      data: result.profile,
      message: `Voice profile built with ${result.profile?.sampleCount} samples (${Math.round((result.profile?.confidenceScore || 0) * 100)}% confidence)`,
    }
  } catch (error) {
    console.error('Build voice profile error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get voice-aware content suggestions
export async function getVoiceAwareSuggestionsAction(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const rawData = {
      currentText: formData.get('currentText') as string,
      targetVoiceStrength: parseFloat(formData.get('targetVoiceStrength') as string) || 0.8
    }

    const validatedData = voiceAwareSuggestionsSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { currentText, targetVoiceStrength } = validatedData.data

    const result = await voiceLearningEngine.getVoiceAwareSuggestions(
      user.id,
      currentText,
      targetVoiceStrength
    )

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to generate voice-aware suggestions',
      }
    }

    return {
      success: true,
      data: {
        suggestions: result.suggestions,
        voiceStrength: targetVoiceStrength,
        totalSuggestions: result.suggestions?.length || 0,
        highConfidenceSuggestions: result.suggestions?.filter(s => s.confidence > 0.7).length || 0
      },
      message: `Generated ${result.suggestions?.length || 0} voice-aware suggestions`,
    }
  } catch (error) {
    console.error('Get voice-aware suggestions error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Find similar voice examples
export async function findSimilarVoiceExamplesAction(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const rawData = {
      queryText: formData.get('queryText') as string,
      minSimilarity: parseFloat(formData.get('minSimilarity') as string) || 0.7,
      maxExamples: parseInt(formData.get('maxExamples') as string) || 10,
      voicePatternFilter: formData.get('voicePatternFilter') ?
        JSON.parse(formData.get('voicePatternFilter') as string) : undefined
    }

    const validatedData = similarVoiceExamplesSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { queryText, minSimilarity, maxExamples, voicePatternFilter } = validatedData.data

    const result = await voiceLearningEngine.findSimilarVoiceExamples(
      user.id,
      queryText,
      {
        minSimilarity,
        maxExamples,
        voicePatternFilter
      }
    )

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to find similar voice examples',
      }
    }

    const examples = result.examples || []

    return {
      success: true,
      data: {
        examples,
        totalFound: examples.length,
        averageVoiceMatch: examples.length > 0
          ? examples.reduce((sum, ex) => sum + ex.metrics.voiceMatch, 0) / examples.length
          : 0,
        averageSimilarity: examples.length > 0
          ? examples.reduce((sum, ex) => sum + ex.similarity, 0) / examples.length
          : 0
      },
      message: `Found ${examples.length} similar voice examples`,
    }
  } catch (error) {
    console.error('Find similar voice examples error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get voice learning analytics
export async function getVoiceLearningAnalyticsAction() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Build or retrieve voice profile
    const profileResult = await voiceLearningEngine.buildVoiceProfile(user.id)

    if (!profileResult.success || !profileResult.profile) {
      return {
        success: false,
        error: 'Voice profile not available. Please write more content to build your profile.',
      }
    }

    const profile = profileResult.profile

    // Calculate analytics
    const analytics = {
      profileSummary: {
        confidenceScore: profile.confidenceScore,
        sampleCount: profile.sampleCount,
        lastUpdated: profile.lastUpdated,
        profileCompleteness: Math.min(profile.sampleCount / 20, 1) // Complete at 20 samples
      },
      voiceCharacteristics: {
        dominantPatterns: profile.voicePatterns
          .filter(p => p.strength > 0.5)
          .map(p => ({
            type: p.patternType,
            strength: p.strength,
            description: p.description
          })),
        voiceMetrics: profile.voiceMetrics,
        styleSummary: `${profile.voiceMetrics.complexityLevel} complexity, ${profile.voiceMetrics.formalityLevel} tone`
      },
      improvements: {
        strengthenAreas: profile.voicePatterns
          .filter(p => p.strength < 0.5)
          .map(p => p.patternType),
        recommendations: [
          profile.sampleCount < 10 ? 'Write more content to improve voice analysis accuracy' : null,
          profile.confidenceScore < 0.7 ? 'Continue writing to strengthen voice patterns' : null,
          profile.voicePatterns.length < 3 ? 'Diversify your writing to develop more voice patterns' : null
        ].filter(Boolean)
      },
      progress: {
        weeklyGrowth: 0, // Would calculate from historical data
        patternDevelopment: profile.voicePatterns.length,
        consistencyScore: profile.confidenceScore
      }
    }

    return {
      success: true,
      data: analytics,
      message: 'Voice learning analytics retrieved successfully',
    }
  } catch (error) {
    console.error('Get voice learning analytics error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Refresh voice profile (force rebuild)
export async function refreshVoiceProfileAction() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Force rebuild with maximum samples
    const result = await voiceLearningEngine.buildVoiceProfile(user.id, 100)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to refresh voice profile',
      }
    }

    // Revalidate relevant pages
    revalidatePath('/dashboard')
    revalidatePath('/profile')
    revalidatePath('/voice-analysis')

    return {
      success: true,
      data: {
        profile: result.profile,
        improvements: {
          newPatterns: result.profile?.voicePatterns.filter(p => p.strength > 0.5).length || 0,
          confidenceIncrease: Math.max(0, (result.profile?.confidenceScore || 0) - 0.5),
          sampleCount: result.profile?.sampleCount || 0
        }
      },
      message: `Voice profile refreshed with ${result.profile?.sampleCount} samples`,
    }
  } catch (error) {
    console.error('Refresh voice profile error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}