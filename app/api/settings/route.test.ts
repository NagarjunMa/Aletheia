import { describe, it, expect } from 'vitest'
import { settingsSchema } from './schema'

describe('settingsSchema', () => {
  it('parses a valid formality_level', () => {
    const result = settingsSchema.safeParse({ formality_level: 'casual' })
    expect(result.success).toBe(true)
  })

  it('accepts all valid formality_level values', () => {
    for (const level of ['casual', 'neutral', 'formal']) {
      expect(settingsSchema.safeParse({ formality_level: level }).success).toBe(true)
    }
  })

  it('fails when formality_level is invalid', () => {
    const result = settingsSchema.safeParse({ formality_level: 'very_formal' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid theme values', () => {
    for (const theme of ['light', 'dark', 'system']) {
      expect(settingsSchema.safeParse({ theme }).success).toBe(true)
    }
  })

  it('fails when theme is invalid', () => {
    const result = settingsSchema.safeParse({ theme: 'rainbow' })
    expect(result.success).toBe(false)
  })

  it('accepts share_analytics as boolean', () => {
    expect(settingsSchema.safeParse({ share_analytics: true }).success).toBe(true)
    expect(settingsSchema.safeParse({ share_analytics: false }).success).toBe(true)
  })

  it('accepts reset_style: true alongside other fields', () => {
    const result = settingsSchema.safeParse({
      formality_level: 'neutral',
      theme: 'dark',
      reset_style: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields are optional)', () => {
    const result = settingsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('fails when share_analytics is not a boolean', () => {
    const result = settingsSchema.safeParse({ share_analytics: 'yes' })
    expect(result.success).toBe(false)
  })
})
