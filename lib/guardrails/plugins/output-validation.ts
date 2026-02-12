// Structured Output Validation Plugin using Instructor.js
// Purpose: Validate AI outputs against expected schemas and business rules

import Instructor from '@instructor-ai/instructor'
import OpenAI from 'openai'
import { z } from 'zod'
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
// VALIDATION SCHEMAS
// ============================================================================

// Base response schema for all outputs
const BaseResponseSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
  reasoning: z.string().optional(),
  sources: z.array(z.string().url()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

// Content type specific schemas
const EmailResponseSchema = BaseResponseSchema.extend({
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  tone: z.enum(['formal', 'casual', 'professional', 'friendly']),
  hasGreeting: z.boolean(),
  hasClosing: z.boolean(),
  recipientCount: z.number().min(1).optional()
})

const ProposalResponseSchema = BaseResponseSchema.extend({
  executiveSummary: z.string().min(100, 'Executive summary must be substantial'),
  sections: z.array(z.object({
    title: z.string(),
    content: z.string(),
    wordCount: z.number()
  })).min(3, 'Proposal must have at least 3 sections'),
  totalWordCount: z.number().min(500, 'Proposal must be at least 500 words'),
  hasCallToAction: z.boolean()
})

const LetterResponseSchema = BaseResponseSchema.extend({
  addressee: z.string().min(2, 'Addressee must be specified'),
  formality: z.enum(['formal', 'semi-formal', 'informal']),
  purpose: z.enum(['complaint', 'inquiry', 'application', 'recommendation', 'other']),
  hasProperFormat: z.boolean(),
  wordCount: z.number().min(50)
})

const CPLAnalysisSchema = BaseResponseSchema.extend({
  analysisType: z.enum(['tone', 'style', 'structure', 'content', 'comprehensive']),
  insights: z.array(z.object({
    category: z.string(),
    observation: z.string(),
    confidence: z.number().min(0).max(1)
  })).min(1, 'Analysis must provide at least one insight'),
  recommendations: z.array(z.string()).optional(),
  score: z.number().min(0).max(100).optional()
})

// ============================================================================
// CONTENT QUALITY VALIDATORS
// ============================================================================

interface QualityRule {
  id: string
  name: string
  check: (content: string, context: ValidationContext) => Promise<ValidationResult>
  severity: Severity
  description: string
  contentTypes?: string[]
}

const createQualityRules = (): QualityRule[] => [
  {
    id: 'coherence-check',
    name: 'Content Coherence',
    check: async (content: string) => {
      // Check for basic coherence indicators
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
      const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length

      // Very short or very long average sentences might indicate poor quality
      if (avgSentenceLength < 20 || avgSentenceLength > 200) {
        return {
          isValid: false,
          severity: 'medium',
          reason: 'Content shows potential coherence issues (unusual sentence structure)',
          confidence: 0.7,
          pluginId: 'output-validation',
          category: 'quality_issue'
        }
      }

      return {
        isValid: true,
        severity: 'none',
        reason: 'Content coherence check passed',
        confidence: 0.8,
        pluginId: 'output-validation',
        category: 'quality_validation'
      }
    },
    severity: 'medium',
    description: 'Validates content coherence and structure'
  },
  {
    id: 'repetition-check',
    name: 'Content Repetition',
    check: async (content: string) => {
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10)
      const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()))
      const repetitionRatio = uniqueSentences.size / sentences.length

      if (repetitionRatio < 0.7 && sentences.length > 5) {
        return {
          isValid: false,
          severity: 'medium',
          reason: 'Content contains excessive repetition',
          confidence: 0.9,
          pluginId: 'output-validation',
          category: 'quality_issue'
        }
      }

      return {
        isValid: true,
        severity: 'none',
        reason: 'Repetition check passed',
        confidence: 0.9,
        pluginId: 'output-validation',
        category: 'quality_validation'
      }
    },
    severity: 'medium',
    description: 'Detects excessive content repetition'
  },
  {
    id: 'completion-check',
    name: 'Response Completion',
    check: async (content: string) => {
      // Check if response appears to be cut off
      const endsWithPunctuation = /[.!?"]$/.test(content.trim())
      const hasIncompleteMarkers = /\.\.\.$|--$|\s+$/.test(content)

      if (!endsWithPunctuation || hasIncompleteMarkers) {
        return {
          isValid: false,
          severity: 'high',
          reason: 'Response appears incomplete or cut off',
          confidence: 0.8,
          pluginId: 'output-validation',
          category: 'completion_issue'
        }
      }

      return {
        isValid: true,
        severity: 'none',
        reason: 'Response completion check passed',
        confidence: 0.8,
        pluginId: 'output-validation',
        category: 'quality_validation'
      }
    },
    severity: 'high',
    description: 'Validates response completion'
  },
  {
    id: 'hallucination-markers',
    name: 'Hallucination Detection',
    check: async (content: string, context: ValidationContext) => {
      // Check for common hallucination markers
      const hallucinationPatterns = [
        /as of my last update/i,
        /i don't have access to real-time/i,
        /according to my training data/i,
        /i cannot browse the internet/i,
        /as an ai language model/i,
        /i should mention that/i
      ]

      const detectedPatterns = hallucinationPatterns.filter(pattern => pattern.test(content))

      if (detectedPatterns.length > 2) {
        return {
          isValid: false,
          severity: 'medium',
          reason: 'Content contains multiple AI limitation disclosures (potential hallucination indicators)',
          confidence: 0.7,
          pluginId: 'output-validation',
          category: 'hallucination_risk'
        }
      }

      return {
        isValid: true,
        severity: 'none',
        reason: 'Hallucination markers check passed',
        confidence: 0.7,
        pluginId: 'output-validation',
        category: 'quality_validation'
      }
    },
    severity: 'medium',
    description: 'Detects potential hallucination markers',
    contentTypes: ['email', 'letter', 'proposal']
  },
  {
    id: 'professional-tone',
    name: 'Professional Tone Validation',
    check: async (content: string, context: ValidationContext) => {
      if (!context.contentType || ['email', 'letter', 'proposal'].includes(context.contentType)) {
        const unprofessionalPatterns = [
          /\b(lol|omg|wtf|lmao|brb|fyi|asap)\b/i,
          /!!!+/,
          /\?\?\?+/,
          /\b(gonna|wanna|gotta|dunno)\b/i
        ]

        const detectedPatterns = unprofessionalPatterns.filter(pattern => pattern.test(content))

        if (detectedPatterns.length > 0) {
          return {
            isValid: false,
            severity: 'low',
            reason: 'Content contains informal language inappropriate for professional context',
            confidence: 0.8,
            pluginId: 'output-validation',
            category: 'tone_issue'
          }
        }
      }

      return {
        isValid: true,
        severity: 'none',
        reason: 'Professional tone check passed',
        confidence: 0.8,
        pluginId: 'output-validation',
        category: 'quality_validation'
      }
    },
    severity: 'low',
    description: 'Validates professional tone for business content',
    contentTypes: ['email', 'letter', 'proposal']
  }
]

// ============================================================================
// OUTPUT VALIDATION PLUGIN IMPLEMENTATION
// ============================================================================

export class OutputValidationPlugin implements GuardrailPlugin {
  public readonly id = 'output-validation'
  public readonly name = 'Structured Output Validation'
  public readonly description = 'Validates AI outputs using Instructor.js schemas and quality rules'
  public readonly version = '1.0.0'
  public readonly priority = 90
  public readonly type = 'output'
  public readonly enabled = true

  private logger = GuardrailLogger.getInstance()
  private instructor: Instructor | null = null
  private qualityRules: QualityRule[]

  constructor(public config: PluginConfig = {}) {
    this.qualityRules = createQualityRules()
    this.initializeInstructor()
  }

  private async initializeInstructor() {
    try {
      const config = getCurrentConfig()

      if (config.instructor?.apiKey) {
        const openai = new OpenAI({
          apiKey: config.instructor.apiKey,
        })

        this.instructor = Instructor({
          client: openai,
          mode: "FUNCTIONS"
        })
      }
    } catch (error) {
      this.logger.warn('Failed to initialize Instructor.js', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  async validate(content: string, context: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now()

    try {
      // Run validation checks in parallel
      const [
        schemaResult,
        qualityResults
      ] = await Promise.all([
        this.validateSchema(content, context),
        this.runQualityChecks(content, context)
      ])

      const validationTime = Date.now() - startTime

      // Aggregate results
      const allResults = [schemaResult, ...qualityResults].filter(r => !r.isValid)

      if (allResults.length === 0) {
        await this.logger.logValidationPassed(context.correlationId, {
          pluginId: this.id,
          contentLength: content.length,
          validationTime,
          checksPerformed: 1 + this.qualityRules.length
        })

        return {
          isValid: true,
          severity: 'none',
          reason: 'Output validation passed all checks',
          confidence: 1.0,
          pluginId: this.id,
          category: 'validation_success',
          metadata: {
            validationTime,
            checksPerformed: 1 + this.qualityRules.length,
            contentType: context.contentType
          }
        }
      }

      // Find highest severity issue
      const maxSeverity = this.getMaxSeverity(allResults.map(r => r.severity))
      const primaryIssue = allResults.find(r => r.severity === maxSeverity) || allResults[0]

      await this.logger.logValidationFailed(context.correlationId, new Error('Output validation failed'), {
        userId: context.userId,
        content: content.substring(0, 100) + '...',
        metadata: {
          validationTime,
          issuesFound: allResults.length,
          primaryIssue: primaryIssue.reason,
          severity: maxSeverity,
          contentType: context.contentType
        }
      })

      return {
        isValid: false,
        severity: maxSeverity,
        reason: `Output validation failed: ${primaryIssue.reason}`,
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
        reason: `Output validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.5,
        pluginId: this.id,
        category: 'validation_error',
        metadata: { validationTime, error: String(error) }
      }
    }
  }

  private async validateSchema(content: string, context: ValidationContext): Promise<ValidationResult> {
    if (!this.instructor) {
      return {
        isValid: true,
        severity: 'none',
        reason: 'Schema validation skipped (Instructor.js not available)',
        confidence: 0.5,
        pluginId: this.id,
        category: 'schema_validation'
      }
    }

    try {
      const schema = this.getSchemaForContentType(context.contentType)

      if (!schema) {
        return {
          isValid: true,
          severity: 'none',
          reason: 'No specific schema defined for content type',
          confidence: 0.8,
          pluginId: this.id,
          category: 'schema_validation'
        }
      }

      // Parse content as structured data
      const parsedContent = await this.instructor.chat.completions.create({
        model: "gpt-3.5-turbo",
        response_model: { schema, name: "OutputValidation" },
        messages: [
          {
            role: "user",
            content: `Parse and validate this ${context.contentType || 'content'}: ${content}`
          }
        ],
        max_retries: 1
      })

      return {
        isValid: true,
        severity: 'none',
        reason: 'Content matches expected schema',
        confidence: 0.9,
        pluginId: this.id,
        category: 'schema_validation',
        metadata: { parsedContent }
      }

    } catch (error) {
      return {
        isValid: false,
        severity: 'medium',
        reason: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.7,
        pluginId: this.id,
        category: 'schema_error'
      }
    }
  }

  private async runQualityChecks(content: string, context: ValidationContext): Promise<ValidationResult[]> {
    const applicableRules = this.qualityRules.filter(rule =>
      !rule.contentTypes || !context.contentType || rule.contentTypes.includes(context.contentType)
    )

    const results = await Promise.allSettled(
      applicableRules.map(rule => rule.check(content, context))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          isValid: false,
          severity: 'medium' as Severity,
          reason: `Quality check "${applicableRules[index].name}" failed: ${result.reason}`,
          confidence: 0.5,
          pluginId: this.id,
          category: 'quality_error'
        }
      }
    })
  }

  private getSchemaForContentType(contentType?: string): z.ZodSchema | null {
    switch (contentType) {
      case 'email':
        return EmailResponseSchema
      case 'proposal':
        return ProposalResponseSchema
      case 'letter':
        return LetterResponseSchema
      case 'cpl-analysis':
        return CPLAnalysisSchema
      default:
        return BaseResponseSchema
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

export function createOutputValidationPlugin(config: PluginConfig = {}): OutputValidationPlugin {
  return new OutputValidationPlugin(config)
}

export {
  BaseResponseSchema,
  EmailResponseSchema,
  ProposalResponseSchema,
  LetterResponseSchema,
  CPLAnalysisSchema,
  createQualityRules
}

export type { QualityRule }