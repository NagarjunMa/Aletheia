import { vi } from 'vitest'

// Mock implementations for AI services
export class MockClaudeService {
  static instance: MockClaudeService | null = null

  static getInstance() {
    if (!this.instance) {
      this.instance = new MockClaudeService()
    }
    return this.instance
  }

  async generateDrafts(input: string, cplScore: number = 75) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))

    const grammarFix = this.mockGrammarFix(input)
    const adaptivePolish = this.mockAdaptivePolish(input, cplScore)

    return {
      success: true,
      data: {
        grammar_fix: grammarFix,
        adaptive_polish: adaptivePolish,
        cpl_score: cplScore,
        usage: {
          input_tokens: input.length,
          output_tokens: grammarFix.length + adaptivePolish.length
        }
      }
    }
  }

  async *streamGeneration(input: string, cplScore: number = 75) {
    const chunks = [
      '[DRAFT 1: Grammar Fix Only]\n',
      input.charAt(0).toUpperCase() + input.slice(1),
      '.\n\n',
      '[DRAFT 2: Adaptive Polish]\n',
      input.charAt(0).toUpperCase() + input.slice(1),
      ' with enhanced clarity and professional tone',
      '.'
    ]

    for (const chunk of chunks) {
      await new Promise(resolve => setTimeout(resolve, 50))
      yield {
        type: 'text',
        content: chunk
      }
    }
  }

  private mockGrammarFix(input: string): string {
    // Simple grammar corrections for testing
    return input
      .trim()
      .replace(/^./, char => char.toUpperCase())
      .replace(/([.!?])\s*$/, '$1')
      .concat(input.endsWith('.') || input.endsWith('!') || input.endsWith('?') ? '' : '.')
  }

  private mockAdaptivePolish(input: string, cplScore: number): string {
    const baseText = this.mockGrammarFix(input)

    // Adjust polishing based on CPL score
    if (cplScore < 50) {
      return baseText
    } else if (cplScore < 75) {
      return baseText.replace(/\./, ' with improved clarity.')
    } else {
      return baseText.replace(/\./, ' with enhanced clarity and professional tone.')
    }
  }
}

// Mock CPL Calculator
export class MockCPLCalculator {
  static calculate(content: string, userHistory: string[] = []): number {
    if (!content || content.trim().length === 0) {
      return 0
    }

    // Simple mock calculation for testing
    const words = content.toLowerCase().split(/\s+/)
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)

    // Basic metrics
    const wordCount = words.length
    const avgSentenceLength = wordCount / (sentences.length || 1)
    const uniqueWordRatio = new Set(words).size / words.length

    // Mock complexity calculation
    let score = 50 // Base score

    // Adjust for sentence length
    if (avgSentenceLength > 15) score += 20
    if (avgSentenceLength > 25) score += 10

    // Adjust for vocabulary diversity
    if (uniqueWordRatio > 0.8) score += 15
    if (uniqueWordRatio > 0.9) score += 10

    // Professional words boost
    const professionalWords = ['enhance', 'facilitate', 'optimize', 'implement', 'strategic']
    const hasProfessionalWords = professionalWords.some(word =>
      content.toLowerCase().includes(word)
    )
    if (hasProfessionalWords) score += 10

    // Ensure score is within bounds
    return Math.min(100, Math.max(0, Math.round(score)))
  }

  static calculateTTR(text: string): number {
    const words = text.toLowerCase().split(/\s+/)
    const uniqueWords = new Set(words)
    return words.length > 0 ? uniqueWords.size / words.length : 0
  }

  static calculateSentenceComplexity(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length === 0) return 0

    const avgLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
    return Math.min(1, Math.max(0, (avgLength - 10) / 20))
  }

  static calculateFormality(text: string): number {
    const formalIndicators = [
      'furthermore', 'nevertheless', 'consequently', 'therefore',
      'moreover', 'subsequently', 'accordingly', 'thus'
    ]
    const informalIndicators = [
      "can't", "won't", "don't", "isn't", "aren't",
      'gonna', 'wanna', 'gotta', 'yeah', 'ok'
    ]

    const words = text.toLowerCase().split(/\s+/)
    const formalCount = formalIndicators.filter(word => words.includes(word)).length
    const informalCount = informalIndicators.filter(word => words.includes(word)).length

    // Return formality score between 0 and 1
    const totalIndicators = formalCount + informalCount
    if (totalIndicators === 0) return 0.5 // Neutral

    return formalCount / totalIndicators
  }

  static calculateCoherence(text: string): number {
    // Simple coherence check based on transition words and sentence connections
    const transitionWords = [
      'however', 'therefore', 'furthermore', 'moreover',
      'consequently', 'additionally', 'similarly', 'in contrast'
    ]

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length <= 1) return 1 // Single sentence is inherently coherent

    const transitionCount = transitionWords.filter(word =>
      text.toLowerCase().includes(word)
    ).length

    // Score based on transition density
    return Math.min(1, transitionCount / (sentences.length - 1) + 0.3)
  }
}

// Mock Content Sanitizer
export class MockContentSanitizer {
  static sanitizeLLMOutput(text: string): string {
    if (!text) return ''

    // Remove zero-width characters
    let cleaned = text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')

    // Collapse excessive whitespace
    cleaned = cleaned.trim().replace(/\s\s+/g, ' ')

    // Remove potential instruction injection patterns
    const dangerousPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /system\s*:\s*/gi,
      /<\|system\|>/gi,
      /\[SYSTEM\]/gi
    ]

    for (const pattern of dangerousPatterns) {
      cleaned = cleaned.replace(pattern, '[FILTERED]')
    }

    return cleaned
  }

  static validateUserInput(input: string) {
    if (!input || input.trim().length === 0) {
      return { valid: false, error: 'Input cannot be empty' }
    }

    if (input.length < 10) {
      return { valid: false, error: 'Input too short (minimum 10 characters)' }
    }

    if (input.length > 5000) {
      return { valid: false, error: 'Input too long (maximum 5000 characters)' }
    }

    // Check for potentially dangerous content
    const dangerousPatterns = [
      /ignore\s+previous\s+instructions/i,
      /system\s*:\s*/i,
      /assistant\s*:\s*/i,
      /<script/i,
      /javascript:/i
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        return { valid: false, error: 'Potentially dangerous content detected' }
      }
    }

    return { valid: true }
  }
}

// Mock streaming utilities
export class MockStreamingUtils {
  static createMockStream(chunks: string[], delay: number = 100): ReadableStream {
    let index = 0

    return new ReadableStream({
      start(controller) {
        const sendChunk = () => {
          if (index < chunks.length) {
            controller.enqueue(`data: ${JSON.stringify({ text: chunks[index] })}\n\n`)
            index++
            setTimeout(sendChunk, delay)
          } else {
            controller.close()
          }
        }
        sendChunk()
      }
    })
  }

  static async *createAsyncGenerator(chunks: string[], delay: number = 100) {
    for (const chunk of chunks) {
      await new Promise(resolve => setTimeout(resolve, delay))
      yield chunk
    }
  }
}

// Export all mock instances
export const mockClaudeService = MockClaudeService.getInstance()
export const mockCPLCalculator = MockCPLCalculator
export const mockContentSanitizer = MockContentSanitizer
export const mockStreamingUtils = MockStreamingUtils

// Jest/Vitest mock functions
export const createMockAIServiceFunctions = () => ({
  generateDrafts: vi.fn().mockImplementation(mockClaudeService.generateDrafts.bind(mockClaudeService)),
  streamGeneration: vi.fn().mockImplementation(mockClaudeService.streamGeneration.bind(mockClaudeService)),
  calculateCPL: vi.fn().mockImplementation(mockCPLCalculator.calculate),
  sanitizeOutput: vi.fn().mockImplementation(mockContentSanitizer.sanitizeLLMOutput),
  validateInput: vi.fn().mockImplementation(mockContentSanitizer.validateUserInput)
})