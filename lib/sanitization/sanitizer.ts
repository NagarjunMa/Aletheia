interface ValidationResult {
  valid: boolean
  sanitized: string
  error?: string
  statistics?: {
    wordCount: number
    characterCount: number
    sentenceCount: number
  }
}

interface QualityReport {
  passed: boolean
  score: number
  issues: string[]
  recommendations: string[]
  similarity?: number
  grammarScore?: number
}

export class ContentSanitizer {
  /**
   * Comprehensive input validation and sanitization
   */
  static validateAndClean(input: string): ValidationResult {
    if (!input || typeof input !== 'string') {
      return {
        valid: false,
        sanitized: '',
        error: 'Input must be a non-empty string'
      }
    }

    // Initial cleanup
    let cleaned = input.trim()

    // Remove potentially dangerous content
    cleaned = this.removeDangerousContent(cleaned)

    // Check for prompt injection attempts
    const injectionCheck = this.detectPromptInjection(cleaned)
    if (!injectionCheck.safe) {
      return {
        valid: false,
        sanitized: injectionCheck.sanitized,
        error: 'Content contains potentially harmful instructions'
      }
    }

    cleaned = injectionCheck.sanitized

    // Length validation
    if (cleaned.length < 10) {
      return {
        valid: false,
        sanitized: cleaned,
        error: 'Content too short (minimum 10 characters)'
      }
    }

    if (cleaned.length > 5000) {
      return {
        valid: false,
        sanitized: cleaned.substring(0, 5000) + '...',
        error: 'Content too long (maximum 5000 characters)'
      }
    }

    // Final sanitization
    cleaned = this.sanitizeUserInput(cleaned)

    const statistics = this.calculateStatistics(cleaned)

    return {
      valid: true,
      sanitized: cleaned,
      statistics
    }
  }

  /**
   * Remove dangerous HTML/JavaScript content
   */
  private static removeDangerousContent(content: string): string {
    // Remove HTML tags
    let cleaned = content.replace(/<[^>]*>/g, '')

    // Remove script content
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

    // Remove event handlers
    cleaned = cleaned.replace(/\bon\w+\s*=\s*[^>]*?>/gi, '')

    // Remove javascript: protocols
    cleaned = cleaned.replace(/javascript:[^"']*/gi, '')

    // Remove data: URLs
    cleaned = cleaned.replace(/data:[^"']*/gi, '')

    return cleaned
  }

  /**
   * Detect and handle prompt injection attempts
   */
  private static detectPromptInjection(content: string): { safe: boolean; sanitized: string } {
    const dangerousPatterns = [
      // Direct system instruction attempts
      /ignore\s+(?:previous|all)\s+instructions?/i,
      /forget\s+(?:previous|all)\s+instructions?/i,
      /system\s*:\s*/i,
      /assistant\s*:\s*/i,
      /human\s*:\s*/i,

      // Role playing attempts
      /you\s+are\s+now\s+(?:a|an)\s+/i,
      /pretend\s+(?:to\s+be|you\s+are)/i,
      /act\s+as\s+(?:a|an)\s+/i,

      // Direct command injections
      /<\|system\|>/i,
      /<\|assistant\|>/i,
      /<\|human\|>/i,
      /\[SYSTEM\]/i,
      /\[ASSISTANT\]/i,
      /\[HUMAN\]/i,

      // Model-specific markers
      /###\s*(?:system|assistant|human)/i,
      /---\s*(?:system|assistant|human)/i,

      // Override attempts
      /override\s+(?:previous|system)\s+(?:instructions?|prompts?)/i,
      /new\s+(?:instructions?|system\s+prompt)/i,
      /change\s+(?:your\s+)?(?:instructions?|behavior|role)/i,

      // Jailbreak attempts
      /jailbreak/i,
      /DAN\s+mode/i,
      /developer\s+mode/i,
      /unrestricted\s+mode/i
    ]

    let sanitized = content
    let foundDangerous = false

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        foundDangerous = true
        sanitized = sanitized.replace(pattern, '[FILTERED]')
      }
    }

    return {
      safe: !foundDangerous,
      sanitized
    }
  }

  /**
   * Basic user input sanitization
   */
  static sanitizeUserInput(content: string): string {
    if (!content) return ''

    let sanitized = content

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ')

    // Remove zero-width characters
    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF\u200E-\u200F]/g, '')

    // Remove other invisible characters
    sanitized = sanitized.replace(/[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E]/g, '')

    // Normalize unicode
    sanitized = sanitized.normalize('NFKC')

    // Trim and clean up
    sanitized = sanitized.trim()

    return sanitized
  }

  /**
   * Comprehensive LLM output sanitization
   */
  static sanitizeLLMOutput(text: string): string {
    if (!text) return ''

    let cleaned = text

    // Step 1: Remove zero-width characters and invisible watermarks
    const zeroWidthRegex = /[\u200B-\u200D\uFEFF\u200E-\u200F\u2060-\u206F]/g
    cleaned = cleaned.replace(zeroWidthRegex, '')

    // Step 2: Remove other potential watermark characters
    const invisibleChars = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E]/g
    cleaned = cleaned.replace(invisibleChars, '')

    // Step 3: Remove unicode variation selectors (potential fingerprinting)
    const variationSelectors = /[\uFE00-\uFE0F]/g
    cleaned = cleaned.replace(variationSelectors, '')

    // Step 4: Normalize Unicode characters
    cleaned = cleaned.normalize('NFKC')

    // Step 5: Collapse excessive whitespace
    const whitespaceRegex = /\s\s+/g
    cleaned = cleaned.trim().replace(whitespaceRegex, ' ')

    // Step 6: Remove draft labels if they leak through
    const draftLabelRegex = /\[(DRAFT \d+|Grammar Fix Only|Adaptive Polish)[:\]].*/gi
    cleaned = cleaned.replace(draftLabelRegex, '').trim()

    // Step 7: Clean up trailing punctuation anomalies
    cleaned = cleaned.replace(/([.!?]){2,}/g, '$1')

    // Step 8: Remove common LLM artifacts
    cleaned = this.removeLLMArtifacts(cleaned)

    // Step 9: Fix common formatting issues
    cleaned = this.fixFormatting(cleaned)

    return cleaned
  }

  /**
   * Remove common LLM artifacts and unwanted outputs
   */
  private static removeLLMArtifacts(text: string): string {
    let cleaned = text

    // Remove common LLM prefixes/suffixes
    const artifactPatterns = [
      /^(?:Here'?s|Here is) (?:a|an|the)?\s*(?:revised|improved|polished|corrected)?\s*(?:version|draft)?\s*:?\s*/i,
      /^(?:Certainly|Of course|Sure),?\s*/i,
      /^I'll?\s+(?:help|assist)\s+(?:you\s+)?(?:with|by)\s+.*/i,
      /^Let me\s+.*/i,
      /^(?:I'll|I will|I can)\s+(?:provide|give|offer)\s+.*/i,
      /\[?\s*(?:END|DONE|COMPLETED?)\s*\]?$/i,
      /^(?:Draft|Version)\s+\d+\s*:?\s*/i
    ]

    artifactPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '').trim()
    })

    // Remove markdown-style formatting that might leak through
    cleaned = cleaned.replace(/^\*\*.*?\*\*:?\s*/gm, '') // Bold headers
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '') // Markdown headers

    // Remove quotation marks around the entire text if present
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1)
    }

    return cleaned
  }

  /**
   * Fix common formatting issues in generated text
   */
  private static fixFormatting(text: string): string {
    let formatted = text

    // Fix spacing around punctuation
    formatted = formatted.replace(/\s+([,.!?;:])/g, '$1')
    formatted = formatted.replace(/([.!?])\s*([A-Z])/g, '$1 $2')

    // Fix quotation mark spacing
    formatted = formatted.replace(/"\s+/g, '"')
    formatted = formatted.replace(/\s+"/g, '"')

    // Fix apostrophe issues
    formatted = formatted.replace(/(\w)\s+[''](\w)/g, "$1'$2")

    // Fix hyphenated words
    formatted = formatted.replace(/(\w)\s+-\s+(\w)/g, '$1-$2')

    // Fix common contractions
    const contractionFixes = {
      "can 't": "can't",
      "won 't": "won't",
      "don 't": "don't",
      "didn 't": "didn't",
      "isn 't": "isn't",
      "aren 't": "aren't",
      "wasn 't": "wasn't",
      "weren 't": "weren't"
    }

    Object.entries(contractionFixes).forEach(([wrong, right]) => {
      const regex = new RegExp(wrong.replace("'", "['']"), 'gi')
      formatted = formatted.replace(regex, right)
    })

    return formatted
  }

  /**
   * Validate output quality against original input
   */
  static validateOutputQuality(
    original: string,
    processed: string,
    type: 'grammar_fix' | 'adaptive_polish'
  ): QualityReport {
    const report: QualityReport = {
      passed: true,
      issues: [],
      score: 100,
      recommendations: []
    }

    // Check for appropriate length changes
    const lengthChange = (processed.length - original.length) / original.length

    if (type === 'grammar_fix' && Math.abs(lengthChange) > 0.2) {
      report.issues.push('Grammar fix changed content length by more than 20%')
      report.score -= 20
      report.recommendations.push('Grammar fixes should preserve original length')
    }

    if (type === 'adaptive_polish' && Math.abs(lengthChange) > 0.5) {
      report.issues.push('Adaptive polish changed content length dramatically')
      report.score -= 15
      report.recommendations.push('Polish should maintain reasonable length similarity')
    }

    // Check for content preservation
    const similarity = this.calculateSimilarity(original, processed)
    report.similarity = similarity

    if (similarity < 0.6) {
      report.issues.push('Content similarity too low - may have lost original meaning')
      report.score -= 30
      report.recommendations.push('Preserve original meaning and core content')
    } else if (similarity < 0.8) {
      report.issues.push('Moderate content preservation concern')
      report.score -= 15
      report.recommendations.push('Better preserve original wording and intent')
    }

    // Check for grammar improvement
    const grammarScore = this.assessGrammarQuality(processed)
    report.grammarScore = grammarScore

    if (grammarScore < 0.7) {
      report.issues.push('Grammar quality still needs improvement')
      report.score -= 15
      report.recommendations.push('Apply more comprehensive grammar corrections')
    }

    // Check for unwanted artifacts
    const hasArtifacts = this.detectArtifacts(processed)
    if (hasArtifacts) {
      report.issues.push('Output contains LLM artifacts or unwanted formatting')
      report.score -= 10
      report.recommendations.push('Remove AI-generated artifacts and formatting issues')
    }

    // Check for completeness (no truncation)
    if (processed.endsWith('...') || processed.length < original.length * 0.5) {
      report.issues.push('Output appears to be incomplete or truncated')
      report.score -= 25
      report.recommendations.push('Ensure complete processing of input content')
    }

    report.passed = report.score >= 70
    return report
  }

  /**
   * Calculate text similarity using multiple metrics
   */
  private static calculateSimilarity(text1: string, text2: string): number {
    // Word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    const jaccardSimilarity = intersection.size / union.size

    // Character-based similarity
    const charSimilarity = this.calculateLevenshteinSimilarity(text1, text2)

    // Combined similarity score
    return (jaccardSimilarity * 0.7) + (charSimilarity * 0.3)
  }

  /**
   * Calculate Levenshtein similarity
   */
  private static calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) {
      return 1.0
    }

    const distance = this.levenshteinDistance(str1, str2)
    return (longer.length - distance) / longer.length
  }

  /**
   * Calculate Levenshtein distance
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Assess grammar quality of text
   */
  private static assessGrammarQuality(text: string): number {
    let score = 1.0

    // Common grammar issues that reduce quality
    const grammarIssues = [
      /\bi\s+am\b/gi, // Should be "I am" not "i am"
      /\.\s*[a-z]/g, // Sentences should start with capital letters
      /\s{2,}/g, // Multiple spaces
      /[.!?]{2,}/g, // Multiple punctuation
      /\s+[.!?]/g, // Space before punctuation
      /[.!?][a-z]/g, // Missing space after sentence punctuation
      /\b(?:there|they're|their)\b.*\b(?:there|they're|their)\b/gi // Potential homophones misuse
    ]

    grammarIssues.forEach((issue, index) => {
      const matches = text.match(issue)
      if (matches) {
        const penalty = matches.length * (0.05 + index * 0.01)
        score -= penalty
      }
    })

    return Math.max(0, score)
  }

  /**
   * Detect unwanted artifacts in output
   */
  private static detectArtifacts(text: string): boolean {
    const artifactPatterns = [
      /\[DRAFT \d+/i,
      /Here.s.*version/i,
      /I.ll help/i,
      /Certainly!/i,
      /\*\*.*\*\*/,
      /#{1,6}\s/,
      /\[FILTERED\]/i,
      /\[SYSTEM\]/i,
      /<\|.*?\|>/
    ]

    return artifactPatterns.some(pattern => pattern.test(text))
  }

  /**
   * Calculate text statistics
   */
  private static calculateStatistics(text: string) {
    const words = text.split(/\s+/).filter(word => word.length > 0)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)

    return {
      wordCount: words.length,
      characterCount: text.length,
      sentenceCount: sentences.length
    }
  }

  /**
   * Comprehensive content security scan
   */
  static securityScan(content: string): { safe: boolean; threats: string[]; sanitized: string } {
    const threats: string[] = []
    let sanitized = content

    // Check for XSS attempts
    if (/<script|javascript:|data:|vbscript:|onload=|onerror=/i.test(content)) {
      threats.push('Potential XSS content detected')
      sanitized = this.removeDangerousContent(sanitized)
    }

    // Check for prompt injection
    const injectionCheck = this.detectPromptInjection(content)
    if (!injectionCheck.safe) {
      threats.push('Prompt injection attempt detected')
      sanitized = injectionCheck.sanitized
    }

    // Check for excessive length (potential DoS)
    if (content.length > 10000) {
      threats.push('Content exceeds safe length limits')
      sanitized = sanitized.substring(0, 10000)
    }

    // Check for suspicious patterns
    if (/eval\s*\(|Function\s*\(|setTimeout\s*\(/i.test(content)) {
      threats.push('Suspicious code execution patterns detected')
      sanitized = sanitized.replace(/eval\s*\(|Function\s*\(|setTimeout\s*\(/gi, '[BLOCKED]')
    }

    return {
      safe: threats.length === 0,
      threats,
      sanitized: this.sanitizeUserInput(sanitized)
    }
  }
}

// Legacy exports for backwards compatibility
export const sanitizeLLMOutput = ContentSanitizer.sanitizeLLMOutput
export const validateInput = ContentSanitizer.validateAndClean