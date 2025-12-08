import { Anthropic } from '@anthropic-ai/sdk'

interface ClaudeRequest {
  system: string
  user: string
  model?: string
  maxTokens?: number
  temperature?: number
}

interface ClaudeResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  success: boolean
  error?: string
}

export class ClaudeService {
  private anthropic: Anthropic
  private static instance: ClaudeService | null = null

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  }

  static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService()
    }
    return ClaudeService.instance
  }

  async generateResponse(request: ClaudeRequest): Promise<ClaudeResponse> {
    try {
      const response = await this.anthropic.messages.create({
        model: request.model || 'claude-3-sonnet-20240229',
        max_tokens: request.maxTokens || 2000,
        temperature: request.temperature || 0.7,
        system: request.system,
        messages: [{
          role: 'user',
          content: request.user
        }]
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API')
      }

      return {
        content: content.text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        },
        success: true
      }
    } catch (error) {
      console.error('Claude API error:', error)

      let errorMessage = 'Failed to generate response'

      if (error instanceof Error) {
        // Handle specific Anthropic errors
        if (error.message.includes('rate_limit')) {
          errorMessage = 'Rate limit exceeded. Please try again later.'
        } else if (error.message.includes('invalid_request')) {
          errorMessage = 'Invalid request parameters.'
        } else if (error.message.includes('authentication')) {
          errorMessage = 'Authentication failed. Please check API key.'
        } else {
          errorMessage = error.message
        }
      }

      return {
        content: '',
        success: false,
        error: errorMessage
      }
    }
  }

  async generateStreamingResponse(
    request: ClaudeRequest,
    onChunk?: (chunk: string) => void
  ): Promise<ClaudeResponse> {
    try {
      const stream = await this.anthropic.messages.stream({
        model: request.model || 'claude-3-sonnet-20240229',
        max_tokens: request.maxTokens || 2000,
        temperature: request.temperature || 0.7,
        system: request.system,
        messages: [{
          role: 'user',
          content: request.user
        }]
      })

      let fullContent = ''
      let inputTokens = 0
      let outputTokens = 0

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text
          fullContent += text

          if (onChunk) {
            onChunk(text)
          }
        } else if (chunk.type === 'message_start') {
          inputTokens = chunk.message.usage.input_tokens
        } else if (chunk.type === 'message_delta') {
          outputTokens = chunk.usage.output_tokens
        }
      }

      return {
        content: fullContent,
        usage: {
          inputTokens,
          outputTokens
        },
        success: true
      }
    } catch (error) {
      console.error('Claude streaming error:', error)

      let errorMessage = 'Failed to generate streaming response'

      if (error instanceof Error) {
        errorMessage = error.message
      }

      return {
        content: '',
        success: false,
        error: errorMessage
      }
    }
  }

  async generateDualDrafts(
    input: string,
    cplScore: number,
    category: string
  ): Promise<{ grammarFix: string; adaptivePolish: string; success: boolean; error?: string }> {
    const complexityLevel = this.mapCPLToComplexity(cplScore)
    const categoryConstraints = this.getCategoryConstraints(category)

    const systemPrompt = `You are Ascendia, a highly specialized Personal Voice Agent. Your core instruction is to preserve the human's raw, unpolished voice while ensuring clarity.

The user's current Content Polish Level (CPL) is ${cplScore}. This indicates they prefer:
- LEXICAL DIVERSITY: ${complexityLevel.lexical}
- SENTENCE STRUCTURE: ${complexityLevel.structure}
- FORMALITY LEVEL: ${complexityLevel.formality}

For ${category} content, apply these additional constraints:
${categoryConstraints}

You MUST output two distinct versions, labeled clearly:

[DRAFT 1: Grammar Fix Only]: Only correct spelling, grammar, and punctuation. Do NOT alter vocabulary, sentence length, or style. Preserve the user's natural voice completely.

[DRAFT 2: Adaptive Polish]: Apply the CPL constraints above. Polish the text for clarity and professionalism while ensuring the final complexity aligns with CPL ${cplScore}. Maintain the user's unique voice and personality.

Important: Both drafts should feel authentic to the original writer's style and intent.`

    const userPrompt = `Please process this text and provide both versions:

"${input}"`

    try {
      const response = await this.generateResponse({
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 3000
      })

      if (!response.success) {
        return {
          grammarFix: input,
          adaptivePolish: input,
          success: false,
          error: response.error
        }
      }

      const drafts = this.parseDualDrafts(response.content, input)

      return {
        ...drafts,
        success: true
      }
    } catch (error) {
      console.error('Dual draft generation error:', error)
      return {
        grammarFix: input,
        adaptivePolish: input,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private mapCPLToComplexity(cplScore: number) {
    if (cplScore < 30) {
      return {
        lexical: 'Very simple vocabulary, common words only',
        structure: 'Short, direct sentences (5-15 words)',
        formality: 'Casual, conversational tone'
      }
    } else if (cplScore < 60) {
      return {
        lexical: 'Moderate vocabulary with some professional terms',
        structure: 'Mixed sentence lengths (10-25 words)',
        formality: 'Semi-formal, professional but approachable'
      }
    } else {
      return {
        lexical: 'Rich vocabulary with technical and sophisticated terms',
        structure: 'Complex sentences with varied structure (15-35 words)',
        formality: 'Formal, highly professional tone'
      }
    }
  }

  private getCategoryConstraints(category: string): string {
    const constraints = {
      email: 'Use professional email conventions with clear subject matter and appropriate salutations.',
      letter: 'Apply formal letter structure with proper addressing and closing.',
      proposal: 'Structure with clear sections: problem, solution, benefits, and next steps.',
      general: 'Apply general business communication best practices.',
      creative: 'Maintain creative voice while improving clarity and flow.',
      academic: 'Use formal academic tone with precise terminology and structured arguments.'
    }

    return constraints[category as keyof typeof constraints] || constraints.general
  }

  private parseDualDrafts(responseText: string, fallback: string): { grammarFix: string; adaptivePolish: string } {
    // Parse the dual draft format
    const grammarFixMatch = responseText.match(/\[DRAFT 1: Grammar Fix Only\]:\s*(.*?)(?=\[DRAFT 2|$)/s)
    const adaptivePolishMatch = responseText.match(/\[DRAFT 2: Adaptive Polish\]:\s*(.*?)$/s)

    let grammarFix = grammarFixMatch?.[1]?.trim() || fallback
    let adaptivePolish = adaptivePolishMatch?.[1]?.trim() || fallback

    // Clean up any remaining labels
    grammarFix = grammarFix.replace(/^\[.*?\]:\s*/, '').trim()
    adaptivePolish = adaptivePolish.replace(/^\[.*?\]:\s*/, '').trim()

    return {
      grammarFix: grammarFix || fallback,
      adaptivePolish: adaptivePolish || fallback
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.generateResponse({
        system: 'You are a helpful assistant.',
        user: 'Say "OK" if you are working properly.',
        maxTokens: 10
      })

      return response.success && response.content.includes('OK')
    } catch (error) {
      console.error('Claude health check failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const claudeService = ClaudeService.getInstance()