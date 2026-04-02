import { describe, it, expect } from 'vitest'
import { generateRequestSchema } from './schema'

const validProfile = {
  name: 'Jane Doe',
  profileUrl: 'https://linkedin.com/in/janedoe',
}

const validPayload = {
  profile: validProfile,
  category: 'linkedin_connection',
}

describe('generateRequestSchema', () => {
  it('parses a minimal valid payload', () => {
    const result = generateRequestSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('parses a full valid payload', () => {
    const result = generateRequestSchema.safeParse({
      profile: {
        name: 'Jane Doe',
        headline: 'Senior Engineer at Acme',
        location: 'San Francisco, CA',
        about: 'Passionate about building things.',
        experiences: [{ title: 'Engineer', company: 'Acme' }],
        recentPosts: ['Post about AI'],
        skills: ['TypeScript', 'React'],
        profileUrl: 'https://linkedin.com/in/janedoe',
      },
      resume: 'My resume content here.',
      jd: 'Job description here.',
      category: 'cold_email',
      intent: 'referral',
      acceptedExamples: ['Example message 1'],
    })
    expect(result.success).toBe(true)
  })

  it('fails when profile.name is missing', () => {
    const result = generateRequestSchema.safeParse({
      profile: { profileUrl: 'https://linkedin.com/in/janedoe' },
      category: 'linkedin_connection',
    })
    expect(result.success).toBe(false)
  })

  it('fails when profile.profileUrl is not a valid URL', () => {
    const result = generateRequestSchema.safeParse({
      profile: { name: 'Jane', profileUrl: 'not-a-url' },
      category: 'linkedin_connection',
    })
    expect(result.success).toBe(false)
  })

  it('fails when category is invalid', () => {
    const result = generateRequestSchema.safeParse({
      ...validPayload,
      category: 'instagram_post',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid category values', () => {
    for (const category of ['linkedin_connection', 'cold_email', 'linkedin_inmail']) {
      expect(generateRequestSchema.safeParse({ ...validPayload, category }).success).toBe(true)
    }
  })

  it('accepts all valid intent values', () => {
    for (const intent of ['networking', 'referral', 'mentorship', 'job_inquiry']) {
      expect(generateRequestSchema.safeParse({ ...validPayload, intent }).success).toBe(true)
    }
  })

  it('fails when intent is invalid', () => {
    const result = generateRequestSchema.safeParse({ ...validPayload, intent: 'cold_call' })
    expect(result.success).toBe(false)
  })

  it('accepts null resume (optional)', () => {
    const result = generateRequestSchema.safeParse({ ...validPayload, resume: null })
    expect(result.success).toBe(true)
  })

  it('accepts null jd (optional)', () => {
    const result = generateRequestSchema.safeParse({ ...validPayload, jd: null })
    expect(result.success).toBe(true)
  })

  it('accepts empty acceptedExamples array', () => {
    const result = generateRequestSchema.safeParse({ ...validPayload, acceptedExamples: [] })
    expect(result.success).toBe(true)
  })

  it('fails when profile is missing entirely', () => {
    const result = generateRequestSchema.safeParse({ category: 'linkedin_connection' })
    expect(result.success).toBe(false)
  })
})
