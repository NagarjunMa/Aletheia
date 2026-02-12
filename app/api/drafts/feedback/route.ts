import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { vectorService } from '@/lib/vectors/vector-service'
import { updateUserVoiceLearning } from '@/lib/voice/voice-learning'

const feedbackRequestSchema = z.object({
  draft_id: z.string().min(1, 'Draft ID is required'),
  is_accepted: z.boolean(),
  user_edits: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = feedbackRequestSchema.parse(body)
    const { draft_id, is_accepted, user_edits } = validatedData

    const { data: draft, error: draftError } = await supabase
      .from('generated_drafts')
      .select('*, user_inputs!inner(conversation_id)')
      .eq('id', draft_id)
      .eq('user_id', user.id)
      .single()

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const updateData: any = {
      is_accepted,
      feedback_at: new Date().toISOString(),
    }

    if (user_edits) {
      updateData.user_edits = user_edits
    }

    const { error: updateError } = await supabase
      .from('generated_drafts')
      .update(updateData)
      .eq('id', draft_id)

    if (updateError) {
      console.error('Error updating draft:', updateError)
      return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
    }

    // Store feedback in user_feedback table (which exists)
    const { error: feedbackError } = await supabase
      .from('user_feedback')
      .insert({
        user_id: user.id,
        draft_id: draft_id,
        rating: is_accepted ? 5 : 1, // Simple rating: 5 for accepted, 1 for rejected
        comment: user_edits || null,
        feedback_type: is_accepted ? 'accept' : 'reject',
        metadata: {
          had_user_edits: !!user_edits,
          draft_type: draft.draft_type,
          user_edits_length: user_edits?.length || 0
        }
      })

    if (feedbackError) {
      console.error('Error storing feedback:', feedbackError)
    }

    // 🚀 VECTOR EMBEDDING OPTIMIZATION: Only generate embeddings on acceptance
    if (is_accepted) {
      try {
        // Generate embeddings for accepted content to learn user's voice
        const contentForLearning = user_edits || draft.content

        // Background processing (non-blocking) for performance
        vectorService.generateEmbedding(contentForLearning).then(async (embedding) => {
          // Update user voice learning with accepted content
          await updateUserVoiceLearning(user.id, {
            content: contentForLearning,
            embedding,
            acceptedAt: new Date(),
            hadUserEdits: !!user_edits,
            category: draft.category || 'general'
          })
          console.log('Voice learning updated for user:', user.id)
        }).catch(err => {
          console.warn('Non-blocking embedding generation failed:', err)
        })

        // Update user profile for accepted adaptive polish only
        if (draft.draft_type === 'adaptive_polish' || draft.type === 'adaptive_polish') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('cpl_score')
            .eq('id', user.id)
            .single()

          const currentScore = profile?.cpl_score || 0
          const scoreIncrement = user_edits ? 1 : 2

          await supabase
            .from('profiles')
            .update({
              cpl_score: currentScore + scoreIncrement,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)
        }
      } catch (embeddingError) {
        // Don't fail the feedback process if embedding fails
        console.warn('Embedding generation failed (non-blocking):', embeddingError)
      }
    }

    await supabase
      .from('usage_analytics')
      .insert({
        user_id: user.id,
        conversation_id: draft.user_inputs.conversation_id,
        action_type: is_accepted ? 'draft_accepted' : 'draft_rejected',
        metadata: {
          draft_type: draft.draft_type,
          had_user_edits: !!user_edits,
          user_edits_length: user_edits?.length || 0,
        },
      })

    return NextResponse.json({
      success: true,
      message: is_accepted ? 'Draft accepted successfully' : 'Draft rejected successfully',
    })
  } catch (error) {
    console.error('Error processing feedback:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}