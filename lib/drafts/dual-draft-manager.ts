import { claudeService } from '@/lib/ai/claude-service'
import { CPLCalculator } from '@/lib/cpl/calculator'
import { ContentSanitizer } from '@/lib/sanitization/sanitizer'

interface UserProfile {
  id: string
  cpl_score: number
  preferences: UserPreferences
}

interface UserPreferences {
  useTransitions?: boolean
  allowFormalityIncrease?: boolean
  allowFormalityDecrease?: boolean
  preferredComplexity?: 'simple' | 'moderate' | 'complex'
  categoryDefaults?: Record<string, any>
}

interface Draft {
  id?: string
  content: string
  type: 'grammar_fix' | 'adaptive_polish'
  cplScore: number
  metadata: {
    originalLength: number
    processedLength: number
    changesCount?: number
    preservationScore?: number
    cplAlignment?: number
    improvementAreas?: string[]
    processingTime?: number
  }
}

interface DraftPair {
  grammarFix: Draft
  adaptivePolish: Draft
}

interface ProcessingResult {
  success: boolean
  drafts?: DraftPair
  error?: string
  processingTime: number
}

interface ComplexityInstructions {
  vocabulary: string
  sentences: string
  formality: string
}

export class DualDraftManager {
  /**
   * Generate both grammar fix and adaptive polish drafts
   */
  async generateDrafts(
    userInput: string,
    userId: string,
    conversationId: string,
    category: string = 'general'
  ): Promise<ProcessingResult> {
    const startTime = Date.now()

    try {
      // Validate and sanitize input
      const validationResult = ContentSanitizer.validateAndClean(userInput)
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
          processingTime: Date.now() - startTime
        }
      }

      const sanitizedInput = validationResult.sanitized

      // Get user profile and preferences
      const userProfile = await this.getUserProfile(userId)
      const cplScore = userProfile?.cpl_score || 50

      console.log(`Generating drafts for user ${userId}, CPL: ${cplScore}, Category: ${category}`)

      // Generate both drafts in parallel for efficiency
      const [grammarDraftResult, adaptiveDraftResult] = await Promise.all([
        this.generateGrammarFixDraft(sanitizedInput),
        this.generateAdaptivePolishDraft(sanitizedInput, cplScore, category, userProfile?.preferences)
      ])

      if (!grammarDraftResult.success || !adaptiveDraftResult.success) {
        return {
          success: false,
          error: grammarDraftResult.error || adaptiveDraftResult.error || 'Draft generation failed',
          processingTime: Date.now() - startTime
        }
      }

      const draftPair: DraftPair = {
        grammarFix: grammarDraftResult.draft!,
        adaptivePolish: adaptiveDraftResult.draft!
      }

      // Validate both drafts
      const validationResults = this.validateDrafts(sanitizedInput, draftPair)

      return {
        success: true,
        drafts: draftPair,
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.error('Draft generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Generate grammar-fix-only draft
   */
  private async generateGrammarFixDraft(
    input: string
  ): Promise<{ success: boolean; draft?: Draft; error?: string }> {
    try {
      const systemPrompt = `You are a precise grammar and spelling checker. Your ONLY task is to correct grammatical errors, spelling mistakes, and punctuation issues.

CRITICAL RULES:
1. Do NOT change vocabulary or word choice
2. Do NOT alter sentence structure or length
3. Do NOT modify the tone or style
4. Do NOT add or remove content
5. ONLY fix clear grammatical errors

Examples of what TO fix:
- Spelling errors: "teh" → "the"
- Capitalization: "i went" → "I went"
- Punctuation: "Hello,world" → "Hello, world"
- Basic grammar: "She don't like" → "She doesn't like"

Examples of what NOT to change:
- Vocabulary level: Keep "big" as "big" (don't change to "large")
- Sentence structure: Keep short sentences short
- Personal style: Keep casual tone if that's the original
- Content length: Should remain very similar

Preserve the writer's natural voice and personality completely.`

      const userPrompt = `Please fix only the grammar and spelling in this text, keeping everything else exactly the same:

"${input}"`

      const response = await claudeService.generateResponse({
        system: systemPrompt,
        user: userPrompt,
        maxTokens: Math.max(500, input.length * 2)
      })

      if (!response.success) {
        return { success: false, error: response.error }
      }

      const sanitizedContent = ContentSanitizer.sanitizeLLMOutput(response.content)
      const changesCount = this.countDifferences(input, sanitizedContent)
      const preservationScore = this.calculatePreservationScore(input, sanitizedContent)

      const draft: Draft = {
        content: sanitizedContent,
        type: 'grammar_fix',
        cplScore: CPLCalculator.calculate(input), // Should stay same as original
        metadata: {
          originalLength: input.length,
          processedLength: sanitizedContent.length,
          changesCount,
          preservationScore
        }
      }

      return { success: true, draft }
    } catch (error) {
      console.error('Grammar fix generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Grammar fix generation failed'
      }
    }
  }

  /**
   * Generate adaptive polish draft
   */
  private async generateAdaptivePolishDraft(
    input: string,
    targetCPL: number,
    category: string,
    preferences?: UserPreferences
  ): Promise<{ success: boolean; draft?: Draft; error?: string }> {
    try {
      const systemPrompt = this.buildAdaptiveSystemPrompt(targetCPL, category, preferences)

      const userPrompt = `Original text to polish: "${input}"

Target CPL: ${targetCPL}
Category: ${category}

Please create an adaptive polish version that maintains the writer's voice while achieving the target complexity level.`

      const response = await claudeService.generateResponse({
        system: systemPrompt,
        user: userPrompt,
        maxTokens: Math.max(1000, input.length * 3)
      })

      if (!response.success) {
        return { success: false, error: response.error }
      }

      const sanitizedContent = ContentSanitizer.sanitizeLLMOutput(response.content)
      const actualCPL = CPLCalculator.calculate(sanitizedContent)
      const improvementAreas = this.identifyImprovements(input, sanitizedContent)

      const draft: Draft = {
        content: sanitizedContent,
        type: 'adaptive_polish',
        cplScore: actualCPL,
        metadata: {
          originalLength: input.length,
          processedLength: sanitizedContent.length,
          cplAlignment: Math.abs(targetCPL - actualCPL),
          improvementAreas
        }
      }

      return { success: true, draft }
    } catch (error) {
      console.error('Adaptive polish generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Adaptive polish generation failed'
      }
    }
  }

  /**
   * Build system prompt for adaptive polish
   */
  private buildAdaptiveSystemPrompt(
    targetCPL: number,
    category: string,
    preferences?: UserPreferences
  ): string {
    const complexity = this.mapCPLToInstructions(targetCPL)
    const categoryRules = this.getCategorySpecificRules(category)

    return `You are Ascendia, an adaptive writing assistant. Polish the text to match CPL ${targetCPL}.

TARGET COMPLEXITY LEVEL:
- Vocabulary: ${complexity.vocabulary}
- Sentence Structure: ${complexity.sentences}
- Formality: ${complexity.formality}

CATEGORY-SPECIFIC RULES (${category}):
${categoryRules}

CRITICAL REQUIREMENTS:
1. Maintain the writer's unique voice and personality
2. Preserve the core message and intent
3. Apply improvements that align with CPL ${targetCPL}
4. Ensure the result feels natural, not artificial
5. Focus on clarity and readability within the complexity level

${this.getPreferencesInstructions(preferences)}

The result should feel like the original writer on their best day - polished but authentic.`
  }

  /**
   * Map CPL score to specific instructions
   */
  private mapCPLToInstructions(cpl: number): ComplexityInstructions {
    if (cpl < 30) {
      return {
        vocabulary: 'Use simple, everyday words. Avoid jargon or technical terms. Choose common words over sophisticated alternatives.',
        sentences: 'Keep sentences short and direct (5-15 words). Use simple structure with one main idea per sentence.',
        formality: 'Maintain casual, conversational tone. Use contractions if natural. Keep it friendly and approachable.'
      }
    } else if (cpl < 60) {
      return {
        vocabulary: 'Use clear, professional language. Some technical terms are okay if they add precision. Balance accessibility with professionalism.',
        sentences: 'Mix sentence lengths (10-25 words). Use some compound sentences for flow. Vary structure while staying clear.',
        formality: 'Professional but approachable. Balance formality with personality. Avoid overly casual or overly stiff language.'
      }
    } else {
      return {
        vocabulary: 'Use sophisticated vocabulary including technical, academic, and nuanced terms. Choose precise words that convey exact meaning.',
        sentences: 'Vary sentence structure (15-35 words). Use complex and compound-complex sentences. Show sophisticated command of syntax.',
        formality: 'Formal, professional tone. Minimize contractions and colloquialisms. Use elevated but clear language.'
      }
    }
  }

  /**
   * Get category-specific rules
   */
  private getCategorySpecificRules(category: string): string {
    const rules = {
      email: `- Use professional email conventions
- Clear subject matter and purpose
- Appropriate salutations and closings
- Structured paragraphs with clear flow
- Action items or next steps if applicable`,

      letter: `- Apply formal letter structure
- Proper addressing and closing
- Respectful and appropriate tone
- Clear purpose statement
- Professional formatting conventions`,

      proposal: `- Structure with clear sections: problem, solution, benefits, next steps
- Use persuasive but professional language
- Include specific details and evidence
- Clear call to action
- Professional business proposal format`,

      academic: `- Use formal academic tone and structure
- Precise terminology and concepts
- Evidence-based arguments
- Proper logical flow and transitions
- Scholarly writing conventions`,

      creative: `- Maintain creative voice and style
- Enhance clarity without losing creativity
- Preserve unique expressions and personality
- Improve flow and readability
- Keep creative elements intact`,

      general: `- Apply general business communication best practices
- Clear, professional, and engaging tone
- Well-structured content
- Appropriate level of formality
- Focus on clarity and effectiveness`
    }

    return rules[category as keyof typeof rules] || rules.general
  }

  /**
   * Generate user preference instructions
   */
  private getPreferencesInstructions(preferences?: UserPreferences): string {
    if (!preferences) return ''

    const instructions: string[] = []

    if (preferences.useTransitions) {
      instructions.push('- Use smooth transitions between ideas')
    }

    if (preferences.allowFormalityIncrease) {
      instructions.push('- You may increase formality if it improves the text')
    } else if (preferences.allowFormalityDecrease) {
      instructions.push('- You may decrease formality if it improves readability')
    }

    if (preferences.preferredComplexity) {
      instructions.push(`- User prefers ${preferences.preferredComplexity} complexity level`)
    }

    return instructions.length > 0
      ? `\nUSER PREFERENCES:\n${instructions.join('\n')}`
      : ''
  }

  /**
   * Count differences between original and processed text
   */
  private countDifferences(original: string, processed: string): number {
    const originalWords = original.toLowerCase().split(/\s+/)
    const processedWords = processed.toLowerCase().split(/\s+/)

    let differences = Math.abs(originalWords.length - processedWords.length)

    const maxLength = Math.max(originalWords.length, processedWords.length)
    for (let i = 0; i < maxLength; i++) {
      if (originalWords[i] !== processedWords[i]) {
        differences++
      }
    }

    return differences
  }

  /**
   * Calculate preservation score
   */
  private calculatePreservationScore(original: string, processed: string): number {
    const originalWords = original.toLowerCase().split(/\s+/)
    const processedWords = processed.toLowerCase().split(/\s+/)

    if (originalWords.length === 0) return 100

    const preservedWords = originalWords.filter((word, index) =>
      processedWords[index] === word
    ).length

    return Math.round((preservedWords / originalWords.length) * 100)
  }

  /**
   * Identify improvement areas
   */
  private identifyImprovements(original: string, polished: string): string[] {
    const improvements: string[] = []

    const originalMetrics = CPLCalculator.calculateBaseMetrics(original)
    const polishedMetrics = CPLCalculator.calculateBaseMetrics(polished)

    if (polishedMetrics.lexicalDiversity > originalMetrics.lexicalDiversity + 5) {
      improvements.push('Enhanced vocabulary diversity')
    }

    if (polishedMetrics.sentenceComplexity > originalMetrics.sentenceComplexity + 5) {
      improvements.push('Improved sentence structure')
    }

    if (polishedMetrics.formalityLevel > originalMetrics.formalityLevel + 5) {
      improvements.push('Increased formality')
    }

    if (polishedMetrics.coherence > originalMetrics.coherence + 5) {
      improvements.push('Enhanced coherence and flow')
    }

    // Check for length changes
    const lengthChange = ((polished.length - original.length) / original.length) * 100
    if (lengthChange > 10) {
      improvements.push('Expanded content for clarity')
    } else if (lengthChange < -10) {
      improvements.push('Condensed for conciseness')
    }

    return improvements
  }

  /**
   * Validate both drafts against quality standards
   */
  private validateDrafts(original: string, drafts: DraftPair): boolean {
    const grammarValidation = ContentSanitizer.validateOutputQuality(
      original,
      drafts.grammarFix.content,
      'grammar_fix'
    )

    const polishValidation = ContentSanitizer.validateOutputQuality(
      original,
      drafts.adaptivePolish.content,
      'adaptive_polish'
    )

    if (!grammarValidation.passed) {
      console.warn('Grammar fix validation failed:', grammarValidation.issues)
    }

    if (!polishValidation.passed) {
      console.warn('Adaptive polish validation failed:', polishValidation.issues)
    }

    return grammarValidation.passed && polishValidation.passed
  }

  /**
   * Get user profile (placeholder for database integration)
   */
  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    // This would integrate with your Supabase database
    // For now, returning a default profile
    console.log(`Getting profile for user: ${userId}`)

    return {
      id: userId,
      cpl_score: 50, // Default CPL
      preferences: {
        useTransitions: true,
        allowFormalityIncrease: true,
        allowFormalityDecrease: true,
        preferredComplexity: 'moderate'
      }
    }
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testResult = await this.generateDrafts(
        'This is a test sentence.',
        'test-user',
        'test-conversation',
        'general'
      )

      return testResult.success
    } catch (error) {
      console.error('Dual draft manager health check failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const dualDraftManager = new DualDraftManager()