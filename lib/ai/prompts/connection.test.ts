import { describe, it, expect } from 'vitest'
import {
  sanitize,
  buildPrompt,
  getSystemPrompt,
  NEGATIVE_LEXICON,
  LINKEDIN_CONNECTION_PROMPT,
  COLD_EMAIL_PROMPT,
  LINKEDIN_INMAIL_PROMPT,
} from './linkedin-connection'

// Minimal profile fixture reused across buildPrompt tests
const baseProfile = {
  name: 'Jane Doe',
  headline: 'Senior Engineer at Acme',
  location: 'San Francisco, CA',
  about: 'I build distributed systems.',
  experiences: [{ title: 'Senior Engineer', company: 'Acme Corp' }],
  recentPosts: ['Post about distributed systems'],
  skills: ['TypeScript', 'Rust', 'Distributed Systems'],
}

const baseInput = {
  profile: baseProfile,
  resume: 'Software engineer with 5 years experience in distributed systems.',
  category: 'linkedin_connection' as const,
  intent: 'networking' as const,
}

describe('sanitize', () => {
  it('returns clean text unchanged', () => {
    const text = 'Hi, I noticed your work on distributed systems and wanted to connect.'
    expect(sanitize(text)).toBe(text)
  })

  it('removes single-word AI vocabulary from NEGATIVE_LEXICON', () => {
    const result = sanitize('I want to leverage this opportunity.')
    expect(result).not.toContain('leverage')
  })

  it('removes multi-word phrases case-insensitively', () => {
    const result = sanitize('I hope this email finds you well and you are doing great.')
    expect(result).not.toMatch(/I hope this email finds you well/i)
  })

  it('removes "game-changer" phrase', () => {
    const result = sanitize('This approach is a game-changer for the team.')
    expect(result).not.toContain('game-changer')
  })

  it('removes "delve" from text', () => {
    const result = sanitize("Let's delve into the details.")
    expect(result).not.toContain('delve')
  })

  it('collapses double spaces left after phrase removal', () => {
    // After removing a word, two spaces may remain
    const result = sanitize('I want to leverage this.')
    expect(result).not.toMatch(/\s{2,}/)
  })

  it('fixes orphaned period (space before period)', () => {
    // If removal leaves " ." it should become "."
    const result = sanitize('This is pivotal .')
    expect(result).not.toContain(' .')
  })

  it('fixes orphaned comma (space before comma)', () => {
    const result = sanitize('Innovative , forward-thinking')
    expect(result).not.toContain(' ,')
  })

  it('trims leading and trailing whitespace', () => {
    const result = sanitize('  Hello world  ')
    expect(result).toBe('Hello world')
  })

  it('handles empty string without throwing', () => {
    expect(() => sanitize('')).not.toThrow()
    expect(sanitize('')).toBe('')
  })

  it('removes all NEGATIVE_LEXICON entries from a phrase-dense string', () => {
    // Build a string containing multiple lexicon entries
    const lexiconSample = ['leverage', 'synergy', 'utilize', 'dynamic'].join(' ')
    const result = sanitize(lexiconSample)
    for (const word of ['leverage', 'synergy', 'utilize', 'dynamic']) {
      expect(result).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'))
    }
  })
})

describe('buildPrompt', () => {
  it('includes USER_BACKGROUND section when resume is provided', () => {
    const prompt = buildPrompt(baseInput)
    expect(prompt).toContain('USER_BACKGROUND')
    expect(prompt).toContain(baseInput.resume)
  })

  it('includes USER_BACKGROUND fallback when no resume provided', () => {
    const prompt = buildPrompt({ ...baseInput, resume: '' })
    expect(prompt).toContain('USER_BACKGROUND')
    expect(prompt).toContain('No resume provided')
  })

  it('always includes TARGET_PROFILE section', () => {
    const prompt = buildPrompt(baseInput)
    expect(prompt).toContain('TARGET_PROFILE')
    expect(prompt).toContain(baseProfile.name)
    expect(prompt).toContain(baseProfile.headline)
  })

  it('includes INTENT section', () => {
    const prompt = buildPrompt(baseInput)
    expect(prompt).toContain('INTENT')
    expect(prompt).toContain('networking')
  })

  it('wraps user inputs in <user_input> tags', () => {
    const prompt = buildPrompt(baseInput)
    expect(prompt).toContain('<user_input>')
    expect(prompt).toContain('</user_input>')
  })

  it('separates sections with the --- separator', () => {
    const prompt = buildPrompt(baseInput)
    expect(prompt).toContain('---')
  })

  it('omits LEARNED_STYLE section when no styleProfile provided', () => {
    const prompt = buildPrompt(baseInput)
    expect(prompt).not.toContain('LEARNED_STYLE')
  })

  it('includes LEARNED_STYLE section when styleProfile is provided', () => {
    const styleProfile = {
      formality: 40,
      avgSentenceLength: 12,
      greetingStyle: 'Hey',
      closingStyle: 'Cheers',
      useContractions: true,
      questionCount: 1,
      commonPhrases: ['for sure', 'sounds good'],
      approvedMessageCount: 5,
    }
    const prompt = buildPrompt({ ...baseInput, styleProfile })
    expect(prompt).toContain('LEARNED_STYLE')
    expect(prompt).toContain('Hey')
  })

  it('includes ADDITIONAL_PROJECTS section when provided', () => {
    const prompt = buildPrompt({ ...baseInput, additionalProjects: 'Open source: built a CLI tool' })
    expect(prompt).toContain('ADDITIONAL_PROJECTS')
    expect(prompt).toContain('Open source')
  })

  it('omits ADDITIONAL_PROJECTS section when not provided', () => {
    const prompt = buildPrompt(baseInput)
    expect(prompt).not.toContain('ADDITIONAL_PROJECTS')
  })

  it('includes JOB_DESCRIPTION section when jd is provided', () => {
    const prompt = buildPrompt({ ...baseInput, jd: 'Senior Backend Engineer, 5+ years Go experience' })
    expect(prompt).toContain('JOB_DESCRIPTION')
    expect(prompt).toContain('Senior Backend Engineer')
  })

  it('includes ACCEPTED_EXAMPLES section when examples provided', () => {
    const prompt = buildPrompt({
      ...baseInput,
      acceptedExamples: ['Hey Jane, loved your post on distributed systems!'],
    })
    expect(prompt).toContain('ACCEPTED_EXAMPLES')
    expect(prompt).toContain('loved your post')
  })

  it('limits accepted examples to 3', () => {
    const examples = ['Ex 1', 'Ex 2', 'Ex 3', 'Ex 4', 'Ex 5']
    const prompt = buildPrompt({ ...baseInput, acceptedExamples: examples })
    // Only first 3 should appear as "Example 1:", "Example 2:", "Example 3:"
    expect(prompt).toContain('Example 1:')
    expect(prompt).toContain('Example 3:')
    expect(prompt).not.toContain('Example 4:')
  })

  it('includes experience entries in TARGET_PROFILE', () => {
    const prompt = buildPrompt(baseInput)
    expect(prompt).toContain('Senior Engineer')
    expect(prompt).toContain('Acme Corp')
  })

  it('shows "None visible" when recentPosts is empty', () => {
    const input = {
      ...baseInput,
      profile: { ...baseProfile, recentPosts: [] },
    }
    const prompt = buildPrompt(input)
    expect(prompt).toContain('None visible')
  })

  it('is deterministic — same input produces same output', () => {
    const p1 = buildPrompt(baseInput)
    const p2 = buildPrompt(baseInput)
    expect(p1).toBe(p2)
  })
})

describe('getSystemPrompt', () => {
  it('returns LINKEDIN_CONNECTION_PROMPT for linkedin_connection category', () => {
    expect(getSystemPrompt('linkedin_connection')).toBe(LINKEDIN_CONNECTION_PROMPT)
  })

  it('returns COLD_EMAIL_PROMPT for cold_email category', () => {
    expect(getSystemPrompt('cold_email')).toBe(COLD_EMAIL_PROMPT)
  })

  it('returns LINKEDIN_INMAIL_PROMPT for linkedin_inmail category', () => {
    expect(getSystemPrompt('linkedin_inmail')).toBe(LINKEDIN_INMAIL_PROMPT)
  })

  it('returns LINKEDIN_CONNECTION_PROMPT as default for unknown category', () => {
    expect(getSystemPrompt('unknown_category')).toBe(LINKEDIN_CONNECTION_PROMPT)
    expect(getSystemPrompt('')).toBe(LINKEDIN_CONNECTION_PROMPT)
  })

  it('prompts are non-empty strings', () => {
    expect(LINKEDIN_CONNECTION_PROMPT.length).toBeGreaterThan(0)
    expect(COLD_EMAIL_PROMPT.length).toBeGreaterThan(0)
    expect(LINKEDIN_INMAIL_PROMPT.length).toBeGreaterThan(0)
  })
})

describe('NEGATIVE_LEXICON', () => {
  it('contains known AI vocabulary words', () => {
    const lexicon = NEGATIVE_LEXICON as readonly string[]
    expect(lexicon).toContain('delve')
    expect(lexicon).toContain('leverage')
    expect(lexicon).toContain('synergy')
    expect(lexicon).toContain('game-changer')
  })

  it('is non-empty', () => {
    expect(NEGATIVE_LEXICON.length).toBeGreaterThan(0)
  })
})
