// Parallel Processing API with Vercel AI SDK
// Created: January 2025
// Purpose: New optimized endpoint with model tiering and parallel processing

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  createGrammarStream,
  createAdaptivePolishStream,
  createCPLAnalysisStream,
  StreamingTextResponse
} from '@/lib/ai/vercel-streaming'
import {
  ModelSelector,
  OperationType,
  UserTier,
  ParallelModelStrategy
} from '@/lib/ai/model-selector'
import { getPersonalizedPrompt } from '@/lib/voice/voice-learning'
import { withBackgroundTasks, scheduleEdgeTask } from '@/lib/background/middleware'
import { schedulePostDraftProcessing } from '@/lib/background/task-orchestrator'

// Request validation schema
const parallelRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  category: z.enum(['instagram_post', 'linkedin', 'medium_article', 'email', 'conversational']),
  conversationId: z.string().uuid(),
  sessionId: z.string().optional(),
})

// Wrap the main handler with background task middleware
export const POST = withBackgroundTasks(async (request: NextRequest, bgTasks) => {
  const encoder = new TextEncoder()

  try {
    // 1. Authentication & Validation
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
    const { prompt, category, conversationId, sessionId } = parallelRequestSchema.parse(body)

    // 2. Get user tier for model selection
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, preferences')
      .eq('id', user.id)
      .single()

    const userTier = (profile?.subscription_tier as UserTier) || UserTier.STANDARD
    const modelStrategy = new ParallelModelStrategy(userTier)

    // 3. Store user input
    const { data: userInput, error: inputError } = await supabase
      .from('user_inputs')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        raw_text: prompt,
        content: prompt,
      })
      .select('id')
      .single()

    if (inputError) {
      console.error('Failed to store user input:', inputError)
      return new Response(
        encoder.encode(`data: {"type":"error","message":"Failed to store input"}\n\n`),
        { status: 500, headers: { 'Content-Type': 'text/event-stream' } }
      )
    }

    // 4. Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Track performance metrics
          const startTime = Date.now()
          const metrics = {
            grammarTime: 0,
            polishTime: 0,
            totalTime: 0,
          }

          // =============================
          // PHASE 1: TRUE PARALLEL PROCESSING
          // =============================
          controller.enqueue(
            encoder.encode(`data: {"type":"phase","phase":"parallel_processing","message":"Starting true parallel processing"}\n\n`)
          )

          const parallelStart = Date.now()

          // Start both streams simultaneously and user context fetch
          const [grammarStreamPromise, polishStreamPromise, userContext] = await Promise.all([
            createGrammarStream(prompt, user.id),
            createAdaptivePolishStream(prompt, { userId: user.id, category }),
            fetchUserContext(user.id, category),
          ])

          console.log('🚀 Both AI streams initialized in parallel')

          // Initialize tracking for both streams
          let grammarFixedText = ''
          let polishedText = ''
          let grammarComplete = false
          let polishComplete = false

          // Start grammar stream
          controller.enqueue(
            encoder.encode(`data: {"type":"draft_start","draftType":"grammar_fix","model":"haiku"}\n\n`)
          )

          // Start polish stream
          controller.enqueue(
            encoder.encode(`data: {"type":"draft_start","draftType":"adaptive_polish","model":"sonnet"}\n\n`)
          )

          // Process both streams in parallel using Promise.race for true concurrency
          await Promise.all([
            // Grammar stream processing
            (async () => {
              try {
                for await (const chunk of grammarStreamPromise.stream) {
                  grammarFixedText += chunk
                  const progress = Math.min((grammarFixedText.length / 150) * 100, 100)

                  controller.enqueue(
                    encoder.encode(`data: {"type":"draft_chunk","draft_type":"grammar_fix","content":"${escapeJson(chunk)}","progress":${progress}}\n\n`)
                  )
                }
                grammarComplete = true
                metrics.grammarTime = Date.now() - parallelStart

                controller.enqueue(
                  encoder.encode(`data: {"type":"draft_complete","draftType":"grammar_fix","cost":${grammarStreamPromise.estimatedCost}}\n\n`)
                )

                console.log(`✅ Grammar stream completed in ${metrics.grammarTime}ms`)
              } catch (error) {
                console.error('Grammar stream error:', error)
              }
            })(),

            // Polish stream processing (runs simultaneously)
            (async () => {
              try {
                for await (const chunk of polishStreamPromise.stream) {
                  polishedText += chunk
                  const progress = Math.min((polishedText.length / 200) * 100, 100)

                  controller.enqueue(
                    encoder.encode(`data: {"type":"draft_chunk","draft_type":"adaptive_polish","content":"${escapeJson(chunk)}","progress":${progress}}\n\n`)
                  )
                }
                polishComplete = true
                metrics.polishTime = Date.now() - parallelStart

                controller.enqueue(
                  encoder.encode(`data: {"type":"draft_complete","draftType":"adaptive_polish","cost":${polishStreamPromise.estimatedCost}}\n\n`)
                )

                console.log(`✅ Polish stream completed in ${metrics.polishTime}ms`)
              } catch (error) {
                console.error('Polish stream error:', error)
              }
            })()
          ])

          // Calculate total time for parallel processing
          const parallelTime = Date.now() - parallelStart
          console.log(`🎯 Parallel processing completed in ${parallelTime}ms (vs ${metrics.grammarTime + metrics.polishTime}ms sequential)`)

          // Send progress update showing parallel completion
          controller.enqueue(
            encoder.encode(`data: {"type":"progress","progress":{"grammar":100,"polish":100},"parallelTime":${parallelTime},"sequentialTime":${metrics.grammarTime + metrics.polishTime}}\n\n`)
          )

          // =============================
          // PHASE 3: Background Tasks (Non-blocking)
          // =============================
          controller.enqueue(
            encoder.encode(`data: {"type":"phase","phase":"background_tasks","message":"Starting background analysis"}\n\n`)
          )

          // Calculate total metrics
          metrics.totalTime = Date.now() - startTime
          const totalCost = grammarStreamPromise.estimatedCost + polishStreamPromise.estimatedCost

          // Calculate performance improvement
          const sequentialTime = metrics.grammarTime + metrics.polishTime
          const calculatedParallelTime = Math.max(metrics.grammarTime, metrics.polishTime)
          const improvement = Math.round(((sequentialTime - calculatedParallelTime) / sequentialTime) * 100)

          // Send completion event with performance metrics
          const completionData = {
            type: "session_complete",
            metrics: {
              ...metrics,
              parallelTime,
              sequentialTime,
              improvement: `${improvement}%`,
              efficiency: improvement > 50 ? 'excellent' : improvement > 30 ? 'good' : 'moderate'
            },
            totalCost,
            models: { grammar: "haiku", polish: "sonnet" },
            drafts: [
              {
                id: crypto.randomUUID(),
                type: 'grammar_fix',
                content: grammarFixedText,
                model: 'haiku',
                estimatedCost: grammarStreamPromise.estimatedCost
              },
              {
                id: crypto.randomUUID(),
                type: 'adaptive_polish',
                content: polishedText,
                model: 'sonnet',
                estimatedCost: polishStreamPromise.estimatedCost
              }
            ]
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(completionData)}\n\n`)
          )

          // Store drafts in database with IDs for background tasks
          const draftIds = await storeDraftsAsync(supabase, {
            userInputId: userInput.id,
            conversationId,
            userId: user.id,
            grammarDraft: grammarFixedText,
            polishDraft: polishedText,
          })

          // Schedule comprehensive background tasks using orchestrator
          if (draftIds.grammarDraftId && draftIds.polishDraftId) {
            schedulePostDraftProcessing({
              userId: user.id,
              conversationId,
              grammarDraft: { id: draftIds.grammarDraftId, content: grammarFixedText },
              polishDraft: { id: draftIds.polishDraftId, content: polishedText }
            })
          }

          // Schedule analytics tracking with enhanced metrics
          scheduleEdgeTask('performance_analytics', {
            userId: user.id,
            sessionId: sessionId || crypto.randomUUID(),
            metrics: {
              ...metrics,
              parallelTime,
              sequentialTime,
              improvement: `${improvement}%`,
              efficiency: improvement > 50 ? 'excellent' : improvement > 30 ? 'good' : 'moderate',
              models: { grammar: 'haiku', polish: 'sonnet' },
              category,
              parallelProcessing: true
            }
          }, async (data) => {
            const supabase = createClient()
            await supabase.from('usage_analytics').insert({
              user_id: data.userId,
              conversation_id: conversationId,
              event_type: 'parallel_processing_complete',
              event_data: data.metrics
            })
          })

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(
            encoder.encode(`data: {"type":"error","message":"${escapeJson(String(error))}"}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
      },
    })
  } catch (error) {
    console.error('Request error:', error)
    return new Response(
      encoder.encode(`data: {"type":"error","message":"Invalid request"}\n\n`),
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    )
  }
}, {
  enableAnalytics: true,
  enablePerformanceMonitoring: true,
  debugMode: process.env.NODE_ENV === 'development'
})

/**
 * Fetch user context for personalization
 */
async function fetchUserContext(userId: string, category: string) {
  const supabase = createClient()

  // Get user preferences and baseline
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences, cpl_score')
    .eq('id', userId)
    .single()

  // Get recent accepted drafts for learning
  const { data: recentDrafts } = await supabase
    .from('generated_drafts')
    .select('content, cpl_score')
    .eq('user_id', userId)
    .eq('is_accepted', true)
    .order('created_at', { ascending: false })
    .limit(5)

  return {
    baseline: profile?.preferences?.writing_baseline || {
      style: 'professional',
      formality: 0.7,
      sentenceLength: 15,
    },
    targetCPL: profile?.cpl_score || 75,
    recentPatterns: recentDrafts || [],
  }
}

/**
 * Store drafts asynchronously and return their IDs for background task scheduling
 */
async function storeDraftsAsync(
  supabase: any,
  data: {
    userInputId: string
    conversationId: string
    userId: string
    grammarDraft: string
    polishDraft: string
  }
): Promise<{ grammarDraftId?: string; polishDraftId?: string }> {
  try {
    const [grammarResult, polishResult] = await Promise.all([
      // Store grammar fix draft
      supabase.from('generated_drafts').insert({
        user_input_id: data.userInputId,
        conversation_id: data.conversationId,
        user_id: data.userId,
        content: data.grammarDraft,
        type: 'grammar_fix',
        generation_status: 'completed',
      }).select('id').single(),

      // Store adaptive polish draft
      supabase.from('generated_drafts').insert({
        user_input_id: data.userInputId,
        conversation_id: data.conversationId,
        user_id: data.userId,
        content: data.polishDraft,
        type: 'adaptive_polish',
        generation_status: 'completed',
      }).select('id').single(),
    ])

    return {
      grammarDraftId: grammarResult?.data?.id,
      polishDraftId: polishResult?.data?.id
    }
  } catch (error) {
    console.error('Failed to store drafts:', error)
    return {}
  }
}


/**
 * Escape JSON string for SSE
 */
function escapeJson(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}