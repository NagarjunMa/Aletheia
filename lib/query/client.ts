// TanStack Query Client Configuration
// Created: December 8, 2024
// Purpose: Configure React Query for server state management

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 5 minutes
      staleTime: 1000 * 60 * 5,
      // Cache time: 10 minutes
      gcTime: 1000 * 60 * 10,
      // Retry failed requests 3 times
      retry: 3,
      // Retry with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for important data
      refetchOnWindowFocus: false,
      // Refetch on reconnect
      refetchOnReconnect: true,
      // Enable background refetching
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
})

// Query keys factory for consistent key management
export const queryKeys = {
  // Authentication
  auth: {
    user: () => ['auth', 'user'] as const,
    profile: () => ['auth', 'profile'] as const,
  },

  // Conversations
  conversations: {
    all: () => ['conversations'] as const,
    lists: () => [...queryKeys.conversations.all(), 'list'] as const,
    list: (filters?: Record<string, any>) =>
      [...queryKeys.conversations.lists(), filters] as const,
    details: () => [...queryKeys.conversations.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.conversations.details(), id] as const,
    stats: () => [...queryKeys.conversations.all(), 'stats'] as const,
  },

  // User Inputs
  inputs: {
    all: () => ['inputs'] as const,
    lists: () => [...queryKeys.inputs.all(), 'list'] as const,
    list: (conversationId?: string) =>
      [...queryKeys.inputs.lists(), conversationId] as const,
    details: () => [...queryKeys.inputs.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.inputs.details(), id] as const,
  },

  // Generated Drafts
  drafts: {
    all: () => ['drafts'] as const,
    lists: () => [...queryKeys.drafts.all(), 'list'] as const,
    list: (inputId?: string) => [...queryKeys.drafts.lists(), inputId] as const,
    details: () => [...queryKeys.drafts.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.drafts.details(), id] as const,
  },

  // CPL Analytics
  cpl: {
    all: () => ['cpl'] as const,
    score: (text: string) => [...queryKeys.cpl.all(), 'score', text] as const,
    trends: (timeframe: string) => [...queryKeys.cpl.all(), 'trends', timeframe] as const,
    statistics: () => [...queryKeys.cpl.all(), 'statistics'] as const,
    benchmarks: (userType: string, category?: string) =>
      [...queryKeys.cpl.all(), 'benchmarks', userType, category] as const,
  },

  // Streaming
  streaming: {
    all: () => ['streaming'] as const,
    session: (sessionId: string) => [...queryKeys.streaming.all(), 'session', sessionId] as const,
    status: (sessionId: string) => [...queryKeys.streaming.all(), 'status', sessionId] as const,
    health: () => [...queryKeys.streaming.all(), 'health'] as const,
  },

  // Profile & Settings
  profile: {
    all: () => ['profile'] as const,
    current: () => [...queryKeys.profile.all(), 'current'] as const,
    preferences: () => [...queryKeys.profile.all(), 'preferences'] as const,
    analytics: () => [...queryKeys.profile.all(), 'analytics'] as const,
  },
} as const

// Utility functions for cache management
export const cacheUtils = {
  // Invalidate all queries for a specific entity
  invalidateEntity: (entity: keyof typeof queryKeys) => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys[entity].all(),
    })
  },

  // Remove all cached data for an entity
  removeEntity: (entity: keyof typeof queryKeys) => {
    return queryClient.removeQueries({
      queryKey: queryKeys[entity].all(),
    })
  },

  // Prefetch a query
  prefetch: <T>(
    queryKey: readonly unknown[],
    queryFn: () => Promise<T>,
    options?: { staleTime?: number }
  ) => {
    return queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: options?.staleTime || 1000 * 60 * 5, // 5 minutes default
    })
  },

  // Set query data manually
  setData: <T>(queryKey: readonly unknown[], data: T) => {
    return queryClient.setQueryData(queryKey, data)
  },

  // Get cached query data
  getData: <T>(queryKey: readonly unknown[]): T | undefined => {
    return queryClient.getQueryData<T>(queryKey)
  },

  // Update query data optimistically
  updateData: <T>(
    queryKey: readonly unknown[],
    updater: (oldData: T | undefined) => T
  ) => {
    return queryClient.setQueryData<T>(queryKey, updater)
  },
}

// Error handling utilities
export const queryErrorHandler = (error: Error) => {
  console.error('Query error:', error)

  // Handle specific error types
  if (error.message.includes('fetch')) {
    // Network error
    console.warn('Network error detected, check connection')
  } else if (error.message.includes('401')) {
    // Authentication error
    console.warn('Authentication error, user may need to re-login')
    // Could trigger a sign-out action here
  } else if (error.message.includes('403')) {
    // Authorization error
    console.warn('Authorization error, user may not have permission')
  } else if (error.message.includes('429')) {
    // Rate limiting
    console.warn('Rate limit exceeded, retrying later')
  }

  // Return a user-friendly error message
  return 'An error occurred. Please try again.'
}

// Mutation error handler
export const mutationErrorHandler = (error: Error) => {
  console.error('Mutation error:', error)

  // Handle mutation-specific errors
  if (error.message.includes('validation')) {
    return 'Please check your input and try again.'
  } else if (error.message.includes('duplicate')) {
    return 'This item already exists.'
  } else if (error.message.includes('not found')) {
    return 'The requested item was not found.'
  }

  return 'Failed to save changes. Please try again.'
}

// Development helpers
export const devtools = {
  // Log all cached queries
  logCache: () => {
    console.log('Query cache:', queryClient.getQueryCache().getAll())
  },

  // Log specific query
  logQuery: (queryKey: readonly unknown[]) => {
    const query = queryClient.getQueryCache().find({ queryKey })
    console.log(`Query [${queryKey.join(', ')}]:`, query)
  },

  // Clear all cache
  clearCache: () => {
    queryClient.clear()
    console.log('Query cache cleared')
  },

  // Get cache statistics
  getCacheStats: () => {
    const cache = queryClient.getQueryCache()
    return {
      totalQueries: cache.getAll().length,
      staleQueries: cache.findAll({ stale: true }).length,
      freshQueries: cache.findAll({ stale: false }).length,
      errorQueries: cache.findAll({ type: 'error' }).length,
    }
  },
}