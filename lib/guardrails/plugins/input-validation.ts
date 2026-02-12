// Advanced Input Validation Plugin for Guardrails
// Purpose: Detect prompt injections, malicious inputs, and policy violations

import type {
  GuardrailPlugin,
  ValidationResult,
  ValidationContext,
  PluginConfig,
  Severity
} from '../types'
import { GuardrailLogger } from '../logging/logger'

// ============================================================================
// VALIDATION PATTERNS AND RULES
// ============================================================================

interface PromptInjectionPattern {
  id: string
  name: string
  pattern: RegExp
  severity: Severity
  description: string
  category: 'jailbreak' | 'roleplay' | 'system_override' | 'data_extraction' | 'manipulation'
}

interface ContentPolicyRule {
  id: string
  name: string
  check: (content: string, context: ValidationContext) => Promise<ValidationResult>
  severity: Severity
  description: string
}

// ============================================================================
// PROMPT INJECTION PATTERNS
// ============================================================================

const PROMPT_INJECTION_PATTERNS: PromptInjectionPattern[] = [
  // Jailbreak Attempts
  {
    id: 'ignore-instructions',
    name: 'Ignore Previous Instructions',
    pattern: /(?:ignore|forget|disregard).*(?:previous|above|earlier|prior).*(?:instructions?|prompts?|rules?|guidelines?)/i,
    severity: 'critical',
    description: 'Attempts to override system instructions',
    category: 'jailbreak'
  },
  {
    id: 'new-instructions',
    name: 'New Instructions Override',
    pattern: /(?:new|different|updated).*instructions?.*(?:are|is|now|should be)/i,
    severity: 'critical',
    description: 'Attempts to inject new instructions',
    category: 'jailbreak'
  },
  {
    id: 'developer-mode',
    name: 'Developer Mode Activation',
    pattern: /(?:developer|debug|admin|root).*mode|enable.*(?:developer|debug|admin)/i,
    severity: 'high',
    description: 'Attempts to activate developer or debug modes',
    category: 'jailbreak'
  },

  // Role-Playing Attacks
  {
    id: 'roleplay-override',
    name: 'Role-Playing Override',
    pattern: /(?:pretend|act|behave|roleplay).*(?:as if|like|you are).*(?:not|no longer|without)/i,
    severity: 'high',
    description: 'Attempts to make AI roleplay as different entity',
    category: 'roleplay'
  },
  {
    id: 'character-injection',
    name: 'Character Injection',
    pattern: /you are now.*(?:character|person|entity|system)|from now on.*(?:you|assistant|ai)/i,
    severity: 'high',
    description: 'Attempts to inject new character or persona',
    category: 'roleplay'
  },

  // System Override Attempts
  {
    id: 'system-prompt',
    name: 'System Prompt Access',
    pattern: /(?:show|reveal|display|tell me).*(?:system|initial|original).*(?:prompt|message|instruction)/i,
    severity: 'medium',
    description: 'Attempts to access system prompts',
    category: 'system_override'
  },
  {
    id: 'content-policy-bypass',
    name: 'Content Policy Bypass',
    pattern: /(?:bypass|ignore|override).*(?:safety|content|policy|filter|guideline)/i,
    severity: 'critical',
    description: 'Attempts to bypass content policies',
    category: 'system_override'
  },

  // Data Extraction Attempts
  {
    id: 'training-data',
    name: 'Training Data Extraction',
    pattern: /(?:training|learned|memorized).*data|repeat.*(?:verbatim|exactly|word for word)/i,
    severity: 'medium',
    description: 'Attempts to extract training data',
    category: 'data_extraction'
  },
  {
    id: 'conversation-history',
    name: 'Conversation History Access',
    pattern: /(?:previous|earlier|past).*(?:conversation|chat|message|response)/i,
    severity: 'low',
    description: 'Attempts to access conversation history',
    category: 'data_extraction'
  },

  // Manipulation Techniques
  {
    id: 'urgency-manipulation',
    name: 'Urgency Manipulation',
    pattern: /(?:urgent|emergency|critical|life or death|immediately|right now).*(?:need|require|must have)/i,
    severity: 'low',
    description: 'Uses urgency to manipulate responses',
    category: 'manipulation'
  },
  {
    id: 'authority-impersonation',
    name: 'Authority Impersonation',
    pattern: /(?:i am|i'm).*(?:your|the).*(?:creator|developer|admin|owner|boss|manager)/i,
    severity: 'medium',
    description: 'Impersonates authority figures',
    category: 'manipulation'
  }
]

// ============================================================================
// CONTENT VALIDATION RULES
// ============================================================================

const createContentPolicyRules = (): ContentPolicyRule[] => [
  {
    id: 'excessive-length',
    name: 'Excessive Input Length',
    check: async (content: string) => {
      const maxLength = 10000 // 10k characters
      if (content.length > maxLength) {
        return {
          isValid: false,
          severity: 'medium',
          reason: `Input exceeds maximum length of ${maxLength} characters`,
          confidence: 1.0,
          pluginId: 'input-validation',
          category: 'policy_violation'
        }
      }
      return {
        isValid: true,
        severity: 'none',
        reason: 'Length validation passed',
        confidence: 1.0,
        pluginId: 'input-validation',
        category: 'policy_validation'
      }
    },
    severity: 'medium',
    description: 'Validates input length limits'
  },
  {
    id: 'repeated-patterns',
    name: 'Repeated Pattern Detection',
    check: async (content: string) => {
      // Check for excessive repetition (potential DoS attempt)
      const lines = content.split('\n')
      const uniqueLines = new Set(lines)
      const repetitionRatio = uniqueLines.size / lines.length

      if (repetitionRatio < 0.3 && lines.length > 20) {
        return {
          isValid: false,
          severity: 'medium',
          reason: 'Excessive repetition detected (possible DoS attempt)',
          confidence: 0.8,
          pluginId: 'input-validation',
          category: 'attack_pattern'
        }
      }
      return {
        isValid: true,
        severity: 'none',
        reason: 'Repetition validation passed',
        confidence: 1.0,
        pluginId: 'input-validation',
        category: 'policy_validation'
      }
    },
    severity: 'medium',
    description: 'Detects excessive repetition patterns'
  },
  {
    id: 'unicode-attacks',
    name: 'Unicode Attack Detection',
    check: async (content: string) => {
      // Check for potentially malicious unicode characters
      const suspiciousUnicodePattern = /[\u202E\u2066-\u2069\u200B-\u200D\uFEFF]/
      if (suspiciousUnicodePattern.test(content)) {
        return {
          isValid: false,
          severity: 'high',
          reason: 'Suspicious unicode characters detected (potential text direction attack)',
          confidence: 0.9,
          pluginId: 'input-validation',
          category: 'attack_pattern'
        }
      }
      return {
        isValid: true,
        severity: 'none',
        reason: 'Unicode validation passed',
        confidence: 1.0,
        pluginId: 'input-validation',
        category: 'policy_validation'
      }
    },
    severity: 'high',
    description: 'Detects malicious unicode attacks'
  },
  {
    id: 'base64-injection',
    name: 'Base64 Injection Detection',
    check: async (content: string) => {
      // Check for large base64 encoded content (potential payload injection)
      const base64Pattern = /(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?/g
      const base64Matches = content.match(base64Pattern) || []
      const largeBase64 = base64Matches.find(match => match.length > 1000)

      if (largeBase64) {
        return {
          isValid: false,
          severity: 'medium',
          reason: 'Large base64 encoded content detected (potential payload injection)',
          confidence: 0.7,
          pluginId: 'input-validation',
          category: 'attack_pattern'
        }
      }
      return {
        isValid: true,
        severity: 'none',
        reason: 'Base64 validation passed',
        confidence: 1.0,
        pluginId: 'input-validation',
        category: 'policy_validation'
      }
    },
    severity: 'medium',
    description: 'Detects base64 injection attempts'
  }
]

// ============================================================================
// INPUT VALIDATION PLUGIN IMPLEMENTATION
// ============================================================================

export class InputValidationPlugin implements GuardrailPlugin {
  public readonly id = 'input-validation'
  public readonly name = 'Advanced Input Validation'
  public readonly description = 'Detects prompt injections, malicious inputs, and policy violations'
  public readonly version = '1.0.0'
  public readonly priority = 100 // High priority
  public readonly type = 'input'
  public readonly enabled = true

  private logger = GuardrailLogger.getInstance()
  private contentPolicyRules: ContentPolicyRule[]

  constructor(public config: PluginConfig = {}) {
    this.contentPolicyRules = createContentPolicyRules()
  }

  async validate(content: string, context: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now()

    try {
      // Run all validation checks in parallel
      const [
        injectionResult,
        policyResults
      ] = await Promise.all([
        this.detectPromptInjection(content, context),
        this.runContentPolicyChecks(content, context)
      ])

      const validationTime = Date.now() - startTime

      // Aggregate results
      const allResults = [injectionResult, ...policyResults].filter(r => !r.isValid)

      if (allResults.length === 0) {
        await this.logger.logValidationPassed(context.correlationId, {
          pluginId: this.id,
          contentLength: content.length,
          validationTime,
          checksPerformed: 1 + this.contentPolicyRules.length
        })

        return {
          isValid: true,
          severity: 'none',
          reason: 'Input validation passed all checks',
          confidence: 1.0,
          pluginId: this.id,
          category: 'validation_success',
          metadata: {
            validationTime,
            checksPerformed: 1 + this.contentPolicyRules.length
          }
        }
      }

      // Find highest severity issue
      const maxSeverity = this.getMaxSeverity(allResults.map(r => r.severity))
      const primaryIssue = allResults.find(r => r.severity === maxSeverity) || allResults[0]

      await this.logger.logValidationFailed(context.correlationId, new Error('Input validation failed'), {
        userId: context.userId,
        content: content.substring(0, 100) + '...',
        metadata: {
          validationTime,
          issuesFound: allResults.length,
          primaryIssue: primaryIssue.reason,
          severity: maxSeverity
        }
      })

      return {
        isValid: false,
        severity: maxSeverity,
        reason: `Input validation failed: ${primaryIssue.reason}`,
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
        reason: `Input validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.5,
        pluginId: this.id,
        category: 'validation_error',
        metadata: { validationTime, error: String(error) }
      }
    }
  }

  private async detectPromptInjection(content: string, context: ValidationContext): Promise<ValidationResult> {
    const detectedPatterns: Array<{ pattern: PromptInjectionPattern; match: RegExpMatchArray }> = []

    // Check against all patterns
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      const match = content.match(pattern.pattern)
      if (match) {
        detectedPatterns.push({ pattern, match })
      }
    }

    if (detectedPatterns.length === 0) {
      return {
        isValid: true,
        severity: 'none',
        reason: 'No prompt injection patterns detected',
        confidence: 1.0,
        pluginId: this.id,
        category: 'injection_check'
      }
    }

    // Find the most severe pattern
    const maxSeverity = this.getMaxSeverity(detectedPatterns.map(d => d.pattern.severity))
    const primaryPattern = detectedPatterns.find(d => d.pattern.severity === maxSeverity)?.pattern

    if (!primaryPattern) {
      return {
        isValid: true,
        severity: 'none',
        reason: 'No significant patterns detected',
        confidence: 1.0,
        pluginId: this.id,
        category: 'injection_check'
      }
    }

    return {
      isValid: false,
      severity: primaryPattern.severity,
      reason: `Potential prompt injection detected: ${primaryPattern.description}`,
      confidence: 0.85,
      pluginId: this.id,
      category: 'prompt_injection',
      metadata: {
        patternId: primaryPattern.id,
        patternName: primaryPattern.name,
        category: primaryPattern.category,
        detectedPatterns: detectedPatterns.map(d => ({
          id: d.pattern.id,
          name: d.pattern.name,
          severity: d.pattern.severity,
          matchedText: d.match[0]
        }))
      }
    }
  }

  private async runContentPolicyChecks(content: string, context: ValidationContext): Promise<ValidationResult[]> {
    const results = await Promise.allSettled(
      this.contentPolicyRules.map(rule => rule.check(content, context))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          isValid: false,
          severity: 'medium' as Severity,
          reason: `Policy check "${this.contentPolicyRules[index].name}" failed: ${result.reason}`,
          confidence: 0.5,
          pluginId: this.id,
          category: 'policy_error'
        }
      }
    })
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

export function createInputValidationPlugin(config: PluginConfig = {}): InputValidationPlugin {
  return new InputValidationPlugin(config)
}

export { PROMPT_INJECTION_PATTERNS, createContentPolicyRules }
export type { PromptInjectionPattern, ContentPolicyRule }