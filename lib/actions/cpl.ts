'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import {
  calculateCPLScore,
  getUserCPLTrends,
  getCPLBenchmarks,
  compareToBenchmarks,
  getCPLImprovementSuggestions,
  updateUserCPLBaseline,
  getCPLDistribution
} from '@/lib/cpl/scoring'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const cplAnalysisSchema = z.object({
  text: z.string().min(10, 'Text must be at least 10 characters').max(10000, 'Text too long'),
  includeBaseline: z.boolean().optional(),
  detailedAnalysis: z.boolean().optional(),
  cacheResults: z.boolean().optional(),
})

const cplTrendsSchema = z.object({
  timeframe: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
})

const benchmarkComparisonSchema = z.object({
  cplScore: z.number().min(1).max(100),
  userType: z.enum(['student', 'professional', 'writer', 'general']).default('general'),
  category: z.string().optional(),
})

// Analyze text and get CPL score
export async function analyzeCPLScore(formData: FormData) {
  try {
    const user = await getUser()

    // Parse and validate form data
    const rawData = {
      text: formData.get('text') as string,
      includeBaseline: formData.get('includeBaseline') === 'true',
      detailedAnalysis: formData.get('detailedAnalysis') === 'true',
      cacheResults: formData.get('cacheResults') === 'true',
    }

    const validatedData = cplAnalysisSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { text, includeBaseline, detailedAnalysis, cacheResults } = validatedData.data

    // Calculate CPL score
    const result = await calculateCPLScore(text, user?.id, {
      includeBaseline,
      detailedAnalysis,
      cacheResults,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      }
    }

    // Get improvement suggestions if user is authenticated
    let suggestions
    if (user && result.score) {
      const userPreferences = await getUserPreferences(user.id)
      const targetCpl = userPreferences?.cpl_target || 75

      suggestions = getCPLImprovementSuggestions(result.score, targetCpl)
    }

    return {
      success: true,
      data: {
        score: result.score,
        suggestions,
      },
      message: 'CPL analysis completed successfully',
    }
  } catch (error) {
    console.error('Analyze CPL score error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get user CPL trends
export async function getUserCPLTrendsAction(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Parse and validate form data
    const rawData = {
      timeframe: (formData.get('timeframe') as 'week' | 'month' | 'quarter' | 'year') || 'month',
    }

    const validatedData = cplTrendsSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { timeframe } = validatedData.data

    // Get trends data
    const result = await getUserCPLTrends(user.id, timeframe)

    return {
      success: result.success,
      data: result.trends,
      error: result.error,
    }
  } catch (error) {
    console.error('Get user CPL trends error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Compare CPL score to benchmarks
export async function compareCPLToBenchmarks(formData: FormData) {
  try {
    const user = await getUser()

    // Parse and validate form data
    const rawData = {
      cplScore: parseInt(formData.get('cplScore') as string),
      userType: (formData.get('userType') as 'student' | 'professional' | 'writer' | 'general') || 'general',
      category: formData.get('category') as string || undefined,
    }

    const validatedData = benchmarkComparisonSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { cplScore, userType, category } = validatedData.data

    // Get benchmarks and comparison
    const benchmarks = getCPLBenchmarks(userType)
    const comparison = compareToBenchmarks(cplScore, userType, category)

    return {
      success: true,
      data: {
        benchmarks,
        comparison,
        userType,
        category,
      },
      message: 'Benchmark comparison completed',
    }
  } catch (error) {
    console.error('Compare CPL to benchmarks error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get CPL improvement suggestions
export async function getCPLSuggestions(formData: FormData) {
  try {
    const user = await getUser()

    const cplScoreData = formData.get('cplScore')
    const targetScore = formData.get('targetScore')

    if (!cplScoreData) {
      return {
        success: false,
        error: 'CPL score data is required',
      }
    }

    // Parse CPL score data (should be JSON)
    const cplScore = JSON.parse(cplScoreData as string)
    const target = targetScore ? parseInt(targetScore as string) : undefined

    // Get improvement suggestions
    const suggestions = getCPLImprovementSuggestions(cplScore, target)

    // Get user-specific context if available
    let userContext = {}
    if (user) {
      const userPreferences = await getUserPreferences(user.id)
      userContext = {
        preferredStyle: userPreferences?.writing_style,
        targetCpl: userPreferences?.cpl_target,
      }
    }

    return {
      success: true,
      data: {
        suggestions,
        userContext,
      },
      message: 'Improvement suggestions generated',
    }
  } catch (error) {
    console.error('Get CPL suggestions error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Update user CPL baseline
export async function updateUserCPLBaselineAction() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Update baseline
    const newBaseline = await updateUserCPLBaseline(user.id)

    if (newBaseline === null) {
      return {
        success: false,
        error: 'No recent CPL scores found to calculate baseline',
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/profile')

    return {
      success: true,
      data: { newBaseline },
      message: `CPL baseline updated to ${newBaseline}`,
    }
  } catch (error) {
    console.error('Update user CPL baseline error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get user's CPL statistics
export async function getUserCPLStatistics() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: null,
      }
    }

    const supabase = createClient()

    // Get user profile with current CPL
    const { data: profile } = await supabase
      .from('profiles')
      .select('cpl_score, preferences')
      .eq('id', user.id)
      .single()

    // Get recent drafts with CPL scores
    const { data: recentDrafts } = await supabase
      .from('generated_drafts')
      .select('cpl_score, draft_type, created_at, user_rating')
      .eq('user_id', user.id)
      .eq('generation_status', 'completed')
      .not('cpl_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!recentDrafts || recentDrafts.length === 0) {
      return {
        success: true,
        data: {
          currentBaseline: profile?.cpl_score || 0,
          totalDrafts: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          improvementTrend: 0,
          draftTypeBreakdown: {},
          recentScores: [],
          targetScore: profile?.preferences?.cpl_target || 75,
        },
      }
    }

    const scores = recentDrafts.map(d => d.cpl_score!).filter(Boolean)
    const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    const highestScore = Math.max(...scores)
    const lowestScore = Math.min(...scores)

    // Calculate improvement trend (recent vs earlier scores)
    const halfPoint = Math.floor(scores.length / 2)
    const recentAverage = scores.slice(0, halfPoint).reduce((sum, score) => sum + score, 0) / halfPoint
    const earlierAverage = scores.slice(halfPoint).reduce((sum, score) => sum + score, 0) / (scores.length - halfPoint)
    const improvementTrend = Math.round((recentAverage - earlierAverage) * 10) / 10

    // Draft type breakdown
    const draftTypeBreakdown = recentDrafts.reduce((acc, draft) => {
      const type = draft.draft_type
      if (!acc[type]) {
        acc[type] = { count: 0, averageScore: 0, totalScore: 0 }
      }
      acc[type].count++
      acc[type].totalScore += draft.cpl_score!
      acc[type].averageScore = Math.round(acc[type].totalScore / acc[type].count)
      return acc
    }, {} as Record<string, any>)

    // Recent scores for charting
    const recentScores = recentDrafts.slice(0, 10).map(draft => ({
      score: draft.cpl_score!,
      date: draft.created_at,
      type: draft.draft_type,
      rating: draft.user_rating,
    })).reverse() // Show chronologically

    return {
      success: true,
      data: {
        currentBaseline: profile?.cpl_score || 0,
        totalDrafts: recentDrafts.length,
        averageScore,
        highestScore,
        lowestScore,
        improvementTrend,
        draftTypeBreakdown,
        recentScores,
        targetScore: profile?.preferences?.cpl_target || 75,
      },
    }
  } catch (error) {
    console.error('Get user CPL statistics error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: null,
    }
  }
}

// Get CPL leaderboard (top performers, anonymized)
export async function getCPLLeaderboard() {
  try {
    const user = await getUser()

    // Get distribution data
    const distributionResult = await getCPLDistribution()

    if (!distributionResult.success) {
      return {
        success: false,
        error: distributionResult.error,
        data: null,
      }
    }

    // Get user's ranking if authenticated
    let userRanking = null
    if (user) {
      const supabase = createClient()

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('cpl_score')
        .eq('id', user.id)
        .single()

      if (userProfile?.cpl_score) {
        // Calculate user's percentile
        const { data: higherScores } = await supabase
          .from('profiles')
          .select('cpl_score', { count: 'exact' })
          .gt('cpl_score', userProfile.cpl_score)

        const { data: totalUsers } = await supabase
          .from('profiles')
          .select('cpl_score', { count: 'exact' })
          .not('cpl_score', 'is', null)

        if (totalUsers && higherScores) {
          const percentile = Math.round(((totalUsers.count - higherScores.count) / totalUsers.count) * 100)
          userRanking = {
            score: userProfile.cpl_score,
            percentile,
            rank: higherScores.count + 1,
            totalUsers: totalUsers.count,
          }
        }
      }
    }

    return {
      success: true,
      data: {
        distribution: distributionResult.data,
        userRanking,
        insights: generateCPLInsights(distributionResult.data!),
      },
    }
  } catch (error) {
    console.error('Get CPL leaderboard error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: null,
    }
  }
}

// Set user CPL target
export async function setUserCPLTarget(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const targetScore = parseInt(formData.get('targetScore') as string)

    if (isNaN(targetScore) || targetScore < 1 || targetScore > 100) {
      return {
        success: false,
        error: 'Target score must be between 1 and 100',
      }
    }

    const supabase = createClient()

    // Get current preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    const currentPreferences = profile?.preferences || {}

    // Update preferences with new target
    const { error } = await supabase
      .from('profiles')
      .update({
        preferences: {
          ...currentPreferences,
          cpl_target: targetScore,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      return {
        success: false,
        error: 'Failed to update CPL target',
      }
    }

    revalidatePath('/settings')
    revalidatePath('/dashboard')

    return {
      success: true,
      data: { targetScore },
      message: `CPL target set to ${targetScore}`,
    }
  } catch (error) {
    console.error('Set user CPL target error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Helper functions
async function getUserPreferences(userId: string) {
  try {
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .single()

    return profile?.preferences || {}
  } catch (error) {
    console.error('Get user preferences error:', error)
    return {}
  }
}

function generateCPLInsights(distribution: any) {
  const insights = []

  if (distribution.average > 70) {
    insights.push('The community maintains high writing standards with an average CPL score above 70.')
  }

  const excellentPercentage = distribution.distribution.find((d: any) => d.range === '81-100')?.percentage || 0
  if (excellentPercentage > 20) {
    insights.push(`${excellentPercentage}% of users achieve excellent CPL scores (81-100).`)
  }

  const needsImprovementPercentage = distribution.distribution
    .filter((d: any) => ['1-20', '21-40'].includes(d.range))
    .reduce((sum: number, d: any) => sum + d.percentage, 0)

  if (needsImprovementPercentage < 10) {
    insights.push('Most users demonstrate strong writing fundamentals.')
  }

  return insights
}