import { QueryClient } from '@tanstack/react-query'
import crypto from 'crypto'

// Cache key generators for consistent cache management
export const cacheKeys = {
  // CPL-related keys
  cpl: {
    calculate: (content: string) => ['cpl', 'calculate', generateContentHash(content)],
    userHistory: (userId: string) => ['cpl', 'history', userId],
    userAverage: (userId: string) => ['cpl', 'average', userId],
  },

  // Embedding-related keys
  embeddings: {
    generate: (content: string, model: string = 'text-embedding-3-small') =>
      ['embeddings', 'generate', generateContentHash(content), model],
    similar: (embedding: number[], options: any) =>
      ['embeddings', 'similar', generateEmbeddingHash(embedding), JSON.stringify(options)],
    userStyle: (userId: string) => ['embeddings', 'style', userId],
  },

  // Draft generation keys
  drafts: {
    all: () => ['drafts'],
    generate: (content: string, draftType: string, options: any) =>
      ['drafts', 'generate', generateContentHash(content), draftType, JSON.stringify(options)],
    dual: (content: string, options: any) =>
      ['drafts', 'dual', generateContentHash(content), JSON.stringify(options)],
    analytics: () => ['drafts', 'analytics'],
    streaming: (streamId: string) => ['drafts', 'streaming', streamId],
  },

  // Voice learning keys
  voice: {
    all: () => ['voice'],
    profile: (userId: string) => ['voice', 'profile', userId],
    patterns: (userId: string) => ['voice', 'patterns', userId],
    similar: (styleVector: number[]) => ['voice', 'similar', generateEmbeddingHash(styleVector)],
    analytics: () => ['voice', 'analytics'],
    suggestions: (text: string, voiceStrength: number) => ['voice', 'suggestions', generateContentHash(text), voiceStrength],
    examples: (text: string, similarity: number, maxExamples: number, patterns?: string[]) =>
      ['voice', 'examples', generateContentHash(text), similarity, maxExamples, patterns?.join(',') || 'all'],
  },

  // Usage and analytics keys
  usage: {
    stats: (userId: string) => ['usage', 'stats', userId],
    embeddings: (userId?: string) => userId ? ['usage', 'embeddings', userId] : ['usage', 'embeddings'],
    monthly: (userId: string, month: string) => ['usage', 'monthly', userId, month],
  }
}

// Generate consistent content hash for cache keys
function generateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content.trim().toLowerCase()).digest('hex').substring(0, 16)
}

// Generate consistent embedding hash for cache keys
function generateEmbeddingHash(embedding: number[]): string {
  const embeddingStr = embedding.slice(0, 10).join(',') // Use first 10 dimensions for hash
  return crypto.createHash('sha256').update(embeddingStr).digest('hex').substring(0, 16)
}

// Advanced cache configuration for maximum cost reduction
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Aggressive caching for cost reduction
        staleTime: 1000 * 60 * 60, // 1 hour - data stays fresh for 1 hour
        gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache for 1 day

        // Reduce network requests
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,

        // Retry configuration for reliability
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors except 429 (rate limit)
          if (error?.status >= 400 && error?.status < 500 && error?.status !== 429) {
            return false
          }
          return failureCount < 2
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Background updates for better UX
        refetchInterval: false, // Disable automatic background refetching
      },
      mutations: {
        // Retry failed mutations
        retry: 1,
        retryDelay: 1000,
      },
    },
  })
}

// Cache configuration presets for different data types
export const cachePresets = {
  // For expensive operations (embeddings, AI processing)
  expensive: {
    staleTime: 1000 * 60 * 60 * 6, // 6 hours
    gcTime: 1000 * 60 * 60 * 24 * 7, // 1 week
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  },

  // For CPL calculations (moderately expensive)
  moderate: {
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60 * 24, // 1 day
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },

  // For user data (should be fresh)
  userdata: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: true,
  },

  // For static/reference data
  static: {
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 24 * 30, // 30 days
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  },
}

// Cache invalidation utilities
export const cacheUtils = {
  // Invalidate all CPL-related caches for a user
  invalidateUserCPL: (queryClient: QueryClient, userId: string) => {
    queryClient.invalidateQueries({ queryKey: ['cpl', 'history', userId] })
    queryClient.invalidateQueries({ queryKey: ['cpl', 'average', userId] })
  },

  // Invalidate user style caches
  invalidateUserStyle: (queryClient: QueryClient, userId: string) => {
    queryClient.invalidateQueries({ queryKey: ['voice', 'profile', userId] })
    queryClient.invalidateQueries({ queryKey: ['voice', 'patterns', userId] })
    queryClient.invalidateQueries({ queryKey: ['embeddings', 'style', userId] })
  },

  // Clear all cached embeddings (for cost management)
  clearEmbeddingCaches: (queryClient: QueryClient) => {
    queryClient.removeQueries({ queryKey: ['embeddings'] })
  },

  // Prefetch commonly used data
  prefetchUserData: async (queryClient: QueryClient, userId: string) => {
    const prefetchPromises = [
      queryClient.prefetchQuery({
        queryKey: cacheKeys.voice.profile(userId),
        staleTime: cachePresets.userdata.staleTime,
      }),
      queryClient.prefetchQuery({
        queryKey: cacheKeys.usage.stats(userId),
        staleTime: cachePresets.userdata.staleTime,
      }),
    ]

    await Promise.allSettled(prefetchPromises)
  },
}

// Cost tracking utilities
export const costTracking = {
  // Track cache hit rates for optimization
  trackCacheHit: (queryKey: string[], hitType: 'hit' | 'miss') => {
    if (typeof window !== 'undefined') {
      const key = `cache_${hitType}_${queryKey[0]}`
      const current = parseInt(localStorage.getItem(key) || '0')
      localStorage.setItem(key, (current + 1).toString())
    }
  },

  // Get cache performance stats
  getCacheStats: () => {
    if (typeof window === 'undefined') return {}

    const stats: Record<string, any> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('cache_')) {
        stats[key] = parseInt(localStorage.getItem(key) || '0')
      }
    }
    return stats
  },

  // Calculate cache hit ratio
  getCacheHitRatio: (operation: string): number => {
    if (typeof window === 'undefined') return 0

    const hits = parseInt(localStorage.getItem(`cache_hit_${operation}`) || '0')
    const misses = parseInt(localStorage.getItem(`cache_miss_${operation}`) || '0')
    const total = hits + misses

    return total > 0 ? hits / total : 0
  },
}

// Cache warming strategies
export const cacheWarming = {
  // Warm CPL cache with user's recent content
  warmCPLCache: async (queryClient: QueryClient, userId: string) => {
    // Implementation would prefetch recent CPL calculations
  },

  // Warm embedding cache with frequently used content
  warmEmbeddingCache: async (queryClient: QueryClient, userId: string) => {
    // Implementation would prefetch user's style embeddings
  },
}

// Export the configured query client instance
export const queryClient = createQueryClient()