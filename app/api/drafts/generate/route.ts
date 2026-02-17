import { NextRequest, NextResponse } from 'next/server'
import { withAuth, getRequestMetadata } from '@/lib/auth/verify-auth'
import { secureInput, INPUT_LIMITS } from '@/lib/security/input-sanitizer'
import { draftGenerationSchema } from '@/lib/validation/schemas'
import { calculateCPLScore, updateUserCPLBaseline } from '@/lib/cpl/scoring'
import { createClient } from '@/lib/supabase/server'
import { sanitizeAIOutput } from '@/lib/ai/sanitizer'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 30_000,
  maxRetries: 2,
})

export const POST = withAuth(async (request: NextRequest, user: any) => {
  try {
    const supabase = createClient()

    // Parse and validate request body
    const body = await request.json()
    const validatedData = draftGenerationSchema.safeParse(body)

    if (!validatedData.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validatedData.error.issues[0]?.message
      }, { status: 400 })
    }

    const { prompt, category, conversation_id } = validatedData.data

    // Secure input - sanitize and check for injection with logging
    const secureResult = await secureInput(
      prompt,
      INPUT_LIMITS.USER_INPUT,
      'Prompt',
      true, // Enable prompt injection detection
      {
        userId: user.id,
        request
      }
    )

    if (!secureResult.valid) {
      return NextResponse.json({
        error: secureResult.error
      }, { status: 400 })
    }

    const sanitizedPrompt = secureResult.sanitized!

    let conversationId = conversation_id

    if (!conversationId) {
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: sanitizedPrompt.slice(0, 50) + (sanitizedPrompt.length > 50 ? '...' : ''),
          category,
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
        raw_text: sanitizedPrompt,
        content: sanitizedPrompt, // Add content field for new schema
      })
      .select('id')
      .single()

    if (inputError) {
      console.error('Error storing user input:', inputError)
      return NextResponse.json({ error: 'Failed to store input' }, { status: 500 })
    }

    const grammarFixPrompt = `You are an expert editor. Please fix any grammar, spelling, and punctuation errors in the following text while preserving the original meaning and tone. Only make necessary corrections - do not rewrite or change the style.

Text: "${sanitizedPrompt}"

Return only the corrected text without any explanations.`

    const adaptivePolishPrompt = `You are an expert writer. Please improve the following ${category} by enhancing clarity, professionalism, and impact while maintaining the original intent and voice. Adapt the tone and style to be appropriate for a ${category}.

Content: "${sanitizedPrompt}"

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

    const rawGrammarContent = grammarResponse.content[0]?.type === 'text' ? grammarResponse.content[0].text.trim() : ''
    const rawPolishContent = polishResponse.content[0]?.type === 'text' ? polishResponse.content[0].text.trim() : ''

    // Sanitize AI-generated content to remove AI fingerprints
    const [grammarSanitization, polishSanitization] = await Promise.all([
      sanitizeAIOutput(rawGrammarContent, {
        platform: category === 'linkedin' ? 'linkedin' : 'general',
        detectAIFingerprints: true,
        humanize: true,
        maxLength: 2000,
        preserveFormatting: true
      }),
      sanitizeAIOutput(rawPolishContent, {
        platform: category === 'linkedin' ? 'linkedin' : 'general',
        detectAIFingerprints: true,
        humanize: true,
        maxLength: 2000,
        preserveFormatting: true
      })
    ])

    const grammarContent = grammarSanitization.success ? grammarSanitization.sanitizedContent : rawGrammarContent
    const polishContent = polishSanitization.success ? polishSanitization.sanitizedContent : rawPolishContent

    // Log AI fingerprint detection results for monitoring
    if (grammarSanitization.isAIGenerated || polishSanitization.isAIGenerated) {
      console.warn('AI fingerprints detected in generated content:', {
        grammarFingerprints: grammarSanitization.isAIGenerated ? {
          confidence: grammarSanitization.aiFingerprints?.confidence,
          patterns: grammarSanitization.aiFingerprints?.detectedPatterns,
          authenticityScore: grammarSanitization.authenticityScore
        } : null,
        polishFingerprints: polishSanitization.isAIGenerated ? {
          confidence: polishSanitization.aiFingerprints?.confidence,
          patterns: polishSanitization.aiFingerprints?.detectedPatterns,
          authenticityScore: polishSanitization.authenticityScore
        } : null,
        userId: user.id,
        category
      })
    }

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

    return NextResponse.json({
      error: 'An error occurred while generating drafts',
      message: 'Please try again or contact support if the problem persists'
    }, { status: 500 })
  }
})