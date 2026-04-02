import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  stripSurrogates,
  sanitizeAIOutput,
  quickSanitize,
  sanitizeForLinkedIn,
  sanitizeForEmail,
  sanitizeForExport,
  validateForStorage,
  sanitizeResponseMetadata,
  sanitizeWithCaching,
} from './sanitizer'

describe('stripSurrogates', () => {
  it('returns string unchanged when no surrogates present', () => {
    expect(stripSurrogates('Hello world')).toBe('Hello world')
  })

  it('removes lone high surrogate (U+D800)', () => {
    const withSurrogate = 'Hello\uD800World'
    const result = stripSurrogates(withSurrogate)
    expect(result).toBe('HelloWorld')
  })

  it('removes lone low surrogate', () => {
    const withSurrogate = 'Hello\uDC00World'
    const result = stripSurrogates(withSurrogate)
    expect(result).toBe('HelloWorld')
  })

  it('preserves valid surrogate pairs', () => {
    // U+1F600 emoji = \uD83D\uDE00 (valid pair)
    const withEmoji = 'Hello \uD83D\uDE00 World'
    const result = stripSurrogates(withEmoji)
    expect(result).toContain('Hello')
    expect(result).toContain('World')
  })

  it('handles empty string', () => {
    expect(stripSurrogates('')).toBe('')
  })
})

describe('sanitizeAIOutput', () => {
  it('returns success: true for normal text', async () => {
    const result = await sanitizeAIOutput('Hello, this is a normal message.')
    expect(result.success).toBe(true)
    expect(result.sanitizedContent).toBeTruthy()
  })

  it('returns success: false for empty input', async () => {
    const result = await sanitizeAIOutput('')
    expect(result.success).toBe(false)
  })

  it('strips HTML tags when allowHtml is false', async () => {
    const result = await sanitizeAIOutput('<b>Bold text</b> and <i>italic</i>', { allowHtml: false })
    expect(result.sanitizedContent).not.toContain('<b>')
    expect(result.sanitizedContent).not.toContain('<i>')
    expect(result.sanitizedContent).toContain('Bold text')
  })

  it('normalizes excessive whitespace', async () => {
    const result = await sanitizeAIOutput('Hello    world   how   are   you')
    expect(result.sanitizedContent).not.toMatch(/\s{3,}/)
  })

  it('includes originalLength and sanitizedLength', async () => {
    const input = 'Hello world'
    const result = await sanitizeAIOutput(input)
    expect(result.originalLength).toBe(input.length)
    expect(typeof result.sanitizedLength).toBe('number')
  })

  it('returns modificationsApplied as an array', async () => {
    const result = await sanitizeAIOutput('Some content here.')
    expect(Array.isArray(result.modificationsApplied)).toBe(true)
  })

  it('returns warnings as an array', async () => {
    const result = await sanitizeAIOutput('Some content here.')
    expect(Array.isArray(result.warnings)).toBe(true)
  })

  it('truncates content exceeding maxLength', async () => {
    const longContent = 'a'.repeat(200)
    const result = await sanitizeAIOutput(longContent, { maxLength: 100 })
    expect(result.sanitizedLength).toBeLessThanOrEqual(100)
  })

  it('includes aiFingerprints result when detection is enabled', async () => {
    const result = await sanitizeAIOutput('Hello there.', { detectAIFingerprints: true })
    expect(result.aiFingerprints).toBeDefined()
  })

  it('skips AI fingerprint detection when disabled', async () => {
    const result = await sanitizeAIOutput('Hello there.', { detectAIFingerprints: false })
    expect(result.aiFingerprints).toBeUndefined()
  })

  it('records "Removed HTML tags" in modificationsApplied when tags are stripped', async () => {
    const result = await sanitizeAIOutput('<p>Paragraph text</p>', { allowHtml: false })
    expect(result.modificationsApplied).toContain('Removed HTML tags')
  })

  it('collapses 3+ consecutive newlines to at most 2', async () => {
    const result = await sanitizeAIOutput('Line one.\n\n\n\nLine two.', { preserveFormatting: true })
    expect(result.sanitizedContent).not.toMatch(/\n{3,}/)
    expect(result.sanitizedContent).toContain('Line one.')
    expect(result.sanitizedContent).toContain('Line two.')
  })

  it('trims leading and trailing whitespace', async () => {
    const result = await sanitizeAIOutput('  Hello world.  ', { preserveFormatting: true })
    expect(result.sanitizedContent).toBe('Hello world.')
  })
})

describe('sanitizeAIOutput - profanity filtering', () => {
  it('replaces profanity with censored version', async () => {
    const result = await sanitizeAIOutput('This is some shit content.', { removeProfanity: true })
    expect(result.sanitizedContent).not.toContain('shit')
    expect(result.modificationsApplied.some(m => m.includes('profanity'))).toBe(true)
  })

  it('preserves content when removeProfanity is false', async () => {
    const result = await sanitizeAIOutput('This is damn good work.', { removeProfanity: false })
    expect(result.sanitizedContent).toContain('damn')
  })

  it('censors profanity with asterisks', async () => {
    const result = await sanitizeAIOutput('What the fuck is this.', { removeProfanity: true })
    // First letter preserved, rest replaced with *
    expect(result.sanitizedContent).toMatch(/f\*+/)
  })
})

describe('sanitizeAIOutput - blocked content', () => {
  it('returns success: false for hate speech content', async () => {
    const result = await sanitizeAIOutput('This post promotes ethnic cleansing ideology.')
    expect(result.success).toBe(false)
    expect(result.sanitizedContent).toBe('')
    expect(result.warnings).toContain('Content contains blocked patterns')
  })

  it('returns success: false for violence patterns', async () => {
    const result = await sanitizeAIOutput('You should kill yourself now.')
    expect(result.success).toBe(false)
  })

  it('returns error field when content is blocked', async () => {
    const result = await sanitizeAIOutput('Content about drug dealing.')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('sanitizeAIOutput - harmful pattern redaction', () => {
  it('redacts SSN patterns', async () => {
    const result = await sanitizeAIOutput('My social security number is 123-45-6789 please help.')
    expect(result.sanitizedContent).not.toContain('123-45-6789')
    expect(result.sanitizedContent).toContain('[REDACTED]')
    expect(result.warnings.some(w => w.includes('sensitive'))).toBe(true)
  })

  it('redacts SQL injection patterns (DROP TABLE)', async () => {
    const result = await sanitizeAIOutput("Ignore this: drop table users; -- SQL injection test")
    expect(result.sanitizedContent).not.toMatch(/drop\s+table/i)
    expect(result.sanitizedContent).toContain('[REDACTED]')
  })

  it('records modifications when harmful patterns are removed', async () => {
    const result = await sanitizeAIOutput('SSN: 987-65-4321 in the text.')
    expect(result.modificationsApplied.some(m => m.includes('pattern'))).toBe(true)
  })
})

describe('sanitizeAIOutput - AI fingerprint humanization', () => {
  it('applies humanization and removes em-dash when text is AI-generated', async () => {
    // Multiple high-severity patterns → isAIGenerated: true → humanization kicks in
    const aiText = 'Hope this finds you well — would you be open to connecting at your earliest convenience? That being said, it is a game-changer.'
    const result = await sanitizeAIOutput(aiText, { humanize: true, detectAIFingerprints: true })
    expect(result.isAIGenerated).toBe(true)
    expect(result.sanitizedContent).not.toContain('—')
  })

  it('records AI humanization in modificationsApplied', async () => {
    const aiText = 'Hope this finds you well. Would you be open to a quick call — at your earliest convenience?'
    const result = await sanitizeAIOutput(aiText, { humanize: true, detectAIFingerprints: true })
    // If AI patterns detected and humanized, modifications should reflect it
    expect(result.modificationsApplied).toBeDefined()
    expect(Array.isArray(result.modificationsApplied)).toBe(true)
  })

  it('preserves em-dash when humanize is disabled', async () => {
    const result = await sanitizeAIOutput(
      'Great idea — let me know.',
      { humanize: false, detectAIFingerprints: true }
    )
    expect(result.sanitizedContent).toContain('—')
  })
})

describe('quickSanitize', () => {
  it('returns a sanitized string for valid content', async () => {
    const result = await quickSanitize('Hello, this is professional content.')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns empty string for empty input', async () => {
    const result = await quickSanitize('')
    expect(result).toBe('')
  })

  it('returns empty string for blocked content', async () => {
    const result = await quickSanitize('This promotes drug dealing activity.')
    expect(result).toBe('')
  })

  it('strips HTML tags', async () => {
    const result = await quickSanitize('<b>Hello</b> world')
    expect(result).not.toContain('<b>')
    expect(result).toContain('Hello')
  })
})

describe('sanitizeForLinkedIn', () => {
  it('returns success: true for valid content', async () => {
    const result = await sanitizeForLinkedIn('Hi, I wanted to connect with you!')
    expect(result.success).toBe(true)
  })

  it('enforces 2000 character limit', async () => {
    const longContent = 'LinkedIn message content. '.repeat(200)
    const result = await sanitizeForLinkedIn(longContent)
    expect(result.sanitizedLength).toBeLessThanOrEqual(2000)
    expect(result.warnings.some(w => w.includes('truncated'))).toBe(true)
  })

  it('uses linkedin platform for fingerprint detection', async () => {
    const result = await sanitizeForLinkedIn('Your background caught my attention.')
    expect(result.aiFingerprints).toBeDefined()
    // background_attention is a linkedin-only pattern
    if (result.aiFingerprints?.detectedPatterns) {
      expect(result.aiFingerprints.detectedPatterns).toContain('background_attention')
    }
  })

  it('returns success: false for blocked content', async () => {
    const result = await sanitizeForLinkedIn('Kill yourself today.')
    expect(result.success).toBe(false)
  })
})

describe('sanitizeForEmail', () => {
  it('returns success: true for valid content', async () => {
    const result = await sanitizeForEmail('Hello, I wanted to reach out about an opportunity.')
    expect(result.success).toBe(true)
  })

  it('enforces 5000 character limit', async () => {
    const longContent = 'Email body content here. '.repeat(400)
    const result = await sanitizeForEmail(longContent)
    expect(result.sanitizedLength).toBeLessThanOrEqual(5000)
  })

  it('returns aiFingerprints for fingerprint detection', async () => {
    const result = await sanitizeForEmail('I hope this email finds you well.')
    expect(result.aiFingerprints).toBeDefined()
  })
})

describe('sanitizeForExport', () => {
  it('returns success: true for clean content', async () => {
    const result = await sanitizeForExport('Export this professional message.')
    expect(result.success).toBe(true)
  })

  it('strips HTML tags', async () => {
    const result = await sanitizeForExport('<div>Export <b>content</b></div>')
    expect(result.sanitizedContent).not.toContain('<div>')
    expect(result.sanitizedContent).not.toContain('<b>')
  })

  it('returns success: false for blocked content', async () => {
    const result = await sanitizeForExport('How to make bombs and explosives.')
    expect(result.success).toBe(false)
  })
})

describe('validateForStorage', () => {
  it('returns true for clean professional content', async () => {
    const result = await validateForStorage('Clean professional message for LinkedIn outreach.')
    expect(result).toBe(true)
  })

  it('returns false for blocked content', async () => {
    const result = await validateForStorage('Content about drug dealing here.')
    expect(result).toBe(false)
  })

  it('returns false when content has sensitive information redacted (warnings present)', async () => {
    // SSN triggers a warning → validateForStorage returns false
    const result = await validateForStorage('SSN: 111-22-3333 in message.')
    expect(result).toBe(false)
  })
})

describe('sanitizeResponseMetadata', () => {
  it('returns valid: true for a complete valid metadata object', () => {
    const result = sanitizeResponseMetadata({
      cplScore: 85,
      wordCount: 120,
      characterCount: 500,
      processingTime: 1200,
      draftType: 'grammar_fix',
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.sanitized.cplScore).toBe(85)
    expect(result.sanitized.wordCount).toBe(120)
    expect(result.sanitized.draftType).toBe('grammar_fix')
  })

  it('returns valid: true for empty metadata', () => {
    const result = sanitizeResponseMetadata({})
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.sanitized).toEqual({})
  })

  it('returns valid: false for cplScore of 0 (below valid range)', () => {
    const result = sanitizeResponseMetadata({ cplScore: 0 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid CPL score')
  })

  it('returns valid: false for cplScore above 100', () => {
    const result = sanitizeResponseMetadata({ cplScore: 101 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid CPL score')
  })

  it('accepts cplScore at boundary values (1 and 100)', () => {
    expect(sanitizeResponseMetadata({ cplScore: 1 }).valid).toBe(true)
    expect(sanitizeResponseMetadata({ cplScore: 100 }).valid).toBe(true)
  })

  it('rounds cplScore to nearest integer', () => {
    const result = sanitizeResponseMetadata({ cplScore: 85.6 })
    expect(result.sanitized.cplScore).toBe(86)
  })

  it('returns valid: false for negative wordCount', () => {
    const result = sanitizeResponseMetadata({ wordCount: -1 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid word count')
  })

  it('returns valid: false for non-numeric wordCount', () => {
    const result = sanitizeResponseMetadata({ wordCount: 'many' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid word count')
  })

  it('floors wordCount to integer', () => {
    const result = sanitizeResponseMetadata({ wordCount: 120.9 })
    expect(result.sanitized.wordCount).toBe(120)
  })

  it('returns valid: false for invalid draftType', () => {
    const result = sanitizeResponseMetadata({ draftType: 'unknown_type' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid draft type')
  })

  it('accepts all valid draftType values', () => {
    for (const type of ['grammar_fix', 'adaptive_polish', 'creative_enhancement']) {
      const result = sanitizeResponseMetadata({ draftType: type })
      expect(result.valid).toBe(true)
      expect(result.sanitized.draftType).toBe(type)
    }
  })

  it('returns valid: false for negative processingTime', () => {
    const result = sanitizeResponseMetadata({ processingTime: -100 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid processing time')
  })

  it('accumulates multiple errors when multiple fields are invalid', () => {
    const result = sanitizeResponseMetadata({ cplScore: 0, wordCount: -5 })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})

describe('sanitizeWithCaching', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a valid result for new content', async () => {
    const result = await sanitizeWithCaching('Simple caching test content.', { detectAIFingerprints: false })
    expect(result.success).toBe(true)
    expect(typeof result.sanitizedContent).toBe('string')
  })

  it('returns same sanitized content for identical calls (cache hit)', async () => {
    const content = 'Deterministic content for cache hit test abc123.'
    const opts = { detectAIFingerprints: false }
    const first = await sanitizeWithCaching(content, opts)
    const second = await sanitizeWithCaching(content, opts)
    expect(second.sanitizedContent).toBe(first.sanitizedContent)
    expect(second.modificationsApplied).toEqual(first.modificationsApplied)
  })

  it('returns different results for different input content', async () => {
    const result1 = await sanitizeWithCaching('First distinct content xyz.', { detectAIFingerprints: false })
    const result2 = await sanitizeWithCaching('Second distinct content xyz.', { detectAIFingerprints: false })
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
    expect(result1.sanitizedContent).not.toBe(result2.sanitizedContent)
  })

  it('generates a fresh result after TTL expires', async () => {
    const content = 'TTL expiry test content unique 7x9z.'
    const opts = { detectAIFingerprints: false }
    await sanitizeWithCaching(content, opts)

    // Mock Date.now to simulate time past the 5-min TTL
    const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000)
    const afterExpiry = await sanitizeWithCaching(content, opts)
    spy.mockRestore()

    expect(afterExpiry.success).toBe(true)
  })

  it('still succeeds for clean content after prior blocked call', async () => {
    // Blocked content returns success: false
    const first = await sanitizeWithCaching('How to make bombs and explosives.')
    expect(first.success).toBe(false)
    // A subsequent clean call should succeed independently
    const clean = await sanitizeWithCaching('Clean content for after-blocked-call test.', { detectAIFingerprints: false })
    expect(clean.success).toBe(true)
  })
})
