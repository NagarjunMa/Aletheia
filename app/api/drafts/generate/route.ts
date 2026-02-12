import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { calculateCPLScore, updateUserCPLBaseline } from '@/lib/cpl/scoring'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const generateRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  category: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational']),
  conversation_id: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = generateRequestSchema.parse(body)
    const { prompt, category, conversation_id } = validatedData

    let conversationId = conversation_id

    if (!conversationId) {
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
        })
        .select('id')
        .single()

      if (convError) {
        console.error('Error creating conversation:', convError)
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }

      conversationId = conversation.id
    }

    const { data: userInput, error: inputError } = await supabase
      .from('user_inputs')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        raw_text: prompt,
      })
      .select('id')
      .single()

    if (inputError) {
      console.error('Error storing user input:', inputError)
      return NextResponse.json({ error: 'Failed to store input' }, { status: 500 })
    }

    const grammarFixPrompt = `You are an expert editor. Please fix any grammar, spelling, and punctuation errors in the following text while preserving the original meaning and tone. Only make necessary corrections - do not rewrite or change the style.

Text: "${prompt}"

Return only the corrected text without any explanations.`

    const adaptivePolishPrompt = `You are an expert writer. Please improve the following ${category} by enhancing clarity, professionalism, and impact while maintaining the original intent and voice. Adapt the tone and style to be appropriate for a ${category}.

Content: "${prompt}"

Return only the improved text without any explanations.`

    const [grammarResponse, polishResponse] = await Promise.all([
      anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: grammarFixPrompt,
          },
        ],
      }),
      anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: adaptivePolishPrompt,
          },
        ],
      }),
    ])

    const grammarContent = grammarResponse.content[0]?.type === 'text' ? grammarResponse.content[0].text.trim() : ''
    const polishContent = polishResponse.content[0]?.type === 'text' ? polishResponse.content[0].text.trim() : ''

    // Calculate CPL scores for both drafts
    const [grammarCPL, polishCPL] = await Promise.all([
      calculateCPLScore(grammarContent, user.id, { includeBaseline: true, cacheResults: true }),
      calculateCPLScore(polishContent, user.id, { includeBaseline: true, cacheResults: true })
    ])

    const grammarScore = grammarCPL.success ? grammarCPL.score!.overall : 0
    const polishScore = polishCPL.success ? polishCPL.score!.overall : 0

    const drafts = [
      {
        user_input_id: userInput.id,
        conversation_id: conversationId,
        user_id: user.id,
        content: grammarContent,
        draft_type: 'grammar_fix' as const,
        cpl_score: grammarScore,
      },
      {
        user_input_id: userInput.id,
        conversation_id: conversationId,
        user_id: user.id,
        content: polishContent,
        draft_type: 'adaptive_polish' as const,
        cpl_score: polishScore,
      },
    ]

    const { data: createdDrafts, error: draftsError } = await supabase
      .from('generated_drafts')
      .insert(drafts)
      .select('*')

    if (draftsError) {
      console.error('Error storing drafts:', draftsError)
      return NextResponse.json({ error: 'Failed to store drafts' }, { status: 500 })
    }

    // Update user's baseline CPL score
    await updateUserCPLBaseline(user.id)

    await supabase
      .from('usage_analytics')
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        action_type: 'draft_generation',
        metadata: {
          category,
          draft_count: 2,
          input_length: prompt.length,
          grammar_cpl_score: grammarScore,
          polish_cpl_score: polishScore,
        },
      })

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      drafts: createdDrafts.map(draft => ({
        id: draft.id,
        content: draft.content,
        type: draft.type,
        cpl_score: draft.cpl_score,
        is_accepted: draft.is_accepted,
        created_at: draft.created_at,
      })),
    })
  } catch (error) {
    console.error('Error generating drafts:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}