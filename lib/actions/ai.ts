'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import { processUserInput, streamProcessUserInput, analyzeText, processBatch } from '@/lib/ai/processor'
import { revalidatePath } from 'next/cache'
import {
  generateDraftSchema,
  cplAnalysisSchema,
  bulkInputSchema,
  type GenerateDraft
} from '@/lib/validations/schemas'

// Generate a draft from user input
export async function generateDraftFromInput(formData: FormData) {
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
      input_id: formData.get('input_id') as string,
      draft_type: (formData.get('draft_type') as 'grammar_fix' | 'adaptive_polish') || 'adaptive_polish',
      processing_options: formData.get('processing_options') ?
        JSON.parse(formData.get('processing_options') as string) : undefined,
    }

    const validatedData = generateDraftSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { input_id, draft_type, processing_options } = validatedData.data
    const supabase = createClient()

    // Verify user owns the input
    const { data: userInput, error: inputError } = await supabase
      .from('user_inputs')
      .select(`
        *,
        conversations!inner(user_id)
      `)
      .eq('id', input_id)
      .single()

    if (inputError || userInput?.conversations?.user_id !== user.id) {
      return {
        success: false,
        error: 'Input not found or access denied',
      }
    }

    // Check if input is already being processed
    if (userInput.processing_status === 'processing') {
      return {
        success: false,
        error: 'Input is already being processed',
      }
    }

    // Process with AI
    const result = await processUserInput(
      input_id,
      draft_type,
      processing_options || {}
    )

    if (result.success) {
      revalidatePath(`/conversations/${userInput.conversation_id}`)
      revalidatePath('/dashboard')
    }

    return {
      success: result.success,
      data: {
        draftId: result.draftId,
        content: result.content,
        cplScore: result.cplScore,
      },
      error: result.error,
      message: result.success ? 'Draft generated successfully' : undefined,
      metadata: {
        processingTime: result.processingTime,
        usage: result.usage,
      },
    }
  } catch (error) {
    console.error('Generate draft error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Quick text analysis without creating records
export async function analyzeTextContent(formData: FormData) {
  try {
    const user = await getUser()

    // Parse and validate form data
    const rawData = {
      text: formData.get('text') as string,
      analysis_type: (formData.get('analysis_type') as 'quick' | 'detailed') || 'quick',
      compare_to_user_baseline: formData.get('compare_to_user_baseline') === 'true',
    }

    const validatedData = cplAnalysisSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { text } = validatedData.data

    // Analyze the text
    const result = await analyzeText(text, user?.id)

    return {
      success: result.success,
      data: {
        cplScore: result.cplScore,
      },
      error: result.error,
      metadata: {
        processingTime: result.processingTime,
        usage: result.usage,
      },
    }
  } catch (error) {
    console.error('Analyze text error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Regenerate a draft with different options
export async function regenerateDraft(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const draftId = formData.get('draft_id') as string
    const draftType = (formData.get('draft_type') as 'grammar_fix' | 'adaptive_polish') || 'adaptive_polish'
    const processingOptions = formData.get('processing_options') ?
      JSON.parse(formData.get('processing_options') as string) : {}

    const supabase = createClient()

    // Get the original draft and input
    const { data: originalDraft, error: draftError } = await supabase
      .from('generated_drafts')
      .select(`
        *,
        user_inputs!inner(*, conversations!inner(user_id))
      `)
      .eq('id', draftId)
      .single()

    if (draftError || originalDraft?.user_inputs?.conversations?.user_id !== user.id) {
      return {
        success: false,
        error: 'Draft not found or access denied',
      }
    }

    // Process the original input again with new options
    const result = await processUserInput(
      originalDraft.input_id,
      draftType,
      processingOptions
    )

    if (result.success) {
      revalidatePath(`/conversations/${originalDraft.user_inputs?.conversation_id}`)
      revalidatePath('/dashboard')
    }

    return {
      success: result.success,
      data: {
        draftId: result.draftId,
        content: result.content,
        cplScore: result.cplScore,
      },
      error: result.error,
      message: result.success ? 'Draft regenerated successfully' : undefined,
    }
  } catch (error) {
    console.error('Regenerate draft error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Process multiple inputs in batch
export async function processBatchInputs(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const rawData = {
      input_ids: JSON.parse(formData.get('input_ids') as string),
      draft_type: (formData.get('draft_type') as 'grammar_fix' | 'adaptive_polish') || 'adaptive_polish',
      processing_options: formData.get('processing_options') ?
        JSON.parse(formData.get('processing_options') as string) : {},
    }

    if (!Array.isArray(rawData.input_ids) || rawData.input_ids.length === 0) {
      return {
        success: false,
        error: 'At least one input ID is required',
      }
    }

    if (rawData.input_ids.length > 10) {
      return {
        success: false,
        error: 'Maximum 10 inputs can be processed at once',
      }
    }

    const supabase = createClient()

    // Verify user owns all inputs
    const { data: userInputs, error: inputError } = await supabase
      .from('user_inputs')
      .select(`
        id,
        conversation_id,
        conversations!inner(user_id)
      `)
      .in('id', rawData.input_ids)

    if (inputError) {
      return {
        success: false,
        error: 'Failed to verify inputs',
      }
    }

    const unauthorizedInputs = userInputs?.filter(
      input => input.conversations?.user_id !== user.id
    )

    if (unauthorizedInputs && unauthorizedInputs.length > 0) {
      return {
        success: false,
        error: 'Access denied to one or more inputs',
      }
    }

    // Process in batch
    const results = await processBatch(
      rawData.input_ids,
      rawData.draft_type,
      rawData.processing_options
    )

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    // Revalidate affected conversation pages
    const conversationIds = new Set(userInputs?.map(input => input.conversation_id))
    conversationIds.forEach(conversationId => {
      revalidatePath(`/conversations/${conversationId}`)
    })
    revalidatePath('/dashboard')

    return {
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failCount,
        },
      },
      message: `Batch processing completed: ${successCount} successful, ${failCount} failed`,
    }
  } catch (error) {
    console.error('Batch processing error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get AI processing statistics for user
export async function getAIProcessingStats() {
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

    const [
      draftsResult,
      usageResult,
      recentActivityResult
    ] = await Promise.all([
      // Draft statistics
      supabase
        .from('generated_drafts')
        .select('draft_type, generation_status, cpl_score, user_rating, created_at')
        .eq('user_id', user.id),

      // API usage statistics
      supabase
        .from('api_usage_logs')
        .select('service, operation, input_tokens, output_tokens, cost_estimate, created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()), // Last 30 days

      // Recent activity
      supabase
        .from('generated_drafts')
        .select(`
          id, draft_type, generation_status, cpl_score, created_at,
          user_inputs!inner(input_text, conversations!inner(title))
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
    ])

    const drafts = draftsResult.data || []
    const usage = usageResult.data || []
    const recentActivity = recentActivityResult.data || []

    // Calculate statistics
    const totalDrafts = drafts.length
    const completedDrafts = drafts.filter(d => d.generation_status === 'completed').length
    const failedDrafts = drafts.filter(d => d.generation_status === 'failed').length

    const avgCplScore = drafts
      .filter(d => d.cpl_score && d.generation_status === 'completed')
      .reduce((sum, d, _, arr) => sum + (d.cpl_score || 0) / arr.length, 0)

    const avgRating = drafts
      .filter(d => d.user_rating)
      .reduce((sum, d, _, arr) => sum + (d.user_rating || 0) / arr.length, 0)

    const totalTokensUsed = usage.reduce((sum, u) => sum + (u.input_tokens || 0) + (u.output_tokens || 0), 0)
    const totalCostEstimate = usage.reduce((sum, u) => sum + (u.cost_estimate || 0), 0)

    const draftsByType = {
      grammar_fix: drafts.filter(d => d.draft_type === 'grammar_fix').length,
      adaptive_polish: drafts.filter(d => d.draft_type === 'adaptive_polish').length,
    }

    return {
      success: true,
      data: {
        totals: {
          total_drafts: totalDrafts,
          completed_drafts: completedDrafts,
          failed_drafts: failedDrafts,
          success_rate: totalDrafts > 0 ? (completedDrafts / totalDrafts) * 100 : 0,
        },
        quality: {
          avg_cpl_score: Math.round(avgCplScore) || 0,
          avg_user_rating: Math.round(avgRating * 10) / 10 || 0,
        },
        usage: {
          total_tokens_used: totalTokensUsed,
          total_cost_estimate: Math.round(totalCostEstimate * 10000) / 10000, // Round to 4 decimal places
          avg_tokens_per_request: usage.length > 0 ? Math.round(totalTokensUsed / usage.length) : 0,
        },
        breakdown: {
          drafts_by_type: draftsByType,
        },
        recent_activity: recentActivity,
      },
    }
  } catch (error) {
    console.error('Get AI processing stats error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: null,
    }
  }
}

// Cancel ongoing processing
export async function cancelProcessing(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const inputId = formData.get('input_id') as string

    if (!inputId) {
      return {
        success: false,
        error: 'Input ID is required',
      }
    }

    const supabase = createClient()

    // Verify user owns the input
    const { data: userInput, error: inputError } = await supabase
      .from('user_inputs')
      .select(`
        id,
        processing_status,
        conversation_id,
        conversations!inner(user_id)
      `)
      .eq('id', inputId)
      .single()

    if (inputError || userInput?.conversations?.user_id !== user.id) {
      return {
        success: false,
        error: 'Input not found or access denied',
      }
    }

    if (userInput.processing_status !== 'processing') {
      return {
        success: false,
        error: 'Input is not currently being processed',
      }
    }

    // Update input status to cancelled
    const { error: updateError } = await supabase
      .from('user_inputs')
      .update({
        processing_status: 'failed',
        error_details: {
          message: 'Processing cancelled by user',
          timestamp: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', inputId)

    if (updateError) {
      console.error('Cancel processing error:', updateError)
      return {
        success: false,
        error: 'Failed to cancel processing',
      }
    }

    // Also update any in-progress drafts
    await supabase
      .from('generated_drafts')
      .update({
        generation_status: 'failed',
        error_details: {
          message: 'Processing cancelled by user',
          timestamp: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('input_id', inputId)
      .eq('generation_status', 'processing')

    revalidatePath(`/conversations/${userInput.conversation_id}`)

    return {
      success: true,
      message: 'Processing cancelled successfully',
    }
  } catch (error) {
    console.error('Cancel processing error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}