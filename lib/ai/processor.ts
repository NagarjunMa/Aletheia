// AI Processing Service
// Created: December 7, 2024
// Purpose: Coordinate AI processing with database operations

import { processWithClaude, streamWithClaude, type ProcessingType, type AIResponse } from './claude'
import { sanitizeAIOutput, sanitizeResponseMetadata, type SanitizationOptions } from './sanitizer'
import { createClient } from '@/lib/supabase/server'
import { updateInputProcessingStatus, updateUserCPLScore } from '@/lib/actions'
import type { Database } from '@/lib/database/types'

type UserInput = Database['public']['Tables']['user_inputs']['Row']
type GeneratedDraft = Database['public']['Tables']['generated_drafts']['Insert']
type GeneratedDraftUpdate = Database['public']['Tables']['generated_drafts']['Update']

export interface ProcessingOptions {
  preserveTone?: boolean
  preserveLength?: boolean
  targetCpl?: number
  targetAudience?: string
  styleGuide?: string
  customInstructions?: string
}

export interface ProcessingResult {
  success: boolean
  draftId?: string
  content?: string
  cplScore?: number
  error?: string
  processingTime?: number
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

// Main processing function that handles database integration
export async function processUserInput(
  inputId: string,
  draftType: 'grammar_fix' | 'adaptive_polish',
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const startTime = Date.now()
  const supabase = createClient()

  try {
    // Get the user input
    const { data: userInput, error: fetchError } = await supabase
      .from('user_inputs')
      .select(`
        *,
        conversations!inner(user_id, title),
        profiles!inner(preferences, cpl_score)
      `)
      .eq('id', inputId)
      .single()

    if (fetchError || !userInput) {
      return {
        success: false,
        error: 'User input not found',
      }
    }

    // Update processing status to 'processing'
    await updateInputProcessingStatus(inputId, 'processing')

    // Create draft record
    const draftData: GeneratedDraft = {
      input_id: inputId,
      user_id: userInput.user_id,
      draft_type: draftType,
      content: '',
      cpl_score: 0,
      generation_status: 'processing',
      processing_options: options,
      metadata: {
        generation_started_at: new Date().toISOString(),
        model_version: 'claude-3-5-sonnet',
        processing_type: draftType,
      },
    }

    const { data: draft, error: draftError } = await supabase
      .from('generated_drafts')
      .insert(draftData)
      .select()
      .single()

    if (draftError || !draft) {
      await updateInputProcessingStatus(inputId, 'failed', 'Failed to create draft record')
      return {
        success: false,
        error: 'Failed to create draft',
      }
    }

    // Prepare processing options with user preferences
    const userPreferences = userInput.profiles?.preferences || {}
    const processingOptions = {
      ...options,
      targetCpl: options.targetCpl || userPreferences.cpl_target || 75,
      preserveTone: options.preserveTone !== false, // Default to true
      preserveLength: options.preserveLength !== false, // Default to true
      userPreferences,
    }

    // Process with Claude
    const aiResult = await processWithClaude(
      userInput.input_text,
      draftType,
      processingOptions
    )

    if (!aiResult.success) {
      // Update draft with error
      await supabase
        .from('generated_drafts')
        .update({
          generation_status: 'failed',
          error_details: { message: aiResult.error, timestamp: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.id)

      await updateInputProcessingStatus(inputId, 'failed', aiResult.error)

      return {
        success: false,
        error: aiResult.error,
        draftId: draft.id,
        processingTime: aiResult.processingTime,
      }
    }

    // Sanitize AI output before processing further
    const sanitizationResult = sanitizeAIOutput(aiResult.content || '', {
      allowHtml: false,
      maxLength: 10000,
      preserveFormatting: true,
      removeProfanity: true,
      validateEncoding: true,
    })

    if (!sanitizationResult.success) {
      // Update draft with sanitization error
      await supabase
        .from('generated_drafts')
        .update({
          generation_status: 'failed',
          error_details: {
            message: 'Content sanitization failed: ' + sanitizationResult.error,
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.id)

      await updateInputProcessingStatus(inputId, 'failed', 'Content sanitization failed')

      return {
        success: false,
        error: 'Generated content failed safety validation',
        draftId: draft.id,
        processingTime: Date.now() - startTime,
      }
    }

    // Use sanitized content
    const sanitizedContent = sanitizationResult.sanitizedContent

    // Log sanitization warnings if any
    if (sanitizationResult.warnings.length > 0) {
      console.warn('Sanitization warnings for draft', draft.id, sanitizationResult.warnings)
    }

    // Calculate CPL score using sanitized content
    let cplScore = 0
    if (sanitizedContent) {
      const cplAnalysis = await processWithClaude(
        sanitizedContent,
        'cpl_analysis',
        { userPreferences }
      )

      if (cplAnalysis.success && cplAnalysis.analysis) {
        cplScore = cplAnalysis.analysis.score
      }
    }

    // Update draft with results
    const updateData: GeneratedDraftUpdate = {
      content: sanitizedContent || '',
      cpl_score: cplScore,
      generation_status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      token_usage: aiResult.usage ? {
        input_tokens: aiResult.usage.inputTokens,
        output_tokens: aiResult.usage.outputTokens,
        total_tokens: aiResult.usage.totalTokens,
      } : null,
      metadata: {
        ...draft.metadata,
        generation_completed_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime,
        success: true,
        sanitization: {
          modifications_applied: sanitizationResult.modificationsApplied,
          warnings: sanitizationResult.warnings,
          original_length: sanitizationResult.originalLength,
          sanitized_length: sanitizationResult.sanitizedLength,
        },
      },
    }

    const { error: updateError } = await supabase
      .from('generated_drafts')
      .update(updateData)
      .eq('id', draft.id)

    if (updateError) {
      console.error('Draft update error:', updateError)
    }

    // Update input processing status
    await updateInputProcessingStatus(inputId, 'completed')

    // Update user's average CPL score if this draft has a score
    if (cplScore > 0) {
      await updateUserAverageCPL(userInput.user_id)
    }

    // Log API usage
    await logApiUsage(userInput.user_id, {
      service: 'anthropic',
      model: 'claude-3-5-sonnet',
      operation: draftType,
      input_tokens: aiResult.usage?.inputTokens || 0,
      output_tokens: aiResult.usage?.outputTokens || 0,
      cost_estimate: aiResult.usage ? estimateCost(aiResult.usage.inputTokens, aiResult.usage.outputTokens) : 0,
      processing_time_ms: Date.now() - startTime,
    })

    return {
      success: true,
      draftId: draft.id,
      content: sanitizedContent,
      cplScore,
      processingTime: Date.now() - startTime,
      usage: aiResult.usage,
    }
  } catch (error) {
    console.error('Processing error:', error)

    // Update processing status to failed
    await updateInputProcessingStatus(inputId, 'failed', 'Processing failed due to unexpected error')

    return {
      success: false,
      error: 'Processing failed due to unexpected error',
      processingTime: Date.now() - startTime,
    }
  }
}

// Streaming processing function
export async function* streamProcessUserInput(
  inputId: string,
  draftType: 'grammar_fix' | 'adaptive_polish',
  options: ProcessingOptions = {}
): AsyncGenerator<{
  type: 'status' | 'content' | 'completed' | 'error'
  status?: string
  content?: string
  draftId?: string
  cplScore?: number
  error?: string
}> {
  const supabase = createClient()

  try {
    yield { type: 'status', status: 'Initializing...' }

    // Get the user input
    const { data: userInput, error: fetchError } = await supabase
      .from('user_inputs')
      .select(`
        *,
        conversations!inner(user_id),
        profiles!inner(preferences)
      `)
      .eq('id', inputId)
      .single()

    if (fetchError || !userInput) {
      yield { type: 'error', error: 'User input not found' }
      return
    }

    yield { type: 'status', status: 'Creating draft record...' }

    // Create draft record
    const draftData: GeneratedDraft = {
      input_id: inputId,
      user_id: userInput.user_id,
      draft_type: draftType,
      content: '',
      cpl_score: 0,
      generation_status: 'processing',
      processing_options: options,
      metadata: {
        generation_started_at: new Date().toISOString(),
        model_version: 'claude-3-5-sonnet',
        streaming: true,
      },
    }

    const { data: draft, error: draftError } = await supabase
      .from('generated_drafts')
      .insert(draftData)
      .select()
      .single()

    if (draftError || !draft) {
      yield { type: 'error', error: 'Failed to create draft' }
      return
    }

    yield { type: 'status', status: 'Processing with AI...', draftId: draft.id }

    // Update processing status
    await updateInputProcessingStatus(inputId, 'processing')

    // Prepare processing options
    const userPreferences = userInput.profiles?.preferences || {}
    const processingOptions = {
      ...options,
      targetCpl: options.targetCpl || userPreferences.cpl_target || 75,
      preserveTone: options.preserveTone !== false,
      preserveLength: options.preserveLength !== false,
      userPreferences,
    }

    let fullContent = ''

    // Stream from Claude
    for await (const chunk of streamWithClaude(
      userInput.input_text,
      draftType,
      processingOptions
    )) {
      if (chunk.type === 'content' && chunk.content) {
        // Quick sanitize the chunk before adding to full content
        const chunkSanitized = sanitizeAIOutput(chunk.content, {
          allowHtml: false,
          maxLength: 1000,
          preserveFormatting: true,
          removeProfanity: false, // Skip profanity for chunks to avoid interrupting flow
          validateEncoding: true,
        })

        if (chunkSanitized.success) {
          fullContent += chunkSanitized.sanitizedContent
          yield { type: 'content', content: chunkSanitized.sanitizedContent, draftId: draft.id }
        }

        // Update draft content periodically
        if (fullContent.length % 100 === 0) { // Update every 100 characters
          await supabase
            .from('generated_drafts')
            .update({ content: fullContent, updated_at: new Date().toISOString() })
            .eq('id', draft.id)
        }
      } else if (chunk.type === 'error') {
        yield { type: 'error', error: chunk.error, draftId: draft.id }
        return
      } else if (chunk.type === 'done') {
        break
      }
    }

    yield { type: 'status', status: 'Analyzing content quality...', draftId: draft.id }

    // Calculate final CPL score
    let cplScore = 0
    if (fullContent.trim()) {
      const cplAnalysis = await processWithClaude(
        fullContent,
        'cpl_analysis',
        { userPreferences }
      )

      if (cplAnalysis.success && cplAnalysis.analysis) {
        cplScore = cplAnalysis.analysis.score
      }
    }

    yield { type: 'status', status: 'Finalizing and sanitizing...', draftId: draft.id }

    // Final sanitization of complete content
    const finalSanitization = sanitizeAIOutput(fullContent, {
      allowHtml: false,
      maxLength: 10000,
      preserveFormatting: true,
      removeProfanity: true, // Apply profanity filter to final content
      validateEncoding: true,
    })

    const finalContent = finalSanitization.success ? finalSanitization.sanitizedContent : fullContent

    // Update final draft
    await supabase
      .from('generated_drafts')
      .update({
        content: finalContent,
        cpl_score: cplScore,
        generation_status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          ...draftData.metadata,
          final_sanitization: {
            modifications_applied: finalSanitization.modificationsApplied,
            warnings: finalSanitization.warnings,
            original_length: finalSanitization.originalLength,
            sanitized_length: finalSanitization.sanitizedLength,
          },
        },
      })
      .eq('id', draft.id)

    // Update input status
    await updateInputProcessingStatus(inputId, 'completed')

    // Update user CPL average
    if (cplScore > 0) {
      await updateUserAverageCPL(userInput.user_id)
    }

    yield {
      type: 'completed',
      draftId: draft.id,
      content: finalContent,
      cplScore,
    }
  } catch (error) {
    console.error('Streaming processing error:', error)
    yield { type: 'error', error: 'Streaming processing failed' }
  }
}

// Analyze text without creating a draft (for quick analysis)
export async function analyzeText(
  text: string,
  userId?: string
): Promise<ProcessingResult> {
  try {
    if (!text.trim()) {
      return { success: false, error: 'Text is required' }
    }

    const startTime = Date.now()

    // Get user preferences if userId provided
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

    // Perform CPL analysis
    const result = await processWithClaude(
      text,
      'cpl_analysis',
      { userPreferences }
    )

    return {
      success: result.success,
      cplScore: result.cplScore,
      error: result.error,
      processingTime: result.processingTime,
      usage: result.usage,
    }
  } catch (error) {
    console.error('Text analysis error:', error)
    return {
      success: false,
      error: 'Analysis failed',
    }
  }
}

// Helper functions
async function updateUserAverageCPL(userId: string) {
  try {
    const supabase = createClient()

    // Calculate new average CPL from all completed drafts
    const { data: drafts } = await supabase
      .from('generated_drafts')
      .select('cpl_score')
      .eq('user_id', userId)
      .eq('generation_status', 'completed')
      .not('cpl_score', 'is', null)

    if (drafts && drafts.length > 0) {
      const avgCpl = drafts.reduce((sum, draft) => sum + (draft.cpl_score || 0), 0) / drafts.length
      await updateUserCPLScore(userId, Math.round(avgCpl))
    }
  } catch (error) {
    console.error('Update user average CPL error:', error)
  }
}

async function logApiUsage(userId: string, usage: any) {
  try {
    const supabase = createClient()

    await supabase
      .from('api_usage_logs')
      .insert({
        user_id: userId,
        service: usage.service,
        model: usage.model,
        operation: usage.operation,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cost_estimate: usage.cost_estimate,
        processing_time_ms: usage.processing_time_ms,
        metadata: {
          timestamp: new Date().toISOString(),
          success: true,
        },
      })
  } catch (error) {
    console.error('API usage logging error:', error)
  }
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  // Claude 3.5 Sonnet pricing
  const inputCostPer1K = 0.003
  const outputCostPer1K = 0.015

  return (
    (inputTokens / 1000) * inputCostPer1K +
    (outputTokens / 1000) * outputCostPer1K
  )
}

// Batch processing for multiple inputs
export async function processBatch(
  inputIds: string[],
  draftType: 'grammar_fix' | 'adaptive_polish',
  options: ProcessingOptions = {}
): Promise<ProcessingResult[]> {
  const results: ProcessingResult[] = []

  // Process in small batches to avoid overwhelming the API
  const batchSize = 3
  for (let i = 0; i < inputIds.length; i += batchSize) {
    const batch = inputIds.slice(i, i + batchSize)

    const batchPromises = batch.map(inputId =>
      processUserInput(inputId, draftType, options)
    )

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    // Small delay between batches
    if (i + batchSize < inputIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}