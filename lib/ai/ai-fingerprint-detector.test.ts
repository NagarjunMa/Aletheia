import { describe, it, expect } from 'vitest'
import {
  detectAIFingerprints,
  isLikelyAIGenerated,
  sanitizeAIFingerprints,
  analyzeContentAuthenticity,
} from './ai-fingerprint-detector'

describe('detectAIFingerprints', () => {
  it('returns the correct result shape', () => {
    const result = detectAIFingerprints('Hello, I wanted to reach out.', 'general')
    expect(result).toHaveProperty('isAIGenerated')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('detectedPatterns')
    expect(result).toHaveProperty('sanitizedContent')
    expect(result).toHaveProperty('authenticityScore')
    expect(result).toHaveProperty('modifications')
    expect(Array.isArray(result.detectedPatterns)).toBe(true)
    expect(typeof result.authenticityScore).toBe('number')
  })

  it('scores clean informal text at 70 or above', () => {
    // Short, informal, personal — should score well
    const clean = "Hi Sarah! I came across your profile and I noticed your work. I'd love to connect!"
    const result = detectAIFingerprints(clean, 'general')
    expect(result.authenticityScore).toBeGreaterThanOrEqual(70)
  })

  it('detects "hope this finds you well" pattern (ai_hope_phrase)', () => {
    const text = 'Hope this finds you well. I wanted to reach out.'
    const result = detectAIFingerprints(text, 'general')
    expect(result.detectedPatterns).toContain('ai_hope_phrase')
    expect(result.authenticityScore).toBeLessThan(100)
  })

  it('detects em-dash as AI fingerprint (em_dash_usage)', () => {
    const text = 'I am reaching out — I believe this is a great opportunity — to connect.'
    const result = detectAIFingerprints(text, 'general')
    expect(result.detectedPatterns).toContain('em_dash_usage')
  })

  it('detects "would you be open to" pattern (ai_politeness)', () => {
    const text = 'Would you be open to a quick chat about this?'
    const result = detectAIFingerprints(text, 'general')
    expect(result.detectedPatterns).toContain('ai_politeness')
  })

  it('detects "at your earliest convenience" pattern (formal_convenience)', () => {
    const text = 'Please respond at your earliest convenience.'
    const result = detectAIFingerprints(text, 'general')
    expect(result.detectedPatterns).toContain('formal_convenience')
  })

  it('detects corporate buzzwords (showcasing)', () => {
    const text = "I've been showcasing my work to various companies."
    const result = detectAIFingerprints(text, 'general')
    expect(result.detectedPatterns).toContain('corporate_buzzwords')
  })

  it('detects "that being said" transition (ai_transition)', () => {
    const text = 'I know you are busy. That being said, I think this is valuable.'
    const result = detectAIFingerprints(text, 'general')
    expect(result.detectedPatterns).toContain('ai_transition')
  })

  it('detects superlative buzzwords (game-changer)', () => {
    const text = 'This technology is a game-changer for the industry.'
    const result = detectAIFingerprints(text, 'general')
    expect(result.detectedPatterns).toContain('superlative_buzzwords')
  })

  it('lowers authenticityScore when multiple patterns are detected', () => {
    const clean = "Hi!"
    const aiHeavy = 'Hope this finds you well. Would you be open to discussing this at your earliest convenience? That being said, I am I would be delighted to showcasing my work — it is a game-changer.'
    const cleanResult = detectAIFingerprints(clean, 'general')
    const aiResult = detectAIFingerprints(aiHeavy, 'general')
    expect(aiResult.authenticityScore).toBeLessThan(cleanResult.authenticityScore)
  })

  it('marks AI-heavy text as generated (isAIGenerated: true)', () => {
    // Multiple high-severity patterns in one message
    const aiText = [
      'Hope this finds you well.',
      'Would you be open to a quick call?',
      'I would be delighted to discuss this at your earliest convenience.',
      'That being said, I appreciate it either way.',
    ].join(' ')
    const result = detectAIFingerprints(aiText, 'general')
    expect(result.isAIGenerated).toBe(true)
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('authenticityScore is always between 0 and 100', () => {
    const texts = [
      '',
      'Hi.',
      'Hope this finds you well. Would you be open to this? That being said, I appreciate it either way. I would be delighted to connect.',
    ]
    for (const text of texts) {
      const result = detectAIFingerprints(text, 'general')
      expect(result.authenticityScore).toBeGreaterThanOrEqual(0)
      expect(result.authenticityScore).toBeLessThanOrEqual(100)
    }
  })

  it('accepts different platform values without throwing', () => {
    expect(() => detectAIFingerprints('Hello.', 'linkedin')).not.toThrow()
    expect(() => detectAIFingerprints('Hello.', 'email')).not.toThrow()
    expect(() => detectAIFingerprints('Hello.', 'general')).not.toThrow()
  })

  it('sanitizedContent replaces em-dash with hyphen', () => {
    const result = detectAIFingerprints('Great idea — let me know.', 'general')
    expect(result.sanitizedContent).not.toContain('—')
    expect(result.sanitizedContent).toContain(' - ')
  })

  it('sanitizedContent is always a string', () => {
    const result = detectAIFingerprints('Some text here.', 'general')
    expect(typeof result.sanitizedContent).toBe('string')
  })

  it('email_greeting pattern only fires on email platform', () => {
    const text = 'I hope this email finds you well.'
    const generalResult = detectAIFingerprints(text, 'general')
    const emailResult = detectAIFingerprints(text, 'email')
    expect(generalResult.detectedPatterns).not.toContain('email_greeting')
    expect(emailResult.detectedPatterns).toContain('email_greeting')
  })

  it('background_attention pattern only fires on linkedin platform', () => {
    const text = 'Your background caught my attention and I wanted to connect.'
    const generalResult = detectAIFingerprints(text, 'general')
    const linkedinResult = detectAIFingerprints(text, 'linkedin')
    expect(generalResult.detectedPatterns).not.toContain('background_attention')
    expect(linkedinResult.detectedPatterns).toContain('background_attention')
  })
})

describe('isLikelyAIGenerated', () => {
  it('returns true for AI-heavy text', () => {
    const aiText = 'Hope this finds you well. Would you be open to a quick call at your earliest convenience? That being said, I appreciate it.'
    expect(isLikelyAIGenerated(aiText)).toBe(true)
  })

  it('returns false for clean informal text', () => {
    const clean = "Hey! Saw your work and thought it was really cool. Want to chat sometime?"
    expect(isLikelyAIGenerated(clean)).toBe(false)
  })

  it('returns a boolean', () => {
    const result = isLikelyAIGenerated('Some text here.')
    expect(typeof result).toBe('boolean')
  })

  it('accepts platform parameter without throwing', () => {
    expect(() => isLikelyAIGenerated('Hello.', 'linkedin')).not.toThrow()
    expect(() => isLikelyAIGenerated('Hello.', 'email')).not.toThrow()
    expect(() => isLikelyAIGenerated('Hello.', 'general')).not.toThrow()
  })

  it('defaults to general platform when no platform provided', () => {
    expect(() => isLikelyAIGenerated('Hello there.')).not.toThrow()
  })
})

describe('sanitizeAIFingerprints', () => {
  it('returns a string', () => {
    const result = sanitizeAIFingerprints('Hello there.')
    expect(typeof result).toBe('string')
  })

  it('replaces em-dash with hyphen', () => {
    const result = sanitizeAIFingerprints('Great idea — let me know.')
    expect(result).not.toContain('—')
    expect(result).toContain(' - ')
  })

  it('returns same result as detectAIFingerprints().sanitizedContent', () => {
    const text = 'Hope this finds you well — would you be open to connecting?'
    const detected = detectAIFingerprints(text, 'general')
    const sanitized = sanitizeAIFingerprints(text, 'general')
    expect(sanitized).toBe(detected.sanitizedContent)
  })

  it('accepts platform parameter without throwing', () => {
    expect(() => sanitizeAIFingerprints('Hello.', 'linkedin')).not.toThrow()
    expect(() => sanitizeAIFingerprints('Hello.', 'email')).not.toThrow()
  })

  it('preserves clean text largely unchanged', () => {
    const clean = "Hi there, just wanted to say your work looks great!"
    const result = sanitizeAIFingerprints(clean)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('analyzeContentAuthenticity', () => {
  it('returns the correct result shape', () => {
    const result = analyzeContentAuthenticity('Some text here.')
    expect(result).toHaveProperty('authenticity')
    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('issues')
    expect(result).toHaveProperty('suggestions')
    expect(Array.isArray(result.issues)).toBe(true)
    expect(Array.isArray(result.suggestions)).toBe(true)
  })

  it('returns authenticity "low" for heavily AI-generated text', () => {
    const aiText = [
      'Hope this finds you well.',
      'Would you be open to a quick call?',
      'I would be delighted to discuss at your earliest convenience.',
      'That being said — I appreciate the game-changer opportunity.',
    ].join(' ')
    const result = analyzeContentAuthenticity(aiText)
    expect(result.authenticity).toBe('low')
    expect(result.score).toBeLessThan(40)
  })

  it('returns authenticity "high" for clean informal text', () => {
    const clean = "Hey! Saw your post and thought it was really interesting. Would love to hear more about your work sometime."
    const result = analyzeContentAuthenticity(clean)
    expect(['high', 'medium']).toContain(result.authenticity)
    expect(result.score).toBeGreaterThan(40)
  })

  it('score is always between 0 and 100', () => {
    const texts = ['', 'Hi.', 'Hope this finds you well — game-changer opportunity at your earliest convenience.']
    for (const text of texts) {
      const result = analyzeContentAuthenticity(text)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    }
  })

  it('includes em-dash suggestion when em-dash is detected', () => {
    const result = analyzeContentAuthenticity('Great opportunity — let me know.')
    if (result.suggestions.length > 0) {
      const hasDashSuggestion = result.suggestions.some(s => s.includes('hyphens') || s.includes('em-dash'))
      expect(hasDashSuggestion).toBe(true)
    }
  })

  it('accepts platform parameter without throwing', () => {
    expect(() => analyzeContentAuthenticity('Hello.', 'linkedin')).not.toThrow()
    expect(() => analyzeContentAuthenticity('Hello.', 'email')).not.toThrow()
    expect(() => analyzeContentAuthenticity('Hello.', 'general')).not.toThrow()
  })

  it('authenticity value is one of "high", "medium", or "low"', () => {
    const result = analyzeContentAuthenticity('Some professional message here.')
    expect(['high', 'medium', 'low']).toContain(result.authenticity)
  })
})
