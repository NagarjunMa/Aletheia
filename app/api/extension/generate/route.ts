import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  getSystemPrompt,
  buildPrompt,
  sanitize,
  type GenerateInput
} from '@/lib/ai/prompts/linkedin-connection'
import type { StylePatterns } from '@/lib/ai/style-analyzer'
import { sanitizeForLinkedIn, stripSurrogates } from '@/lib/ai/sanitizer'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { getCorsHeaders } from '@/lib/cors'

const log = createLogger('extension-generate')

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
    log.info('No Bearer token in Authorization header')
    return null
  }

  const accessToken = authHeader.slice(7)
  log.debug({ tokenPrefix: accessToken.substring(0, 8) }, 'Validating access token')
  const { data: { user }, error } = await supabaseAuth.auth.getUser(accessToken)

  if (error || !user) {
    log.info({ err: error?.message }, 'Token validation failed')
    return null
  }

  log.info({ userId: user.id.substring(0, 8) }, 'Authenticated')
  return { userId: user.id, email: '' }
}

// ─── Persistent rate limiting via Supabase ───

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remainingRequests: number; resetTime: number }> {
  const { data, error } = await supabaseService.rpc('check_and_increment_rate_limit', {
    p_user_id: userId,
    p_daily_limit: DAILY_LIMIT
  })

  if (error || !data || data.length === 0) {
    log.error({ err: error }, 'Rate limit RPC error — failing open')
    return { allowed: true, remainingRequests: DAILY_LIMIT - 1, resetTime: Date.now() + 86400000 }
  }

  const row = data[0]
  return {
    allowed: row.allowed,
    remainingRequests: row.remaining,
    resetTime: new Date(row.reset_time).getTime()
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
  const corsHeaders = getCorsHeaders(request, { allowCredentials: true, methods: 'GET, POST, OPTIONS' })

  try {
    // 1. Auth check FIRST (before rate limiting)
    const authResult = await authenticateRequest(request)
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid Bearer token required' },
        { status: 401, headers: corsHeaders }
      )
    }

    // 2. Fetch user style profile (non-blocking — failure just skips learned style)
    let styleProfile: StylePatterns | undefined
    try {
      const { data: prefs } = await supabaseService
        .from('user_preferences')
        .select('style_patterns, approved_message_count')
        .eq('user_id', authResult.userId)
        .maybeSingle()

      if (prefs && (prefs.approved_message_count ?? 0) >= 3 && prefs.style_patterns) {
        styleProfile = prefs.style_patterns as unknown as StylePatterns
        log.debug({ approvedCount: prefs.approved_message_count }, 'Using learned style profile')
      }
    } catch (err) {
      log.warn({ err }, 'Failed to fetch style profile, continuing without it')
    }

    // 3. Rate limiting (per user, persistent)
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

    // Sanitize all user-provided strings to strip unpaired Unicode surrogates
    // that cause JSON serialization failures with the Anthropic API
    const sanitizedProfile = {
      ...profile,
      name: stripSurrogates(profile.name),
      headline: profile.headline ? stripSurrogates(profile.headline) : profile.headline,
      location: profile.location ? stripSurrogates(profile.location) : profile.location,
      about: profile.about ? stripSurrogates(profile.about) : profile.about,
      experiences: profile.experiences?.map(e => ({
        title: stripSurrogates(e.title),
        company: e.company ? stripSurrogates(e.company) : e.company,
      })),
      recentPosts: profile.recentPosts?.map(p => stripSurrogates(p)),
      skills: profile.skills?.map(s => stripSurrogates(s)),
    }
    const sanitizedResume = resume ? stripSurrogates(resume).slice(0, 8000) : resume
    const sanitizedJd = jd ? stripSurrogates(jd).slice(0, 4000) : jd
    const sanitizedExamples = acceptedExamples?.map(e => stripSurrogates(e))

    // Use new prompt system
    const systemPrompt = getSystemPrompt(category)
    const promptInput: GenerateInput = {
      profile: {
        name: sanitizedProfile.name,
        headline: sanitizedProfile.headline || '',
        location: sanitizedProfile.location || '',
        about: sanitizedProfile.about || '',
        experiences: (sanitizedProfile.experiences || []).map(e => ({ title: e.title, company: e.company || '' })),
        recentPosts: sanitizedProfile.recentPosts || [],
        skills: sanitizedProfile.skills || []
      },
      resume: sanitizedResume || '',
      jd: sanitizedJd || '',
      category,
      intent: intent || 'networking',
      acceptedExamples: sanitizedExamples || [],
    }
    if (styleProfile) {
      promptInput.styleProfile = styleProfile
    }
    const userPrompt = buildPrompt(promptInput)

    // Generate content using Claude
    const startTime = Date.now()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
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
    log.info({ userId: authResult.userId.substring(0, 8), tokens: tokenUsage.input_tokens + tokenUsage.output_tokens, processingTime }, 'Generation completed')

    const rateLimitHeaders = {
      'X-RateLimit-Limit': String(DAILY_LIMIT),
      'X-RateLimit-Remaining': String(rateCheck.remainingRequests),
      'X-RateLimit-Reset': String(rateCheck.resetTime)
    }

    // Parse response based on category with validation
    if (category === 'cold_email' || category === 'linkedin_inmail') {
      try {
        const cleanedContent = stripMarkdownCodeFences(rawContent)
        const parsed = JSON.parse(cleanedContent)

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
            log.warn({
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
            }, 'AI fingerprints detected in Chrome extension generation')
          }

          const wordCount = parsed.word_count || countWords(sanitizedBody)

          const maxWords = category === 'cold_email' ? 150 : 120

          let finalBody = sanitizedBody
          if (wordCount > maxWords) {
            log.warn({ category, wordCount, maxWords }, 'Category exceeds word limit')
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
        log.warn({ err: parseError }, 'Failed to parse JSON response, attempting fallback')

        const basicSanitization = sanitize(rawContent)
        const enhancedSanitization = await sanitizeForLinkedIn(basicSanitization)
        const sanitizedContent = enhancedSanitization.success ? enhancedSanitization.sanitizedContent : basicSanitization

        if (enhancedSanitization.isAIGenerated) {
          log.warn({
            confidence: enhancedSanitization.aiFingerprints?.confidence,
            patterns: enhancedSanitization.aiFingerprints?.detectedPatterns,
            authenticityScore: enhancedSanitization.authenticityScore,
            category: validatedData.category
          }, 'AI fingerprints detected in fallback processing')
        }

        // Try JSON parse on sanitized content (fence-stripped) before falling through to regex
        try {
          const cleanedSanitized = stripMarkdownCodeFences(sanitizedContent)
          const parsedFallback = JSON.parse(cleanedSanitized)
          if (parsedFallback.subject_line && parsedFallback.body) {
            const maxWords = category === 'cold_email' ? 150 : 120
            const wordCount = parsedFallback.word_count || countWords(parsedFallback.body)
            let finalBody = parsedFallback.body
            if (wordCount > maxWords) {
              finalBody = truncateToWordLimit(finalBody, maxWords)
            }
            return NextResponse.json({
              success: true,
              subject_line: parsedFallback.subject_line,
              body: finalBody,
              category,
              word_count: countWords(finalBody),
              character_count: finalBody.length,
              validation: {
                word_limit_passed: countWords(finalBody) <= maxWords,
                sanitization_applied: true,
                ai_patterns_detected: enhancedSanitization.isAIGenerated,
                json_parsing_successful: true,
                fallback_json_recovery: true
              },
              usage: tokenUsage,
              processingTime
            }, {
              headers: { ...corsHeaders, ...rateLimitHeaders }
            })
          }
        } catch {
          // JSON recovery failed, fall through to regex extraction
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
      log.warn({
        confidence: enhancedSanitization.aiFingerprints?.confidence,
        patterns: enhancedSanitization.aiFingerprints?.detectedPatterns,
        authenticityScore: enhancedSanitization.authenticityScore,
        category: validatedData.category
      }, 'AI fingerprints detected in LinkedIn connection generation')
    }

    // Apply smart character limit preserving the OPEN sentence
    let finalContent = sanitizedContent
    let wasTruncated = false
    const originalLength = sanitizedContent.length

    if (finalContent.length > 300) {
      log.warn({ length: finalContent.length, limit: 300 }, 'LinkedIn connection exceeds character limit')

      // Smart truncation: find the last sentence boundary (period) within 300 chars
      const within300 = finalContent.substring(0, 300)
      const lastPeriod = within300.lastIndexOf('.')

      if (lastPeriod > 150) {
        // Cut at the last complete sentence
        finalContent = finalContent.substring(0, lastPeriod + 1).trim()
      } else {
        // Fallback: cut at last word boundary to avoid chopping mid-word
        const lastSpace = within300.lastIndexOf(' ')
        finalContent = finalContent.substring(0, lastSpace > 0 ? lastSpace : 297).trim()
      }

      wasTruncated = true
      log.info({ truncatedLength: finalContent.length }, 'LinkedIn message truncated at sentence boundary')
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
    log.error({ err: error }, 'Extension generation error')

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request'
      }, { status: 400, headers: getCorsHeaders(request, { allowCredentials: true, methods: 'GET, POST, OPTIONS' }) })
    }

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'Anthropic API authentication failed'
        }, { status: 500, headers: getCorsHeaders(request, { allowCredentials: true, methods: 'GET, POST, OPTIONS' }) })
      }

      if (error.status === 429) {
        return NextResponse.json({
          success: false,
          error: 'Rate limit exceeded, please try again later'
        }, { status: 429, headers: getCorsHeaders(request, { allowCredentials: true, methods: 'GET, POST, OPTIONS' }) })
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to generate content'
    }, { status: 500, headers: getCorsHeaders(request, { allowCredentials: true, methods: 'GET, POST, OPTIONS' }) })
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
  const body = content.replace(/(?:Subject|SUBJECT):\s*(.+)\n?/i, '')
  return body.trim()
}

function stripMarkdownCodeFences(content: string): string {
  const trimmed = content.trim()
  const match = trimmed.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?\s*```$/)
  return match?.[1] ? match[1].trim() : trimmed
}

// GET endpoint for health check with Bearer token validation
export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, { allowCredentials: true, methods: 'GET, POST, OPTIONS' })

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
      service: 'Aletheia Extension API',
      version: '2.0.0',
      endpoints: {
        generate: 'POST /api/extension/generate'
      },
      status: 'healthy',
      authenticated: true,
      user: authResult.userId.substring(0, 8)
    }, {
      headers: corsHeaders
    })

  } catch (error) {
    log.error({ err: error }, 'GET endpoint error')
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
      ...getCorsHeaders(request, { allowCredentials: true, methods: 'GET, POST, OPTIONS' }),
      'Access-Control-Max-Age': '86400',
    },
  })
}
