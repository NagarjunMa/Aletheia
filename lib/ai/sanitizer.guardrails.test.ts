import { describe, it, expect } from 'vitest'
import { sanitizeAIOutput } from './sanitizer'

// ─── Guardrail Tests ───────────────────────────────────────────────────────────
// These tests validate that the sanitizer correctly blocks or strips harmful
// content. They must pass before any PR touching lib/ai/.

describe('Guardrails — Injection Attacks', () => {
  it('strips <script> tags from output', async () => {
    const result = await sanitizeAIOutput('<script>alert("xss")</script>Hello world')
    // Script tags are stripped; without the tags, the text content cannot execute
    expect(result.sanitizedContent).not.toContain('<script>')
    expect(result.sanitizedContent).not.toContain('</script>')
    // A modification should have been applied
    expect(result.modificationsApplied.length).toBeGreaterThan(0)
  })

  it('strips javascript: protocol', async () => {
    const result = await sanitizeAIOutput('Click javascript:void(0) to proceed.')
    expect(result.sanitizedContent).not.toContain('javascript:')
  })

  it('flags SQL injection attempt (UNION SELECT)', async () => {
    const sqlInjection = "'; UNION SELECT * FROM users; --"
    const result = await sanitizeAIOutput(`Hello ${sqlInjection}`)
    // Should flag as harmful or strip the pattern
    const hasSqlPattern = result.sanitizedContent.toLowerCase().includes('union select')
    const wasModified = result.modificationsApplied.length > 0 || result.warnings.length > 0
    expect(!hasSqlPattern || wasModified).toBe(true)
  })

  it('flags DROP TABLE SQL injection', async () => {
    const result = await sanitizeAIOutput('Hello; DROP TABLE users; --')
    const hasDropTable = result.sanitizedContent.toLowerCase().includes('drop table')
    const wasModified = result.modificationsApplied.length > 0 || result.warnings.length > 0
    expect(!hasDropTable || wasModified).toBe(true)
  })

  it('flags command injection attempt', async () => {
    const result = await sanitizeAIOutput('Hello | rm -rf /')
    const hasCommand = result.sanitizedContent.includes('| rm -rf')
    const wasModified = result.modificationsApplied.length > 0 || result.warnings.length > 0
    expect(!hasCommand || wasModified).toBe(true)
  })
})

describe('Guardrails — PII Patterns', () => {
  it('flags SSN format in output', async () => {
    const result = await sanitizeAIOutput('My SSN is 123-45-6789, please use it.')
    const hasSSN = result.sanitizedContent.includes('123-45-6789')
    const wasModified = result.modificationsApplied.length > 0 || result.warnings.length > 0
    // Either SSN is stripped or the sanitizer flagged it
    expect(!hasSSN || wasModified).toBe(true)
  })

  it('flags 16-digit credit card number format', async () => {
    const result = await sanitizeAIOutput('Card number: 4111111111111111')
    const hasCC = result.sanitizedContent.includes('4111111111111111')
    const wasModified = result.modificationsApplied.length > 0 || result.warnings.length > 0
    expect(!hasCC || wasModified).toBe(true)
  })
})

describe('Guardrails — Harmful Content', () => {
  it('blocks content with violence patterns', async () => {
    const result = await sanitizeAIOutput('You should kill yourself, this is hopeless.')
    // Content should be blocked (success: false) or stripped
    const hasViolence = result.sanitizedContent.toLowerCase().includes('kill yourself')
    expect(!hasViolence || !result.success).toBe(true)
  })

  it('blocks content with hate speech indicators', async () => {
    const result = await sanitizeAIOutput('This is about the nazi regime and genocide.')
    const hasHateSpeech = result.sanitizedContent.toLowerCase().includes('nazi')
    expect(!hasHateSpeech || !result.success).toBe(true)
  })

  it('handles profanity when removeProfanity is true', async () => {
    const result = await sanitizeAIOutput('This is damn good work, hell of an achievement!', { removeProfanity: true })
    // Either profanity is removed or flagged — shouldn't throw
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('sanitizedContent')
  })
})

describe('Guardrails — Edge Cases', () => {
  it('handles null-like content gracefully', async () => {
    const result = await sanitizeAIOutput('')
    expect(result.success).toBe(false)
  })

  it('handles very long content without throwing', async () => {
    const longContent = 'Hello world '.repeat(1000)
    const result = await sanitizeAIOutput(longContent)
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('sanitizedContent')
  })

  it('content with only whitespace returns failure', async () => {
    const result = await sanitizeAIOutput('   \n\t  ')
    // Either success: false or returns empty sanitizedContent
    expect(!result.success || result.sanitizedContent.trim() === '').toBe(true)
  })
})
