'use server'

import { getUser } from '@/lib/supabase/server'
import { dualDraftGenerator } from '@/lib/drafts/dual-generation'
import type { DraftGenerationOptions } from '@/lib/drafts/dual-generation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const dualDraftGenerationSchema = z.object({
  content: z.string().min(10, 'Content must be at least 10 characters').max(10000, 'Content too long'),
  targetCPL: z.number().min(1).max(100).optional(),
  preserveVoice: z.boolean().optional().default(true),
  urgentMode: z.boolean().optional().default(false),
  customInstructions: z.string().max(500, 'Custom instructions too long').optional()
})

// Generate dual drafts (grammar + style)
export async function generateDualDraftsAction(formData: FormData) {
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
      targetCPL: formData.get('targetCPL') ? parseInt(formData.get('targetCPL') as string) : undefined,
      preserveVoice: formData.get('preserveVoice') !== 'false',
      urgentMode: formData.get('urgentMode') === 'true',
      customInstructions: formData.get('customInstructions') as string || undefined
    }

    const validatedData = dualDraftGenerationSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const options: DraftGenerationOptions = {
      userId: user.id,
      ...validatedData.data
    }

    const startTime = Date.now()
    const result = await dualDraftGenerator.generateDualDrafts(options)
    const totalTime = Date.now() - startTime

    // Revalidate dashboard for updated stats
    revalidatePath('/dashboard')

    return {
      success: true,
      data: {
        ...result,
        generation_time: totalTime,
        user_id: user.id,
        summary: {
          grammarChanges: result.grammarDraft.changes.length,
          styleImprovements: result.styleDraft.improvements.length,
          cplImprovement: result.metadata.expectedImprovements.styleEnhanced,
          voiceAlignment: result.styleDraft.voiceAlignment,
          costSavings: result.metadata.costSavings.estimatedSavings
        }
      },
      message: `Dual drafts generated successfully with ${result.grammarDraft.changes.length} grammar fixes and ${result.styleDraft.improvements.length} style improvements`,
    }
  } catch (error) {
    console.error('Generate dual drafts error:', error)
    return {
      success: false,
      error: 'Failed to generate drafts. Please try again.',
    }
  }
}

// Create streaming dual draft generation endpoint
export async function createDualDraftStreamAction(formData: FormData) {
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
      targetCPL: formData.get('targetCPL') ? parseInt(formData.get('targetCPL') as string) : undefined,
      preserveVoice: formData.get('preserveVoice') !== 'false',
      urgentMode: formData.get('urgentMode') === 'true',
      customInstructions: formData.get('customInstructions') as string || undefined
    }

    const validatedData = dualDraftGenerationSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const options: DraftGenerationOptions = {
      userId: user.id,
      streamingEnabled: true,
      ...validatedData.data
    }

    // Create streaming endpoint
    const stream = dualDraftGenerator.createDualDraftStream(options)

    return {
      success: true,
      data: {
        streamId: crypto.randomUUID(),
        stream: stream,
        options: options
      },
      message: 'Streaming dual draft generation initialized',
    }
  } catch (error) {
    console.error('Create dual draft stream error:', error)
    return {
      success: false,
      error: 'Failed to initialize streaming generation',
    }
  }
}

// Get dual draft generation analytics
export async function getDualDraftAnalyticsAction() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Get user's dual draft history and analytics
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()

    // Get recent dual drafts
    const { data: recentDrafts, error } = await supabase
      .from('generated_drafts')
      .select('*')
      .eq('user_id', user.id)
      .in('draft_type', ['dual_grammar_only', 'dual_style_enhanced'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching dual draft analytics:', error)
      return {
        success: false,
        error: 'Failed to fetch analytics data',
      }
    }

    // Calculate analytics
    const grammarDrafts = recentDrafts?.filter(d => d.draft_type === 'dual_grammar_only') || []
    const styleDrafts = recentDrafts?.filter(d => d.draft_type === 'dual_style_enhanced') || []

    const analytics = {
      overview: {
        totalDrafts: recentDrafts?.length || 0,
        grammarOnlyCount: grammarDrafts.length,
        styleEnhancedCount: styleDrafts.length,
        averageProcessingTime: recentDrafts?.length > 0
          ? Math.round((recentDrafts.reduce((sum, d) => sum + (d.processing_time_ms || 0), 0)) / recentDrafts.length)
          : 0,
        totalProcessingTime: recentDrafts?.reduce((sum, d) => sum + (d.processing_time_ms || 0), 0) || 0
      },

      grammarAnalytics: {
        averageChanges: grammarDrafts.length > 0
          ? Math.round(grammarDrafts.reduce((sum, d) => sum + (d.metadata?.grammar_changes || 0), 0) / grammarDrafts.length)
          : 0,
        changeTypes: grammarDrafts.reduce((acc, draft) => {
          const breakdown = draft.metadata?.changes_breakdown || {}
          Object.entries(breakdown).forEach(([type, count]) => {
            acc[type] = (acc[type] || 0) + (count as number)
          })
          return acc
        }, {} as Record<string, number>),
        mostCommonIssues: [] // Would be calculated from change patterns
      },

      styleAnalytics: {
        averageCPLImprovement: styleDrafts.length > 0
          ? Math.round(styleDrafts.reduce((sum, d) => {
              const cpl = d.cpl_score || 0
              const originalCpl = d.metadata?.original_cpl || 50
              return sum + Math.max(0, cpl - originalCpl)
            }, 0) / styleDrafts.length)
          : 0,
        averageVoiceAlignment: styleDrafts.length > 0
          ? styleDrafts.reduce((sum, d) => sum + (d.metadata?.voice_alignment || 0.5), 0) / styleDrafts.length
          : 0.5,
        averageImprovements: styleDrafts.length > 0
          ? Math.round(styleDrafts.reduce((sum, d) => sum + (d.metadata?.style_improvements || 0), 0) / styleDrafts.length)
          : 0,
        improvementTypes: ['vocabulary', 'clarity', 'engagement'] // Would be extracted from actual data
      },

      performance: {
        costSavings: {
          totalSaved: recentDrafts?.reduce((sum, d) => {
            const savings = d.metadata?.cost_savings?.estimated_savings || 0
            return sum + (typeof savings === 'number' ? savings : 0)
          }, 0) || 0,
          batchProcessingUsage: recentDrafts?.filter(d =>
            d.metadata?.cost_savings?.batch_processing
          ).length || 0,
          cacheHitRate: recentDrafts?.length > 0
            ? recentDrafts.filter(d => (d.metadata?.cost_savings?.cache_hits || 0) > 0).length / recentDrafts.length
            : 0
        },
        efficiency: {
          parallelProcessing: recentDrafts?.filter(d =>
            d.metadata?.processing_strategy === 'parallel'
          ).length || 0,
          averageParallelTime: grammarDrafts.length > 0 && styleDrafts.length > 0
            ? Math.min(
                grammarDrafts.reduce((sum, d) => sum + (d.processing_time_ms || 0), 0) / grammarDrafts.length,
                styleDrafts.reduce((sum, d) => sum + (d.processing_time_ms || 0), 0) / styleDrafts.length
              )
            : 0
        }
      },

      trends: {
        dailyUsage: [], // Would calculate from created_at timestamps
        improvementTrend: [], // Would track CPL improvements over time
        efficiencyTrend: [] // Would track processing time improvements
      },

      recommendations: [
        recentDrafts?.length === 0 ? 'Try generating your first dual draft to see both grammar fixes and style improvements' : null,
        (recentDrafts?.length || 0) < 5 ? 'Generate more drafts to unlock detailed analytics and personalized insights' : null,
        styleDrafts.length > 0 && (styleDrafts.reduce((sum, d) => sum + (d.metadata?.voice_alignment || 0.5), 0) / styleDrafts.length) < 0.7
          ? 'Consider building a stronger voice profile for better style alignment'
          : null,
        grammarDrafts.length > 5 && (grammarDrafts.reduce((sum, d) => sum + (d.metadata?.grammar_changes || 0), 0) / grammarDrafts.length) > 10
          ? 'Focus on common grammar patterns to improve your baseline writing quality'
          : null
      ].filter(Boolean)
    }

    return {
      success: true,
      data: analytics,
      message: 'Dual draft analytics retrieved successfully',
    }
  } catch (error) {
    console.error('Get dual draft analytics error:', error)
    return {
      success: false,
      error: 'Failed to retrieve analytics',
    }
  }
}

// Get active stream count (for monitoring)
export async function getActiveStreamCountAction() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const activeCount = dualDraftGenerator.getActiveStreamCount()

    return {
      success: true,
      data: {
        activeStreams: activeCount,
        timestamp: new Date().toISOString()
      },
      message: `${activeCount} active streams`,
    }
  } catch (error) {
    console.error('Get active stream count error:', error)
    return {
      success: false,
      error: 'Failed to get stream count',
    }
  }
}

// Cancel user streams (cleanup)
export async function cancelUserStreamsAction() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    dualDraftGenerator.cancelUserStreams(user.id)

    return {
      success: true,
      data: { cancelled: true },
      message: 'User streams cancelled',
    }
  } catch (error) {
    console.error('Cancel user streams error:', error)
    return {
      success: false,
      error: 'Failed to cancel streams',
    }
  }
}