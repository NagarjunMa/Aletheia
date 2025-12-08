// Server-Side Streaming Implementation
// Created: December 7, 2024
// Purpose: Server-side streaming infrastructure for real-time AI processing

import { streamProcessUserInput } from '@/lib/ai/processor'
import { createClient, getUser } from '@/lib/supabase/server'

// Type definitions for streaming responses
export interface StreamingMessage {
  id: string
  type: 'status' | 'content' | 'progress' | 'completed' | 'error'
  timestamp: string
  data?: any
}

export interface StreamingSession {
  id: string
  userId: string
  inputId: string
  draftType: 'grammar_fix' | 'adaptive_polish'
  status: 'active' | 'completed' | 'failed'
  createdAt: Date
  lastActivity: Date
}

// In-memory session store (in production, use Redis or similar)
const activeSessions = new Map<string, StreamingSession>()

// Create streaming session
export async function createStreamingSession(
  inputId: string,
  draftType: 'grammar_fix' | 'adaptive_polish'
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const user = await getUser()
    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const supabase = createClient()

    // Verify user owns the input
    const { data: userInput, error: inputError } = await supabase
      .from('user_inputs')
      .select(`
        id,
        processing_status,
        conversations!inner(user_id)
      `)
      .eq('id', inputId)
      .single()

    if (inputError || userInput?.conversations?.user_id !== user.id) {
      return { success: false, error: 'Input not found or access denied' }
    }

    if (userInput.processing_status === 'processing') {
      return { success: false, error: 'Input is already being processed' }
    }

    // Create session
    const sessionId = crypto.randomUUID()
    const session: StreamingSession = {
      id: sessionId,
      userId: user.id,
      inputId,
      draftType,
      status: 'active',
      createdAt: new Date(),
      lastActivity: new Date(),
    }

    activeSessions.set(sessionId, session)

    return { success: true, sessionId }
  } catch (error) {
    console.error('Create streaming session error:', error)
    return { success: false, error: 'Failed to create streaming session' }
  }
}

// Stream processing with ReadableStream
export async function streamProcessing(sessionId: string): Promise<ReadableStream<Uint8Array>> {
  const session = activeSessions.get(sessionId)

  if (!session) {
    throw new Error('Invalid session ID')
  }

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        // Helper function to send message
        const sendMessage = (message: StreamingMessage) => {
          session.lastActivity = new Date()
          const data = `data: ${JSON.stringify(message)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        // Send initial status
        sendMessage({
          id: crypto.randomUUID(),
          type: 'status',
          timestamp: new Date().toISOString(),
          data: { status: 'Starting AI processing...', sessionId }
        })

        let draftId: string | undefined
        let fullContent = ''
        let cplScore: number | undefined

        // Stream from AI processor
        for await (const update of streamProcessUserInput(
          session.inputId,
          session.draftType
        )) {
          switch (update.type) {
            case 'status':
              sendMessage({
                id: crypto.randomUUID(),
                type: 'status',
                timestamp: new Date().toISOString(),
                data: {
                  status: update.status,
                  draftId: update.draftId || draftId
                }
              })

              if (update.draftId) {
                draftId = update.draftId
              }
              break

            case 'content':
              if (update.content) {
                fullContent += update.content

                sendMessage({
                  id: crypto.randomUUID(),
                  type: 'content',
                  timestamp: new Date().toISOString(),
                  data: {
                    content: update.content,
                    fullContent,
                    draftId: update.draftId || draftId
                  }
                })

                // Send progress update
                const progress = Math.min(95, (fullContent.length / 1000) * 100)
                sendMessage({
                  id: crypto.randomUUID(),
                  type: 'progress',
                  timestamp: new Date().toISOString(),
                  data: {
                    progress,
                    stage: 'generating',
                    draftId: update.draftId || draftId
                  }
                })
              }
              break

            case 'completed':
              cplScore = update.cplScore
              session.status = 'completed'

              sendMessage({
                id: crypto.randomUUID(),
                type: 'progress',
                timestamp: new Date().toISOString(),
                data: {
                  progress: 100,
                  stage: 'completed',
                  draftId: update.draftId || draftId
                }
              })

              sendMessage({
                id: crypto.randomUUID(),
                type: 'completed',
                timestamp: new Date().toISOString(),
                data: {
                  draftId: update.draftId || draftId,
                  content: update.content || fullContent,
                  cplScore: update.cplScore,
                  finalStats: {
                    wordCount: fullContent.split(/\s+/).length,
                    characterCount: fullContent.length,
                    processingTime: Date.now() - session.createdAt.getTime()
                  }
                }
              })

              // Clean up session after a delay
              setTimeout(() => {
                activeSessions.delete(sessionId)
              }, 5 * 60 * 1000) // 5 minutes

              controller.close()
              return

            case 'error':
              session.status = 'failed'

              sendMessage({
                id: crypto.randomUUID(),
                type: 'error',
                timestamp: new Date().toISOString(),
                data: {
                  error: update.error,
                  draftId: update.draftId || draftId
                }
              })

              // Clean up session
              setTimeout(() => {
                activeSessions.delete(sessionId)
              }, 60 * 1000) // 1 minute

              controller.close()
              return
          }
        }
      } catch (error) {
        console.error('Streaming error:', error)

        session.status = 'failed'

        const errorMessage = {
          id: crypto.randomUUID(),
          type: 'error' as const,
          timestamp: new Date().toISOString(),
          data: {
            error: error instanceof Error ? error.message : 'Streaming failed',
            sessionId
          }
        }

        const data = `data: ${JSON.stringify(errorMessage)}\n\n`
        controller.enqueue(encoder.encode(data))

        // Clean up session
        setTimeout(() => {
          activeSessions.delete(sessionId)
        }, 60 * 1000)

        controller.close()
      }
    },

    cancel() {
      // Clean up when client disconnects
      session.status = 'failed'
      activeSessions.delete(sessionId)
    }
  })
}

// Get session status
export function getSessionStatus(sessionId: string): StreamingSession | null {
  return activeSessions.get(sessionId) || null
}

// Cancel streaming session
export function cancelStreamingSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId)
  if (session) {
    session.status = 'failed'
    activeSessions.delete(sessionId)
    return true
  }
  return false
}

// Clean up expired sessions
export function cleanupExpiredSessions(maxAgeMs = 30 * 60 * 1000) { // 30 minutes
  const now = Date.now()
  const expiredSessions: string[] = []

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivity.getTime() > maxAgeMs) {
      expiredSessions.push(sessionId)
    }
  }

  for (const sessionId of expiredSessions) {
    activeSessions.delete(sessionId)
  }

  return expiredSessions.length
}

// Get active session count
export function getActiveSessionCount(): number {
  return activeSessions.size
}

// Get sessions for user
export function getUserSessions(userId: string): StreamingSession[] {
  return Array.from(activeSessions.values()).filter(
    session => session.userId === userId
  )
}

// Rate limiting for streaming
const userStreamCounts = new Map<string, number>()

export function checkStreamingRateLimit(userId: string, maxConcurrent = 3): boolean {
  const currentCount = userStreamCounts.get(userId) || 0
  return currentCount < maxConcurrent
}

export function incrementUserStreamCount(userId: string): void {
  const currentCount = userStreamCounts.get(userId) || 0
  userStreamCounts.set(userId, currentCount + 1)
}

export function decrementUserStreamCount(userId: string): void {
  const currentCount = userStreamCounts.get(userId) || 0
  if (currentCount > 0) {
    userStreamCounts.set(userId, currentCount - 1)
  }
}

// Utility function to create Server-Sent Events response
export function createSSEResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
}

// Health check for streaming infrastructure
export function getStreamingHealth() {
  const activeSessions = getActiveSessionCount()
  const totalUsers = new Set(Array.from(activeSessions.values()).map(s => s.userId)).size

  return {
    status: activeSessions < 100 ? 'healthy' : 'degraded', // Arbitrary threshold
    activeSessions,
    totalUsers,
    averageSessionsPerUser: totalUsers > 0 ? activeSessions / totalUsers : 0,
    timestamp: new Date().toISOString(),
  }
}

// Periodic cleanup (should be run on a schedule)
setInterval(() => {
  const cleanedCount = cleanupExpiredSessions()
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired streaming sessions`)
  }
}, 5 * 60 * 1000) // Every 5 minutes