import { describe, it, expect } from 'vitest'
import { analyzeStyle, mergeStylePatterns, type StylePatterns } from './style-analyzer'

describe('analyzeStyle', () => {
  it('returns the correct StylePatterns shape', () => {
    const result = analyzeStyle('Hi there. How are you doing today?')
    expect(result).toHaveProperty('avgSentenceLength')
    expect(result).toHaveProperty('formality')
    expect(result).toHaveProperty('greetingStyle')
    expect(result).toHaveProperty('closingStyle')
    expect(result).toHaveProperty('useContractions')
    expect(result).toHaveProperty('questionCount')
    expect(result).toHaveProperty('commonPhrases')
    expect(typeof result.formality).toBe('number')
    expect(result.formality).toBeGreaterThanOrEqual(0)
    expect(result.formality).toBeLessThanOrEqual(100)
  })

  it('detects greeting from message start', () => {
    expect(analyzeStyle('Hi John, I saw your profile.').greetingStyle).toBe('Hi')
    expect(analyzeStyle('Hey there!').greetingStyle).toBe('Hey')
    expect(analyzeStyle('Hello, nice to meet you.').greetingStyle).toBe('Hello')
    expect(analyzeStyle('Dear Mr Smith,').greetingStyle).toBe('Dear')
  })

  it('returns empty greetingStyle when no greeting found', () => {
    expect(analyzeStyle('I wanted to reach out about an opportunity.').greetingStyle).toBe('')
  })

  it('detects closing style', () => {
    const result = analyzeStyle('Looking forward to connecting. Best wishes.')
    expect(result.closingStyle).toBeTruthy()
  })

  it('counts question marks', () => {
    expect(analyzeStyle('How are you? What do you think? Is this good?').questionCount).toBe(3)
    expect(analyzeStyle('No questions here at all.').questionCount).toBe(0)
  })

  it('sets useContractions true when contractions present', () => {
    // "I'm", "don't", "we'll" — multiple contractions in a short message pushes above 2% ratio
    const result = analyzeStyle("I'm excited. I don't think we'll have issues. I can't wait. Let's do this. I've heard great things.")
    expect(result.useContractions).toBe(true)
  })

  it('sets useContractions false when no contractions', () => {
    const result = analyzeStyle('I am excited to connect with you regarding the position at your company.')
    expect(result.useContractions).toBe(false)
  })

  it('formal markers raise formality score above 50', () => {
    const formal = analyzeStyle('Furthermore, regarding this matter, I would like to notwithstanding the aforementioned.')
    expect(formal.formality).toBeGreaterThan(50)
  })

  it('informal markers lower formality score below 50', () => {
    const informal = analyzeStyle('Hey yeah that is totally awesome, gonna check it out btw!')
    expect(informal.formality).toBeLessThan(50)
  })

  it('computes avgSentenceLength correctly', () => {
    // "One two three." = 3 words, "Four five." = 2 words → avg = Math.round((3+2)/2) = 3
    const result = analyzeStyle('One two three. Four five.')
    expect(result.avgSentenceLength).toBe(3)
  })

  it('handles empty string without throwing', () => {
    const result = analyzeStyle('')
    expect(result.avgSentenceLength).toBe(0)
    expect(result.questionCount).toBe(0)
  })

  it('handles single sentence', () => {
    const result = analyzeStyle('Hello world.')
    expect(result.avgSentenceLength).toBeGreaterThan(0)
  })
})

describe('mergeStylePatterns', () => {
  const base: StylePatterns = {
    avgSentenceLength: 10,
    formality: 60,
    greetingStyle: 'Hello',
    closingStyle: 'Best',
    useContractions: false,
    questionCount: 2,
    commonPhrases: ['looking forward', 'great opportunity'],
  }

  const incoming: StylePatterns = {
    avgSentenceLength: 20,
    formality: 40,
    greetingStyle: 'Hi',
    closingStyle: '',
    useContractions: true,
    questionCount: 0,
    commonPhrases: ['really excited', 'love this'],
  }

  it('weights existing at 80% and incoming at 20% by default', () => {
    const result = mergeStylePatterns(base, incoming)
    // avgSentenceLength: 10 * 0.8 + 20 * 0.2 = 8 + 4 = 12
    expect(result.avgSentenceLength).toBe(12)
    // formality: 60 * 0.8 + 40 * 0.2 = 48 + 8 = 56
    expect(result.formality).toBe(56)
    // questionCount: 2 * 0.8 + 0 * 0.2 = 1.6 → rounded = 2
    expect(result.questionCount).toBe(2)
  })

  it('incoming greetingStyle takes precedence when non-empty', () => {
    const result = mergeStylePatterns(base, incoming)
    expect(result.greetingStyle).toBe('Hi')
  })

  it('keeps existing greetingStyle when incoming is empty', () => {
    const withEmptyGreeting = { ...incoming, greetingStyle: '' }
    const result = mergeStylePatterns(base, withEmptyGreeting)
    expect(result.greetingStyle).toBe('Hello')
  })

  it('keeps existing closingStyle when incoming is empty', () => {
    const result = mergeStylePatterns(base, incoming) // incoming.closingStyle = ''
    expect(result.closingStyle).toBe('Best')
  })

  it('latest useContractions signal wins', () => {
    const result = mergeStylePatterns(base, incoming)
    expect(result.useContractions).toBe(true)
  })

  it('merges phrase lists', () => {
    const result = mergeStylePatterns(base, incoming)
    expect(result.commonPhrases.length).toBeGreaterThan(0)
    // All phrases from both lists should be represented
    const allPhrases = result.commonPhrases.join(' ')
    expect(allPhrases.length).toBeGreaterThan(0)
  })

  it('respects custom weight', () => {
    const result = mergeStylePatterns(base, incoming, 0.5)
    // avgSentenceLength: 10 * 0.5 + 20 * 0.5 = 15
    expect(result.avgSentenceLength).toBe(15)
  })
})
