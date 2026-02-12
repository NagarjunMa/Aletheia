import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0
      },
      mutations: {
        retry: false
      }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Mock user data generators
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@ascendia.dev',
  full_name: 'Test User',
  avatar_url: null,
  cpl_score: 75.5,
  preferences: {},
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockConversation = (overrides = {}) => ({
  id: 'test-conversation-id',
  user_id: 'test-user-id',
  title: 'Test Conversation',
  category: 'general',
  context: {},
  is_archived: false,
  created_at: '2024-01-01T00:00:00Z',
  last_activity_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockDraft = (overrides = {}) => ({
  id: 'test-draft-id',
  user_input_id: 'test-input-id',
  conversation_id: 'test-conversation-id',
  user_id: 'test-user-id',
  content: 'This is a test draft content.',
  draft_type: 'adaptive_polish' as const,
  cpl_score: 82.3,
  is_accepted: false,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockUserInput = (overrides = {}) => ({
  id: 'test-input-id',
  conversation_id: 'test-conversation-id',
  user_id: 'test-user-id',
  raw_text: 'This is test user input.',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
})

// Form testing helpers
export const fillForm = async (form: HTMLFormElement, data: Record<string, string>) => {
  const { fireEvent } = await import('@testing-library/react')

  Object.entries(data).forEach(([name, value]) => {
    const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement
    if (input) {
      fireEvent.change(input, { target: { value } })
    }
  })
}

// Async testing helpers
export const waitForElementToBeRemoved = async (element: () => HTMLElement | null) => {
  const { waitForElementToBeRemoved: originalWait } = await import('@testing-library/react')
  return originalWait(element, { timeout: 5000 })
}

// Mock implementations for common services
export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: createMockUser() },
      error: null
    }),
    getSession: vi.fn().mockResolvedValue({
      data: { session: { user: createMockUser() } },
      error: null
    }),
    signInWithOAuth: vi.fn().mockResolvedValue({
      data: { url: 'http://mock-oauth-url.com' },
      error: null
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: createMockUser() },
      error: null
    }),
    signUp: vi.fn().mockResolvedValue({
      data: { user: createMockUser() },
      error: null
    }),
    signOut: vi.fn().mockResolvedValue({ error: null })
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: createMockUser(),
      error: null
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: createMockUser(),
      error: null
    })
  }))
}

export const mockAnthropicClient = {
  messages: {
    create: vi.fn().mockResolvedValue({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'text',
        text: '[DRAFT 1: Grammar Fix Only]\nTest content.\n\n[DRAFT 2: Adaptive Polish]\nTest content with enhanced clarity.'
      }],
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      usage: { input_tokens: 50, output_tokens: 100 }
    }),
    stream: vi.fn().mockReturnValue({
      on: vi.fn().mockImplementation((event, callback) => {
        if (event === 'text') {
          setTimeout(() => callback('Test streaming text'), 100)
        }
        if (event === 'end') {
          setTimeout(callback, 200)
        }
        return { on: vi.fn() }
      })
    })
  }
}

// Testing utilities for AI SDK
export const mockUseCompletion = (overrides = {}) => ({
  completion: '',
  complete: vi.fn().mockResolvedValue('Mock completion result'),
  isLoading: false,
  error: null,
  stop: vi.fn(),
  setCompletion: vi.fn(),
  ...overrides
})

export const mockUseChat = (overrides = {}) => ({
  messages: [],
  input: '',
  handleInputChange: vi.fn(),
  handleSubmit: vi.fn(),
  isLoading: false,
  error: null,
  stop: vi.fn(),
  reload: vi.fn(),
  append: vi.fn(),
  setInput: vi.fn(),
  ...overrides
})

// Zustand store testing helpers
export const createMockConversationStore = (overrides = {}) => ({
  conversations: [createMockConversation()],
  currentConversation: createMockConversation(),
  isLoading: false,
  addConversation: vi.fn(),
  updateConversation: vi.fn(),
  setCurrentConversation: vi.fn(),
  deleteConversation: vi.fn(),
  ...overrides
})

// Server Action testing helpers
export const mockServerAction = <T = any>(result: T) => {
  return vi.fn().mockImplementation(async () => {
    // Simulate server action delay
    await new Promise(resolve => setTimeout(resolve, 100))
    return { success: true, data: result }
  })
}

export const mockServerActionError = (error: string) => {
  return vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return { success: false, error }
  })
}

// CPL calculation testing data
export const cplTestCases = [
  {
    input: 'hello world',
    expected: { min: 0, max: 50 },
    description: 'Simple, short input'
  },
  {
    input: 'This is a well-constructed sentence with appropriate complexity and professional vocabulary that demonstrates higher-level writing capabilities.',
    expected: { min: 70, max: 100 },
    description: 'Complex, professional input'
  },
  {
    input: '',
    expected: { min: 0, max: 0 },
    description: 'Empty input'
  }
]

// Performance testing helpers
export const measureRenderTime = async (renderFn: () => void) => {
  const start = performance.now()
  renderFn()
  const end = performance.now()
  return end - start
}

// Accessibility testing helpers
export const checkA11y = async (container: HTMLElement) => {
  // Basic accessibility checks
  const buttons = container.querySelectorAll('button')
  const inputs = container.querySelectorAll('input, textarea')
  const images = container.querySelectorAll('img')
  const links = container.querySelectorAll('a')

  // Check for proper button labels
  buttons.forEach(button => {
    expect(
      button.textContent ||
      button.getAttribute('aria-label') ||
      button.getAttribute('title')
    ).toBeTruthy()
  })

  // Check for proper form labels
  inputs.forEach(input => {
    expect(
      input.getAttribute('aria-label') ||
      input.getAttribute('aria-labelledby') ||
      container.querySelector(`label[for="${input.id}"]`)
    ).toBeTruthy()
  })

  // Check for alt text on images
  images.forEach(img => {
    expect(
      img.getAttribute('alt') !== undefined
    ).toBeTruthy()
  })

  // Check for proper link text
  links.forEach(link => {
    expect(
      link.textContent ||
      link.getAttribute('aria-label') ||
      link.getAttribute('title')
    ).toBeTruthy()
  })
}