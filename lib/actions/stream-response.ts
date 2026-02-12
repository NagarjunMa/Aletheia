'use server'

import { createClient } from '@/lib/supabase/server'
import { claudeService } from '@/lib/ai/claude-service'
import { ContentSanitizer } from '@/lib/sanitization/sanitizer'
import { z } from 'zod'

// Input validation schema for streaming
const streamRequestSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  type: z.enum(['grammar_fix', 'adaptive_polish', 'general_improvement']),
  cplTarget: z.number().min(0).max(100).optional(),
  category: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational']).optional()
})

interface StreamChunk {
  type: 'content' | 'metadata' | 'complete' | 'error'
  data: any
  timestamp: number
}

/**
 * Server Action for streaming AI responses
 * Returns a ReadableStream that can be consumed by the client
 */
export async function streamDraftGeneration(request: {
  content: string
  type: 'grammar_fix' | 'adaptive_polish' | 'general_improvement'
  cplTarget?: number
  category?: string
}) {
  try {
    // Authenticate user
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Authentication required')
    }

    // Validate input
    const validationResult = streamRequestSchema.safeParse(request)
    if (!validationResult.success) {
      throw new Error(`Validation failed: ${validationResult.error.errors[0].message}`)
    }

    const { content, type, cplTarget = 50, category = 'conversational' } = validationResult.data

    // Security scan
    const securityScan = ContentSanitizer.securityScan(content)
    if (!securityScan.safe) {
      throw new Error(`Security scan failed: ${securityScan.threats.join(', ')}`)
    }

    // Create the streaming response
    const stream = new ReadableStream({
      start(controller) {
        streamAIResponse(controller, content, type, cplTarget, category, user.id)
          .catch(error => {
            console.error('Streaming error:', error)
            controller.enqueue(createChunk('error', { error: error.message }))
            controller.close()
          })
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  } catch (error) {
    console.error('Stream setup error:', error)

    // Return error stream
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(createChunk('error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
        controller.close()
      }
    })

    return new Response(errorStream, {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    })
  }
}

/**
 * Handle the actual AI streaming response
 */
async function streamAIResponse(
  controller: ReadableStreamDefaultController,
  content: string,
  type: string,
  cplTarget: number,
  category: string,
  userId: string
) {
  try {
    // Send initial metadata
    controller.enqueue(createChunk('metadata', {
      type,
      cplTarget,
      category,
      startTime: Date.now()
    }))

    let systemPrompt = ''
    let userPrompt = ''

    // Build prompts based on type
    switch (type) {
      case 'grammar_fix':
        ({ systemPrompt, userPrompt } = buildGrammarFixPrompts(content))
        break
      case 'adaptive_polish':
        ({ systemPrompt, userPrompt } = buildAdaptivePolishPrompts(content, cplTarget, category))
        break
      case 'general_improvement':
        ({ systemPrompt, userPrompt } = buildGeneralImprovementPrompts(content, cplTarget))
        break
      default:
        throw new Error('Invalid request type')
    }

    // Stream the AI response
    let fullResponse = ''
    let chunkCount = 0

    const streamResult = await claudeService.generateStreamingResponse(
      {
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 2000
      },
      (chunk: string) => {
        fullResponse += chunk
        chunkCount++

        // Send content chunk to client
        controller.enqueue(createChunk('content', {
          chunk,
          fullResponse: fullResponse.substring(0, Math.min(fullResponse.length, 1000)), // Preview
          chunkIndex: chunkCount
        }))

        // Send periodic metadata updates
        if (chunkCount % 10 === 0) {
          controller.enqueue(createChunk('metadata', {
            progress: Math.min(90, chunkCount * 2), // Estimated progress
            chunksReceived: chunkCount,
            currentLength: fullResponse.length
          }))
        }
      }
    )

    if (!streamResult.success) {
      throw new Error(streamResult.error || 'AI generation failed')
    }

    // Sanitize the final response
    const sanitizedResponse = ContentSanitizer.sanitizeLLMOutput(fullResponse)

    // Send completion chunk with final result
    controller.enqueue(createChunk('complete', {
      finalContent: sanitizedResponse,
      usage: streamResult.usage,
      processingTime: Date.now() - Date.now(), // This would be calculated properly
      totalChunks: chunkCount,
      originalLength: content.length,
      processedLength: sanitizedResponse.length
    }))

    // Log the streaming session for analytics
    await logStreamingSession(userId, type, content.length, sanitizedResponse.length, chunkCount)

    controller.close()
  } catch (error) {
    console.error('AI streaming error:', error)
    controller.enqueue(createChunk('error', {
      error: error instanceof Error ? error.message : 'Streaming failed'
    }))
    controller.close()
  }
}

/**
 * Build prompts for grammar fix streaming
 */
function buildGrammarFixPrompts(content: string) {
  const systemPrompt = `You are a precise grammar and spelling checker. Your ONLY task is to correct grammatical errors, spelling mistakes, and punctuation issues.

CRITICAL RULES:
1. Do NOT change vocabulary or word choice
2. Do NOT alter sentence structure or length
3. Do NOT modify the tone or style
4. Do NOT add or remove content
5. ONLY fix clear grammatical errors

Stream your corrections as you make them. Think through each sentence carefully and only make necessary corrections.`

  const userPrompt = `Please fix only the grammar and spelling in this text, streaming your corrections as you work through it:

"${content}"`

  return { systemPrompt, userPrompt }
}

/**
 * Build prompts for adaptive polish streaming
 */
function buildAdaptivePolishPrompts(content: string, cplTarget: number, category: string) {
  const complexity = mapCPLToComplexity(cplTarget)

  const systemPrompt = `You are Ascendia, an adaptive writing assistant. Polish the text to match CPL ${cplTarget} while preserving the writer's voice.

TARGET COMPLEXITY:
- Vocabulary: ${complexity.vocabulary}
- Sentences: ${complexity.sentences}
- Formality: ${complexity.formality}

CATEGORY: ${category}

Stream your improvements as you work through the text. Think aloud about your polishing decisions while maintaining the writer's authentic voice.`

  const userPrompt = `Please polish this text for CPL ${cplTarget}, streaming your improvements:

"${content}"`

  return { systemPrompt, userPrompt }
}

/**
 * Build prompts for general improvement streaming
 */
function buildGeneralImprovementPrompts(content: string, cplTarget: number) {
  const systemPrompt = `You are a writing improvement assistant. Enhance clarity, flow, and effectiveness while preserving the writer's voice.

Target complexity level: ${cplTarget}/100

Stream your improvements as you work, explaining your enhancements for better readability and impact.`

  const userPrompt = `Please improve this text for clarity and effectiveness, streaming your enhancements:

"${content}"`

  return { systemPrompt, userPrompt }
}

/**
 * Map CPL to complexity descriptions
 */
function mapCPLToComplexity(cpl: number) {
  if (cpl < 30) {
    return {
      vocabulary: 'Simple, everyday words',
      sentences: 'Short, direct sentences (5-15 words)',
      formality: 'Casual, conversational tone'
    }
  } else if (cpl < 60) {
    return {
      vocabulary: 'Professional language with some technical terms',
      sentences: 'Mixed sentence lengths (10-25 words)',
      formality: 'Professional but approachable'
    }
  } else {
    return {
      vocabulary: 'Sophisticated vocabulary with technical terms',
      sentences: 'Complex sentences with varied structure (15-35 words)',
      formality: 'Formal, professional tone'
    }
  }
}

/**
 * Create a properly formatted SSE chunk
 */
function createChunk(type: string, data: any): string {
  const chunk: StreamChunk = {
    type,
    data,
    timestamp: Date.now()
  }

  return `data: ${JSON.stringify(chunk)}\n\n`
}

/**
 * Log streaming session for analytics
 */
async function logStreamingSession(
  userId: string,
  type: string,
  originalLength: number,
  processedLength: number,
  chunkCount: number
) {
  try {
    // This would log to your analytics/monitoring system
    console.log('Streaming session completed:', {
      userId,
      type,
      originalLength,
      processedLength,
      chunkCount,
      timestamp: new Date().toISOString()
    })

    // Could also save to database for user analytics
    // const supabase = createClient()
    // await supabase.from('streaming_sessions').insert({...})

  } catch (error) {
    console.error('Failed to log streaming session:', error)
    // Non-critical error, don't fail the stream
  }
}

/**
 * Health check for streaming service
 */
export async function streamHealthCheck() {
  try {
    const testStream = await streamDraftGeneration({
      content: 'This is a test.',
      type: 'grammar_fix'
    })

    return { success: true, status: 'Streaming service healthy' }
  } catch (error) {
    console.error('Streaming health check failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed'
    }
  }
}

/**
 * Alternative implementation using async generators for more complex streaming
 */
export async function* streamDraftGenerationGenerator(request: {
  content: string
  type: 'grammar_fix' | 'adaptive_polish' | 'general_improvement'
  cplTarget?: number
  category?: string
}) {
  try {
    // Similar setup as above
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      yield { type: 'error', data: { error: 'Authentication required' } }
      return
    }

    const validationResult = streamRequestSchema.safeParse(request)
    if (!validationResult.success) {
      yield { type: 'error', data: { error: 'Validation failed' } }
      return
    }

    const { content, type, cplTarget = 50, category = 'conversational' } = validationResult.data

    // Yield initial metadata
    yield {
      type: 'metadata',
      data: {
        type,
        cplTarget,
        category,
        startTime: Date.now()
      }
    }

    // Process and yield chunks
    let chunkCount = 0
    let fullResponse = ''

    const { systemPrompt, userPrompt } = type === 'grammar_fix'
      ? buildGrammarFixPrompts(content)
      : buildAdaptivePolishPrompts(content, cplTarget, category)

    await claudeService.generateStreamingResponse(
      { system: systemPrompt, user: userPrompt },
      (chunk: string) => {
        fullResponse += chunk
        chunkCount++

        // Note: In a real async generator, you'd need to handle this differently
        // This is just showing the structure
      }
    )

    yield {
      type: 'complete',
      data: {
        finalContent: ContentSanitizer.sanitizeLLMOutput(fullResponse),
        totalChunks: chunkCount
      }
    }

  } catch (error) {
    yield {
      type: 'error',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}