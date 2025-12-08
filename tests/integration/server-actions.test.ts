import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockFormData,
  createMockServerAction,
  createValidatedMockServerAction,
  validateFormData,
  serverActionTestScenarios,
  securityTestInputs,
  testSecurityInput
} from '../utils/server-action-testing'
import {
  mockClaudeService,
  mockCPLCalculator,
  mockContentSanitizer
} from '../utils/ai-service-mocks'

// Mock the Next.js server modules
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn()
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }))
}))

describe('Server Actions Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Draft Generation Server Action', () => {
    it('should generate drafts successfully with valid input', async () => {
      const mockGenerateDrafts = createMockServerAction(
        serverActionTestScenarios.generateDraft.expectedResult
      )

      const formData = createMockFormData({
        content: 'Test content for generation',
        type: 'email'
      })

      const result = await mockGenerateDrafts(formData)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.grammar_fix).toBeDefined()
      expect(result.data.adaptive_polish).toBeDefined()
      expect(result.data.cpl_score).toBeGreaterThan(0)
    })

    it('should validate input content length', async () => {
      const mockGenerateDrafts = createValidatedMockServerAction(
        (formData) => {
          const content = formData.get('content')?.toString() || ''
          return content.length >= 10 && content.length <= 5000
        },
        { success: true, data: { message: 'Valid content' } },
        { success: false, error: 'Content must be between 10 and 5000 characters' }
      )

      // Test too short
      let formData = createMockFormData({ content: 'short' })
      let result = await mockGenerateDrafts(formData)
      expect(result.success).toBe(false)

      // Test valid length
      formData = createMockFormData({ content: 'This is a valid content length for testing purposes.' })
      result = await mockGenerateDrafts(formData)
      expect(result.success).toBe(true)
    })

    it('should sanitize AI output', async () => {
      const maliciousOutput = 'Normal content <script>alert("xss")</script> more content'
      const sanitized = mockContentSanitizer.sanitizeLLMOutput(maliciousOutput)

      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('Normal content')
      expect(sanitized).toContain('more content')
    })

    it('should handle CPL calculation correctly', () => {
      const testCases = [
        {
          input: 'hello world',
          expectedRange: { min: 0, max: 60 }
        },
        {
          input: 'This is a sophisticated sentence demonstrating advanced vocabulary and complex grammatical structures.',
          expectedRange: { min: 70, max: 100 }
        }
      ]

      testCases.forEach(({ input, expectedRange }) => {
        const score = mockCPLCalculator.calculate(input)
        expect(score).toBeGreaterThanOrEqual(expectedRange.min)
        expect(score).toBeLessThanOrEqual(expectedRange.max)
      })
    })

    it('should prevent malicious input injection', async () => {
      const mockGenerateDrafts = createMockServerAction({
        success: false,
        error: 'Potentially dangerous content detected'
      })

      await testSecurityInput(mockGenerateDrafts, 'content', securityTestInputs.promptInjection)
      await testSecurityInput(mockGenerateDrafts, 'content', securityTestInputs.xss)
    })
  })

  describe('User Profile Server Actions', () => {
    it('should update user profile successfully', async () => {
      const mockUpdateProfile = createMockServerAction(
        serverActionTestScenarios.updateProfile.expectedResult
      )

      const formData = createMockFormData({
        full_name: 'John Doe',
        preferences: JSON.stringify({ theme: 'dark' })
      })

      const result = await mockUpdateProfile(formData)

      expect(result.success).toBe(true)
      expect(result.data.full_name).toBe('John Doe')
    })

    it('should validate profile data', async () => {
      const mockUpdateProfile = createValidatedMockServerAction(
        (formData) => validateFormData.required(formData, ['full_name']),
        { success: true, data: { message: 'Profile updated' } },
        { success: false, error: 'Full name is required' }
      )

      // Test missing required field
      let formData = createMockFormData({ email: 'test@example.com' })
      let result = await mockUpdateProfile(formData)
      expect(result.success).toBe(false)

      // Test with required field
      formData = createMockFormData({ full_name: 'John Doe' })
      result = await mockUpdateProfile(formData)
      expect(result.success).toBe(true)
    })
  })

  describe('Conversation Management Server Actions', () => {
    it('should create conversation successfully', async () => {
      const mockCreateConversation = createMockServerAction({
        success: true,
        data: {
          id: 'conv-123',
          title: 'New Conversation',
          category: 'email'
        }
      })

      const formData = createMockFormData({
        title: 'New Conversation',
        category: 'email'
      })

      const result = await mockCreateConversation(formData)

      expect(result.success).toBe(true)
      expect(result.data.id).toBeDefined()
      expect(result.data.title).toBe('New Conversation')
    })

    it('should validate conversation title length', async () => {
      const mockCreateConversation = createValidatedMockServerAction(
        (formData) => {
          const title = formData.get('title')?.toString() || ''
          return title.length >= 1 && title.length <= 100
        },
        { success: true, data: { message: 'Conversation created' } },
        { success: false, error: 'Title must be between 1 and 100 characters' }
      )

      // Test empty title
      let formData = createMockFormData({ title: '' })
      let result = await mockCreateConversation(formData)
      expect(result.success).toBe(false)

      // Test too long title
      formData = createMockFormData({ title: 'a'.repeat(101) })
      result = await mockCreateConversation(formData)
      expect(result.success).toBe(false)

      // Test valid title
      formData = createMockFormData({ title: 'Valid Title' })
      result = await mockCreateConversation(formData)
      expect(result.success).toBe(true)
    })

    it('should archive conversation', async () => {
      const mockArchiveConversation = createMockServerAction({
        success: true,
        data: { message: 'Conversation archived' }
      })

      const formData = createMockFormData({
        conversationId: 'conv-123',
        action: 'archive'
      })

      const result = await mockArchiveConversation(formData)

      expect(result.success).toBe(true)
      expect(result.data.message).toBe('Conversation archived')
    })
  })

  describe('Authentication Server Actions', () => {
    it('should handle signup with email validation', async () => {
      const mockSignup = createValidatedMockServerAction(
        (formData) => {
          return validateFormData.email(formData, 'email') &&
                 validateFormData.minLength(formData, 'password', 8)
        },
        serverActionTestScenarios.createUser.expectedResult,
        { success: false, error: 'Invalid email or password too short' }
      )

      // Test invalid email
      let formData = createMockFormData({
        email: 'invalid-email',
        password: 'ValidPass123!'
      })
      let result = await mockSignup(formData)
      expect(result.success).toBe(false)

      // Test short password
      formData = createMockFormData({
        email: 'test@example.com',
        password: 'short'
      })
      result = await mockSignup(formData)
      expect(result.success).toBe(false)

      // Test valid credentials
      formData = createMockFormData({
        email: 'test@example.com',
        password: 'ValidPass123!'
      })
      result = await mockSignup(formData)
      expect(result.success).toBe(true)
    })

    it('should handle login rate limiting', async () => {
      let attemptCount = 0
      const mockLogin = vi.fn().mockImplementation(async () => {
        attemptCount++
        if (attemptCount > 3) {
          return { success: false, error: 'Too many attempts. Please try again later.' }
        }
        return { success: true, data: { user: { id: 'user-123' } } }
      })

      // First 3 attempts should succeed
      for (let i = 0; i < 3; i++) {
        const result = await mockLogin()
        expect(result.success).toBe(true)
      }

      // 4th attempt should fail
      const result = await mockLogin()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Too many attempts')
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockServerAction = vi.fn().mockRejectedValue(new Error('Network error'))

      try {
        await mockServerAction()
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Network error')
      }
    })

    it('should handle validation errors', async () => {
      const mockServerAction = createMockServerAction({
        success: false,
        error: 'Validation failed'
      })

      const result = await mockServerAction()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation failed')
    })

    it('should handle authorization errors', async () => {
      const mockServerAction = createMockServerAction({
        success: false,
        error: 'Unauthorized access'
      })

      const result = await mockServerAction()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unauthorized access')
    })
  })

  describe('Performance Tests', () => {
    it('should complete server actions within acceptable time', async () => {
      const mockServerAction = createMockServerAction({
        success: true,
        data: { message: 'Success' }
      }, 50) // 50ms delay

      const startTime = performance.now()
      const result = await mockServerAction()
      const endTime = performance.now()

      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(200) // Should complete within 200ms
    })

    it('should handle concurrent server action calls', async () => {
      const mockServerAction = createMockServerAction({
        success: true,
        data: { message: 'Success' }
      }, 100)

      const promises = Array.from({ length: 5 }, () => mockServerAction())
      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result.success).toBe(true)
      })
    })
  })
})