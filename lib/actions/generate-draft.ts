'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { dualDraftManager } from '@/lib/drafts/dual-draft-manager'
import { ContentSanitizer } from '@/lib/sanitization/sanitizer'
import { monitoringSystem } from '@/lib/monitoring'

// Input validation schema
const generateDraftSchema = z.object({
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000, 'Content must be less than 5000 characters'),
  type: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational']),
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters').optional()
})

interface GenerateDraftResult {
  success: boolean
  data?: {
    grammarFix: {
      id: string
      content: string
      cplScore: number
      metadata: any
    }
    adaptivePolish: {
      id: string
      content: string
      cplScore: number
      metadata: any
    }
    conversation: {
      id: string
      title: string
    }
    userInput: {
      id: string
    }
    processingTime: number
  }
  error?: string
  validationErrors?: Record<string, string>
}

/**
 * Main Server Action for generating dual drafts
 */
export async function generateDraftAction(
  prevState: any,
  formData: FormData
): Promise<GenerateDraftResult> {
  const startTime = Date.now()

  try {
    // Get authenticated user
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication required. Please log in to continue.'
      }
    }

    // Validate input data
    const validationResult = generateDraftSchema.safeParse({
      content: formData.get('content'),
      type: formData.get('type'),
      conversationId: formData.get('conversationId') || undefined,
      title: formData.get('title') || undefined
    })

    if (!validationResult.success) {
      const validationErrors: Record<string, string> = {}
      validationResult.error.errors.forEach(error => {
        const field = error.path.join('.')
        validationErrors[field] = error.message
      })

      return {
        success: false,
        error: 'Validation failed',
        validationErrors
      }
    }

    const { content, type, conversationId, title } = validationResult.data

    // Security scan on input
    const securityScan = ContentSanitizer.securityScan(content)
    if (!securityScan.safe) {
      return {
        success: false,
        error: `Content security check failed: ${securityScan.threats.join(', ')}`
      }
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(
      supabase,
      user.id,
      conversationId,
      title || `${type.charAt(0).toUpperCase() + type.slice(1)} Draft`,
      type
    )

    if (!conversation) {
      return {
        success: false,
        error: 'Failed to create or retrieve conversation'
      }
    }

    // Save user input
    const userInput = await saveUserInput(supabase, user.id, conversation.id, content)
    if (!userInput) {
      return {
        success: false,
        error: 'Failed to save user input'
      }
    }

    // Generate drafts with monitoring
    console.log(`Generating drafts for user ${user.id}, conversation ${conversation.id}`)

    // Track security framework metrics
    await monitoringSystem.trackComponentMetrics(
      'security_framework',
      'content_validation',
      {
        latency: Date.now() - startTime,
        success: securityScan.safe,
        customMetrics: {
          threatCount: securityScan.threats.length,
          contentLength: content.length,
          inputType: type
        }
      },
      { userId: user.id }
    ).catch(error => console.debug('Security metrics tracking failed:', error))

    const draftResult = await dualDraftManager.generateDrafts(
      content,
      user.id,
      conversation.id,
      type
    )

    if (!draftResult.success || !draftResult.drafts) {
      return {
        success: false,
        error: draftResult.error || 'Failed to generate drafts'
      }
    }

    // Save drafts to database
    const savedDrafts = await saveDrafts(
      supabase,
      user.id,
      conversation.id,
      userInput.id,
      draftResult.drafts
    )

    if (!savedDrafts) {
      return {
        success: false,
        error: 'Failed to save generated drafts'
      }
    }

    // Update user's last activity
    await updateUserActivity(supabase, user.id)

    // Revalidate dashboard page to show new drafts
    revalidatePath('/dashboard')
    revalidatePath(`/conversation/${conversation.id}`)

    const processingTime = Date.now() - startTime

    // Track parallel processing metrics
    await monitoringSystem.trackComponentMetrics(
      'parallel_processor',
      'dual_draft_generation',
      {
        latency: processingTime,
        success: true,
        customMetrics: {
          grammarLatency: draftResult.metrics?.grammarLatency || processingTime * 0.4,
          polishLatency: draftResult.metrics?.polishLatency || processingTime * 0.6,
          improvementPercent: Math.round(
            ((savedDrafts.adaptivePolish.cplScore - savedDrafts.grammarFix.cplScore) /
             savedDrafts.grammarFix.cplScore) * 100
          ),
          grammarCplScore: savedDrafts.grammarFix.cplScore,
          polishCplScore: savedDrafts.adaptivePolish.cplScore
        }
      },
      { userId: user.id, sessionId: conversation.id }
    ).catch(error => console.debug('Parallel processing metrics tracking failed:', error))

    return {
      success: true,
      data: {
        grammarFix: {
          id: savedDrafts.grammarFix.id,
          content: savedDrafts.grammarFix.content,
          cplScore: savedDrafts.grammarFix.cplScore,
          metadata: savedDrafts.grammarFix.metadata
        },
        adaptivePolish: {
          id: savedDrafts.adaptivePolish.id,
          content: savedDrafts.adaptivePolish.content,
          cplScore: savedDrafts.adaptivePolish.cplScore,
          metadata: savedDrafts.adaptivePolish.metadata
        },
        conversation: {
          id: conversation.id,
          title: conversation.title
        },
        userInput: {
          id: userInput.id
        },
        processingTime
      }
    }
  } catch (error) {
    console.error('Draft generation error:', error)

    // Track error metrics
    monitoringSystem.trackComponentMetrics(
      'parallel_processor',
      'draft_generation_error',
      {
        latency: Date.now() - startTime,
        success: false,
        customMetrics: {
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    ).catch(err => console.debug('Error metrics tracking failed:', err))

    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}

/**
 * Get or create a conversation
 */
async function getOrCreateConversation(
  supabase: any,
  userId: string,
  conversationId?: string,
  title?: string,
  category?: string
) {
  try {
    if (conversationId) {
      // Get existing conversation
      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Error fetching conversation:', error)
        return null
      }

      return conversation
    } else {
      // Create new conversation
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: title || 'New Draft',
          category: category || 'conversational'
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating conversation:', error)
        return null
      }

      return conversation
    }
  } catch (error) {
    console.error('Conversation operation error:', error)
    return null
  }
}

/**
 * Save user input to database
 */
async function saveUserInput(
  supabase: any,
  userId: string,
  conversationId: string,
  content: string
) {
  try {
    const { data: userInput, error } = await supabase
      .from('user_inputs')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        raw_text: content
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving user input:', error)
      return null
    }

    return userInput
  } catch (error) {
    console.error('User input save error:', error)
    return null
  }
}

/**
 * Save generated drafts to database
 */
async function saveDrafts(
  supabase: any,
  userId: string,
  conversationId: string,
  userInputId: string,
  drafts: any
) {
  try {
    // Save both drafts
    const draftsToInsert = [
      {
        user_input_id: userInputId,
        conversation_id: conversationId,
        user_id: userId,
        content: drafts.grammarFix.content,
        draft_type: 'grammar_fix',
        cpl_score: drafts.grammarFix.cplScore,
        metadata: drafts.grammarFix.metadata
      },
      {
        user_input_id: userInputId,
        conversation_id: conversationId,
        user_id: userId,
        content: drafts.adaptivePolish.content,
        draft_type: 'adaptive_polish',
        cpl_score: drafts.adaptivePolish.cplScore,
        metadata: drafts.adaptivePolish.metadata
      }
    ]

    const { data: savedDrafts, error } = await supabase
      .from('generated_drafts')
      .insert(draftsToInsert)
      .select()

    if (error) {
      console.error('Error saving drafts:', error)
      return null
    }

    // Return drafts in the expected format
    const grammarFix = savedDrafts.find((d: any) => d.draft_type === 'grammar_fix')
    const adaptivePolish = savedDrafts.find((d: any) => d.draft_type === 'adaptive_polish')

    return {
      grammarFix: {
        id: grammarFix.id,
        content: grammarFix.content,
        cplScore: grammarFix.cpl_score,
        metadata: grammarFix.metadata
      },
      adaptivePolish: {
        id: adaptivePolish.id,
        content: adaptivePolish.content,
        cplScore: adaptivePolish.cpl_score,
        metadata: adaptivePolish.metadata
      }
    }
  } catch (error) {
    console.error('Draft save error:', error)
    return null
  }
}

/**
 * Update user's last activity timestamp
 */
async function updateUserActivity(supabase: any, userId: string) {
  try {
    await supabase
      .from('profiles')
      .update({
        updated_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      })
      .eq('id', userId)
  } catch (error) {
    console.error('Error updating user activity:', error)
    // Non-critical error, don't fail the request
  }
}

/**
 * Get user's recent drafts
 */
export async function getUserDraftsAction(
  conversationId?: string,
  limit: number = 10
) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    let query = supabase
      .from('generated_drafts')
      .select(`
        *,
        user_inputs (
          raw_text
        ),
        conversations (
          title,
          category
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (conversationId) {
      query = query.eq('conversation_id', conversationId)
    }

    const { data: drafts, error } = await query

    if (error) {
      console.error('Error fetching drafts:', error)
      return { success: false, error: 'Failed to fetch drafts' }
    }

    return { success: true, data: drafts }
  } catch (error) {
    console.error('Get drafts error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a draft
 */
export async function deleteDraftAction(draftId: string) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await supabase
      .from('generated_drafts')
      .delete()
      .eq('id', draftId)
      .eq('user_id', user.id) // Ensure user can only delete their own drafts

    if (error) {
      console.error('Error deleting draft:', error)
      return { success: false, error: 'Failed to delete draft' }
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Delete draft error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get conversation details
 */
export async function getConversationAction(conversationId: string) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .select(`
        *,
        user_inputs (
          *,
          generated_drafts (*)
        )
      `)
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error fetching conversation:', error)
      return { success: false, error: 'Conversation not found' }
    }

    return { success: true, data: conversation }
  } catch (error) {
    console.error('Get conversation error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update conversation title
 */
export async function updateConversationTitleAction(
  conversationId: string,
  title: string
) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!title || title.trim().length === 0) {
      return { success: false, error: 'Title is required' }
    }

    if (title.length > 200) {
      return { success: false, error: 'Title must be less than 200 characters' }
    }

    const { error } = await supabase
      .from('conversations')
      .update({ title: title.trim() })
      .eq('id', conversationId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error updating conversation title:', error)
      return { success: false, error: 'Failed to update title' }
    }

    revalidatePath('/dashboard')
    revalidatePath(`/conversation/${conversationId}`)
    return { success: true }
  } catch (error) {
    console.error('Update title error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}