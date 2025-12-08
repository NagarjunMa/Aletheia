'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import {
  createStreamingSession,
  getSessionStatus,
  cancelStreamingSession,
  getUserSessions,
  getStreamingHealth,
  checkStreamingRateLimit
} from '@/lib/streaming/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const startStreamingSchema = z.object({
  inputId: z.string().uuid('Invalid input ID'),
  draftType: z.enum(['grammar_fix', 'adaptive_polish']),
  processingOptions: z.object({
    targetCpl: z.number().min(1).max(100).optional(),
    preserveTone: z.boolean().optional(),
    preserveLength: z.boolean().optional(),
    targetAudience: z.string().max(100).optional(),
    styleGuide: z.string().max(500).optional(),
  }).optional(),
})

// Start streaming processing session
export async function startStreamingProcessing(formData: FormData) {
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
      inputId: formData.get('inputId') as string,
      draftType: formData.get('draftType') as 'grammar_fix' | 'adaptive_polish',
      processingOptions: formData.get('processingOptions') ?
        JSON.parse(formData.get('processingOptions') as string) : undefined,
    }

    const validatedData = startStreamingSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { inputId, draftType } = validatedData.data

    // Check rate limiting
    if (!checkStreamingRateLimit(user.id)) {
      return {
        success: false,
        error: 'Too many concurrent streaming sessions. Please wait for existing sessions to complete.',
      }
    }

    // Verify user owns the input
    const supabase = createClient()
    const { data: userInput, error: inputError } = await supabase
      .from('user_inputs')
      .select(`
        id,
        processing_status,
        conversation_id,
        conversations!inner(user_id)
      `)
      .eq('id', inputId)
      .single()

    if (inputError || userInput?.conversations?.user_id !== user.id) {
      return {
        success: false,
        error: 'Input not found or access denied',
      }
    }

    if (userInput.processing_status === 'processing') {
      return {
        success: false,
        error: 'Input is already being processed',
      }
    }

    // Create streaming session
    const sessionResult = await createStreamingSession(inputId, draftType)

    if (sessionResult.success) {
      revalidatePath(`/conversations/${userInput.conversation_id}`)
      revalidatePath('/dashboard')
    }

    return {
      success: sessionResult.success,
      data: sessionResult.sessionId ? {
        sessionId: sessionResult.sessionId,
        streamUrl: `/api/stream/process?sessionId=${sessionResult.sessionId}`,
      } : undefined,
      error: sessionResult.error,
      message: sessionResult.success ? 'Streaming session created successfully' : undefined,
    }
  } catch (error) {
    console.error('Start streaming processing error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get streaming session status
export async function getStreamingSessionStatus(sessionId: string) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: null,
      }
    }

    if (!sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
        data: null,
      }
    }

    const session = getSessionStatus(sessionId)

    if (!session || session.userId !== user.id) {
      return {
        success: false,
        error: 'Session not found or access denied',
        data: null,
      }
    }

    return {
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        inputId: session.inputId,
        draftType: session.draftType,
        createdAt: session.createdAt.toISOString(),
        lastActivity: session.lastActivity.toISOString(),
        isActive: session.status === 'active',
      },
    }
  } catch (error) {
    console.error('Get streaming session status error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: null,
    }
  }
}

// Cancel streaming session
export async function cancelStreamingProcessing(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const sessionId = formData.get('sessionId') as string

    if (!sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
      }
    }

    const session = getSessionStatus(sessionId)

    if (!session || session.userId !== user.id) {
      return {
        success: false,
        error: 'Session not found or access denied',
      }
    }

    const cancelled = cancelStreamingSession(sessionId)

    if (cancelled) {
      // Also update the input status in database
      const supabase = createClient()
      await supabase
        .from('user_inputs')
        .update({
          processing_status: 'failed',
          error_details: {
            message: 'Processing cancelled by user',
            timestamp: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.inputId)

      revalidatePath(`/conversations`)
      revalidatePath('/dashboard')
    }

    return {
      success: cancelled,
      error: cancelled ? undefined : 'Failed to cancel session',
      message: cancelled ? 'Session cancelled successfully' : undefined,
    }
  } catch (error) {
    console.error('Cancel streaming processing error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get user's active streaming sessions
export async function getUserActiveStreamingSessions() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: [],
      }
    }

    const sessions = getUserSessions(user.id)

    const sessionData = sessions.map(session => ({
      sessionId: session.id,
      status: session.status,
      inputId: session.inputId,
      draftType: session.draftType,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      isActive: session.status === 'active',
    }))

    return {
      success: true,
      data: sessionData,
    }
  } catch (error) {
    console.error('Get user active streaming sessions error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: [],
    }
  }
}

// Check if user can start new streaming session
export async function checkStreamingAvailability() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: { canStream: false, reason: 'Not authenticated' },
      }
    }

    const canStream = checkStreamingRateLimit(user.id)
    const activeSessions = getUserSessions(user.id)

    return {
      success: true,
      data: {
        canStream,
        reason: canStream ? 'Available' : 'Too many concurrent sessions',
        activeSessionCount: activeSessions.length,
        maxConcurrentSessions: 3, // This should match the limit in server.ts
        activeSessions: activeSessions.map(s => ({
          sessionId: s.id,
          inputId: s.inputId,
          draftType: s.draftType,
          status: s.status,
        })),
      },
    }
  } catch (error) {
    console.error('Check streaming availability error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: { canStream: false, reason: 'Error checking availability' },
    }
  }
}

// Get streaming service health status (admin only)
export async function getStreamingServiceHealth() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: null,
      }
    }

    // In a real app, you might want to check if user is admin
    // For now, we'll return health info for any authenticated user
    const health = getStreamingHealth()

    return {
      success: true,
      data: health,
    }
  } catch (error) {
    console.error('Get streaming service health error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: null,
    }
  }
}

// Resume a streaming session (if it was interrupted)
export async function resumeStreamingSession(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const sessionId = formData.get('sessionId') as string
    const inputId = formData.get('inputId') as string

    if (!sessionId || !inputId) {
      return {
        success: false,
        error: 'Session ID and Input ID are required',
      }
    }

    // Check if session exists and is owned by user
    const session = getSessionStatus(sessionId)

    if (session && session.userId === user.id) {
      // Session still exists, can resume
      return {
        success: true,
        data: {
          sessionId,
          streamUrl: `/api/stream/process?sessionId=${sessionId}`,
        },
        message: 'Resuming existing session',
      }
    }

    // Session doesn't exist, create new one
    const supabase = createClient()
    const { data: userInput, error: inputError } = await supabase
      .from('user_inputs')
      .select(`
        id,
        processing_status,
        conversation_id,
        conversations!inner(user_id)
      `)
      .eq('id', inputId)
      .single()

    if (inputError || userInput?.conversations?.user_id !== user.id) {
      return {
        success: false,
        error: 'Input not found or access denied',
      }
    }

    // Create new streaming session
    const draftType = formData.get('draftType') as 'grammar_fix' | 'adaptive_polish' || 'adaptive_polish'
    const sessionResult = await createStreamingSession(inputId, draftType)

    return {
      success: sessionResult.success,
      data: sessionResult.sessionId ? {
        sessionId: sessionResult.sessionId,
        streamUrl: `/api/stream/process?sessionId=${sessionResult.sessionId}`,
      } : undefined,
      error: sessionResult.error,
      message: sessionResult.success ? 'New streaming session created' : undefined,
    }
  } catch (error) {
    console.error('Resume streaming session error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Cleanup user's completed/failed sessions
export async function cleanupUserSessions() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const userSessions = getUserSessions(user.id)
    const completedOrFailedSessions = userSessions.filter(
      session => session.status === 'completed' || session.status === 'failed'
    )

    let cleanedCount = 0
    for (const session of completedOrFailedSessions) {
      const cleaned = cancelStreamingSession(session.id)
      if (cleaned) cleanedCount++
    }

    return {
      success: true,
      data: { cleanedSessions: cleanedCount },
      message: `Cleaned up ${cleanedCount} completed/failed sessions`,
    }
  } catch (error) {
    console.error('Cleanup user sessions error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}