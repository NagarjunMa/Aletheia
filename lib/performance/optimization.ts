import { lazy, Suspense } from 'react'
import dynamic from 'next/dynamic'

// Component lazy loading utilities
export const createLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) => {
  const LazyComponent = lazy(importFn)

  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback ? <fallback /> : <div>Loading...</div>}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

// Dynamic imports with loading states
export const createDynamicComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: {
    loading?: React.ComponentType
    ssr?: boolean
  }
) => {
  return dynamic(importFn, {
    loading: options?.loading || (() => <div>Loading...</div>),
    ssr: options?.ssr ?? true
  })
}

// Pre-optimized dynamic imports for common components
export const ChatInterface = createDynamicComponent(
  () => import('@/components/chat/chat-interface'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse">Loading chat...</div>
      </div>
    )
  }
)

export const SettingsPanel = createDynamicComponent(
  () => import('@/components/settings/settings-panel'),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse bg-gray-100 rounded-lg" />
    )
  }
)

export const ConversationHistory = createDynamicComponent(
  () => import('@/components/conversation/conversation-history'),
  {
    ssr: true,
    loading: () => (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse bg-gray-100 rounded-lg" />
        ))}
      </div>
    )
  }
)

// Resource preloading utilities
export class ResourcePreloader {
  private static preloadedResources = new Set<string>()

  // Preload critical resources
  static preloadCriticalResources(): void {
    if (typeof window === 'undefined') return

    const criticalResources = [
      '/api/health',
      // Add other critical API endpoints
    ]

    criticalResources.forEach(resource => {
      this.preloadResource(resource, 'fetch')
    })
  }

  // Preload a specific resource
  static preloadResource(href: string, as: string = 'fetch'): void {
    if (typeof window === 'undefined' || this.preloadedResources.has(href)) return

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = href
    link.as = as

    document.head.appendChild(link)
    this.preloadedResources.add(href)
  }

  // Preload component modules
  static preloadComponent(importFn: () => Promise<any>): void {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        importFn().catch(() => {
          // Silently fail preloading
        })
      })
    }
  }

  // Preload critical fonts
  static preloadFonts(): void {
    if (typeof window === 'undefined') return

    const fonts = [
      // Add your font URLs here
      // '/fonts/inter-var.woff2',
    ]

    fonts.forEach(font => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = font
      link.as = 'font'
      link.type = 'font/woff2'
      link.crossOrigin = 'anonymous'

      document.head.appendChild(link)
    })
  }
}

// Image optimization utilities
export const optimizeImageProps = (
  src: string,
  alt: string,
  options?: {
    priority?: boolean
    quality?: number
    sizes?: string
  }
) => ({
  src,
  alt,
  quality: options?.quality || 85,
  priority: options?.priority || false,
  sizes: options?.sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  placeholder: 'blur' as const,
  blurDataURL: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyejckjjvEDtsd/FPJWJJwUUnSRzjJtJrZNjtNJx5ZHNGVJGk3ixF3LT5dMXoQQcKXgQ+qjDL6R9bZIEhLzQ1o0BPLOUFuOOx3tFu3fBSQtSpKQ7KXU7c6qE15qL5vQZPDGlSYmTgT6K3FBgTtH/9k='
})

// Code splitting utilities
export const createChunkedImport = <T>(
  moduleName: string,
  chunkName?: string
) => {
  return () => import(
    /* webpackChunkName: "[request]" */
    /* webpackMode: "lazy" */
    moduleName
  ) as Promise<T>
}

// Service worker utilities
export class ServiceWorkerManager {
  private static isRegistered = false

  static async register(): Promise<void> {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      this.isRegistered
    ) {
      return
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js')

      registration.addEventListener('updatefound', () => {
        console.log('Service Worker update found')
      })

      this.isRegistered = true
      console.log('Service Worker registered successfully')
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }

  static async unregister(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(reg => reg.unregister()))
      this.isRegistered = false
      console.log('Service Worker unregistered')
    } catch (error) {
      console.error('Service Worker unregistration failed:', error)
    }
  }
}

// Cache management utilities
export class CacheManager {
  private static readonly CACHE_NAMES = {
    STATIC: 'static-v1',
    API: 'api-v1',
    IMAGES: 'images-v1'
  }

  // Clear all caches
  static async clearAll(): Promise<void> {
    if (typeof window === 'undefined' || !('caches' in window)) return

    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    )

    console.log('All caches cleared')
  }

  // Clear specific cache
  static async clearCache(cacheName: string): Promise<void> {
    if (typeof window === 'undefined' || !('caches' in window)) return

    await caches.delete(cacheName)
    console.log(`Cache ${cacheName} cleared`)
  }

  // Get cache size
  static async getCacheSize(): Promise<number> {
    if (typeof window === 'undefined' || !('caches' in window)) return 0

    let totalSize = 0

    const cacheNames = await caches.keys()
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName)
      const requests = await cache.keys()

      for (const request of requests) {
        const response = await cache.match(request)
        if (response) {
          const blob = await response.blob()
          totalSize += blob.size
        }
      }
    }

    return totalSize
  }
}

// Performance optimization hooks
export function useOptimization() {
  React.useEffect(() => {
    // Initialize optimizations on mount
    ResourcePreloader.preloadCriticalResources()
    ResourcePreloader.preloadFonts()

    // Register service worker in production
    if (process.env.NODE_ENV === 'production') {
      ServiceWorkerManager.register()
    }

    // Preload critical components
    ResourcePreloader.preloadComponent(() => import('@/components/chat/chat-interface'))

    return () => {
      // Cleanup if needed
    }
  }, [])

  const preloadComponent = ResourcePreloader.preloadComponent
  const preloadResource = ResourcePreloader.preloadResource

  return {
    preloadComponent,
    preloadResource
  }
}

// Bundle size monitoring
export function analyzeBundleSize() {
  if (typeof window === 'undefined') return

  // Monitor large chunks loading
  if ('performance' in window && 'observer' in window.PerformanceObserver) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()

      entries.forEach((entry) => {
        if (entry.entryType === 'resource' && entry.name.includes('.js')) {
          const size = (entry as PerformanceResourceTiming).transferSize

          if (size > 100000) { // 100KB
            console.warn(`Large JS bundle loaded: ${entry.name} (${Math.round(size / 1024)}KB)`)
          }
        }
      })
    })

    observer.observe({ entryTypes: ['resource'] })
  }
}

// Critical CSS inlining utility
export function inlineCriticalCSS() {
  if (typeof window === 'undefined') return

  // This would typically be handled at build time
  // but can be used for runtime optimization
  const criticalStyles = [
    // Add critical CSS here
  ]

  if (criticalStyles.length > 0) {
    const style = document.createElement('style')
    style.textContent = criticalStyles.join('\n')
    document.head.appendChild(style)
  }
}

// Performance budget monitoring
export class PerformanceBudget {
  private static budgets = {
    totalJSSize: 250000, // 250KB
    totalCSSSize: 50000,  // 50KB
    totalImageSize: 1000000, // 1MB
    firstContentfulPaint: 2000, // 2s
    largestContentfulPaint: 4000, // 4s
    firstInputDelay: 100 // 100ms
  }

  static checkBudgets(): void {
    if (typeof window === 'undefined') return

    // Check resource sizes
    if ('performance' in window) {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

      let totalJSSize = 0
      let totalCSSSize = 0
      let totalImageSize = 0

      entries.forEach(entry => {
        const size = entry.transferSize || 0

        if (entry.name.endsWith('.js')) {
          totalJSSize += size
        } else if (entry.name.endsWith('.css')) {
          totalCSSSize += size
        } else if (/\.(jpg|jpeg|png|gif|webp|avif)$/i.test(entry.name)) {
          totalImageSize += size
        }
      })

      // Check budgets
      if (totalJSSize > this.budgets.totalJSSize) {
        console.warn(`JS budget exceeded: ${Math.round(totalJSSize / 1024)}KB > ${Math.round(this.budgets.totalJSSize / 1024)}KB`)
      }

      if (totalCSSSize > this.budgets.totalCSSSize) {
        console.warn(`CSS budget exceeded: ${Math.round(totalCSSSize / 1024)}KB > ${Math.round(this.budgets.totalCSSSize / 1024)}KB`)
      }

      if (totalImageSize > this.budgets.totalImageSize) {
        console.warn(`Image budget exceeded: ${Math.round(totalImageSize / 1024)}KB > ${Math.round(this.budgets.totalImageSize / 1024)}KB`)
      }
    }
  }

  static setBudget(metric: keyof typeof PerformanceBudget.budgets, value: number): void {
    this.budgets[metric] = value
  }
}