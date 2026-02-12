'use client'

import React, { createContext, useContext, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient, cacheUtils, costTracking } from './cache-config'

// Cache context for performance monitoring
interface CacheContextType {
  hitRatio: number
  totalSavings: number
  clearCache: (type?: string) => void
  getCacheStats: () => any
}

const CacheContext = createContext<CacheContextType | undefined>(undefined)

// Provider component with aggressive caching for cost reduction
export function CacheProvider({ children }: { children: React.ReactNode }) {
  const [cacheStats, setCacheStats] = React.useState({
    hitRatio: 0,
    totalSavings: 0
  })

  // Update cache stats periodically
  useEffect(() => {
    const updateStats = () => {
      const embeddingRatio = costTracking.getCacheHitRatio('embeddings')
      const cplRatio = costTracking.getCacheHitRatio('cpl')
      const voiceRatio = costTracking.getCacheHitRatio('voice')

      // Calculate average hit ratio
      const averageRatio = (embeddingRatio + cplRatio + voiceRatio) / 3

      // Estimate cost savings (embeddings are most expensive)
      const totalSavings = (
        embeddingRatio * 0.02 + // $0.02 per 1k tokens saved on embeddings
        cplRatio * 0.01 +       // $0.01 per calculation saved on CPL
        voiceRatio * 0.005      // $0.005 per voice analysis saved
      )

      setCacheStats({
        hitRatio: averageRatio,
        totalSavings
      })
    }

    // EMERGENCY FIX: Disabled interval polling to resolve performance issues
    // Update stats once on mount but disable continuous polling
    updateStats()

    // DISABLED: const interval = setInterval(updateStats, 30000)
    // return () => clearInterval(interval)

    // TODO: Re-enable cache stats polling after resolving infinite loop
    return () => {}
  }, [])

  const cacheContextValue: CacheContextType = {
    hitRatio: cacheStats.hitRatio,
    totalSavings: cacheStats.totalSavings,
    clearCache: (type?: string) => {
      if (type === 'embeddings') {
        cacheUtils.clearEmbeddingCaches(queryClient)
      } else if (type) {
        queryClient.removeQueries({ queryKey: [type] })
      } else {
        queryClient.clear()
      }
    },
    getCacheStats: () => costTracking.getCacheStats()
  }

  return (
    <CacheContext.Provider value={cacheContextValue}>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-right"
          />
        )}
        {process.env.NODE_ENV === 'development' && (
          <CachePerformanceIndicator />
        )}
      </QueryClientProvider>
    </CacheContext.Provider>
  )
}

// Development component to show cache performance
function CachePerformanceIndicator() {
  const cacheContext = useContext(CacheContext)

  if (!cacheContext) return null

  const { hitRatio, totalSavings } = cacheContext

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-50">
      <div className="mb-1">
        🎯 Cache Hit: {(hitRatio * 100).toFixed(1)}%
      </div>
      <div className="mb-1">
        💰 Saved: ${totalSavings.toFixed(4)}
      </div>
      <div className="text-green-400">
        📊 {hitRatio > 0.8 ? '✓ Excellent' : hitRatio > 0.6 ? '⚡ Good' : '⚠️ Low'} Performance
      </div>
    </div>
  )
}

// Hook to access cache context
export function useCacheContext() {
  const context = useContext(CacheContext)
  if (!context) {
    throw new Error('useCacheContext must be used within CacheProvider')
  }
  return context
}

// Hook for cache-aware API calls with automatic tracking
export function useCacheAwareQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: {
    staleTime?: number
    enabled?: boolean
    expensive?: boolean // Mark expensive operations for longer caching
  } = {}
) {
  const { expensive = false } = options

  // Track cache performance
  React.useEffect(() => {
    costTracking.trackCacheHit([key], 'miss')
  }, [key])

  // Use longer cache for expensive operations
  const cacheTime = expensive ? 1000 * 60 * 60 * 6 : 1000 * 60 * 30 // 6 hours vs 30 minutes

  return {
    // This would typically use the actual React Query implementation
    // For now, it's a placeholder showing the caching strategy
    staleTime: options.staleTime || cacheTime,
    enabled: options.enabled !== false,
    onSuccess: () => costTracking.trackCacheHit([key], 'hit')
  }
}

// Higher-order component for cache-optimized components
export function withCacheOptimization<T extends object>(
  Component: React.ComponentType<T>
) {
  return React.memo(function CacheOptimizedComponent(props: T) {
    const cacheContext = useCacheContext()

    // PERFORMANCE OPTIMIZATION: Remove aggressive prefetching on mount
    // Instead, prefetch only when user interacts with components
    // This prevents the 102 requests and 18+ second load times

    // Optional: Add interaction-based prefetching
    const prefetchOnInteraction = React.useCallback(async () => {
      const userId = getUserId()
      if (userId) {
        // Only prefetch essential data when user actually starts using features
        await cacheUtils.prefetchUserData(queryClient, userId)
      }
    }, [])

    return <Component {...props} />
  })
}

// Utility function to get user ID (implement based on your auth)
function getUserId(): string | null {
  // This would typically come from your auth context
  // For now, return null as placeholder
  return null
}

// Cache invalidation component for admin/development
export function CacheManagement() {
  const { clearCache, getCacheStats, hitRatio, totalSavings } = useCacheContext()
  const [stats, setStats] = React.useState<any>({})

  const refreshStats = () => {
    setStats(getCacheStats())
  }

  React.useEffect(() => {
    refreshStats()
  }, [getCacheStats])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-[#2e5797]">
        Cache Performance Dashboard
      </h2>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card p-4 rounded-lg border border-[#2e5797]/20">
          <div className="text-sm text-muted-foreground">Cache Hit Ratio</div>
          <div className="text-2xl font-bold text-[#2e5797]">
            {(hitRatio * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">
            Target: 87.5% for maximum savings
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border border-[#2e5797]/20">
          <div className="text-sm text-muted-foreground">Total Savings</div>
          <div className="text-2xl font-bold text-green-600">
            ${totalSavings.toFixed(4)}
          </div>
          <div className="text-xs text-muted-foreground">
            Estimated API costs saved
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-sm">Embeddings</span>
          <span className="text-[#2e5797] font-mono">
            {(costTracking.getCacheHitRatio('embeddings') * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">CPL Calculations</span>
          <span className="text-[#2e5797] font-mono">
            {(costTracking.getCacheHitRatio('cpl') * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Voice Analysis</span>
          <span className="text-[#2e5797] font-mono">
            {(costTracking.getCacheHitRatio('voice') * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => clearCache('embeddings')}
          className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm hover:bg-orange-200"
        >
          Clear Embeddings
        </button>
        <button
          onClick={() => clearCache('cpl')}
          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
        >
          Clear CPL Cache
        </button>
        <button
          onClick={() => clearCache()}
          className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
        >
          Clear All Cache
        </button>
        <button
          onClick={refreshStats}
          className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
        >
          Refresh Stats
        </button>
      </div>

      {hitRatio > 0.875 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          🎉 Excellent! You've achieved the target 87.5% cache hit ratio for maximum cost savings.
        </div>
      )}
    </div>
  )
}