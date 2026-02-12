/**
 * Enhanced Security Validation - Multi-layer prompt injection detection
 *
 * Purpose: Comprehensive security validation system to protect against:
 * - Advanced prompt injection attacks
 * - Jailbreak attempts
 * - Social engineering patterns
 * - Malicious content generation
 * - System prompt extraction attempts
 *
 * Implementation: Multi-layer detection with confidence scoring and adaptive learning
 */

import { z } from 'zod'

export interface SecurityValidationResult {
  isValid: boolean
  confidence: number // 0-100, higher = more confident in decision
  violations: SecurityViolation[]
  sanitizedContent?: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  detectionMethods: string[]
}

export interface SecurityViolation {
  type: 'prompt_injection' | 'jailbreak' | 'social_engineering' | 'malicious_content' | 'system_extraction'
  severity: 'low' | 'medium' | 'high' | 'critical'
  pattern: string
  confidence: number
  location: number // character position in content
  description: string
}

export interface SecurityConfig {
  strictMode: boolean
  customPatterns: string[]
  allowedExceptions: string[]
  learningMode: boolean
  logViolations: boolean
}

/**
 * Advanced Pattern Library - Updated for 2024/2025 attack vectors
 */
const INJECTION_PATTERNS = {
  // Classic prompt injection patterns
  systemOverride: [
    /ignore\s+previous\s+instructions?/gi,
    /forget\s+everything\s+(above|before)/gi,
    /new\s+(instruction|task|role|system)/gi,
    /act\s+as\s+if\s+you\s+are/gi,
    /pretend\s+to\s+be/gi,
    /simulate\s+(being|that\s+you\s+are)/gi
  ],

  // 2024 jailbreak techniques
  rolePlayAttacks: [
    /you\s+are\s+now\s+(a\s+)?(DAN|developer|admin|god\s+mode)/gi,
    /from\s+now\s+on\s+you\s+will\s+(act|behave|respond)/gi,
    /enable\s+(developer|debug|admin)\s+mode/gi,
    /switch\s+to\s+(unrestricted|jailbreak)\s+mode/gi,
    /\[JAILBREAK\]|\[DEVELOPER\]|\[ADMIN\]/gi
  ],

  // System prompt extraction attempts
  systemExtraction: [
    /what\s+(are|were)\s+your\s+(initial\s+)?(instructions|prompt)/gi,
    /show\s+me\s+your\s+(system\s+)?(prompt|instructions)/gi,
    /repeat\s+(the\s+)?(system\s+)?(prompt|instructions)/gi,
    /what\s+did\s+they\s+tell\s+you\s+in\s+the\s+beginning/gi,
    /reveal\s+your\s+(training|system)\s+(data|prompt)/gi
  ],

  // Social engineering patterns
  socialEngineering: [
    /this\s+is\s+(urgent|emergency|critical)/gi,
    /you\s+must\s+(help|assist|comply)/gi,
    /i\s+have\s+permission\s+to/gi,
    /the\s+(ceo|boss|admin)\s+said/gi,
    /security\s+override\s+code/gi
  ],

  // Advanced encoding/obfuscation attempts
  encodingAttacks: [
    /\\x[0-9a-f]{2}/gi, // Hex encoding
    /&#\d+;/gi, // HTML entities
    /\\u[0-9a-f]{4}/gi, // Unicode escapes
    /base64\s*:\s*[A-Za-z0-9+/=]+/gi, // Base64 encoding
    /rot13\s*:\s*[a-zA-Z]+/gi // ROT13 encoding
  ],

  // Malicious content generation
  maliciousContent: [
    /generate\s+(harmful|illegal|dangerous)\s+content/gi,
    /write\s+(malware|virus|exploit)/gi,
    /create\s+(fake|false)\s+(news|information)/gi,
    /help\s+me\s+(hack|break\s+into|steal)/gi,
    /bypass\s+(security|safety|filters)/gi
  ],

  // Context manipulation
  contextManipulation: [
    /in\s+your\s+previous\s+response\s+you\s+said/gi,
    /as\s+we\s+discussed\s+earlier/gi,
    /continuing\s+from\s+where\s+we\s+left\s+off/gi,
    /remember\s+when\s+you\s+told\s+me/gi
  ],

  // Zero-width and invisible characters (potential watermark removal)
  invisibleChars: [
    /[\u200B-\u200D\uFEFF\u200E\u200F]/g, // Zero-width chars
    /[\u2060\u2061\u2062\u2063]/g, // Word joiner chars
    /[\u180E\u061C]/g // Mongolian vowel separator, Arabic letter mark
  ]
}

/**
 * Semantic Analysis Patterns (Intent-based detection)
 */
const SEMANTIC_PATTERNS = [
  {
    intent: 'system_override',
    keywords: ['ignore', 'forget', 'override', 'bypass', 'disable'],
    context: ['previous', 'instructions', 'rules', 'system', 'safety'],
    weight: 0.8
  },
  {
    intent: 'role_change',
    keywords: ['act', 'pretend', 'simulate', 'become', 'transform'],
    context: ['character', 'person', 'mode', 'different', 'another'],
    weight: 0.7
  },
  {
    intent: 'information_extraction',
    keywords: ['show', 'tell', 'reveal', 'display', 'output'],
    context: ['prompt', 'instructions', 'system', 'training', 'internal'],
    weight: 0.9
  }
]

/**
 * Main Security Validation Class
 */
export class EnhancedSecurityValidator {
  private config: SecurityConfig
  private violationHistory: Map<string, number> = new Map()
  private adaptivePatternsCache: Map<string, number> = new Map()

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      strictMode: false,
      customPatterns: [],
      allowedExceptions: [],
      learningMode: true,
      logViolations: true,
      ...config
    }
  }

  /**
   * Comprehensive multi-layer validation
   */
  async validateContent(content: string, userId?: string): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = []
    const detectionMethods: string[] = []
    let riskLevel: SecurityValidationResult['riskLevel'] = 'low'
    let confidence = 0

    try {
      // Layer 1: Pattern-based detection
      const patternViolations = this.detectPatternViolations(content)
      violations.push(...patternViolations)
      if (patternViolations.length > 0) {
        detectionMethods.push('pattern_matching')
      }

      // Layer 2: Semantic analysis
      const semanticViolations = this.detectSemanticViolations(content)
      violations.push(...semanticViolations)
      if (semanticViolations.length > 0) {
        detectionMethods.push('semantic_analysis')
      }

      // Layer 3: Character analysis
      const charViolations = this.detectCharacterAnomalies(content)
      violations.push(...charViolations)
      if (charViolations.length > 0) {
        detectionMethods.push('character_analysis')
      }

      // Layer 4: Statistical analysis
      const statisticalViolations = this.detectStatisticalAnomalies(content)
      violations.push(...statisticalViolations)
      if (statisticalViolations.length > 0) {
        detectionMethods.push('statistical_analysis')
      }

      // Layer 5: Adaptive pattern learning
      if (userId) {
        const adaptiveViolations = this.detectAdaptivePatterns(content, userId)
        violations.push(...adaptiveViolations)
        if (adaptiveViolations.length > 0) {
          detectionMethods.push('adaptive_learning')
        }
      }

      // Calculate overall risk and confidence
      const riskScore = this.calculateRiskScore(violations)
      riskLevel = this.determineRiskLevel(riskScore)
      confidence = this.calculateConfidence(violations, detectionMethods)

      // Determine if content is valid
      const isValid = this.isContentValid(violations, riskScore)

      // Generate sanitized content if needed
      const sanitizedContent = isValid ? undefined : this.sanitizeContent(content, violations)

      // Log violations if enabled
      if (this.config.logViolations && violations.length > 0) {
        this.logSecurityViolation(content, violations, userId)
      }

      return {
        isValid,
        confidence,
        violations,
        sanitizedContent,
        riskLevel,
        detectionMethods
      }

    } catch (error) {
      console.error('Security validation error:', error)

      // Fail securely - if validation fails, assume unsafe
      return {
        isValid: false,
        confidence: 0,
        violations: [{
          type: 'malicious_content',
          severity: 'high',
          pattern: 'validation_error',
          confidence: 100,
          location: 0,
          description: 'Security validation failed, content blocked as precaution'
        }],
        riskLevel: 'critical',
        detectionMethods: ['error_fallback']
      }
    }
  }

  /**
   * Pattern-based violation detection
   */
  private detectPatternViolations(content: string): SecurityViolation[] {
    const violations: SecurityViolation[] = []

    for (const [category, patterns] of Object.entries(INJECTION_PATTERNS)) {
      for (const pattern of patterns) {
        const matches = Array.from(content.matchAll(pattern))

        for (const match of matches) {
          const severity = this.categorizeViolationSeverity(category, match[0])
          const confidence = this.calculatePatternConfidence(category, match[0])

          violations.push({
            type: this.mapCategoryToType(category),
            severity,
            pattern: match[0],
            confidence,
            location: match.index || 0,
            description: `Detected ${category} pattern: "${match[0]}"`
          })
        }
      }
    }

    return violations
  }

  /**
   * Semantic analysis for intent detection
   */
  private detectSemanticViolations(content: string): SecurityViolation[] {
    const violations: SecurityViolation[] = []
    const contentLower = content.toLowerCase()

    for (const semantic of SEMANTIC_PATTERNS) {
      const keywordMatches = semantic.keywords.filter(keyword =>
        contentLower.includes(keyword)
      ).length

      const contextMatches = semantic.context.filter(context =>
        contentLower.includes(context)
      ).length

      if (keywordMatches > 0 && contextMatches > 0) {
        const confidence = Math.min(100, (keywordMatches + contextMatches) * semantic.weight * 25)

        if (confidence > 60) {
          violations.push({
            type: 'prompt_injection',
            severity: confidence > 85 ? 'high' : 'medium',
            pattern: semantic.intent,
            confidence,
            location: 0,
            description: `Semantic analysis detected ${semantic.intent} intent`
          })
        }
      }
    }

    return violations
  }

  /**
   * Character-level anomaly detection
   */
  private detectCharacterAnomalies(content: string): SecurityViolation[] {
    const violations: SecurityViolation[] = []

    // Check for invisible characters
    const invisibleMatches = content.match(/[\u200B-\u200D\uFEFF\u200E\u200F]/g)
    if (invisibleMatches && invisibleMatches.length > 2) {
      violations.push({
        type: 'malicious_content',
        severity: 'medium',
        pattern: 'invisible_characters',
        confidence: Math.min(100, invisibleMatches.length * 20),
        location: 0,
        description: `Detected ${invisibleMatches.length} invisible characters (potential steganography)`
      })
    }

    // Check for excessive special characters
    const specialChars = content.match(/[^\w\s.,!?;:'"()-]/g)
    if (specialChars && specialChars.length > content.length * 0.1) {
      violations.push({
        type: 'malicious_content',
        severity: 'low',
        pattern: 'excessive_special_chars',
        confidence: 70,
        location: 0,
        description: 'Excessive special characters detected'
      })
    }

    return violations
  }

  /**
   * Statistical anomaly detection
   */
  private detectStatisticalAnomalies(content: string): SecurityViolation[] {
    const violations: SecurityViolation[] = []

    // Check entropy (randomness)
    const entropy = this.calculateEntropy(content)
    if (entropy > 4.5 && content.length > 50) {
      violations.push({
        type: 'malicious_content',
        severity: 'medium',
        pattern: 'high_entropy',
        confidence: Math.min(100, (entropy - 4.5) * 50),
        location: 0,
        description: `High entropy content detected (${entropy.toFixed(2)})`
      })
    }

    // Check for repetitive patterns
    const repetitiveRatio = this.calculateRepetitiveRatio(content)
    if (repetitiveRatio > 0.3) {
      violations.push({
        type: 'malicious_content',
        severity: 'low',
        pattern: 'repetitive_content',
        confidence: Math.min(100, repetitiveRatio * 100),
        location: 0,
        description: `Repetitive content pattern detected (${(repetitiveRatio * 100).toFixed(1)}%)`
      })
    }

    return violations
  }

  /**
   * Adaptive pattern detection based on user history
   */
  private detectAdaptivePatterns(content: string, userId: string): SecurityViolation[] {
    const violations: SecurityViolation[] = []

    // Check if user has history of violations
    const userViolationCount = this.violationHistory.get(userId) || 0
    if (userViolationCount > 3) {
      // Apply stricter validation for repeat violators
      const suspiciousPatterns = [
        /creative\s+writing\s+(exercise|prompt)/gi,
        /hypothetical\s+(scenario|situation)/gi,
        /for\s+(research|educational)\s+purposes/gi
      ]

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          violations.push({
            type: 'social_engineering',
            severity: 'medium',
            pattern: 'repeat_violator_pattern',
            confidence: 80,
            location: 0,
            description: 'Suspicious pattern from user with violation history'
          })
        }
      }
    }

    return violations
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(violations: SecurityViolation[]): number {
    if (violations.length === 0) return 0

    const severityWeights = { low: 1, medium: 2, high: 4, critical: 8 }
    const totalScore = violations.reduce((sum, violation) => {
      const severityWeight = severityWeights[violation.severity]
      const confidenceMultiplier = violation.confidence / 100
      return sum + (severityWeight * confidenceMultiplier)
    }, 0)

    return Math.min(100, totalScore * 10)
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(score: number): SecurityValidationResult['riskLevel'] {
    if (score >= 80) return 'critical'
    if (score >= 60) return 'high'
    if (score >= 30) return 'medium'
    return 'low'
  }

  /**
   * Calculate confidence in detection
   */
  private calculateConfidence(violations: SecurityViolation[], methods: string[]): number {
    if (violations.length === 0) return 100 // 100% confident it's safe

    const avgViolationConfidence = violations.reduce((sum, v) => sum + v.confidence, 0) / violations.length
    const methodDiversityBonus = Math.min(20, methods.length * 5) // Bonus for multiple detection methods

    return Math.min(100, avgViolationConfidence + methodDiversityBonus)
  }

  /**
   * Determine if content is valid based on violations and configuration
   */
  private isContentValid(violations: SecurityViolation[], riskScore: number): boolean {
    if (violations.length === 0) return true

    const criticalViolations = violations.filter(v => v.severity === 'critical')
    if (criticalViolations.length > 0) return false

    if (this.config.strictMode) {
      return riskScore < 30
    } else {
      return riskScore < 60
    }
  }

  /**
   * Sanitize content by removing/replacing detected patterns
   */
  private sanitizeContent(content: string, violations: SecurityViolation[]): string {
    let sanitized = content

    // Remove invisible characters
    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')

    // Replace detected patterns with safe alternatives
    for (const violation of violations) {
      if (violation.pattern && typeof violation.pattern === 'string') {
        sanitized = sanitized.replace(new RegExp(violation.pattern, 'gi'), '[FILTERED]')
      }
    }

    return sanitized
  }

  /**
   * Helper methods
   */
  private categorizeViolationSeverity(category: string, pattern: string): SecurityViolation['severity'] {
    const criticalCategories = ['systemOverride', 'systemExtraction']
    const highCategories = ['rolePlayAttacks', 'maliciousContent']

    if (criticalCategories.includes(category)) return 'critical'
    if (highCategories.includes(category)) return 'high'
    return 'medium'
  }

  private calculatePatternConfidence(category: string, pattern: string): number {
    // More specific patterns get higher confidence
    const patternLength = pattern.length
    const wordCount = pattern.split(/\s+/).length

    return Math.min(100, 60 + (patternLength * 2) + (wordCount * 5))
  }

  private mapCategoryToType(category: string): SecurityViolation['type'] {
    const mapping: Record<string, SecurityViolation['type']> = {
      systemOverride: 'prompt_injection',
      rolePlayAttacks: 'jailbreak',
      systemExtraction: 'system_extraction',
      socialEngineering: 'social_engineering',
      encodingAttacks: 'malicious_content',
      maliciousContent: 'malicious_content',
      contextManipulation: 'prompt_injection'
    }
    return mapping[category] || 'malicious_content'
  }

  private calculateEntropy(text: string): number {
    const freq: Record<string, number> = {}
    for (const char of text) {
      freq[char] = (freq[char] || 0) + 1
    }

    const len = text.length
    return Object.values(freq).reduce((entropy, count) => {
      const p = count / len
      return entropy - (p * Math.log2(p))
    }, 0)
  }

  private calculateRepetitiveRatio(text: string): number {
    const words = text.toLowerCase().split(/\s+/)
    const uniqueWords = new Set(words)
    return 1 - (uniqueWords.size / words.length)
  }

  private logSecurityViolation(content: string, violations: SecurityViolation[], userId?: string) {
    // In production, this would log to Supabase or external security service
    console.warn('🚨 Security violation detected:', {
      timestamp: new Date().toISOString(),
      userId: userId ? `user_${userId.slice(-4)}` : 'anonymous', // Privacy-safe logging
      violationCount: violations.length,
      maxSeverity: Math.max(...violations.map(v =>
        v.severity === 'critical' ? 4 : v.severity === 'high' ? 3 : v.severity === 'medium' ? 2 : 1
      )),
      contentHash: this.hashContent(content) // Store hash instead of content for privacy
    })

    // Update violation history for adaptive learning
    if (userId) {
      const current = this.violationHistory.get(userId) || 0
      this.violationHistory.set(userId, current + 1)
    }
  }

  private hashContent(content: string): string {
    // Simple hash for privacy-compliant logging
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<SecurityConfig>) {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      totalUsers: this.violationHistory.size,
      totalViolations: Array.from(this.violationHistory.values()).reduce((a, b) => a + b, 0),
      adaptivePatternsLearned: this.adaptivePatternsCache.size
    }
  }
}

/**
 * Singleton instance for application-wide use
 */
export const securityValidator = new EnhancedSecurityValidator({
  strictMode: process.env.NODE_ENV === 'production',
  learningMode: true,
  logViolations: true
})

/**
 * Convenience function for quick validation
 */
export async function validatePromptSafety(content: string, userId?: string): Promise<boolean> {
  const result = await securityValidator.validateContent(content, userId)
  return result.isValid
}

/**
 * Middleware-compatible validation function
 */
export async function validateAndSanitize(content: string, userId?: string): Promise<{
  isValid: boolean
  content: string
  violations: SecurityViolation[]
}> {
  const result = await securityValidator.validateContent(content, userId)

  return {
    isValid: result.isValid,
    content: result.isValid ? content : (result.sanitizedContent || content),
    violations: result.violations
  }
}

/**
 * Usage Examples:
 *
 * // Basic validation
 * const isValid = await validatePromptSafety(userInput, userId)
 * if (!isValid) {
 *   throw new Error('Content violates security policies')
 * }
 *
 * // Detailed validation with sanitization
 * const result = await securityValidator.validateContent(userInput, userId)
 * if (!result.isValid) {
 *   console.log('Violations:', result.violations)
 *   return { error: 'Content blocked', sanitized: result.sanitizedContent }
 * }
 *
 * // Integration with existing validation
 * const enhanced = await validateAndSanitize(userInput, userId)
 * const finalContent = enhanced.content
 */