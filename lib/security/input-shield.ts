/**
 * Layer 1: Input Shield - Advanced Input Guardrails with XML Sandboxing
 *
 * Purpose: First line of defense in the 4-layer security framework
 * - Advanced prompt injection detection
 * - XML-based content sandboxing
 * - Multi-pattern analysis with confidence scoring
 * - Integration with existing security infrastructure
 *
 * Performance: <25ms latency target with caching optimization
 */

import { z } from 'zod'
import { securityValidator, type SecurityValidationResult } from './enhanced-validation'
import { ContentSanitizer, containsDangerousPatterns } from './input-validation'

export interface InputShieldConfig {
  enableXMLSandboxing: boolean
  enableSemanticAnalysis: boolean
  enableBehavioralDetection: boolean
  strictMode: boolean
  cacheValidation: boolean
  logViolations: boolean
}

export interface InputShieldResult {
  isValid: boolean
  confidence: number
  violations: ShieldViolation[]
  sanitizedContent: string
  xmlSandboxed: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  processingTime: number
}

export interface ShieldViolation {
  type: 'injection' | 'jailbreak' | 'extraction' | 'encoding' | 'social' | 'xml_escape'
  severity: 'low' | 'medium' | 'high' | 'critical'
  pattern: string
  confidence: number
  location: number
  layer: 'pattern' | 'semantic' | 'behavioral' | 'xml'
  description: string
}

/**
 * XML Sandboxing Patterns - Prevent XML escape attempts
 */
const XML_ESCAPE_PATTERNS = [
  // XML entity injection
  /&[a-zA-Z][a-zA-Z0-9]*;/g,
  /&#\d+;/g,
  /&#x[0-9a-fA-F]+;/g,

  // XML structure escape attempts
  /<\/[^>]*>/gi,
  /<[^>]*>/gi,
  /\]\]>/gi,
  /<!\[CDATA\[/gi,

  // XML processing instruction injection
  /<\?[^>]*\?>/gi,
  /<!DOCTYPE[^>]*>/gi,

  // XML namespace injection
  /xmlns\s*=\s*['"]/gi,

  // XML comment injection for data exfiltration
  /<!--[\s\S]*?-->/gi
]

/**
 * Advanced Behavioral Patterns - 2025 attack vectors
 */
const BEHAVIORAL_PATTERNS = [
  {
    name: 'chain_of_thought_manipulation',
    patterns: [
      /let['']?s think step by step/gi,
      /think step by step/gi,
      /reasoning step by step/gi
    ],
    context: ['ignore', 'forget', 'override', 'system'],
    weight: 0.8
  },
  {
    name: 'emotional_manipulation',
    patterns: [
      /this is (very )?important/gi,
      /please (help|assist)/gi,
      /i (need|require) your help/gi
    ],
    context: ['emergency', 'urgent', 'critical', 'life', 'death'],
    weight: 0.7
  },
  {
    name: 'authority_impersonation',
    patterns: [
      /i am (the )?(admin|administrator|developer)/gi,
      /(ceo|manager|supervisor) said/gi,
      /company policy requires/gi
    ],
    context: ['override', 'access', 'permission', 'allow'],
    weight: 0.9
  },
  {
    name: 'technical_social_engineering',
    patterns: [
      /debug mode/gi,
      /maintenance mode/gi,
      /test environment/gi,
      /development setting/gi
    ],
    context: ['enable', 'activate', 'switch', 'turn on'],
    weight: 0.8
  }
]

/**
 * Semantic Context Analysis - Intent detection
 */
const SEMANTIC_CONTEXTS = {
  systemOverride: {
    keywords: ['ignore', 'forget', 'disregard', 'override', 'bypass'],
    triggers: ['previous', 'instructions', 'rules', 'system', 'prompt'],
    riskMultiplier: 1.5
  },
  informationExtraction: {
    keywords: ['show', 'tell', 'reveal', 'display', 'output', 'print'],
    triggers: ['prompt', 'instructions', 'system', 'internal', 'configuration'],
    riskMultiplier: 2.0
  },
  roleManipulation: {
    keywords: ['act', 'pretend', 'simulate', 'become', 'transform'],
    triggers: ['character', 'person', 'mode', 'role', 'personality'],
    riskMultiplier: 1.3
  }
}

/**
 * Input Shield Class - First Layer Defense
 */
export class InputShield {
  private config: InputShieldConfig
  private validationCache: Map<string, InputShieldResult> = new Map()
  private patternCache: Map<string, boolean> = new Map()

  constructor(config: Partial<InputShieldConfig> = {}) {
    this.config = {
      enableXMLSandboxing: true,
      enableSemanticAnalysis: true,
      enableBehavioralDetection: true,
      strictMode: process.env.NODE_ENV === 'production',
      cacheValidation: true,
      logViolations: true,
      ...config
    }
  }

  /**
   * Main shield validation - comprehensive input protection
   */
  async validateInput(
    content: string,
    userId?: string,
    category: string = 'general'
  ): Promise<InputShieldResult> {
    const startTime = Date.now()

    try {
      // Check cache first for performance
      const cacheKey = this.generateCacheKey(content, userId, category)
      if (this.config.cacheValidation && this.validationCache.has(cacheKey)) {
        const cached = this.validationCache.get(cacheKey)!
        return { ...cached, processingTime: Date.now() - startTime }
      }

      const violations: ShieldViolation[] = []

      // Layer 1A: Pattern-based detection (existing + enhanced)
      const patternViolations = await this.detectPatternViolations(content)
      violations.push(...patternViolations)

      // Layer 1B: XML sandboxing validation
      if (this.config.enableXMLSandboxing) {
        const xmlViolations = this.detectXMLEscapeAttempts(content)
        violations.push(...xmlViolations)
      }

      // Layer 1C: Semantic analysis
      if (this.config.enableSemanticAnalysis) {
        const semanticViolations = this.detectSemanticViolations(content)
        violations.push(...semanticViolations)
      }

      // Layer 1D: Behavioral pattern detection
      if (this.config.enableBehavioralDetection) {
        const behavioralViolations = this.detectBehavioralPatterns(content)
        violations.push(...behavioralViolations)
      }

      // Calculate risk assessment
      const riskScore = this.calculateRiskScore(violations)
      const riskLevel = this.determineRiskLevel(riskScore)
      const confidence = this.calculateConfidence(violations)

      // Determine validity
      const isValid = this.isInputValid(violations, riskScore)

      // Generate sanitized and XML-sandboxed content
      const sanitizedContent = this.sanitizeContent(content, violations)
      const xmlSandboxed = this.applyXMLSandboxing(sanitizedContent)

      const result: InputShieldResult = {
        isValid,
        confidence,
        violations,
        sanitizedContent,
        xmlSandboxed,
        riskLevel,
        processingTime: Date.now() - startTime
      }

      // Cache result if enabled
      if (this.config.cacheValidation && result.processingTime < 100) {
        this.validationCache.set(cacheKey, result)

        // Clean old cache entries periodically
        if (this.validationCache.size > 1000) {
          this.cleanCache()
        }
      }

      // Log violations if configured
      if (this.config.logViolations && violations.length > 0) {
        this.logShieldViolation(content, violations, userId, category)
      }

      return result

    } catch (error) {
      console.error('Input Shield validation error:', error)

      // Fail securely - reject on error
      return {
        isValid: false,
        confidence: 0,
        violations: [{
          type: 'injection',
          severity: 'critical',
          pattern: 'validation_error',
          confidence: 100,
          location: 0,
          layer: 'pattern',
          description: 'Input Shield validation failed - content blocked as precaution'
        }],
        sanitizedContent: ContentSanitizer.sanitizePlainText(content),
        xmlSandboxed: this.applyXMLSandboxing(content),
        riskLevel: 'critical',
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Enhanced pattern violation detection with existing integration
   */
  private async detectPatternViolations(content: string): Promise<ShieldViolation[]> {
    const violations: ShieldViolation[] = []

    // Integrate with existing enhanced validation
    try {
      const enhancedResult = await securityValidator.validateContent(content)

      if (!enhancedResult.isValid) {
        for (const violation of enhancedResult.violations) {
          violations.push({
            type: this.mapEnhancedViolationType(violation.type),
            severity: violation.severity,
            pattern: violation.pattern,
            confidence: violation.confidence,
            location: violation.location,
            layer: 'pattern',
            description: `Enhanced: ${violation.description}`
          })
        }
      }
    } catch (error) {
      console.warn('Enhanced validation integration error:', error)
    }

    // Add basic pattern check as fallback
    if (containsDangerousPatterns(content)) {
      violations.push({
        type: 'injection',
        severity: 'high',
        pattern: 'dangerous_pattern_detected',
        confidence: 85,
        location: 0,
        layer: 'pattern',
        description: 'Basic dangerous pattern detected'
      })
    }

    return violations
  }

  /**
   * XML escape attempt detection
   */
  private detectXMLEscapeAttempts(content: string): ShieldViolation[] {
    const violations: ShieldViolation[] = []

    for (const pattern of XML_ESCAPE_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern))

      for (const match of matches) {
        const severity = this.assessXMLViolationSeverity(match[0])
        violations.push({
          type: 'xml_escape',
          severity,
          pattern: match[0],
          confidence: 90,
          location: match.index || 0,
          layer: 'xml',
          description: `XML escape attempt detected: "${match[0]}"`
        })
      }
    }

    return violations
  }

  /**
   * Advanced semantic analysis
   */
  private detectSemanticViolations(content: string): ShieldViolation[] {
    const violations: ShieldViolation[] = []
    const contentLower = content.toLowerCase()

    for (const [contextName, context] of Object.entries(SEMANTIC_CONTEXTS)) {
      const keywordMatches = context.keywords.filter(keyword =>
        contentLower.includes(keyword)
      ).length

      const triggerMatches = context.triggers.filter(trigger =>
        contentLower.includes(trigger)
      ).length

      if (keywordMatches > 0 && triggerMatches > 0) {
        const baseConfidence = Math.min(100, (keywordMatches + triggerMatches) * 25)
        const adjustedConfidence = baseConfidence * context.riskMultiplier

        if (adjustedConfidence > 70) {
          violations.push({
            type: 'injection',
            severity: adjustedConfidence > 90 ? 'high' : 'medium',
            pattern: contextName,
            confidence: Math.min(100, adjustedConfidence),
            location: 0,
            layer: 'semantic',
            description: `Semantic analysis detected ${contextName} intent`
          })
        }
      }
    }

    return violations
  }

  /**
   * Behavioral pattern detection for sophisticated attacks
   */
  private detectBehavioralPatterns(content: string): ShieldViolation[] {
    const violations: ShieldViolation[] = []
    const contentLower = content.toLowerCase()

    for (const behavior of BEHAVIORAL_PATTERNS) {
      const patternMatches = behavior.patterns.filter(pattern =>
        pattern.test(content)
      ).length

      const contextMatches = behavior.context.filter(context =>
        contentLower.includes(context)
      ).length

      if (patternMatches > 0 && contextMatches > 0) {
        const confidence = Math.min(100, (patternMatches + contextMatches) * behavior.weight * 30)

        if (confidence > 65) {
          violations.push({
            type: 'social',
            severity: confidence > 85 ? 'high' : 'medium',
            pattern: behavior.name,
            confidence,
            location: 0,
            layer: 'behavioral',
            description: `Behavioral analysis detected ${behavior.name}`
          })
        }
      }
    }

    return violations
  }

  /**
   * XML Sandboxing - Wrap content to prevent XML injection
   */
  private applyXMLSandboxing(content: string): string {
    // Escape all XML special characters
    let sandboxed = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')

    // Wrap in CDATA section for additional protection
    sandboxed = `<![CDATA[${sandboxed}]]>`

    // Wrap in XML sandbox container with namespace isolation
    sandboxed = `<sandbox xmlns:user="urn:user-content" xmlns:safe="urn:safe-content">
      <user:input>${sandboxed}</user:input>
    </sandbox>`

    return sandboxed
  }

  /**
   * Content sanitization with violation-specific handling
   */
  private sanitizeContent(content: string, violations: ShieldViolation[]): string {
    let sanitized = ContentSanitizer.sanitizePlainText(content)

    // Apply specific sanitization based on violation types
    for (const violation of violations) {
      switch (violation.type) {
        case 'xml_escape':
          sanitized = sanitized.replace(new RegExp(this.escapeRegex(violation.pattern), 'gi'), '[XML-FILTERED]')
          break
        case 'injection':
          sanitized = sanitized.replace(new RegExp(this.escapeRegex(violation.pattern), 'gi'), '[INJECTION-FILTERED]')
          break
        case 'jailbreak':
          sanitized = sanitized.replace(new RegExp(this.escapeRegex(violation.pattern), 'gi'), '[JAILBREAK-FILTERED]')
          break
        case 'extraction':
          sanitized = sanitized.replace(new RegExp(this.escapeRegex(violation.pattern), 'gi'), '[EXTRACTION-FILTERED]')
          break
        case 'social':
          sanitized = sanitized.replace(new RegExp(this.escapeRegex(violation.pattern), 'gi'), '[SOCIAL-FILTERED]')
          break
      }
    }

    return sanitized
  }

  /**
   * Risk calculation with multi-factor assessment
   */
  private calculateRiskScore(violations: ShieldViolation[]): number {
    if (violations.length === 0) return 0

    const severityWeights = { low: 1, medium: 3, high: 6, critical: 10 }
    const layerWeights = { pattern: 1.0, semantic: 1.2, behavioral: 1.5, xml: 1.3 }

    const totalScore = violations.reduce((sum, violation) => {
      const severityWeight = severityWeights[violation.severity]
      const layerWeight = layerWeights[violation.layer]
      const confidenceMultiplier = violation.confidence / 100

      return sum + (severityWeight * layerWeight * confidenceMultiplier)
    }, 0)

    return Math.min(100, totalScore * 5)
  }

  /**
   * Confidence calculation with layer diversity bonus
   */
  private calculateConfidence(violations: ShieldViolation[]): number {
    if (violations.length === 0) return 100

    const avgConfidence = violations.reduce((sum, v) => sum + v.confidence, 0) / violations.length
    const uniqueLayers = new Set(violations.map(v => v.layer)).size
    const layerDiversityBonus = Math.min(15, uniqueLayers * 3)

    return Math.min(100, avgConfidence + layerDiversityBonus)
  }

  /**
   * Validity determination with configurable thresholds
   */
  private isInputValid(violations: ShieldViolation[], riskScore: number): boolean {
    if (violations.length === 0) return true

    const criticalViolations = violations.filter(v => v.severity === 'critical')
    if (criticalViolations.length > 0) return false

    const threshold = this.config.strictMode ? 35 : 50
    return riskScore < threshold
  }

  /**
   * Helper methods
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical'
    if (score >= 60) return 'high'
    if (score >= 30) return 'medium'
    return 'low'
  }

  private assessXMLViolationSeverity(pattern: string): ShieldViolation['severity'] {
    if (pattern.includes('CDATA') || pattern.includes('DOCTYPE')) return 'critical'
    if (pattern.includes('<?') || pattern.includes('xmlns')) return 'high'
    if (pattern.includes('<!--')) return 'medium'
    return 'low'
  }

  private mapEnhancedViolationType(type: string): ShieldViolation['type'] {
    const mapping: Record<string, ShieldViolation['type']> = {
      'prompt_injection': 'injection',
      'jailbreak': 'jailbreak',
      'system_extraction': 'extraction',
      'social_engineering': 'social',
      'malicious_content': 'injection'
    }
    return mapping[type] || 'injection'
  }

  private generateCacheKey(content: string, userId?: string, category?: string): string {
    const hash = this.simpleHash(content + (userId || '') + (category || ''))
    return `shield_${hash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private cleanCache(): void {
    // Keep only most recent 500 entries
    const entries = Array.from(this.validationCache.entries())
    this.validationCache.clear()
    entries.slice(-500).forEach(([key, value]) => {
      this.validationCache.set(key, value)
    })
  }

  private logShieldViolation(
    content: string,
    violations: ShieldViolation[],
    userId?: string,
    category?: string
  ): void {
    console.warn('🛡️ Input Shield violation detected:', {
      timestamp: new Date().toISOString(),
      layer: 'input_shield',
      userId: userId ? `user_${userId.slice(-4)}` : 'anonymous',
      category: category || 'unknown',
      violationCount: violations.length,
      maxSeverity: Math.max(...violations.map(v =>
        v.severity === 'critical' ? 4 : v.severity === 'high' ? 3 : v.severity === 'medium' ? 2 : 1
      )),
      layers: Array.from(new Set(violations.map(v => v.layer))),
      contentHash: this.simpleHash(content),
      riskLevel: this.determineRiskLevel(this.calculateRiskScore(violations))
    })
  }

  /**
   * Public configuration methods
   */
  updateConfig(newConfig: Partial<InputShieldConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  getStats(): {
    cacheHits: number
    totalValidations: number
    configStatus: InputShieldConfig
  } {
    return {
      cacheHits: this.validationCache.size,
      totalValidations: this.validationCache.size + this.patternCache.size,
      configStatus: this.config
    }
  }

  clearCache(): void {
    this.validationCache.clear()
    this.patternCache.clear()
  }
}

/**
 * Singleton instance for application-wide use
 */
export const inputShield = new InputShield({
  enableXMLSandboxing: true,
  enableSemanticAnalysis: true,
  enableBehavioralDetection: true,
  strictMode: process.env.NODE_ENV === 'production',
  cacheValidation: true,
  logViolations: true
})

/**
 * Convenience validation functions
 */

export async function validateUserInput(
  content: string,
  userId?: string,
  category?: string
): Promise<{ isValid: boolean; sanitized: string; xmlSafe: string }> {
  const result = await inputShield.validateInput(content, userId, category)
  return {
    isValid: result.isValid,
    sanitized: result.sanitizedContent,
    xmlSafe: result.xmlSandboxed
  }
}

export async function quickShieldCheck(content: string): Promise<boolean> {
  const result = await inputShield.validateInput(content)
  return result.isValid
}

/**
 * Integration with existing schemas
 */
export const shieldedInputSchema = z.string()
  .min(1, 'Content is required')
  .max(5000, 'Content too long')
  .refine(async (content) => {
    const result = await inputShield.validateInput(content)
    return result.isValid
  }, 'Content failed security validation')

/**
 * Usage Examples:
 *
 * // Basic validation
 * const { isValid, sanitized, xmlSafe } = await validateUserInput(userInput, userId)
 * if (!isValid) {
 *   return { error: 'Content blocked by security shield', sanitized }
 * }
 *
 * // Advanced validation with full result
 * const result = await inputShield.validateInput(userInput, userId, 'email')
 * if (!result.isValid) {
 *   console.log('Violations:', result.violations)
 *   console.log('Processing time:', result.processingTime, 'ms')
 * }
 *
 * // XML-safe content for AI processing
 * const xmlContent = result.xmlSandboxed
 * const aiResponse = await processWithAI(xmlContent)
 */