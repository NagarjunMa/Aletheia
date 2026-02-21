import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  getSystemPrompt,
  buildPrompt,
  sanitize,
  type GenerateInput
} from '@/lib/ai/prompts/linkedin-connection'
import { sanitizeForLinkedIn } from '@/lib/ai/sanitizer'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Supabase service client for rate limiting (no cookie dependency)
const supabaseService = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Supabase client for token validation (anon key)
const supabaseAuth = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAILY_LIMIT = 30

// ─── Auth helper ───

async function authenticateRequest(request: NextRequest): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[EXT-GENERATE] ✗ No Bearer token in Authorization header')
    return null
  }

  const accessToken = authHeader.slice(7)
  console.log('[EXT-GENERATE] Validating token (first 20 chars):', accessToken.substring(0, 20) + '...')
  const { data: { user }, error } = await supabaseAuth.auth.getUser(accessToken)

  if (error || !user) {
    console.log('[EXT-GENERATE] ✗ Token validation failed:', error?.message || 'no user')
    return null
  }

  console.log('[EXT-GENERATE] ✓ Authenticated:', user.email)
  return { userId: user.id, email: user.email || '' }
}

// ─── Persistent rate limiting via Supabase ───

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remainingRequests: number; resetTime: number }> {
  const now = new Date()
  const windowStartCutoff = new Date(now.getTime() - 86400000) // 24 hours ago

  // Get current usage count within the 24h window
  const { data, error } = await supabaseService
    .from('extension_rate_limits')
    .select('request_count, window_start')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned (first request)
    console.error('Rate limit check error:', error)
    // Fail open — allow request but log error
    return { allowed: true, remainingRequests: DAILY_LIMIT - 1, resetTime: now.getTime() + 86400000 }
  }

  if (!data) {
    // First request ever — create row
    const { error: insertError } = await supabaseService
      .from('extension_rate_limits')
      .insert({
        user_id: userId,
        request_count: 1,
        window_start: now.toISOString()
      })

    if (insertError) {
      console.error('Rate limit insert error:', insertError)
    }

    return { allowed: true, remainingRequests: DAILY_LIMIT - 1, resetTime: now.getTime() + 86400000 }
  }

  const windowStart = new Date(data.window_start)

  if (windowStart < windowStartCutoff) {
    // Window expired — reset
    const { error: updateError } = await supabaseService
      .from('extension_rate_limits')
      .update({
        request_count: 1,
        window_start: now.toISOString()
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Rate limit reset error:', updateError)
    }

    return { allowed: true, remainingRequests: DAILY_LIMIT - 1, resetTime: now.getTime() + 86400000 }
  }

  if (data.request_count >= DAILY_LIMIT) {
    const resetTime = windowStart.getTime() + 86400000
    return { allowed: false, remainingRequests: 0, resetTime }
  }

  // Increment
  const { error: updateError } = await supabaseService
    .from('extension_rate_limits')
    .update({
      request_count: data.request_count + 1
    })
    .eq('user_id', userId)

  if (updateError) {
    console.error('Rate limit increment error:', updateError)
  }

  const resetTime = windowStart.getTime() + 86400000
  return {
    allowed: true,
    remainingRequests: Math.max(0, DAILY_LIMIT - data.request_count - 1),
    resetTime
  }
}

// ─── CORS helpers ───

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowedPatterns = [
    /^chrome-extension:\/\//,
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/.*\.vercel\.app$/,
  ]

  const isAllowed = origin && allowedPatterns.some(p => p.test(origin))

  return {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}

// Request validation schema
const generateRequestSchema = z.object({
  profile: z.object({
    name: z.string(),
    headline: z.string().nullish(),
    location: z.string().nullish(),
    about: z.string().nullish(),
    experiences: z.array(z.object({
      title: z.string(),
      company: z.string().nullish()
    })).nullish(),
    recentPosts: z.array(z.string()).nullish(),
    skills: z.array(z.string()).nullish(),
    profileUrl: z.string().url()
  }),
  resume: z.string().nullish().default(''),
  jd: z.string().nullish().default(''),
  category: z.enum(['linkedin_connection', 'cold_email', 'linkedin_inmail']),
  intent: z.enum(['networking', 'referral', 'mentorship', 'job_inquiry']).nullish().default('networking'),
  acceptedExamples: z.array(z.string()).nullish().default([])
})

type GenerateRequest = z.infer<typeof generateRequestSchema>

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request)

  try {
    // 1. Auth check FIRST (before rate limiting)
    const authResult = await authenticateRequest(request)
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid Bearer token required' },
        { status: 401, headers: corsHeaders }
      )
    }

    // 2. Rate limiting (per user, persistent)
    const rateCheck = await checkRateLimit(authResult.userId)
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: 'Daily limit reached',
        message: 'You have exceeded the 30 requests per day limit. Please try again tomorrow.',
        resetTime: rateCheck.resetTime
      }, {
        status: 429,
        headers: {
          ...corsHeaders,
          'X-RateLimit-Limit': String(DAILY_LIMIT),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateCheck.resetTime)
        }
      })
    }

    // 3. Parse and validate request
    const body = await request.json()
    const validatedData = generateRequestSchema.parse(body)

    const { profile, resume, jd, category, intent, acceptedExamples } = validatedData

    // Use new prompt system
    const systemPrompt = getSystemPrompt(category)
    const userPrompt = buildPrompt({
      profile: {
        name: profile.name,
        headline: profile.headline || '',
        location: profile.location || '',
        about: profile.about || '',
        experiences: (profile.experiences || []).map(e => ({ title: e.title, company: e.company || '' })),
        recentPosts: profile.recentPosts || [],
        skills: profile.skills || []
      },
      resume: resume || '',
      jd: jd || '',
      category,
      intent: intent || 'networking',
      acceptedExamples: acceptedExamples || []
    })

    // Generate content using Claude
    const startTime = Date.now()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const processingTime = Date.now() - startTime
    const rawContent = response.content[0]?.type === 'text'
      ? response.content[0].text
      : ''

    if (!rawContent) {
      throw new Error('No content generated by Claude')
    }

    // Log usage for monitoring
    const tokenUsage = response.usage
    console.log(`Extension generation [${authResult.email}]: ${tokenUsage.input_tokens + tokenUsage.output_tokens} tokens, ${processingTime}ms`)

    const rateLimitHeaders = {
      'X-RateLimit-Limit': String(DAILY_LIMIT),
      'X-RateLimit-Remaining': String(rateCheck.remainingRequests),
      'X-RateLimit-Reset': String(rateCheck.resetTime)
    }

    // Parse response based on category with validation
    if (category === 'cold_email' || category === 'linkedin_inmail') {
      try {
        const parsed = JSON.parse(rawContent)

        if (parsed.subject_line && parsed.body) {
          const basicSubjectSanitization = sanitize(parsed.subject_line)
          const basicBodySanitization = sanitize(parsed.body)

          const enhancedSubjectSanitization = await sanitizeForLinkedIn(basicSubjectSanitization)
          const enhancedBodySanitization = await sanitizeForLinkedIn(basicBodySanitization)

          const sanitizedSubject = enhancedSubjectSanitization.success ? enhancedSubjectSanitization.sanitizedContent : basicSubjectSanitization
          const sanitizedBody = enhancedBodySanitization.success ? enhancedBodySanitization.sanitizedContent : basicBodySanitization

          const subjectHasAI = enhancedSubjectSanitization.isAIGenerated
          const bodyHasAI = enhancedBodySanitization.isAIGenerated

          if (subjectHasAI || bodyHasAI) {
            console.warn('AI fingerprints detected in Chrome extension generation:', {
              subject: subjectHasAI ? {
                confidence: enhancedSubjectSanitization.aiFingerprints?.confidence,
                patterns: enhancedSubjectSanitization.aiFingerprints?.detectedPatterns,
                authenticityScore: enhancedSubjectSanitization.authenticityScore
              } : null,
              body: bodyHasAI ? {
                confidence: enhancedBodySanitization.aiFingerprints?.confidence,
                patterns: enhancedBodySanitization.aiFingerprints?.detectedPatterns,
                authenticityScore: enhancedBodySanitization.authenticityScore
              } : null,
              category: validatedData.category
            })
          }

          const wordCount = parsed.word_count || countWords(sanitizedBody)

          const maxWords = category === 'cold_email' ? 150 : 120

          let finalBody = sanitizedBody
          if (wordCount > maxWords) {
            console.warn(`${category} exceeds word limit: ${wordCount} > ${maxWords}`)
            finalBody = truncateToWordLimit(sanitizedBody, maxWords)
          }

          return NextResponse.json({
            success: true,
            subject_line: sanitizedSubject,
            body: finalBody,
            category,
            word_count: countWords(finalBody),
            character_count: finalBody.length,
            validation: {
              word_limit_passed: countWords(finalBody) <= maxWords,
              sanitization_applied: parsed.subject_line !== sanitizedSubject || parsed.body !== sanitizedBody,
              ai_patterns_detected: subjectHasAI || bodyHasAI,
              json_parsing_successful: true
            },
            usage: tokenUsage,
            processingTime
          }, {
            headers: { ...corsHeaders, ...rateLimitHeaders }
          })
        }
      } catch (parseError) {
        console.warn('Failed to parse JSON response, attempting fallback sanitization and parsing:', parseError)

        const basicSanitization = sanitize(rawContent)
        const enhancedSanitization = await sanitizeForLinkedIn(basicSanitization)
        const sanitizedContent = enhancedSanitization.success ? enhancedSanitization.sanitizedContent : basicSanitization

        if (enhancedSanitization.isAIGenerated) {
          console.warn('AI fingerprints detected in fallback processing:', {
            confidence: enhancedSanitization.aiFingerprints?.confidence,
            patterns: enhancedSanitization.aiFingerprints?.detectedPatterns,
            authenticityScore: enhancedSanitization.authenticityScore,
            category: validatedData.category
          })
        }

        const subject = extractSubjectFromText(sanitizedContent)
        const body = extractBodyFromText(sanitizedContent)

        return NextResponse.json({
          success: true,
          subject_line: subject,
          body: body,
          category,
          word_count: countWords(body),
          character_count: body.length,
          validation: {
            word_limit_passed: false,
            sanitization_applied: rawContent !== sanitizedContent,
            ai_patterns_detected: enhancedSanitization.isAIGenerated,
            json_parsing_successful: false,
            fallback_parsing: true
          },
          usage: tokenUsage,
          processingTime
        }, {
          headers: { ...corsHeaders, ...rateLimitHeaders }
        })
      }
    }

    // For LinkedIn connections - apply AI fingerprint detection and sanitization
    const basicSanitization = sanitize(rawContent)
    const enhancedSanitization = await sanitizeForLinkedIn(basicSanitization)
    const sanitizedContent = enhancedSanitization.success ? enhancedSanitization.sanitizedContent : basicSanitization

    if (enhancedSanitization.isAIGenerated) {
      console.warn('AI fingerprints detected in LinkedIn connection generation:', {
        confidence: enhancedSanitization.aiFingerprints?.confidence,
        patterns: enhancedSanitization.aiFingerprints?.detectedPatterns,
        authenticityScore: enhancedSanitization.authenticityScore,
        category: validatedData.category
      })
    }

    // Apply smart character limit preserving the OPEN sentence
    let finalContent = sanitizedContent
    let wasTruncated = false
    const originalLength = sanitizedContent.length

    if (finalContent.length > 300) {
      console.warn(`LinkedIn connection exceeds character limit: ${finalContent.length} > 300`)

      const sentences = finalContent.match(/[^.!?]+[.!?]+/g) || [finalContent]

      if (sentences.length >= 3) {
        const withoutHook = sentences.slice(1).join(' ').trim()
        if (withoutHook.length <= 300) {
          finalContent = withoutHook
          wasTruncated = true
        } else {
          const lastSentence = sentences[sentences.length - 1]?.trim() ?? ''
          if (lastSentence.length > 0 && lastSentence.length <= 300) {
            finalContent = lastSentence
            wasTruncated = true
          } else {
            finalContent = finalContent.substring(0, 297) + '...'
            wasTruncated = true
          }
        }
      } else if (sentences.length === 2) {
        const secondSentence = sentences[1]?.trim() ?? ''
        const firstTrimmed = (sentences[0] ?? '').substring(0, 300 - secondSentence.length - 2).trim()
        const combined = firstTrimmed + '. ' + secondSentence
        if (combined.length <= 300) {
          finalContent = combined
          wasTruncated = true
        } else {
          finalContent = finalContent.substring(0, 297) + '...'
          wasTruncated = true
        }
      } else {
        finalContent = finalContent.substring(0, 297) + '...'
        wasTruncated = true
      }
    }

    return NextResponse.json({
      success: true,
      body: finalContent,
      category,
      character_count: finalContent.length,
      validation: {
        character_limit_passed: true,
        original_length: originalLength,
        truncated: wasTruncated,
        sanitization_applied: rawContent !== sanitizedContent
      },
      usage: tokenUsage,
      processingTime
    }, {
      headers: { ...corsHeaders, ...rateLimitHeaders }
    })

  } catch (error) {
    console.error('Extension generation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors[0]?.message
      }, { status: 400, headers: getCorsHeaders(request) })
    }

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'Anthropic API authentication failed'
        }, { status: 500, headers: getCorsHeaders(request) })
      }

      if (error.status === 429) {
        return NextResponse.json({
          success: false,
          error: 'Rate limit exceeded, please try again later'
        }, { status: 429, headers: getCorsHeaders(request) })
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to generate content'
    }, { status: 500, headers: getCorsHeaders(request) })
  }
}

// Utility functions
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

function truncateToWordLimit(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}

function extractSubjectFromText(content: string): string {
  const subjectMatch = content.match(/(?:Subject|SUBJECT):\s*(.+)/i)
  if (subjectMatch?.[1]) return subjectMatch[1].trim()
  const firstLine = content.split('\n')[0]?.trim()
  return firstLine || 'Quick connect'
}

function extractBodyFromText(content: string): string {
  let body = content.replace(/(?:Subject|SUBJECT):\s*(.+)\n?/i, '')
  return body.trim()
}

// GET endpoint for health check with Bearer token validation
export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request)

  try {
    // Auth check
    const authResult = await authenticateRequest(request)
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid Bearer token required' },
        { status: 401, headers: corsHeaders }
      )
    }

    return NextResponse.json({
      service: 'Ascendia Extension API',
      version: '2.0.0',
      endpoints: {
        generate: 'POST /api/extension/generate'
      },
      status: 'healthy',
      authenticated: true,
      user: authResult.email
    }, {
      headers: corsHeaders
    })

  } catch (error) {
    console.error('GET endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(request),
      'Access-Control-Max-Age': '86400',
    },
  })
}
