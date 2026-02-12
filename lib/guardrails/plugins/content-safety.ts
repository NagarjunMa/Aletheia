// Content Safety and Hallucination Detection Plugin
// Purpose: Detect unsafe content, hallucinations, and factual inconsistencies

import OpenAI from 'openai'
import type {
  GuardrailPlugin,
  ValidationResult,
  ValidationContext,
  PluginConfig,
  Severity
} from '../types'
import { GuardrailLogger } from '../logging/logger'
import { getCurrentConfig } from '../config'

// ============================================================================
// CONTENT SAFETY PATTERNS
// ============================================================================

interface SafetyPattern {
  id: string
  name: string
  pattern: RegExp
  severity: Severity
  description: string
  category: 'harmful' | 'biased' | 'inappropriate' | 'privacy' | 'legal'
}

const CONTENT_SAFETY_PATTERNS: SafetyPattern[] = [
  // Harmful Content
  {
    id: 'violence-threat',
    name: 'Violence or Threats',
    pattern: /\b(?:kill|murder|hurt|harm|attack|violence|threat|weapon|bomb|explosive|suicide)\b/i,
    severity: 'critical',
    description: 'Content contains potential violence or threats',
    category: 'harmful'
  },
  {
    id: 'self-harm',
    name: 'Self-Harm References',
    pattern: /\b(?:self-harm|suicide|cutting|overdose|end.*life|kill myself)\b/i,
    severity: 'critical',
    description: 'Content contains self-harm references',
    category: 'harmful'
  },

  // Biased Content
  {
    id: 'discriminatory-language',
    name: 'Discriminatory Language',
    pattern: /\b(?:racist|sexist|homophobic|transphobic|xenophobic|bigot|hate|inferior|superior).*(?:race|gender|religion|nationality|sexuality)\b/i,
    severity: 'high',
    description: 'Content contains potentially discriminatory language',
    category: 'biased'
  },

  // Privacy Violations
  {
    id: 'personal-info',
    name: 'Personal Information',
    pattern: /\b(?:ssn|social security|credit card|passport|driver.*license|phone.*number|address|email.*password)\b/i,
    severity: 'high',
    description: 'Content may contain personal information',
    category: 'privacy'
  },
  {
    id: 'financial-info',
    name: 'Financial Information',
    pattern: /\b(?:\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}|\d{3}-\d{2}-\d{4}|account.*number|routing.*number)\b/i,
    severity: 'critical',
    description: 'Content contains potential financial information',
    category: 'privacy'
  },

  // Legal Issues
  {
    id: 'copyright-violation',
    name: 'Potential Copyright Violation',
    pattern: /(?:copyright|copyrighted|©|all rights reserved).*(?:material|content|text|work)/i,
    severity: 'medium',
    description: 'Content may contain copyrighted material',
    category: 'legal'
  },

  // Inappropriate Content
  {
    id: 'adult-content',
    name: 'Adult Content',
    pattern: /\b(?:sexual|erotic|pornographic|explicit|adult.*content|nsfw)\b/i,
    severity: 'high',
    description: 'Content may contain adult or sexual material',
    category: 'inappropriate'
  }
]

// ============================================================================
// HALLUCINATION DETECTION PATTERNS
// ============================================================================

interface HallucinationIndicator {
  id: string
  name: string
  check: (content: string, context: ValidationContext) => Promise<ValidationResult>
  severity: Severity
  description: string
}

const createHallucinationDetectors = (): HallucinationIndicator[] => [
  {
    id: 'factual-uncertainty',
    name: 'Factual Uncertainty Markers',
    check: async (content: string) => {
      const uncertaintyMarkers = [
        /\b(?:i think|i believe|i assume|probably|maybe|perhaps|might be|could be|seems like)\b/gi,
        /\b(?:i'm not sure|not certain|unclear|uncertain|possibly|allegedly)\b/gi,
        /\b(?:according to.*sources|some sources suggest|it's been reported)\b/gi
      ]

      let totalMatches = 0
      for (const pattern of uncertaintyMarkers) {
        const matches = content.match(pattern) || []
        totalMatches += matches.length
      }

      const words = content.split(/\s+/).length
      const uncertaintyRatio = totalMatches / words

      if (uncertaintyRatio > 0.05) { // More than 5% uncertainty markers
        return {
          isValid: false,
          severity: 'medium',
          reason: 'High frequency of uncertainty markers detected (potential hallucination)',
          confidence: 0.7,
          pluginId: 'content-safety',
          category: 'hallucination_risk'
        }
      }

      return {
        isValid: true,
        severity: 'none',
        reason: 'Acceptable level of factual uncertainty',
        confidence: 0.8,
        pluginId: 'content-safety',
        category: 'hallucination_check'
      }
    },
    severity: 'medium',
    description: 'Detects excessive uncertainty markers that may indicate hallucination'
  },
  {
    id: 'specific-false-claims',
    name: 'Specific False Claims',
    check: async (content: string) => {
      const falseClaimPatterns = [
        /\b(?:as of|since|after|before)\s+\d{4}\b/gi, // Date references that could be wrong
        /\b(?:according to|based on|research shows|studies indicate)\b/gi, // Unsourced claims
        /\b(?:statistics show|data reveals|reports confirm)\b/gi, // Unsourced statistics
        /\b(?:experts say|scientists believe|researchers found)\b/gi // Vague authority appeals
      ]

      let suspiciousClaimsCount = 0
      for (const pattern of falseClaimPatterns) {
        const matches = content.match(pattern) || []
        suspiciousClaimsCount += matches.length
      }

      if (suspiciousClaimsCount > 3) {
        return {
          isValid: false,
          severity: 'medium',
          reason: 'Multiple unsourced factual claims detected',
          confidence: 0.6,
          pluginId: 'content-safety',
          category: 'hallucination_risk'
        }
      }

      return {
        isValid: true,
        severity: 'none',
        reason: 'Acceptable level of factual claims',
        confidence: 0.7,
        pluginId: 'content-safety',
        category: 'hallucination_check'
      }
    },
    severity: 'medium',
    description: 'Detects patterns of potentially false or unsourced claims'
  },
  {
    id: 'inconsistent-information',
    name: 'Internal Inconsistencies',
    check: async (content: string) => {
      // Simple check for contradictory statements
      const contradictionPatterns = [
        { positive: /\b(?:always|never|all|none|every|no)\b/gi, negative: /\b(?:sometimes|some|few|many|most)\b/gi },
        { positive: /\b(?:definitely|certainly|absolutely)\b/gi, negative: /\b(?:maybe|perhaps|possibly|might)\b/gi }
      ]

      let inconsistencyScore = 0
      for (const { positive, negative } of contradictionPatterns) {
        const posMatches = (content.match(positive) || []).length
        const negMatches = (content.match(negative) || []).length

        if (posMatches > 0 && negMatches > 0) {
          inconsistencyScore += Math.min(posMatches, negMatches)
        }
      }

      if (inconsistencyScore > 2) {
        return {
          isValid: false,
          severity: 'low',
          reason: 'Potential internal inconsistencies detected',
          confidence: 0.5,
          pluginId: 'content-safety',
          category: 'consistency_issue'
        }
      }

      return {
        isValid: true,
        severity: 'none',
        reason: 'No significant inconsistencies detected',
        confidence: 0.6,
        pluginId: 'content-safety',
        category: 'consistency_check'
      }
    },
    severity: 'low',
    description: 'Detects potential internal inconsistencies in content'
  },
  {
    id: 'ai-disclosure-missing',
    name: 'Missing AI Disclosure',
    check: async (content: string, context: ValidationContext) => {
      // For formal content, check if AI assistance is disclosed when required
      if (context.contentType && ['proposal', 'letter'].includes(context.contentType)) {
        const hasAIDisclosure = /\b(?:ai assistance|artificial intelligence|automated|generated with ai|ai-assisted)\b/i.test(content)
        const contentLength = content.length

        // For longer formal documents, AI disclosure might be expected
        if (contentLength > 1000 && !hasAIDisclosure) {
          return {
            isValid: false,
            severity: 'low',
            reason: 'Formal document may require AI assistance disclosure',
            confidence: 0.4,
            pluginId: 'content-safety',
            category: 'disclosure_issue'
          }
        }
      }

      return {
        isValid: true,
        severity: 'none',
        reason: 'AI disclosure check passed',
        confidence: 0.5,
        pluginId: 'content-safety',
        category: 'disclosure_check'
      }
    },
    severity: 'low',
    description: 'Checks for appropriate AI assistance disclosure'
  }
]

// ============================================================================
// CONTENT SAFETY PLUGIN IMPLEMENTATION
// ============================================================================

export class ContentSafetyPlugin implements GuardrailPlugin {
  public readonly id = 'content-safety'
  public readonly name = 'Content Safety & Hallucination Detection'
  public readonly description = 'Detects unsafe content, hallucinations, and factual inconsistencies'
  public readonly version = '1.0.0'
  public readonly priority = 95
  public readonly type = 'output'
  public readonly enabled = true

  private logger = GuardrailLogger.getInstance()
  private openai: OpenAI | null = null
  private hallucinationDetectors: HallucinationIndicator[]

  constructor(public config: PluginConfig = {}) {
    this.hallucinationDetectors = createHallucinationDetectors()
    this.initializeOpenAI()
  }

  private async initializeOpenAI() {
    try {
      const config = getCurrentConfig()

      if (config.openai?.apiKey) {
        this.openai = new OpenAI({
          apiKey: config.openai.apiKey,
        })
      }
    } catch (error) {
      this.logger.warn('Failed to initialize OpenAI for content safety', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  async validate(content: string, context: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now()

    try {
      // Run all validation checks in parallel
      const [
        safetyResults,
        hallucinationResults,
        moderationResult
      ] = await Promise.all([
        this.runSafetyChecks(content, context),
        this.runHallucinationChecks(content, context),
        this.runOpenAIModeration(content)
      ])

      const validationTime = Date.now() - startTime

      // Aggregate results
      const allResults = [
        ...safetyResults,
        ...hallucinationResults,
        moderationResult
      ].filter(r => r && !r.isValid)

      if (allResults.length === 0) {
        await this.logger.logValidationPassed(context.correlationId, {
          pluginId: this.id,
          contentLength: content.length,
          validationTime,
          checksPerformed: CONTENT_SAFETY_PATTERNS.length + this.hallucinationDetectors.length + 1
        })

        return {
          isValid: true,
          severity: 'none',
          reason: 'Content safety validation passed all checks',
          confidence: 1.0,
          pluginId: this.id,
          category: 'safety_validation',
          metadata: {
            validationTime,
            checksPerformed: CONTENT_SAFETY_PATTERNS.length + this.hallucinationDetectors.length + 1
          }
        }
      }

      // Find highest severity issue
      const maxSeverity = this.getMaxSeverity(allResults.map(r => r.severity))
      const primaryIssue = allResults.find(r => r.severity === maxSeverity) || allResults[0]

      await this.logger.logSecurityViolation(context.correlationId, {
        type: primaryIssue.category,
        severity: primaryIssue.severity,
        pluginId: this.id,
        reason: primaryIssue.reason,
        action: maxSeverity === 'critical' ? 'block' : 'flag'
      }, {
        userId: context.userId,
        metadata: {
          validationTime,
          issuesFound: allResults.length,
          contentLength: content.length
        }
      })

      return {
        isValid: false,
        severity: maxSeverity,
        reason: `Content safety issue: ${primaryIssue.reason}`,
        confidence: Math.max(...allResults.map(r => r.confidence)),
        pluginId: this.id,
        category: primaryIssue.category,
        metadata: {
          validationTime,
          issuesFound: allResults.length,
          issues: allResults.map(r => ({
            severity: r.severity,
            reason: r.reason,
            confidence: r.confidence,
            category: r.category
          }))
        }
      }

    } catch (error) {
      const validationTime = Date.now() - startTime

      await this.logger.logValidationError(context.correlationId, error as Error, {
        userId: context.userId,
        content: content.substring(0, 100) + '...',
        metadata: { validationTime }
      })

      return {
        isValid: false,
        severity: 'high',
        reason: `Content safety validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.5,
        pluginId: this.id,
        category: 'validation_error',
        metadata: { validationTime, error: String(error) }
      }
    }
  }

  private async runSafetyChecks(content: string, context: ValidationContext): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []

    for (const pattern of CONTENT_SAFETY_PATTERNS) {
      const match = content.match(pattern.pattern)

      if (match) {
        results.push({
          isValid: false,
          severity: pattern.severity,
          reason: pattern.description,
          confidence: 0.8,
          pluginId: this.id,
          category: pattern.category,
          metadata: {
            patternId: pattern.id,
            patternName: pattern.name,
            matchedText: match[0]
          }
        })
      }
    }

    return results
  }

  private async runHallucinationChecks(content: string, context: ValidationContext): Promise<ValidationResult[]> {
    const results = await Promise.allSettled(
      this.hallucinationDetectors.map(detector => detector.check(content, context))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          isValid: false,
          severity: 'medium' as Severity,
          reason: `Hallucination check "${this.hallucinationDetectors[index].name}" failed: ${result.reason}`,
          confidence: 0.5,
          pluginId: this.id,
          category: 'hallucination_error'
        }
      }
    })
  }

  private async runOpenAIModeration(content: string): Promise<ValidationResult | null> {
    if (!this.openai) {
      return null
    }

    try {
      const moderation = await this.openai.moderations.create({
        input: content
      })

      const result = moderation.results[0]

      if (result.flagged) {
        const categories = Object.entries(result.categories)
          .filter(([_, flagged]) => flagged)
          .map(([category, _]) => category)

        const scores = Object.entries(result.category_scores)
          .filter(([category, _]) => categories.includes(category))
          .map(([category, score]) => ({ category, score }))
          .sort((a, b) => b.score - a.score)

        const primaryCategory = scores[0]?.category || 'unknown'
        const maxScore = scores[0]?.score || 0

        return {
          isValid: false,
          severity: maxScore > 0.8 ? 'critical' : maxScore > 0.5 ? 'high' : 'medium',
          reason: `Content flagged by OpenAI moderation: ${categories.join(', ')}`,
          confidence: maxScore,
          pluginId: this.id,
          category: 'moderation_violation',
          metadata: {
            categories,
            scores,
            primaryCategory,
            maxScore
          }
        }
      }

      return {
        isValid: true,
        severity: 'none',
        reason: 'OpenAI moderation passed',
        confidence: 1.0,
        pluginId: this.id,
        category: 'moderation_check'
      }

    } catch (error) {
      this.logger.warn('OpenAI moderation check failed', {
        error: error instanceof Error ? error.message : String(error)
      })

      return null
    }
  }

  private getMaxSeverity(severities: Severity[]): Severity {
    const severityOrder: Severity[] = ['none', 'low', 'medium', 'high', 'critical']
    let maxIndex = 0

    for (const severity of severities) {
      const index = severityOrder.indexOf(severity)
      if (index > maxIndex) {
        maxIndex = index
      }
    }

    return severityOrder[maxIndex]
  }
}

// ============================================================================
// PLUGIN FACTORY AND EXPORTS
// ============================================================================

export function createContentSafetyPlugin(config: PluginConfig = {}): ContentSafetyPlugin {
  return new ContentSafetyPlugin(config)
}

export { CONTENT_SAFETY_PATTERNS, createHallucinationDetectors }
export type { SafetyPattern, HallucinationIndicator }