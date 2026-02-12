// Enhanced Supabase Client Configuration with Error Handling
// Created: December 7, 2024
// Updated: January 2025
// Purpose: Resilient client-side Supabase client with fallback modes

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database/types'

// Connection state management
interface ConnectionState {
  isOnline: boolean
  lastError: string | null
  retryCount: number
  fallbackMode: 'none' | 'local' | 'offline'
}

let connectionState: ConnectionState = {
  isOnline: false,
  lastError: null,
  retryCount: 0,
  fallbackMode: 'none'
}

// Singleton instance to prevent multiple client creations
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

// Enhanced client creation with error handling
export function createClient() {
  if (!supabaseInstance) {
    try {
      // Validate environment variables
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!url || !key) {
        console.error('❌ Supabase configuration missing')
        connectionState.fallbackMode = 'offline'
        throw new Error('Missing Supabase environment variables')
      }

      // Validate URL format
      if (!url.match(/^https:\/\/[a-z0-9]{20}\.supabase\.co$/)) {
        console.error('❌ Invalid Supabase URL format:', url)
        connectionState.fallbackMode = 'offline'
        throw new Error('Invalid Supabase URL format')
      }

      console.log('🔗 Creating Supabase client for:', url.replace(/[a-z0-9]{20}/, '***'))

      supabaseInstance = createBrowserClient<Database>(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        },
        global: {
          headers: {
            'x-application-name': 'ascendia',
            'x-client-version': '2.0.0'
          }
        },
        db: {
          schema: 'public'
        }
      })

      // Test connection on creation
      testConnection()

    } catch (error) {
      console.error('❌ Failed to create Supabase client:', error)
      connectionState.lastError = error instanceof Error ? error.message : 'Unknown error'

      // Return a mock client for development
      return createMockClient()
    }
  }
  return supabaseInstance!
}

// Test connection health
async function testConnection() {
  if (!supabaseInstance) return

  try {
    console.log('🧪 Testing Supabase connection...')

    // Simple health check
    const { error } = await supabaseInstance
      .from('profiles')
      .select('count')
      .limit(1)
      .maybeSingle()

    if (error) {
      if (error.message.includes('relation "profiles" does not exist')) {
        console.warn('⚠️ Database schema not initialized, but connection works')
        connectionState.isOnline = true
        connectionState.fallbackMode = 'none'
      } else {
        throw error
      }
    } else {
      console.log('✅ Supabase connection successful')
      connectionState.isOnline = true
      connectionState.fallbackMode = 'none'
      connectionState.lastError = null
      connectionState.retryCount = 0
    }

  } catch (error) {
    console.error('❌ Supabase connection failed:', error)
    connectionState.isOnline = false
    connectionState.lastError = error instanceof Error ? error.message : 'Connection failed'
    connectionState.retryCount++

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('DNS')) {
        console.error('💡 Tip: Check if your Supabase project exists and is active')
        connectionState.fallbackMode = 'offline'
      } else if (error.message.includes('timeout')) {
        console.error('💡 Tip: Supabase project might be paused or overloaded')
        connectionState.fallbackMode = 'local'
      } else if (error.message.includes('unauthorized') || error.message.includes('API key')) {
        console.error('💡 Tip: Check your Supabase API keys')
        connectionState.fallbackMode = 'offline'
      }
    }
  }
}

// Create mock client for development/testing
function createMockClient() {
  console.log('🎭 Creating mock Supabase client for offline development')

  const mockClient = {
    from: (table: string) => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null })
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithOAuth: () => Promise.resolve({ data: null, error: null }),
      signUp: () => Promise.resolve({ data: null, error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        download: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } })
      })
    }
  }

  return mockClient as any
}

// Export enhanced client with connection state
export const supabase = createClient()

// Export connection utilities
export const getConnectionState = () => ({ ...connectionState })

export const retryConnection = async () => {
  console.log('🔄 Retrying Supabase connection...')
  connectionState.retryCount++

  if (connectionState.retryCount > 5) {
    console.error('❌ Max retry attempts reached, switching to offline mode')
    connectionState.fallbackMode = 'offline'
    return false
  }

  await testConnection()
  return connectionState.isOnline
}

export const isOfflineMode = () => connectionState.fallbackMode === 'offline'
export const getLastError = () => connectionState.lastError

// Type-safe table access helpers (updated after cleanup)
export const Tables = {
  profiles: () => supabase.from('profiles'),
  conversations: () => supabase.from('conversations'),
  user_inputs: () => supabase.from('user_inputs'),
  generated_drafts: () => supabase.from('generated_drafts'),
  user_feedback: () => supabase.from('user_feedback'),
  user_preferences: () => supabase.from('user_preferences'),
  usage_analytics: () => supabase.from('usage_analytics'),
  production_metrics: () => supabase.from('production_metrics'),
  messages: () => supabase.from('messages'),
}

// Views access
export const Views = {
  user_dashboard_stats: () => supabase.from('user_dashboard_stats'),
  conversation_details: () => supabase.from('conversation_details'),
}