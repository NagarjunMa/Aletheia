'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  userInputSchema,
  bulkInputSchema,
  generateDraftSchema,
  draftFeedbackSchema,
  type UserInput,
  type GenerateDraft,
  type DraftFeedback
} from '@/lib/validations/schemas'
import type { Database } from '@/lib/database/types'

type UserInputRow = Database['public']['Tables']['user_inputs']['Row']
type UserInputInsert = Database['public']['Tables']['user_inputs']['Insert']
type GeneratedDraftInsert = Database['public']['Tables']['generated_drafts']['Insert']

// Create a new user input
export async function createUserInput(formData: FormData) {
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
      conversation_id: formData.get('conversation_id') as string,
      input_text: formData.get('input_text') as string,
      input_type: (formData.get('input_type') as 'text' | 'voice' | 'file') || 'text',
      context_data: formData.get('context_data') ?
        JSON.parse(formData.get('context_data') as string) : undefined,
      processing_preferences: formData.get('processing_preferences') ?
        JSON.parse(formData.get('processing_preferences') as string) : undefined,
    }

    const validatedData = userInputSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { conversation_id, input_text, input_type, context_data, processing_preferences } = validatedData.data
    const supabase = createClient()

    // Verify user owns the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversation_id)
      .single()

    if (convError || conversation?.user_id !== user.id) {
      return {
        success: false,
        error: 'Conversation not found or access denied',
      }
    }

    // Create the user input
    const inputData: UserInputInsert = {
      conversation_id,
      user_id: user.id,
      input_text,
      input_type,
      processing_status: 'pending',
      context_data: context_data || null,
      processing_preferences: processing_preferences || null,
      metadata: {
        input_length: input_text.length,
        word_count: input_text.split(/\s+/).length,
        created_from: 'web_app',
      },
    }

    const { data: userInput, error } = await supabase
      .from('user_inputs')
      .insert(inputData)
      .select()
      .single()

    if (error) {
      console.error('User input creation error:', error)
      return {
        success: false,
        error: 'Failed to create user input',
      }
    }

    revalidatePath(`/conversations/${conversation_id}`)

    return {
      success: true,
      data: userInput,
      message: 'Input created successfully',
    }
  } catch (error) {
    console.error('Create user input error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Create multiple user inputs (bulk operation)
export async function createBulkUserInputs(formData: FormData) {
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
      conversation_id: formData.get('conversation_id') as string,
      inputs: JSON.parse(formData.get('inputs') as string),
    }

    const validatedData = bulkInputSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { conversation_id, inputs } = validatedData.data
    const supabase = createClient()

    // Verify user owns the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversation_id)
      .single()

    if (convError || conversation?.user_id !== user.id) {
      return {
        success: false,
        error: 'Conversation not found or access denied',
      }
    }

    // Prepare bulk insert data
    const inputsData: UserInputInsert[] = inputs.map((input, index) => ({
      conversation_id,
      user_id: user.id,
      input_text: input.input_text,
      input_type: input.input_type,
      processing_status: 'pending',
      context_data: input.context_data || null,
      metadata: {
        input_length: input.input_text.length,
        word_count: input.input_text.split(/\s+/).length,
        bulk_order: index + 1,
        created_from: 'bulk_upload',
      },
    }))

    // Insert all inputs
    const { data: userInputs, error } = await supabase
      .from('user_inputs')
      .insert(inputsData)
      .select()

    if (error) {
      console.error('Bulk user inputs creation error:', error)
      return {
        success: false,
        error: 'Failed to create user inputs',
      }
    }

    revalidatePath(`/conversations/${conversation_id}`)

    return {
      success: true,
      data: userInputs,
      message: `${userInputs?.length || 0} inputs created successfully`,
    }
  } catch (error) {
    console.error('Create bulk user inputs error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get user inputs for a conversation
export async function getUserInputs(conversationId: string, limit = 20, offset = 0) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: [],
      }
    }

    const supabase = createClient()

    // Verify user owns the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single()

    if (convError || conversation?.user_id !== user.id) {
      return {
        success: false,
        error: 'Conversation not found or access denied',
        data: [],
      }
    }

    // Get user inputs with their drafts
    const { data, error } = await supabase
      .from('user_inputs')
      .select(`
        *,
        generated_drafts(*)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Get user inputs error:', error)
      return {
        success: false,
        error: 'Failed to fetch user inputs',
        data: [],
      }
    }

    return {
      success: true,
      data: data || [],
    }
  } catch (error) {
    console.error('Get user inputs error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: [],
    }
  }
}

// Update user input processing status
export async function updateInputProcessingStatus(
  inputId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  errorMessage?: string
) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const supabase = createClient()

    const updateData: any = {
      processing_status: status,
      updated_at: new Date().toISOString(),
    }

    if (errorMessage) {
      updateData.error_details = { message: errorMessage, timestamp: new Date().toISOString() }
    }

    if (status === 'completed') {
      updateData.processed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('user_inputs')
      .update(updateData)
      .eq('id', inputId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Update processing status error:', error)
      return {
        success: false,
        error: 'Failed to update processing status',
      }
    }

    // Revalidate the conversation page
    if (data) {
      revalidatePath(`/conversations/${data.conversation_id}`)
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('Update processing status error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Generate draft from user input (this will be called by AI processing)
export async function generateDraft(formData: FormData) {
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
      .select('*, conversations!inner(user_id)')
      .eq('id', input_id)
      .single()

    if (inputError || userInput?.conversations?.user_id !== user.id) {
      return {
        success: false,
        error: 'Input not found or access denied',
      }
    }

    // Note: The actual AI processing will be handled separately
    // For now, we just create a placeholder draft
    const draftData: GeneratedDraftInsert = {
      input_id,
      user_id: user.id,
      draft_type,
      content: '', // This will be filled by AI processing
      cpl_score: 0, // This will be calculated by AI processing
      generation_status: 'pending',
      processing_options: processing_options || null,
      metadata: {
        generation_started_at: new Date().toISOString(),
        model_version: 'claude-3-5-sonnet',
      },
    }

    const { data: draft, error } = await supabase
      .from('generated_drafts')
      .insert(draftData)
      .select()
      .single()

    if (error) {
      console.error('Draft generation error:', error)
      return {
        success: false,
        error: 'Failed to generate draft',
      }
    }

    revalidatePath(`/conversations/${userInput.conversation_id}`)

    return {
      success: true,
      data: draft,
      message: 'Draft generation started',
    }
  } catch (error) {
    console.error('Generate draft error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Submit feedback for a generated draft
export async function submitDraftFeedback(formData: FormData) {
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
      draft_id: formData.get('draft_id') as string,
      rating: parseInt(formData.get('rating') as string),
      feedback_text: formData.get('feedback_text') as string || undefined,
      improvement_areas: formData.get('improvement_areas') ?
        JSON.parse(formData.get('improvement_areas') as string) : undefined,
      would_use_again: formData.get('would_use_again') === 'true',
    }

    const validatedData = draftFeedbackSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { draft_id, rating, feedback_text, improvement_areas, would_use_again } = validatedData.data
    const supabase = createClient()

    // Verify user owns the draft
    const { data: draft, error: draftError } = await supabase
      .from('generated_drafts')
      .select('*, user_inputs!inner(conversation_id), conversations!inner(user_id)')
      .eq('id', draft_id)
      .single()

    if (draftError) {
      return {
        success: false,
        error: 'Draft not found or access denied',
      }
    }

    // Update the draft with feedback
    const { error: updateError } = await supabase
      .from('generated_drafts')
      .update({
        user_rating: rating,
        user_feedback: feedback_text,
        feedback_metadata: {
          improvement_areas,
          would_use_again,
          feedback_submitted_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft_id)

    if (updateError) {
      console.error('Draft feedback error:', updateError)
      return {
        success: false,
        error: 'Failed to submit feedback',
      }
    }

    // Also log the feedback in the user_feedback table
    await supabase
      .from('user_feedback')
      .insert({
        user_id: user.id,
        feedback_type: 'draft_rating',
        title: `Draft Feedback - ${draft.draft_type}`,
        description: feedback_text || `Rating: ${rating}/5`,
        category: 'ai_generation',
        priority: 'medium',
        metadata: {
          draft_id,
          rating,
          improvement_areas,
          would_use_again,
          draft_type: draft.draft_type,
        },
      })

    revalidatePath(`/conversations/${draft.user_inputs?.conversation_id}`)

    return {
      success: true,
      message: 'Feedback submitted successfully',
    }
  } catch (error) {
    console.error('Submit draft feedback error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get user input by ID with all related data
export async function getUserInput(inputId: string) {
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

    const { data, error } = await supabase
      .from('user_inputs')
      .select(`
        *,
        conversations!inner(user_id, title, category),
        generated_drafts(*)
      `)
      .eq('id', inputId)
      .single()

    if (error || data?.conversations?.user_id !== user.id) {
      return {
        success: false,
        error: 'Input not found or access denied',
        data: null,
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('Get user input error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: null,
    }
  }
}

// Delete user input (soft delete)
export async function deleteUserInput(inputId: string) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const supabase = createClient()

    // Get input details first
    const { data: userInput, error: fetchError } = await supabase
      .from('user_inputs')
      .select('conversation_id, conversations!inner(user_id)')
      .eq('id', inputId)
      .single()

    if (fetchError || userInput?.conversations?.user_id !== user.id) {
      return {
        success: false,
        error: 'Input not found or access denied',
      }
    }

    // Mark as deleted (we keep the data for audit purposes)
    const { error } = await supabase
      .from('user_inputs')
      .update({
        processing_status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', inputId)

    if (error) {
      console.error('Delete user input error:', error)
      return {
        success: false,
        error: 'Failed to delete input',
      }
    }

    revalidatePath(`/conversations/${userInput.conversation_id}`)

    return {
      success: true,
      message: 'Input deleted successfully',
    }
  } catch (error) {
    console.error('Delete user input error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}