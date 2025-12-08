// Streaming API Route Handler
// Created: December 7, 2024
// Purpose: Handle streaming AI processing requests

import { NextRequest } from 'next/server'
import {
  createStreamingSession,
  streamProcessing,
  createSSEResponse,
  checkStreamingRateLimit,
  incrementUserStreamCount,
  decrementUserStreamCount,
  getSessionStatus
} from '@/lib/streaming/server'
import { getUser } from '@/lib/supabase/server'
import { z } from 'zod'

// Request schema validation
const streamRequestSchema = z.object({
  inputId: z.string().uuid('Invalid input ID'),
  draftType: z.enum(['grammar_fix', 'adaptive_polish']),
  options: z.object({
    targetCpl: z.number().min(1).max(100).optional(),
    preserveTone: z.boolean().optional(),
    preserveLength: z.boolean().optional(),
    targetAudience: z.string().optional(),
    styleGuide: z.string().optional(),
  }).optional(),
})

// POST /api/stream/process - Start streaming processing
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Check rate limiting
    if (!checkStreamingRateLimit(user.id)) {
      return new Response('Too many concurrent streams', { status: 429 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = streamRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: validationResult.error.issues[0].message }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const { inputId, draftType } = validationResult.data

    // Create streaming session
    const sessionResult = await createStreamingSession(inputId, draftType)
    if (!sessionResult.success) {
      return new Response(
        JSON.stringify({ error: sessionResult.error }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const sessionId = sessionResult.sessionId!

    // Increment user stream count
    incrementUserStreamCount(user.id)

    // Create streaming response
    const stream = await streamProcessing(sessionId)

    // Wrap stream to handle cleanup
    const wrappedStream = new ReadableStream({
      start(controller) {
        const reader = stream.getReader()

        const pump = async (): Promise<void> => {
          try {
            const { done, value } = await reader.read()

            if (done) {
              // Stream completed
              decrementUserStreamCount(user.id)
              controller.close()
              return
            }

            controller.enqueue(value)
            return pump()
          } catch (error) {
            console.error('Stream pump error:', error)
            decrementUserStreamCount(user.id)
            controller.error(error)
          }
        }

        pump()
      },

      cancel() {
        // Client disconnected
        decrementUserStreamCount(user.id)
      }
    })

    return createSSEResponse(wrappedStream)

  } catch (error) {
    console.error('Streaming API error:', error)

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// GET /api/stream/process?sessionId=... - Get session status
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const session = getSessionStatus(sessionId)
    if (!session || session.userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        status: session.status,
        inputId: session.inputId,
        draftType: session.draftType,
        createdAt: session.createdAt.toISOString(),
        lastActivity: session.lastActivity.toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Get session status error:', error)

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}