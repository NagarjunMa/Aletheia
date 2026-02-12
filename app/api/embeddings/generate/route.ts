import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { z } from 'zod'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Request validation schema
const generateEmbeddingSchema = z.object({
  text: z.string().min(1).max(8000), // OpenAI limit for text-embedding-3-small
  model: z.string().optional().default('text-embedding-3-small')
})

// Rate limiting (simple in-memory implementation for demo)
const rateLimits = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_PER_HOUR = 100 // Adjust based on needs
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimits.get(userId)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimits.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (userLimit.count >= RATE_LIMIT_PER_HOUR) {
    return false
  }

  userLimit.count++
  return true
}

// POST /api/embeddings/generate - Generate embedding for text
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check rate limiting
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const validationResult = generateEmbeddingSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.issues[0].message
        },
        { status: 400 }
      )
    }

    const { text, model } = validationResult.data

    // Generate embedding using OpenAI
    const startTime = Date.now()

    const response = await openai.embeddings.create({
      model,
      input: text,
      encoding_format: 'float'
    })

    const processingTime = Date.now() - startTime

    if (!response.data?.[0]?.embedding) {
      throw new Error('No embedding data received from OpenAI')
    }

    const embedding = response.data[0].embedding
    const tokenUsage = response.usage?.total_tokens || 0

    // Log usage for cost tracking
    console.log(`Embedding generated for user ${user.id}: ${tokenUsage} tokens, ${processingTime}ms`)

    // Optional: Store usage in database for analytics
    try {
      // You could implement usage logging here
      // await logApiUsage(user.id, 'embeddings/generate', tokenUsage, processingTime)
    } catch (logError) {
      console.error('Failed to log usage:', logError)
      // Don't fail the request for logging errors
    }

    return NextResponse.json({
      embedding,
      model,
      tokenUsage,
      processingTime,
      dimensions: embedding.length
    })

  } catch (error) {
    console.error('Embedding generation error:', error)

    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'OpenAI API key invalid' },
          { status: 500 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'OpenAI API rate limit exceeded' },
          { status: 429 }
        )
      }
      if (error.status === 400) {
        return NextResponse.json(
          { error: 'Invalid text content for embedding' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate embedding' },
      { status: 500 }
    )
  }
}

// GET /api/embeddings/generate/usage - Get usage statistics
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userLimit = rateLimits.get(user.id)
    const now = Date.now()

    const usageStats = {
      userId: user.id,
      currentHourUsage: userLimit && now <= userLimit.resetTime ? userLimit.count : 0,
      hourlyLimit: RATE_LIMIT_PER_HOUR,
      resetTime: userLimit?.resetTime || now + RATE_LIMIT_WINDOW,
      remainingRequests: userLimit && now <= userLimit.resetTime
        ? Math.max(0, RATE_LIMIT_PER_HOUR - userLimit.count)
        : RATE_LIMIT_PER_HOUR
    }

    return NextResponse.json(usageStats)

  } catch (error) {
    console.error('Usage stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get usage statistics' },
      { status: 500 }
    )
  }
}