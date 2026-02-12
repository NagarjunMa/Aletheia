import { vi } from 'vitest'

// Mock Supabase client for testing
export const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    csv: vi.fn().mockResolvedValue({ data: '', error: null }),
    geojson: vi.fn().mockResolvedValue({ data: null, error: null }),
    explain: vi.fn().mockResolvedValue({ data: '', error: null }),
    rollback: vi.fn().mockResolvedValue({ data: null, error: null }),
    returns: vi.fn((data) => Promise.resolve(data)),
    then: vi.fn((resolve) => resolve({ data: [], error: null })),
  })),

  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: { full_name: 'Test User' }
        }
      },
      error: null
    }),
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          user: {
            id: 'test-user-id',
            email: 'test@example.com'
          }
        }
      },
      error: null
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com'
        },
        session: {
          access_token: 'test-access-token'
        }
      },
      error: null
    }),
    signUp: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com'
        },
        session: null
      },
      error: null
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    refreshSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'new-test-access-token'
        }
      },
      error: null
    }),
    onAuthStateChange: vi.fn((callback) => {
      // Simulate initial session
      callback('INITIAL_SESSION', {
        access_token: 'test-access-token',
        user: { id: 'test-user-id', email: 'test@example.com' }
      })

      return {
        data: { subscription: { unsubscribe: vi.fn() } }
      }
    })
  },

  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({
      unsubscribe: vi.fn()
    }),
    unsubscribe: vi.fn()
  })),

  removeChannel: vi.fn(),
  removeAllChannels: vi.fn(),
  getChannels: vi.fn().mockReturnValue([]),

  // Storage mocks
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      download: vi.fn().mockResolvedValue({ data: null, error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/file.jpg' }
      }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null
      })
    }))
  },

  // Functions mocks
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: null, error: null })
  }
}

// Mock Supabase modules
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
  supabase: mockSupabaseClient
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
  getUser: vi.fn().mockResolvedValue({
    id: 'test-user-id',
    email: 'test@example.com'
  }),
  getSession: vi.fn().mockResolvedValue({
    access_token: 'test-access-token',
    user: { id: 'test-user-id', email: 'test@example.com' }
  })
}))

// Helper function to reset all mocks
export function resetSupabaseMocks() {
  Object.values(mockSupabaseClient).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockClear()
    }
  })

  Object.values(mockSupabaseClient.auth).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockClear()
    }
  })
}

// Helper to set up specific auth states
export function setupAuthState(state: 'authenticated' | 'unauthenticated' | 'loading') {
  switch (state) {
    case 'authenticated':
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { full_name: 'Test User' }
          }
        },
        error: null
      })
      break

    case 'unauthenticated':
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })
      break

    case 'loading':
      mockSupabaseClient.auth.getUser.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )
      break
  }
}