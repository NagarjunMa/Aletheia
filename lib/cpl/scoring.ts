// Content Polish Level (CPL) Scoring System
// Created: December 7, 2024
// Purpose: Comprehensive CPL analysis, scoring, and management

import { processWithClaude, type CPLAnalysis } from '@/lib/ai/claude'
import { createClient } from '@/lib/supabase/server'
import { analyzeTextComplexity } from '@/lib/ai/utils'

export interface CPLScore {
  overall: number
  breakdown: {
    grammar: number
    clarity: number
    style: number
    engagement: number
    vocabulary: number
  }
  analysis: CPLAnalysis
  timestamp: Date
  textMetrics: {
    wordCount: number
    sentenceCount: number
    paragraphCount: number
    complexityLevel: string
    readingTimeMinutes: number
  }
}

export interface CPLTrend {
  userId: string
  timeframe: 'week' | 'month' | 'quarter' | 'year'
  averageScore: number
  improvement: number
  improvementPercentage: number
  totalDrafts: number
  dataPoints: Array<{
    date: string
    score: number
    draftType: string
  }>
}

export interface CPLBenchmark {
  category: string
  userType: 'student' | 'professional' | 'writer' | 'general'
  targetScore: number
  minimumScore: number
  excellentScore: number
  description: string
}

// Core CPL scoring function
export async function calculateCPLScore(
  text: string,
  userId?: string,
  options: {
    includeBaseline?: boolean
    detailedAnalysis?: boolean
    cacheResults?: boolean
  } = {}
): Promise<{ success: boolean; score?: CPLScore; error?: string }> {
  try {
    if (!text || text.trim().length < 10) {
      return {
        success: false,
        error: 'Text must be at least 10 characters long'
      }
    }

    // Get user preferences if available
    let userPreferences = {}
    if (userId) {
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .single()

      userPreferences = profile?.preferences || {}
    }

    // Analyze with Claude
    const aiResult = await processWithClaude(
      text,
      'cpl_analysis',
      {
        userPreferences,
        compareToUserBaseline: options.includeBaseline
      }
    )

    if (!aiResult.success || !aiResult.analysis) {
      return {
        success: false,
        error: aiResult.error || 'Failed to analyze content'
      }
    }

    // Calculate text metrics
    const textMetrics = analyzeTextComplexity(text)

    // Create comprehensive CPL score
    const cplScore: CPLScore = {
      overall: aiResult.analysis.score,
      breakdown: aiResult.analysis.breakdown,
      analysis: aiResult.analysis,
      timestamp: new Date(),
      textMetrics: {
        wordCount: textMetrics.wordCount,
        sentenceCount: textMetrics.sentenceCount,
        paragraphCount: textMetrics.paragraphCount,
        complexityLevel: textMetrics.complexityLevel,
        readingTimeMinutes: textMetrics.estimatedReadingTimeMinutes,
      }
    }

    // Cache results if requested and user provided
    if (options.cacheResults && userId) {
      await cacheCPLResult(userId, text, cplScore)
    }

    return {
      success: true,
      score: cplScore
    }

  } catch (error) {
    console.error('CPL scoring error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during analysis'
    }
  }
}

// Get CPL trends for a user
export async function getUserCPLTrends(
  userId: string,
  timeframe: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<{ success: boolean; trends?: CPLTrend; error?: string }> {
  try {
    const supabase = createClient()

    // Calculate date range
    const now = new Date()
    const startDate = new Date()

    switch (timeframe) {
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(now.getMonth() - 1)
        break
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3)
        break
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
    }

    // Get drafts with CPL scores
    const { data: drafts, error } = await supabase
      .from('generated_drafts')
      .select('cpl_score, draft_type, created_at')
      .eq('user_id', userId)
      .eq('generation_status', 'completed')
      .not('cpl_score', 'is', null)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      return {
        success: false,
        error: 'Failed to fetch CPL data'
      }
    }

    if (!drafts || drafts.length === 0) {
      return {
        success: true,
        trends: {
          userId,
          timeframe,
          averageScore: 0,
          improvement: 0,
          improvementPercentage: 0,
          totalDrafts: 0,
          dataPoints: []
        }
      }
    }

    // Calculate trends
    const scores = drafts.map(d => d.cpl_score!).filter(Boolean)
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length

    // Calculate improvement (compare first quarter vs last quarter)
    const quarterSize = Math.max(1, Math.floor(scores.length / 4))
    const firstQuarter = scores.slice(0, quarterSize)
    const lastQuarter = scores.slice(-quarterSize)

    const firstAverage = firstQuarter.reduce((sum, score) => sum + score, 0) / firstQuarter.length
    const lastAverage = lastQuarter.reduce((sum, score) => sum + score, 0) / lastQuarter.length

    const improvement = lastAverage - firstAverage
    const improvementPercentage = firstAverage > 0 ? (improvement / firstAverage) * 100 : 0

    // Create data points
    const dataPoints = drafts.map(draft => ({
      date: draft.created_at,
      score: draft.cpl_score!,
      draftType: draft.draft_type
    }))

    const trends: CPLTrend = {
      userId,
      timeframe,
      averageScore: Math.round(averageScore),
      improvement: Math.round(improvement * 10) / 10,
      improvementPercentage: Math.round(improvementPercentage * 10) / 10,
      totalDrafts: drafts.length,
      dataPoints
    }

    return {
      success: true,
      trends
    }

  } catch (error) {
    console.error('Get CPL trends error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}

// Get CPL benchmarks for user type
export function getCPLBenchmarks(userType: 'student' | 'professional' | 'writer' | 'general' = 'general'): CPLBenchmark[] {
  const benchmarks: Record<string, CPLBenchmark[]> = {
    student: [
      {
        category: 'Academic Essays',
        userType: 'student',
        targetScore: 75,
        minimumScore: 60,
        excellentScore: 85,
        description: 'Well-structured academic writing with clear arguments'
      },
      {
        category: 'Research Papers',
        userType: 'student',
        targetScore: 80,
        minimumScore: 70,
        excellentScore: 90,
        description: 'Professional academic writing with rigorous analysis'
      },
      {
        category: 'Lab Reports',
        userType: 'student',
        targetScore: 70,
        minimumScore: 60,
        excellentScore: 80,
        description: 'Clear, methodical scientific documentation'
      }
    ],
    professional: [
      {
        category: 'Business Communications',
        userType: 'professional',
        targetScore: 80,
        minimumScore: 70,
        excellentScore: 90,
        description: 'Clear, professional business correspondence'
      },
      {
        category: 'Reports & Proposals',
        userType: 'professional',
        targetScore: 85,
        minimumScore: 75,
        excellentScore: 95,
        description: 'Comprehensive, persuasive business documents'
      },
      {
        category: 'Technical Documentation',
        userType: 'professional',
        targetScore: 75,
        minimumScore: 65,
        excellentScore: 85,
        description: 'Clear, accurate technical communication'
      }
    ],
    writer: [
      {
        category: 'Creative Writing',
        userType: 'writer',
        targetScore: 85,
        minimumScore: 70,
        excellentScore: 95,
        description: 'Engaging, original creative content'
      },
      {
        category: 'Blog Posts',
        userType: 'writer',
        targetScore: 80,
        minimumScore: 70,
        excellentScore: 90,
        description: 'Engaging, accessible online content'
      },
      {
        category: 'Marketing Copy',
        userType: 'writer',
        targetScore: 85,
        minimumScore: 75,
        excellentScore: 95,
        description: 'Persuasive, compelling marketing content'
      }
    ],
    general: [
      {
        category: 'General Writing',
        userType: 'general',
        targetScore: 70,
        minimumScore: 60,
        excellentScore: 80,
        description: 'Clear, effective general communication'
      },
      {
        category: 'Personal Communications',
        userType: 'general',
        targetScore: 65,
        minimumScore: 55,
        excellentScore: 75,
        description: 'Friendly, clear personal writing'
      }
    ]
  }

  return benchmarks[userType] || benchmarks.general
}

// Compare user's CPL against benchmarks
export function compareToBenchmarks(
  cplScore: number,
  userType: 'student' | 'professional' | 'writer' | 'general' = 'general',
  category?: string
): {
  benchmark: CPLBenchmark | null
  performance: 'below_minimum' | 'minimum' | 'target' | 'excellent'
  gap: number
  recommendations: string[]
} {
  const benchmarks = getCPLBenchmarks(userType)
  const benchmark = category
    ? benchmarks.find(b => b.category.toLowerCase().includes(category.toLowerCase()))
    : benchmarks[0] // Use first benchmark as default

  if (!benchmark) {
    return {
      benchmark: null,
      performance: 'target',
      gap: 0,
      recommendations: []
    }
  }

  let performance: 'below_minimum' | 'minimum' | 'target' | 'excellent'
  let gap: number
  let recommendations: string[] = []

  if (cplScore >= benchmark.excellentScore) {
    performance = 'excellent'
    gap = 0
    recommendations = [
      'Excellent work! Your writing meets the highest standards.',
      'Consider helping others improve their writing skills.',
      'Maintain this level of quality in future work.'
    ]
  } else if (cplScore >= benchmark.targetScore) {
    performance = 'target'
    gap = benchmark.excellentScore - cplScore
    recommendations = [
      'Good work! You\'ve met the target standard.',
      `Work on improving by ${gap} points to reach excellent level.`,
      'Focus on refining style and engagement elements.'
    ]
  } else if (cplScore >= benchmark.minimumScore) {
    performance = 'minimum'
    gap = benchmark.targetScore - cplScore
    recommendations = [
      'You\'ve met the minimum standard.',
      `Focus on improving by ${gap} points to reach target level.`,
      'Work on clarity, structure, and grammar improvements.'
    ]
  } else {
    performance = 'below_minimum'
    gap = benchmark.minimumScore - cplScore
    recommendations = [
      'Your writing needs significant improvement.',
      `Focus on improving by ${gap} points to reach minimum standard.`,
      'Start with basic grammar and structure improvements.',
      'Consider using the grammar fix option before adaptive polish.'
    ]
  }

  return {
    benchmark,
    performance,
    gap,
    recommendations
  }
}

// Get CPL improvement suggestions
export function getCPLImprovementSuggestions(
  cplScore: CPLScore,
  targetScore?: number
): {
  primaryFocus: string
  suggestions: string[]
  estimatedImprovement: number
  difficulty: 'easy' | 'moderate' | 'challenging'
} {
  const { breakdown } = cplScore
  const currentScore = cplScore.overall
  const target = targetScore || currentScore + 10

  // Find the weakest areas
  const areas = [
    { name: 'grammar', score: breakdown.grammar, weight: 0.20 },
    { name: 'clarity', score: breakdown.clarity, weight: 0.25 },
    { name: 'style', score: breakdown.style, weight: 0.20 },
    { name: 'engagement', score: breakdown.engagement, weight: 0.20 },
    { name: 'vocabulary', score: breakdown.vocabulary, weight: 0.15 }
  ]

  areas.sort((a, b) => a.score - b.score)
  const weakestArea = areas[0]

  const suggestions: Record<string, string[]> = {
    grammar: [
      'Review basic grammar rules and common errors',
      'Use grammar checking tools during writing',
      'Read your work aloud to catch grammatical mistakes',
      'Focus on sentence structure and punctuation',
      'Practice with grammar exercises'
    ],
    clarity: [
      'Use shorter, clearer sentences',
      'Organize ideas with clear topic sentences',
      'Use transitional phrases to connect ideas',
      'Remove unnecessary words and jargon',
      'Structure content with headings and bullet points'
    ],
    style: [
      'Develop a consistent voice and tone',
      'Vary sentence length and structure',
      'Choose words that match your audience',
      'Avoid overuse of passive voice',
      'Read examples of good writing in your field'
    ],
    engagement: [
      'Start with compelling openings',
      'Use specific examples and stories',
      'Ask rhetorical questions to involve readers',
      'Vary paragraph length for better flow',
      'End with strong, memorable conclusions'
    ],
    vocabulary: [
      'Use precise, specific words instead of generic ones',
      'Avoid unnecessary jargon or overly complex words',
      'Use action verbs instead of weak verbs',
      'Incorporate varied vocabulary while staying accessible',
      'Replace weak modifiers with stronger alternatives'
    ]
  }

  const estimatedImprovement = Math.min(
    target - currentScore,
    (100 - weakestArea.score) * weakestArea.weight * 0.7 // Conservative estimate
  )

  const difficulty = weakestArea.score < 50 ? 'easy' :
                    weakestArea.score < 70 ? 'moderate' : 'challenging'

  return {
    primaryFocus: weakestArea.name,
    suggestions: suggestions[weakestArea.name],
    estimatedImprovement: Math.round(estimatedImprovement),
    difficulty
  }
}

// Cache CPL results for performance
async function cacheCPLResult(userId: string, text: string, score: CPLScore) {
  try {
    // Create a hash of the text for caching (simplified)
    const textHash = text.length.toString() + text.substring(0, 50)

    // In a production app, you might use Redis or a dedicated cache
    console.log(`Caching CPL result for user ${userId}: score ${score.overall}`)
  } catch (error) {
    console.error('Cache CPL result error:', error)
  }
}

// Update user's baseline CPL score
export async function updateUserCPLBaseline(userId: string) {
  try {
    const supabase = createClient()

    // Get recent CPL scores (last 10 drafts)
    const { data: recentDrafts } = await supabase
      .from('generated_drafts')
      .select('cpl_score')
      .eq('user_id', userId)
      .eq('generation_status', 'completed')
      .not('cpl_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (recentDrafts && recentDrafts.length > 0) {
      const scores = recentDrafts.map(d => d.cpl_score!).filter(Boolean)
      const averageScore = Math.round(
        scores.reduce((sum, score) => sum + score, 0) / scores.length
      )

      // Update user profile
      await supabase
        .from('profiles')
        .update({
          cpl_score: averageScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      return averageScore
    }

    return null
  } catch (error) {
    console.error('Update user CPL baseline error:', error)
    return null
  }
}

// Get CPL distribution across all users (for insights)
export async function getCPLDistribution(): Promise<{
  success: boolean
  data?: {
    average: number
    median: number
    distribution: Array<{ range: string; count: number; percentage: number }>
  }
  error?: string
}> {
  try {
    const supabase = createClient()

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('cpl_score')
      .not('cpl_score', 'is', null)

    if (error || !profiles) {
      return {
        success: false,
        error: 'Failed to fetch CPL distribution data'
      }
    }

    const scores = profiles.map(p => p.cpl_score!).filter(Boolean).sort((a, b) => a - b)

    if (scores.length === 0) {
      return {
        success: true,
        data: {
          average: 0,
          median: 0,
          distribution: []
        }
      }
    }

    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    const median = scores[Math.floor(scores.length / 2)]

    // Create distribution buckets
    const ranges = [
      { range: '1-20', min: 1, max: 20 },
      { range: '21-40', min: 21, max: 40 },
      { range: '41-60', min: 41, max: 60 },
      { range: '61-80', min: 61, max: 80 },
      { range: '81-100', min: 81, max: 100 }
    ]

    const distribution = ranges.map(({ range, min, max }) => {
      const count = scores.filter(score => score >= min && score <= max).length
      const percentage = Math.round((count / scores.length) * 100)
      return { range, count, percentage }
    })

    return {
      success: true,
      data: {
        average,
        median,
        distribution
      }
    }
  } catch (error) {
    console.error('Get CPL distribution error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}