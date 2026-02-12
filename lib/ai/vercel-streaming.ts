// Vercel AI SDK Streaming Integration
// Created: January 2025
// Purpose: Replace manual Anthropic calls with Vercel AI SDK for better streaming

import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

// Model configuration with tiering
export const ModelConfig = {
  // Fast & Cheap - Use for grammar, context analysis
  HAIKU: {
    model: 'claude-3-haiku-20240307',
    costPer1k: 0.00025,
    avgLatency: 500, // ms
    useFor: ['grammar_fix', 'context_analysis', 'quick_scoring']
  },

  // High Quality - Use for adaptive polish
  SONNET: {
    model: 'claude-sonnet-4-20250514',
    costPer1k: 0.003,
    avgLatency: 2000, // ms
    useFor: ['adaptive_polish', 'complex_reasoning']
  },

  // Premium (Optional) - For critical documents
  OPUS: {
    model: 'claude-3-opus-20240229',
    costPer1k: 0.015,
    avgLatency: 3000, // ms
    useFor: ['premium_users', 'critical_documents']
  }
} as const

// Input validation schema
const streamRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  model: z.enum(['haiku', 'sonnet', 'opus']).default('sonnet'),
  maxTokens: z.number().default(1000),
  temperature: z.number().min(0).max(1).default(0.7),
  systemPrompt: z.string().optional(),
})

export type StreamRequest = z.infer<typeof streamRequestSchema>

/**
 * Create a grammar fix stream using Haiku (fast model)
 */
export async function createGrammarStream(
  text: string,
  userId?: string
) {
  const systemPrompt = `You are an expert grammar checker. Your task is to:
1. Fix all grammar, spelling, and punctuation errors
2. Preserve the original tone, style, and voice
3. Make minimal changes - only fix actual errors
4. DO NOT change the writing style or add new content

Return only the corrected text without explanations.`

  try {
    const result = await streamText({
      model: anthropic(ModelConfig.HAIKU.model),
      prompt: text,
      system: systemPrompt,
      maxTokens: 1000,
      temperature: 0.2, // Low temperature for consistency
      abortSignal: AbortSignal.timeout(10000), // 10 second timeout
    })

    return {
      stream: result.textStream,
      usage: result.usage,
      modelUsed: 'haiku',
      estimatedCost: calculateCost('haiku', await result.usage),
    }
  } catch (error) {
    console.error('Grammar stream error:', error)
    throw new Error('Failed to create grammar stream')
  }
}

/**
 * Create an adaptive polish stream using Sonnet (quality model)
 */
export async function createAdaptivePolishStream(
  text: string,
  userContext: {
    userId: string
    baseline?: any
    category?: string
    targetCPL?: number
  }
) {
  const systemPrompt = `You are an expert writing coach specializing in personalized content improvement.

User Context:
- Writing Style: ${userContext.baseline?.style || 'general'}
- Formality Level: ${userContext.baseline?.formality || 0.5}
- Target CPL: ${userContext.targetCPL || 75}
- Category: ${userContext.category || 'general'}

Your task:
1. Enhance the text while preserving the author's unique voice
2. Improve clarity, flow, and engagement
3. Fix any remaining grammar issues naturally
4. Ensure the content meets the target CPL score
5. Maintain the author's preferred vocabulary level

Return only the enhanced text without explanations.`

  try {
    const result = await streamText({
      model: anthropic(ModelConfig.SONNET.model),
      prompt: text,
      system: systemPrompt,
      maxTokens: 1500,
      temperature: 0.7, // Balanced for creativity
      abortSignal: AbortSignal.timeout(20000), // 20 second timeout
    })

    return {
      stream: result.textStream,
      usage: result.usage,
      modelUsed: 'sonnet',
      estimatedCost: calculateCost('sonnet', await result.usage),
    }
  } catch (error) {
    console.error('Polish stream error:', error)
    throw new Error('Failed to create polish stream')
  }
}

/**
 * Create a parallel processing stream with both grammar and polish
 */
export async function createParallelStreams(
  text: string,
  userContext: any
) {
  // Start both operations in parallel
  const [grammarResult, contextData] = await Promise.all([
    createGrammarStream(text, userContext.userId),
    fetchUserContext(userContext.userId), // This would be imported from your context service
  ])

  // Use grammar-fixed text for polish
  let grammarFixedText = ''
  for await (const chunk of grammarResult.stream) {
    grammarFixedText += chunk
  }

  // Now create polish stream with grammar-fixed text
  const polishResult = await createAdaptivePolishStream(
    grammarFixedText,
    {
      ...userContext,
      baseline: contextData,
    }
  )

  return {
    grammarStream: grammarResult,
    polishStream: polishResult,
    totalEstimatedCost: grammarResult.estimatedCost + polishResult.estimatedCost,
  }
}

/**
 * Create a CPL analysis stream using Haiku (fast model)
 */
export async function createCPLAnalysisStream(text: string) {
  const systemPrompt = `Analyze this text for Content Polish Level (CPL).

Scoring Framework (1-100):
- Grammar & Mechanics (20%)
- Clarity & Structure (25%)
- Style & Voice (20%)
- Engagement & Impact (20%)
- Vocabulary (15%)

Return JSON only:
{
  "score": number,
  "breakdown": {
    "grammar": number,
    "clarity": number,
    "style": number,
    "engagement": number,
    "vocabulary": number
  },
  "suggestions": ["suggestion1", "suggestion2"]
}`

  try {
    const result = await streamText({
      model: anthropic(ModelConfig.HAIKU.model),
      prompt: text,
      system: systemPrompt,
      maxTokens: 500,
      temperature: 0.3, // Low for consistent scoring
      abortSignal: AbortSignal.timeout(5000), // 5 second timeout
    })

    return {
      stream: result.textStream,
      usage: result.usage,
      modelUsed: 'haiku',
      estimatedCost: calculateCost('haiku', await result.usage),
    }
  } catch (error) {
    console.error('CPL analysis error:', error)
    throw new Error('Failed to create CPL analysis stream')
  }
}

/**
 * Calculate estimated cost based on model and usage
 */
function calculateCost(
  model: 'haiku' | 'sonnet' | 'opus',
  usage: { promptTokens: number; completionTokens: number }
): number {
  const config = {
    haiku: ModelConfig.HAIKU,
    sonnet: ModelConfig.SONNET,
    opus: ModelConfig.OPUS,
  }[model]

  const totalTokens = usage.promptTokens + usage.completionTokens
  return (totalTokens / 1000) * config.costPer1k
}

/**
 * Fetch user context (placeholder - integrate with your actual service)
 */
async function fetchUserContext(userId: string): Promise<any> {
  // This would connect to your Supabase or context service
  // For now, returning a placeholder
  return {
    style: 'professional',
    formality: 0.75,
    averageSentenceLength: 18,
    vocabularyLevel: 'advanced',
  }
}

// Export utility for creating streaming responses
export { StreamingTextResponse } from 'ai'