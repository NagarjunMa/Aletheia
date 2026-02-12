// Anthropic Claude API Integration
// Created: December 7, 2024
// Purpose: Core Claude API integration with error handling and streaming

import Anthropic from '@anthropic-ai/sdk'
import { aiProcessingSchema, cplAnalysisSchema, type AIProcessing } from '@/lib/validations/schemas'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Claude model configuration
export const CLAUDE_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
  topP: 0.9,
} as const

// AI processing types
export type ProcessingType = 'grammar_fix' | 'adaptive_polish' | 'cpl_analysis'

export interface AIResponse {
  success: boolean
  content?: string
  cplScore?: number
  analysis?: CPLAnalysis
  error?: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  processingTime?: number
}

export interface CPLAnalysis {
  score: number
  breakdown: {
    grammar: number
    clarity: number
    style: number
    engagement: number
    structure: number
  }
  suggestions: string[]
  strengths: string[]
  improvements: string[]
}

// System prompts for different processing types
const SYSTEM_PROMPTS = {
  grammar_fix: `You are an expert grammar and spelling checker. Your task is to:

1. Fix all grammar, spelling, and punctuation errors
2. Preserve the original tone, style, and voice
3. Maintain the exact same meaning and intent
4. Keep the same structure and formatting
5. Make minimal changes - only fix actual errors

Rules:
- DO NOT change the writing style or tone
- DO NOT add new content or elaborate
- DO NOT change the structure or flow
- Only fix clear errors in grammar, spelling, and punctuation
- Preserve all intentional stylistic choices

Return only the corrected text without explanations.`,

  adaptive_polish: `You are an expert writing coach specializing in personalized content improvement. Your task is to enhance the given text while preserving the author's unique voice and style.

Your approach:
1. Analyze the author's natural writing style, tone, and voice
2. Improve clarity, flow, and engagement while maintaining their style
3. Fix grammar and spelling errors naturally
4. Enhance word choice and sentence structure appropriately
5. Ensure the Content Polish Level (CPL) meets the target while staying authentic

Guidelines for CPL scoring (1-100):
- 1-20: Very informal, many errors, unclear structure
- 21-40: Casual writing, some errors, basic structure
- 41-60: Clear communication, minor errors, good structure
- 61-80: Polished writing, minimal errors, strong structure
- 81-100: Highly refined, error-free, excellent flow and engagement

Preserve:
- The author's unique voice and personality
- Their preferred vocabulary level
- Their natural sentence patterns
- The core message and intent
- Any intentional stylistic choices

Return only the enhanced text without explanations.`,

  cpl_analysis: `You are an expert writing analyst specializing in Content Polish Level (CPL) assessment. Analyze the provided text and provide a comprehensive CPL evaluation.

CPL Scoring Framework (1-100):

**Grammar & Mechanics (20%)**
- 90-100: Perfect grammar, spelling, punctuation
- 70-89: Minor errors that don't impede understanding
- 50-69: Some errors that occasionally confuse meaning
- 30-49: Frequent errors that impede readability
- 1-29: Many errors that significantly hinder comprehension

**Clarity & Structure (25%)**
- 90-100: Crystal clear, excellent logical flow
- 70-89: Clear with strong organization
- 50-69: Generally clear with minor organizational issues
- 30-49: Somewhat unclear, structural problems
- 1-29: Confusing, poor organization

**Style & Voice (20%)**
- 90-100: Distinctive, engaging, perfectly matched to audience
- 70-89: Strong style, appropriate tone
- 50-69: Adequate style, generally appropriate
- 30-49: Inconsistent or inappropriate style
- 1-29: Poor style, inappropriate for audience

**Engagement & Impact (20%)**
- 90-100: Highly engaging, memorable, compelling
- 70-89: Engaging with good impact
- 50-69: Moderately engaging
- 30-49: Limited engagement
- 1-29: Not engaging, forgettable

**Vocabulary & Word Choice (15%)**
- 90-100: Precise, varied, sophisticated word choice
- 70-89: Good vocabulary, mostly precise
- 50-69: Adequate vocabulary
- 30-49: Limited or imprecise vocabulary
- 1-29: Poor word choice, very limited vocabulary

Provide your analysis in this JSON format:
{
  "score": number (1-100),
  "breakdown": {
    "grammar": number (1-100),
    "clarity": number (1-100),
    "style": number (1-100),
    "engagement": number (1-100),
    "vocabulary": number (1-100)
  },
  "suggestions": ["specific improvement suggestion 1", "suggestion 2"],
  "strengths": ["identified strength 1", "strength 2"],
  "improvements": ["area for improvement 1", "area 2"]
}`
} as const

// Main Claude processing function
export async function processWithClaude(
  text: string,
  processingType: ProcessingType,
  options?: {
    targetCpl?: number
    preserveTone?: boolean
    preserveLength?: boolean
    userPreferences?: Record<string, any>
    context?: Record<string, any>
  }
): Promise<AIResponse> {
  const startTime = Date.now()

  try {
    // Validate input
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: 'Input text is required',
      }
    }

    if (text.length > 10000) {
      return {
        success: false,
        error: 'Text too long (max 10,000 characters)',
      }
    }

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        success: false,
        error: 'Anthropic API key not configured',
      }
    }

    // Build the appropriate prompt
    const systemPrompt = SYSTEM_PROMPTS[processingType]
    let userPrompt = text

    // Add context for adaptive polish
    if (processingType === 'adaptive_polish' && options) {
      const contextParts = []

      if (options.targetCpl) {
        contextParts.push(`Target CPL Score: ${options.targetCpl}`)
      }

      if (options.userPreferences?.writing_style) {
        contextParts.push(`User's preferred style: ${options.userPreferences.writing_style}`)
      }

      if (options.preserveTone) {
        contextParts.push('Important: Preserve the author\'s original tone and voice')
      }

      if (options.preserveLength) {
        contextParts.push('Important: Maintain similar length to original')
      }

      if (contextParts.length > 0) {
        userPrompt = `${contextParts.join('\n')}\n\nText to enhance:\n${text}`
      }
    }

    // Make API call to Claude
    const response = await anthropic.messages.create({
      model: CLAUDE_CONFIG.model,
      max_tokens: CLAUDE_CONFIG.maxTokens,
      temperature: processingType === 'cpl_analysis' ? 0.3 : CLAUDE_CONFIG.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    const processingTime = Date.now() - startTime

    // Extract response content
    const content = response.content[0]
    if (content.type !== 'text') {
      return {
        success: false,
        error: 'Unexpected response format from Claude',
      }
    }

    const responseText = content.text

    // Handle CPL analysis response
    if (processingType === 'cpl_analysis') {
      try {
        // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json...```)
        let jsonText = responseText.trim()
        if (jsonText.startsWith('```')) {
          // Remove opening ```json or ``` and closing ```
          jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
        }
        const analysis = JSON.parse(jsonText) as CPLAnalysis
        return {
          success: true,
          analysis,
          cplScore: analysis.score,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          },
          processingTime,
        }
      } catch (parseError) {
        console.error('CPL analysis parsing error:', parseError)
        return {
          success: false,
          error: 'Failed to parse CPL analysis',
        }
      }
    }

    // For other processing types, return the enhanced text
    return {
      success: true,
      content: responseText.trim(),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      processingTime,
    }
  } catch (error: any) {
    const processingTime = Date.now() - startTime

    console.error('Claude API error:', error)

    // Handle specific API errors
    if (error.status === 400) {
      return {
        success: false,
        error: 'Invalid request to Claude API',
        processingTime,
      }
    }

    if (error.status === 401) {
      return {
        success: false,
        error: 'Invalid API key or authentication failed',
        processingTime,
      }
    }

    if (error.status === 429) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        processingTime,
      }
    }

    if (error.status === 500) {
      return {
        success: false,
        error: 'Claude API server error. Please try again.',
        processingTime,
      }
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        error: 'Network error. Please check your connection.',
        processingTime,
      }
    }

    return {
      success: false,
      error: 'An unexpected error occurred while processing with Claude',
      processingTime,
    }
  }
}

// Streaming version for real-time processing
export async function* streamWithClaude(
  text: string,
  processingType: ProcessingType,
  options?: {
    targetCpl?: number
    preserveTone?: boolean
    preserveLength?: boolean
    userPreferences?: Record<string, any>
  }
): AsyncGenerator<{ type: 'content' | 'error' | 'done'; content?: string; error?: string }> {
  try {
    // Validate input
    if (!text || text.trim().length === 0) {
      yield { type: 'error', error: 'Input text is required' }
      return
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      yield { type: 'error', error: 'Anthropic API key not configured' }
      return
    }

    // CPL analysis doesn't support streaming
    if (processingType === 'cpl_analysis') {
      const result = await processWithClaude(text, processingType, options)
      if (result.success && result.analysis) {
        yield { type: 'content', content: JSON.stringify(result.analysis, null, 2) }
      } else {
        yield { type: 'error', error: result.error }
      }
      yield { type: 'done' }
      return
    }

    // Build the appropriate prompt
    const systemPrompt = SYSTEM_PROMPTS[processingType]
    let userPrompt = text

    // Add context for adaptive polish
    if (processingType === 'adaptive_polish' && options) {
      const contextParts = []

      if (options.targetCpl) {
        contextParts.push(`Target CPL Score: ${options.targetCpl}`)
      }

      if (options.userPreferences?.writing_style) {
        contextParts.push(`User's preferred style: ${options.userPreferences.writing_style}`)
      }

      if (options.preserveTone) {
        contextParts.push('Important: Preserve the author\'s original tone and voice')
      }

      if (options.preserveLength) {
        contextParts.push('Important: Maintain similar length to original')
      }

      if (contextParts.length > 0) {
        userPrompt = `${contextParts.join('\n')}\n\nText to enhance:\n${text}`
      }
    }

    // Create streaming request
    const stream = await anthropic.messages.create({
      model: CLAUDE_CONFIG.model,
      max_tokens: CLAUDE_CONFIG.maxTokens,
      temperature: CLAUDE_CONFIG.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      stream: true,
    })

    // Process streaming response
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield { type: 'content', content: chunk.delta.text }
      } else if (chunk.type === 'message_stop') {
        yield { type: 'done' }
        break
      } else if (chunk.type === 'error') {
        yield { type: 'error', error: 'Streaming error occurred' }
        break
      }
    }
  } catch (error: any) {
    console.error('Claude streaming error:', error)
    yield { type: 'error', error: 'Streaming failed: ' + (error.message || 'Unknown error') }
  }
}

// Utility functions
export function calculateCPLScore(analysis: CPLAnalysis): number {
  const weights = {
    grammar: 0.2,
    clarity: 0.25,
    style: 0.2,
    engagement: 0.2,
    vocabulary: 0.15,
  }

  return Math.round(
    analysis.breakdown.grammar * weights.grammar +
    analysis.breakdown.clarity * weights.clarity +
    analysis.breakdown.style * weights.style +
    analysis.breakdown.engagement * weights.engagement +
    analysis.breakdown.vocabulary * weights.vocabulary
  )
}

export function validateApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')
}

export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4)
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  // Claude 3.5 Sonnet pricing (as of 2024)
  const inputCostPer1K = 0.003 // $3 per 1M tokens
  const outputCostPer1K = 0.015 // $15 per 1M tokens

  return (
    (inputTokens / 1000) * inputCostPer1K +
    (outputTokens / 1000) * outputCostPer1K
  )
}