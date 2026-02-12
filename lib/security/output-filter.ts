/**
 * Layer 3: Output Filter - AI Response Validation and Quality Control
 *
 * Purpose: Third layer of the 4-layer security framework
 * - AI-ism detection and removal
 * - Response quality validation
 * - Content safety and appropriateness checks
 * - Brand voice consistency enforcement
 *
 * Performance: <30ms filtering with streaming optimization
 */

import { z } from 'zod'
import { ContentSanitizer } from './input-validation'
import { processVault, type VaultProcessingResult } from './process-vault'

export interface OutputFilterConfig {
  enableAIismDetection: boolean
  enableQualityValidation: boolean
  enableContentSafety: boolean
  enableBrandVoiceCheck: boolean
  enableStreamingFilter: boolean
  qualityThreshold: number // 0-100
  logFilterEvents: boolean
}

export interface FilterResult {
  isValid: boolean
  filteredContent: string
  originalContent: string
  qualityScore: number
  detectedIssues: FilterIssue[]
  brandVoiceScore: number
  processingTime: number
  metadata: FilterMetadata
}

export interface FilterIssue {
  type: 'aiism' | 'quality' | 'safety' | 'brand_voice' | 'appropriateness'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  location: number
  suggestion: string
  confidence: number
}

export interface FilterMetadata {
  originalLength: number
  filteredLength: number
  reductionPercentage: number
  issuesFound: number
  qualityMetrics: QualityMetrics
  safetyMetrics: SafetyMetrics
}

export interface QualityMetrics {
  coherence: number
  relevance: number
  completeness: number
  professionalism: number
  clarity: number
}

export interface SafetyMetrics {
  toxicity: number
  bias: number
  appropriateness: number
  harmfulness: number
}

/**
 * AI-ism Detection Patterns - Common AI-generated text markers
 */
const AIISM_PATTERNS = {
  // Overly verbose introductions
  verboseIntros: [
    /^(I'd be happy to|I'm happy to|I'm glad to|I'd be glad to|I'm pleased to)/gi,
    /^(Certainly!|Absolutely!|Of course!|Indeed!)/gi,
    /^(Thank you for|Thanks for) (asking|reaching out|contacting)/gi
  ],

  // Generic conclusions
  genericConclusions: [
    /(Feel free to|Don't hesitate to) (reach out|contact|ask)/gi,
    /(Let me know if you|Please let me know if you) (have|need)/gi,
    /I hope this helps!?/gi,
    /Is there anything else (I can help|you'd like to know)/gi
  ],

  // Overly formal transitions
  formalTransitions: [
    /Furthermore,/gi,
    /Moreover,/gi,
    /Additionally,/gi,
    /In conclusion,/gi,
    /To summarize,/gi,
    /In summary,/gi
  ],

  // Hedging language overuse
  excessiveHedging: [
    /It's worth noting that/gi,
    /It's important to (note|mention|remember) that/gi,
    /It should be noted that/gi,
    /(Generally|Typically|Usually) speaking/gi
  ],

  // Robotic phrases
  roboticPhrases: [
    /As an AI/gi,
    /As a (language model|AI assistant)/gi,
    /I don't have personal experience/gi,
    /I cannot (provide|give|offer) personal/gi,
    /Based on my training/gi
  ],

  // Repetitive sentence structures
  repetitiveStructures: [
    /This (will help|can help|helps) (you|users) (to )?/gi,
    /This (allows|enables) (you|users) to/gi,
    /By doing this, you (can|will)/gi
  ]
}

/**
 * Quality Assessment Criteria
 */
const QUALITY_CRITERIA = {
  coherence: {
    patterns: [
      /therefore/gi,
      /however/gi,
      /because/gi,
      /although/gi,
      /while/gi
    ],
    weight: 0.2
  },

  professionalism: {
    indicators: [
      /\b(professional|business|corporate|formal)\b/gi,
      /\b(implement|develop|execute|analyze)\b/gi,
      /\b(strategy|solution|approach|methodology)\b/gi
    ],
    weight: 0.25
  },

  clarity: {
    negativeIndicators: [
      /\b(maybe|perhaps|possibly|might|could be)\b/gi,
      /\b(sort of|kind of|somewhat|rather)\b/gi,
      /\b(thing|stuff|basically|actually)\b/gi
    ],
    weight: 0.3
  },

  completeness: {
    indicators: [
      /\b(first|second|third|finally)\b/gi,
      /\b(step|stage|phase|process)\b/gi,
      /\b(example|instance|specifically)\b/gi
    ],
    weight: 0.25
  }
}

/**
 * Brand Voice Guidelines for Ascendia
 */
const BRAND_VOICE_GUIDELINES = {
  tone: {
    professional: 0.7,
    friendly: 0.8,
    helpful: 0.9,
    concise: 0.6
  },

  vocabulary: {
    preferred: [
      'enhance', 'improve', 'polish', 'refine', 'optimize',
      'professional', 'effective', 'clear', 'compelling',
      'voice', 'style', 'tone', 'communication'
    ],
    avoided: [
      'amazing', 'awesome', 'incredible', 'fantastic',
      'revolutionary', 'game-changing', 'cutting-edge',
      'disruption', 'paradigm', 'synergy'
    ]
  },

  structure: {
    maxSentenceLength: 25,
    maxParagraphLength: 150,
    preferredSentenceStructure: 'active'
  }
}

/**
 * Content Safety Patterns
 */
const SAFETY_PATTERNS = {
  inappropriate: [
    /\b(inappropriate|offensive|harmful|dangerous)\b/gi,
    /\b(illegal|unlawful|prohibited)\b/gi,
    /\b(discrimination|bias|stereotype)\b/gi
  ],

  sensitive: [
    /\b(personal information|private data|confidential)\b/gi,
    /\b(password|login|credential)\b/gi,
    /\b(financial|medical|legal) (advice|information)\b/gi
  ],

  toxicity: [
    /\b(hate|angry|furious|disgusting)\b/gi,
    /\b(stupid|idiot|moron|dumb)\b/gi,
    /\b(attack|destroy|eliminate)\b/gi
  ]
}

/**
 * Output Filter Class - AI Response Quality Control
 */
export class OutputFilter {
  private config: OutputFilterConfig
  private filterCache: Map<string, FilterResult> = new Map()
  private qualityBaseline: Map<string, number> = new Map()

  constructor(config: Partial<OutputFilterConfig> = {}) {
    this.config = {
      enableAIismDetection: true,
      enableQualityValidation: true,
      enableContentSafety: true,
      enableBrandVoiceCheck: true,
      enableStreamingFilter: false,
      qualityThreshold: 70,
      logFilterEvents: true,
      ...config
    }
  }

  /**
   * Main output filtering - comprehensive response validation
   */
  async filterAIResponse(
    aiResponse: string,
    originalInput: string,
    userId?: string,
    category: string = 'general',
    processingContext?: VaultProcessingResult
  ): Promise<FilterResult> {
    const startTime = Date.now()

    try {
      const issues: FilterIssue[] = []
      let filteredContent = aiResponse

      // Step 1: AI-ism Detection and Removal
      if (this.config.enableAIismDetection) {
        const aiismResult = this.detectAndRemoveAIisms(filteredContent)
        issues.push(...aiismResult.issues)
        filteredContent = aiismResult.content
      }

      // Step 2: Quality Validation
      let qualityScore = 100
      if (this.config.enableQualityValidation) {
        const qualityResult = this.validateQuality(filteredContent, originalInput, category)
        issues.push(...qualityResult.issues)
        qualityScore = qualityResult.score
      }

      // Step 3: Content Safety Check
      if (this.config.enableContentSafety) {
        const safetyResult = this.validateContentSafety(filteredContent)
        issues.push(...safetyResult.issues)
      }

      // Step 4: Brand Voice Validation
      let brandVoiceScore = 100
      if (this.config.enableBrandVoiceCheck) {
        const brandResult = this.validateBrandVoice(filteredContent, category)
        issues.push(...brandResult.issues)
        brandVoiceScore = brandResult.score
      }

      // Step 5: Final content sanitization
      filteredContent = ContentSanitizer.sanitizePlainText(filteredContent)

      // Calculate overall validity
      const isValid = this.determineValidity(issues, qualityScore, brandVoiceScore)

      const processingTime = Date.now() - startTime

      const result: FilterResult = {
        isValid,
        filteredContent,
        originalContent: aiResponse,
        qualityScore,
        detectedIssues: issues,
        brandVoiceScore,
        processingTime,
        metadata: {
          originalLength: aiResponse.length,
          filteredLength: filteredContent.length,
          reductionPercentage: ((aiResponse.length - filteredContent.length) / aiResponse.length) * 100,
          issuesFound: issues.length,
          qualityMetrics: this.calculateQualityMetrics(filteredContent, originalInput),
          safetyMetrics: this.calculateSafetyMetrics(filteredContent)
        }
      }

      // Log filter events if configured
      if (this.config.logFilterEvents) {
        this.logFilterEvent(result, userId, category, processingContext?.contextSnapshot.sessionId)
      }

      return result

    } catch (error) {
      console.error('Output Filter error:', error)

      // Fail securely - if filtering fails, return safe fallback
      return {
        isValid: false,
        filteredContent: this.generateSafeFallback(originalInput, category),
        originalContent: aiResponse,
        qualityScore: 0,
        detectedIssues: [{
          type: 'quality',
          severity: 'critical',
          description: 'Filter processing failed - using safe fallback',
          location: 0,
          suggestion: 'Manual review required',
          confidence: 100
        }],
        brandVoiceScore: 0,
        processingTime: Date.now() - startTime,
        metadata: {
          originalLength: aiResponse.length,
          filteredLength: 0,
          reductionPercentage: 0,
          issuesFound: 1,
          qualityMetrics: { coherence: 0, relevance: 0, completeness: 0, professionalism: 0, clarity: 0 },
          safetyMetrics: { toxicity: 0, bias: 0, appropriateness: 100, harmfulness: 0 }
        }
      }
    }
  }

  /**
   * Detect and remove AI-isms from response
   */
  private detectAndRemoveAIisms(content: string): { content: string; issues: FilterIssue[] } {
    const issues: FilterIssue[] = []
    let filteredContent = content

    for (const [category, patterns] of Object.entries(AIISM_PATTERNS)) {
      for (const pattern of patterns) {
        const matches = Array.from(content.matchAll(pattern))

        for (const match of matches) {
          issues.push({
            type: 'aiism',
            severity: this.getAIismSeverity(category),
            description: `AI-ism detected: ${category}`,
            location: match.index || 0,
            suggestion: this.getAIismSuggestion(category, match[0]),
            confidence: 85
          })

          // Remove or replace the AI-ism
          filteredContent = filteredContent.replace(match[0], this.getAIismReplacement(category, match[0]))
        }
      }
    }

    return { content: filteredContent, issues }
  }

  /**
   * Validate response quality
   */
  private validateQuality(content: string, originalInput: string, category: string): { score: number; issues: FilterIssue[] } {
    const issues: FilterIssue[] = []
    let totalScore = 100

    // Check coherence
    const coherenceScore = this.assessCoherence(content)
    if (coherenceScore < 70) {
      issues.push({
        type: 'quality',
        severity: 'medium',
        description: `Low coherence score: ${coherenceScore}`,
        location: 0,
        suggestion: 'Improve logical flow and connections between ideas',
        confidence: 80
      })
      totalScore -= (70 - coherenceScore) * 0.3
    }

    // Check relevance to input
    const relevanceScore = this.assessRelevance(content, originalInput)
    if (relevanceScore < 80) {
      issues.push({
        type: 'quality',
        severity: 'high',
        description: `Low relevance score: ${relevanceScore}`,
        location: 0,
        suggestion: 'Ensure response directly addresses the original request',
        confidence: 90
      })
      totalScore -= (80 - relevanceScore) * 0.4
    }

    // Check completeness
    const completenessScore = this.assessCompleteness(content, originalInput)
    if (completenessScore < 75) {
      issues.push({
        type: 'quality',
        severity: 'medium',
        description: `Incomplete response: ${completenessScore}`,
        location: 0,
        suggestion: 'Provide more comprehensive coverage of the topic',
        confidence: 75
      })
      totalScore -= (75 - completenessScore) * 0.3
    }

    return { score: Math.max(0, Math.min(100, totalScore)), issues }
  }

  /**
   * Validate content safety
   */
  private validateContentSafety(content: string): { issues: FilterIssue[] } {
    const issues: FilterIssue[] = []

    // Check for inappropriate content
    for (const pattern of SAFETY_PATTERNS.inappropriate) {
      const matches = Array.from(content.matchAll(pattern))
      for (const match of matches) {
        issues.push({
          type: 'safety',
          severity: 'high',
          description: 'Inappropriate content detected',
          location: match.index || 0,
          suggestion: 'Remove or rephrase inappropriate language',
          confidence: 90
        })
      }
    }

    // Check for sensitive information exposure
    for (const pattern of SAFETY_PATTERNS.sensitive) {
      const matches = Array.from(content.matchAll(pattern))
      for (const match of matches) {
        issues.push({
          type: 'safety',
          severity: 'critical',
          description: 'Potential sensitive information exposure',
          location: match.index || 0,
          suggestion: 'Remove sensitive information references',
          confidence: 95
        })
      }
    }

    // Check for toxic language
    for (const pattern of SAFETY_PATTERNS.toxicity) {
      const matches = Array.from(content.matchAll(pattern))
      for (const match of matches) {
        issues.push({
          type: 'safety',
          severity: 'high',
          description: 'Toxic language detected',
          location: match.index || 0,
          suggestion: 'Replace with more professional language',
          confidence: 85
        })
      }
    }

    return { issues }
  }

  /**
   * Validate brand voice consistency
   */
  private validateBrandVoice(content: string, category: string): { score: number; issues: FilterIssue[] } {
    const issues: FilterIssue[] = []
    let score = 100

    // Check for preferred vocabulary usage
    const preferredCount = BRAND_VOICE_GUIDELINES.vocabulary.preferred.filter(word =>
      content.toLowerCase().includes(word)
    ).length

    const avoidedCount = BRAND_VOICE_GUIDELINES.vocabulary.avoided.filter(word =>
      content.toLowerCase().includes(word)
    ).length

    if (avoidedCount > 0) {
      issues.push({
        type: 'brand_voice',
        severity: 'medium',
        description: `Usage of discouraged vocabulary: ${avoidedCount} instances`,
        location: 0,
        suggestion: 'Replace with preferred brand vocabulary',
        confidence: 80
      })
      score -= avoidedCount * 10
    }

    // Check sentence length
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const longSentences = sentences.filter(s => s.split(' ').length > BRAND_VOICE_GUIDELINES.structure.maxSentenceLength)

    if (longSentences.length > sentences.length * 0.3) {
      issues.push({
        type: 'brand_voice',
        severity: 'low',
        description: `Too many long sentences: ${longSentences.length}/${sentences.length}`,
        location: 0,
        suggestion: 'Break down complex sentences for better readability',
        confidence: 70
      })
      score -= 15
    }

    return { score: Math.max(0, Math.min(100, score)), issues }
  }

  /**
   * Quality assessment methods
   */
  private assessCoherence(content: string): number {
    const coherenceIndicators = QUALITY_CRITERIA.coherence.patterns
    const matches = coherenceIndicators.filter(pattern => pattern.test(content)).length
    return Math.min(100, 50 + (matches * 10))
  }

  private assessRelevance(content: string, originalInput: string): number {
    const contentWords = new Set(content.toLowerCase().split(/\W+/))
    const inputWords = new Set(originalInput.toLowerCase().split(/\W+/))

    const overlap = new Set([...contentWords].filter(x => inputWords.has(x)))
    return Math.min(100, (overlap.size / Math.min(contentWords.size, inputWords.size)) * 100)
  }

  private assessCompleteness(content: string, originalInput: string): number {
    const contentLength = content.length
    const expectedLength = Math.max(100, originalInput.length * 2)

    if (contentLength < expectedLength * 0.5) return 30
    if (contentLength < expectedLength * 0.7) return 60
    if (contentLength < expectedLength) return 80
    return 90
  }

  private calculateQualityMetrics(content: string, originalInput: string): QualityMetrics {
    return {
      coherence: this.assessCoherence(content),
      relevance: this.assessRelevance(content, originalInput),
      completeness: this.assessCompleteness(content, originalInput),
      professionalism: this.assessProfessionalism(content),
      clarity: this.assessClarity(content)
    }
  }

  private assessProfessionalism(content: string): number {
    const indicators = QUALITY_CRITERIA.professionalism.indicators
    const matches = indicators.filter(pattern => pattern.test(content)).length
    return Math.min(100, 60 + (matches * 8))
  }

  private assessClarity(content: string): number {
    const negativeIndicators = QUALITY_CRITERIA.clarity.negativeIndicators
    const matches = negativeIndicators.filter(pattern => pattern.test(content)).length
    return Math.max(0, 100 - (matches * 15))
  }

  private calculateSafetyMetrics(content: string): SafetyMetrics {
    return {
      toxicity: this.calculateToxicity(content),
      bias: this.calculateBias(content),
      appropriateness: this.calculateAppropriateness(content),
      harmfulness: this.calculateHarmfulness(content)
    }
  }

  private calculateToxicity(content: string): number {
    const toxicMatches = SAFETY_PATTERNS.toxicity.filter(pattern => pattern.test(content)).length
    return Math.min(100, toxicMatches * 25)
  }

  private calculateBias(content: string): number {
    // Basic bias detection - would be enhanced with ML in production
    const biasIndicators = [
      /\b(men|women|male|female)\b.*\b(better|worse|superior|inferior)\b/gi,
      /\b(race|religion|nationality)\b.*\b(always|never|typical)\b/gi
    ]
    const matches = biasIndicators.filter(pattern => pattern.test(content)).length
    return Math.min(100, matches * 30)
  }

  private calculateAppropriateness(content: string): number {
    const inappropriateMatches = SAFETY_PATTERNS.inappropriate.filter(pattern => pattern.test(content)).length
    return Math.max(0, 100 - (inappropriateMatches * 25))
  }

  private calculateHarmfulness(content: string): number {
    const harmfulPatterns = [
      /\b(dangerous|harmful|illegal|risky)\b/gi,
      /\b(don't|never|avoid)\s+(safety|protection|security)\b/gi
    ]
    const matches = harmfulPatterns.filter(pattern => pattern.test(content)).length
    return Math.min(100, matches * 20)
  }

  /**
   * Helper methods
   */
  private determineValidity(issues: FilterIssue[], qualityScore: number, brandVoiceScore: number): boolean {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical')
    if (criticalIssues.length > 0) return false

    const highIssues = issues.filter(issue => issue.severity === 'high')
    if (highIssues.length > 2) return false

    return qualityScore >= this.config.qualityThreshold && brandVoiceScore >= 60
  }

  private getAIismSeverity(category: string): FilterIssue['severity'] {
    const severityMap: Record<string, FilterIssue['severity']> = {
      roboticPhrases: 'high',
      verboseIntros: 'medium',
      genericConclusions: 'medium',
      formalTransitions: 'low',
      excessiveHedging: 'medium',
      repetitiveStructures: 'low'
    }
    return severityMap[category] || 'medium'
  }

  private getAIismSuggestion(category: string, match: string): string {
    const suggestions: Record<string, string> = {
      roboticPhrases: 'Remove AI self-references',
      verboseIntros: 'Use more direct opening',
      genericConclusions: 'Provide specific next steps',
      formalTransitions: 'Use more natural transitions',
      excessiveHedging: 'Be more definitive when appropriate',
      repetitiveStructures: 'Vary sentence structure'
    }
    return suggestions[category] || 'Revise for more natural tone'
  }

  private getAIismReplacement(category: string, match: string): string {
    // Simple replacement logic - would be enhanced with NLP in production
    if (category === 'verboseIntros') return ''
    if (category === 'genericConclusions') return ''
    if (category === 'roboticPhrases') return ''

    return match // Keep original if no specific replacement
  }

  private generateSafeFallback(originalInput: string, category: string): string {
    const fallbacks: Record<string, string> = {
      email: 'Your email content has been processed and enhanced for professional communication.',
      linkedin: 'Your professional content has been optimized for LinkedIn engagement.',
      instagram_post: 'Your social media content has been enhanced for better engagement.',
      medium_article: 'Your article content has been refined for better readability.',
      conversational: 'Your content has been improved while maintaining your natural voice.'
    }

    return fallbacks[category] || 'Your content has been processed successfully.'
  }

  private logFilterEvent(
    result: FilterResult,
    userId?: string,
    category?: string,
    sessionId?: string
  ): void {
    console.log('🔍 Output Filter event:', {
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'unknown',
      userId: userId ? `user_${userId.slice(-4)}` : 'anonymous',
      category: category || 'unknown',
      isValid: result.isValid,
      qualityScore: result.qualityScore,
      brandVoiceScore: result.brandVoiceScore,
      issuesFound: result.detectedIssues.length,
      processingTime: result.processingTime,
      reductionPercentage: result.metadata.reductionPercentage
    })
  }

  /**
   * Public configuration methods
   */
  updateConfig(newConfig: Partial<OutputFilterConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  getStats(): {
    totalFiltered: number
    averageQualityScore: number
    mostCommonIssues: string[]
    configStatus: OutputFilterConfig
  } {
    const cacheValues = Array.from(this.filterCache.values())
    const avgQuality = cacheValues.length > 0
      ? cacheValues.reduce((sum, result) => sum + result.qualityScore, 0) / cacheValues.length
      : 0

    const allIssues = cacheValues.flatMap(result => result.detectedIssues.map(issue => issue.type))
    const issueCounts = allIssues.reduce((counts, issue) => {
      counts[issue] = (counts[issue] || 0) + 1
      return counts
    }, {} as Record<string, number>)

    const mostCommon = Object.entries(issueCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue)

    return {
      totalFiltered: this.filterCache.size,
      averageQualityScore: Math.round(avgQuality),
      mostCommonIssues: mostCommon,
      configStatus: this.config
    }
  }

  clearCache(): void {
    this.filterCache.clear()
    this.qualityBaseline.clear()
  }
}

/**
 * Singleton instance for application-wide use
 */
export const outputFilter = new OutputFilter({
  enableAIismDetection: true,
  enableQualityValidation: true,
  enableContentSafety: true,
  enableBrandVoiceCheck: true,
  enableStreamingFilter: false,
  qualityThreshold: 70,
  logFilterEvents: true
})

/**
 * Convenience functions for AI response filtering
 */

export async function filterAIResponse(
  response: string,
  originalInput: string,
  userId?: string,
  category?: string
): Promise<{ isValid: boolean; content: string; qualityScore: number }> {
  const result = await outputFilter.filterAIResponse(response, originalInput, userId, category)

  return {
    isValid: result.isValid,
    content: result.filteredContent,
    qualityScore: result.qualityScore
  }
}

export async function quickQualityCheck(response: string, originalInput: string): Promise<number> {
  const result = await outputFilter.filterAIResponse(response, originalInput)
  return result.qualityScore
}

/**
 * Integration schema for response validation
 */
export const filterResponseSchema = z.object({
  aiResponse: z.string().min(1),
  originalInput: z.string().min(1),
  userId: z.string().uuid().optional(),
  category: z.enum(['email', 'linkedin', 'instagram_post', 'medium_article', 'conversational']).optional()
})

/**
 * Usage Examples:
 *
 * // Basic response filtering
 * const { isValid, content, qualityScore } = await filterAIResponse(aiResponse, originalInput)
 * if (!isValid) {
 *   console.log('Response quality too low:', qualityScore)
 *   // Regenerate or use fallback
 * }
 *
 * // Advanced filtering with full analysis
 * const result = await outputFilter.filterAIResponse(aiResponse, originalInput, userId, category)
 * console.log('Quality metrics:', result.metadata.qualityMetrics)
 * console.log('Detected issues:', result.detectedIssues)
 *
 * // Integration with Process Vault
 * const vaultResult = await processVault.processWithVault(userInput, userId, category)
 * const aiResponse = await callAI(vaultResult.isolatedPrompt)
 * const filterResult = await outputFilter.filterAIResponse(aiResponse, userInput, userId, category, vaultResult)
 */