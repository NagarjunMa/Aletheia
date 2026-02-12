import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { calculateCPLScore } from '@/lib/cpl/scoring'
import { getPersonalizedPrompt } from '@/lib/voice/voice-learning'
import { generateBaselinePrompts } from '@/lib/templates/category-baselines'
import { sanitizeAIOutput, quickSanitize } from '@/lib/ai/sanitizer'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const streamRequestSchema = z.object({
  sessionId: z.string().optional(), // Make sessionId optional for now
  prompt: z.string().min(1),
  category: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational']),
  conversationId: z.string(),
})

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        encoder.encode('data: {"type":"error","message":"Unauthorized"}\n\n'),
        {
          status: 401,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    const body = await request.json()
    const { sessionId, prompt, category, conversationId } = streamRequestSchema.parse(body)

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        // 🚨 SSE KEEP-ALIVE: Implement heartbeat to prevent 15-20s timeouts
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keep-alive\n\n'))
          } catch (e) {
            // Stream closed, clear interval
            clearInterval(heartbeatInterval)
          }
        }, 5000) // Every 5 seconds

        try {
          // 🔒 RACE CONDITION GUARD: Store user input with sequential dependency
          const { data: userInput, error: inputError } = await supabase
            .from('user_inputs')
            .insert({
              conversation_id: conversationId,
              user_id: user.id,
              content: prompt,
              raw_text: prompt,  // Dual storage for analytics
            })
            .select('id')
            .single()

          if (inputError) {
            console.error('Stream setup error - Failed to store user input:', inputError)
            clearInterval(heartbeatInterval)
            controller.enqueue(
              encoder.encode(`data: {"type":"error","message":"Failed to store input: ${inputError.message}"}\n\n`)
            )
            controller.close()
            return
          }

          // ✅ SAFE: userInput.id now guaranteed to exist for all subsequent operations
          console.log('User input stored successfully:', userInput.id)

          // Generate prompts with cold start baseline support
          console.log('Generating prompts with baseline fallback...')
          let grammarPrompt, polishPrompt
          try {
            // Check if user has history for personalized prompts
            const hasUserHistory = await checkUserHistory(user.id)

            if (!hasUserHistory) {
              // 🌟 COLD START: Use category-specific gold standards for new users
              console.log(`Using cold start baseline for new user: ${user.id}`)
              const baselinePrompts = generateBaselinePrompts(category, prompt)
              grammarPrompt = baselinePrompts.grammarPrompt
              polishPrompt = baselinePrompts.polishPrompt
            } else {
              // Use personalized prompts for users with history
              [grammarPrompt, polishPrompt] = await Promise.all([
                getStandardGrammarPrompt(prompt),
                getPersonalizedPrompt(user.id, prompt, category)
              ])
            }

            console.log('Prompts generated successfully')
          } catch (promptError) {
            console.error('Error generating prompts:', promptError)
            // Fallback to baseline prompts on error
            const baselinePrompts = generateBaselinePrompts(category, prompt)
            grammarPrompt = baselinePrompts.grammarPrompt
            polishPrompt = baselinePrompts.polishPrompt
            console.log('Using baseline prompts as fallback')
          }

          // Stream grammar fix first
          const grammarDraftId = crypto.randomUUID()
          controller.enqueue(
            encoder.encode(`data: {"type":"draft_start","draftId":"${grammarDraftId}","draftType":"grammar_fix"}\n\n`)
          )

          let grammarContent = ''
          let grammarResponse
          try {
            grammarResponse = await anthropic.messages.stream({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1000,
              messages: [{ role: 'user', content: grammarPrompt }],
            })
            console.log('Grammar stream initialized successfully')
          } catch (anthropicError) {
            console.error('Error starting grammar stream:', anthropicError)
            controller.enqueue(
              encoder.encode(`data: {"type":"error","message":"Failed to start AI processing: ${(anthropicError as Error).message}"}\n\n`)
            )
            controller.close()
            return
          }

          let chunkCount = 0
          for await (const chunk of grammarResponse) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              grammarContent += chunk.delta.text
              chunkCount++

              // 🛡️ SANITATION FIRST: Real-time sanitization of streaming chunks
              const sanitizedChunk = await quickSanitize(chunk.delta.text)

              // Send every chunk immediately with progress
              const progress = Math.min((grammarContent.length / (prompt.length * 2)) * 100, 45)
              const chunkData = {
                type: "draft_chunk",
                draft_type: "grammar_fix",
                content: sanitizedChunk, // ✅ Send sanitized chunk to client
                progress: progress
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`)
              )
            }
          }

          // Calculate CPL score for grammar fix
          const grammarCPL = await calculateCPLScore(grammarContent, user.id, {
            includeBaseline: true,
            cacheResults: true
          })
          const grammarScore = grammarCPL.success ? grammarCPL.score!.overall : 0

          // Complete grammar fix with progress update
          controller.enqueue(
            encoder.encode(`data: {"type":"progress","progress":{"grammar":50,"polish":0}}\n\n`)
          )

          // Stream adaptive polish
          const polishDraftId = crypto.randomUUID()
          controller.enqueue(
            encoder.encode(`data: {"type":"draft_start","draftId":"${polishDraftId}","draftType":"adaptive_polish"}\n\n`)
          )

          let polishContent = ''
          const polishResponse = await anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{ role: 'user', content: polishPrompt }],
          })

          chunkCount = 0
          for await (const chunk of polishResponse) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              polishContent += chunk.delta.text
              chunkCount++

              // 🛡️ SANITATION FIRST: Real-time sanitization of streaming chunks
              const sanitizedChunk = await quickSanitize(chunk.delta.text)

              // Send every chunk immediately with progress (50-95% range for polish)
              const progress = 50 + Math.min((polishContent.length / (prompt.length * 2)) * 100, 45)
              const chunkData = {
                type: "draft_chunk",
                draft_type: "adaptive_polish",
                content: sanitizedChunk, // ✅ Send sanitized chunk to client
                progress: progress
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`)
              )
            }
          }

          // Calculate CPL score for adaptive polish
          const polishCPL = await calculateCPLScore(polishContent, user.id, {
            includeBaseline: true,
            cacheResults: true
          })
          const polishScore = polishCPL.success ? polishCPL.score!.overall : 0

          // Complete adaptive polish with progress update
          controller.enqueue(
            encoder.encode(`data: {"type":"progress","progress":{"grammar":50,"polish":100}}\n\n`)
          )

          // 🛡️ COMPREHENSIVE SANITATION: Full sanitization before database storage
          const grammarSanitized = await sanitizeAIOutput(grammarContent, {
            allowHtml: false,
            maxLength: 5000,
            preserveFormatting: true,
            removeProfanity: true,
            validateEncoding: true
          })

          const polishSanitized = await sanitizeAIOutput(polishContent, {
            allowHtml: false,
            maxLength: 5000,
            preserveFormatting: true,
            removeProfanity: true,
            validateEncoding: true
          })

          // Validate sanitization results
          if (!grammarSanitized.success || !polishSanitized.success) {
            console.error('Content sanitization failed:', {
              grammar: grammarSanitized.error,
              polish: polishSanitized.error
            })
            controller.enqueue(
              encoder.encode('data: {"type":"error","message":"Content validation failed"}\\n\\n')
            )
            controller.close()
            return
          }

          // Log sanitization modifications for monitoring
          if (grammarSanitized.modificationsApplied.length > 0 || polishSanitized.modificationsApplied.length > 0) {
            console.log('Content sanitization applied:', {
              grammar: grammarSanitized.modificationsApplied,
              polish: polishSanitized.modificationsApplied,
              warnings: [...grammarSanitized.warnings, ...polishSanitized.warnings]
            })
          }

          // 🔒 RACE CONDITION PROTECTED: Store sanitized drafts with guaranteed user_input_id
          // Ensure CPL scores are valid numbers and convert from 0-100 to 0.0-1.0 scale for DB
          // Database column is NUMERIC(3,2) which only allows values up to 9.99
          const normalizeScore = (score: number): number => {
            if (typeof score !== 'number' || isNaN(score)) return 0.0
            // Convert from 0-100 scale to 0.0-1.0 scale, clamp to valid range
            const normalized = Math.max(0, Math.min(score, 100)) / 100
            // Round to 2 decimal places to fit NUMERIC(3,2)
            return Math.round(normalized * 100) / 100
          }
          const validGrammarScore = normalizeScore(grammarScore)
          const validPolishScore = normalizeScore(polishScore)

          const drafts = [
            {
              user_input_id: userInput.id,  // ✅ Safe reference after successful insert
              conversation_id: conversationId,
              user_id: user.id,
              content: grammarSanitized.sanitizedContent, // ✅ Fully sanitized content
              draft_type: 'grammar_fix',
              cpl_score: validGrammarScore,
            },
            {
              user_input_id: userInput.id,  // ✅ Safe reference after successful insert
              conversation_id: conversationId,
              user_id: user.id,
              content: polishSanitized.sanitizedContent, // ✅ Fully sanitized content
              draft_type: 'adaptive_polish',
              cpl_score: validPolishScore,
            },
          ]

          console.log('Attempting to insert drafts:', JSON.stringify(drafts, null, 2))

          const { data: createdDrafts, error: draftsError } = await supabase
            .from('generated_drafts')
            .insert(drafts)
            .select('*')

          if (draftsError) {
            console.error('Database insert error:', draftsError)
            console.error('Draft data that failed:', JSON.stringify(drafts, null, 2))
            controller.enqueue(
              encoder.encode(`data: {"type":"error","message":"Failed to store drafts: ${draftsError.message}"}\n\n`)
            )
          } else {
            // Send final completion with draft IDs using correct event type
            controller.enqueue(
              encoder.encode(`data: {"type":"complete","drafts":${JSON.stringify(createdDrafts)}}\n\n`)
            )
          }

          // 📊 NON-BLOCKING ANALYTICS: Track without affecting user response time
          // Note: In production, use waitUntil() or background job queue
          supabase
            .from('usage_analytics')
            .insert({
              user_id: user.id,
              conversation_id: conversationId,
              event_type: 'streaming_draft_generation',
              event_data: {
                session_id: crypto.randomUUID(),
                category,
                draft_count: 2,
                input_length: prompt.length,
                grammar_cpl_score: grammarScore,
                polish_cpl_score: polishScore,
                streaming: true,
                user_input_id: userInput.id,  // Safe reference for analytics
                // 🛡️ Sanitization metrics for monitoring
                sanitization: {
                  grammar_modifications: grammarSanitized.modificationsApplied.length,
                  polish_modifications: polishSanitized.modificationsApplied.length,
                  grammar_warnings: grammarSanitized.warnings.length,
                  polish_warnings: polishSanitized.warnings.length,
                  content_reduction: {
                    grammar: grammarSanitized.originalLength - grammarSanitized.sanitizedLength,
                    polish: polishSanitized.originalLength - polishSanitized.sanitizedLength
                  }
                }
              },
            })
            .then(() => console.log('Analytics tracked successfully'))
            .catch(err => console.warn('Analytics tracking failed:', err))

          // Clean up heartbeat before closing
          clearInterval(heartbeatInterval)
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          // Clean up heartbeat on error
          clearInterval(heartbeatInterval)
          controller.enqueue(
            encoder.encode(`data: {"type":"error","message":"${error instanceof Error ? error.message : 'Unknown error'}"}\n\n`)
          )
          controller.close()
        }
      },

      cancel() {
        // Cleanup if client cancels
        console.log('Stream cancelled by client')
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('Stream setup error:', error)

    if (error instanceof z.ZodError) {
      return new Response(
        encoder.encode('data: {"type":"error","message":"Invalid request data"}\n\n'),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    return new Response(
      encoder.encode('data: {"type":"error","message":"Internal server error"}\n\n'),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    )
  }
}

// 🔍 HELPER: Check if user has previous drafts for personalization
async function checkUserHistory(userId: string): Promise<boolean> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('generated_drafts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_accepted', true)
      .limit(1)

    if (error) {
      console.warn('Error checking user history:', error)
      return false
    }

    return (data && data.length > 0)
  } catch (error) {
    console.warn('Error in checkUserHistory:', error)
    return false
  }
}

function getStandardGrammarPrompt(text: string): string {
  return `You are an expert editor. Please fix any grammar, spelling, and punctuation errors in the following text while preserving the original meaning and tone. Only make necessary corrections - do not rewrite or change the style.

Text: "${text}"

Return only the corrected text without any explanations.`
}

function getAdaptivePolishPrompt(text: string, category: string): string {
  const categoryContext = {
    'instagram_post': 'engaging social media post',
    'linkedin': 'professional LinkedIn post',
    'medium_article': 'thoughtful Medium article',
    'email': 'professional email',
    'conversational': 'natural conversation'
  }[category] || 'professional content'

  return `You are an expert writer. Please improve the following text to be more polished and effective as a ${categoryContext}. Enhance clarity, professionalism, and impact while maintaining the original intent and voice. Adapt the tone and style to be appropriate for ${category === 'conversational' ? 'casual conversation' : category}.

Content: "${text}"

Return only the improved text without any explanations.`
}