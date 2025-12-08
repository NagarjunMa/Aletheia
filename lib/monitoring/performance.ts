import * as Sentry from '@sentry/nextjs'

// Performance monitoring utilities
export class PerformanceMonitor {
  private static marks: Map<string, number> = new Map()

  // Mark the start of an operation
  static mark(name: string): void {
    this.marks.set(name, performance.now())

    // Also create a performance mark for browser dev tools
    if (typeof window !== 'undefined' && 'mark' in performance) {
      performance.mark(`${name}-start`)
    }
  }

  // Measure the duration of an operation
  static measure(name: string): number {
    const startTime = this.marks.get(name)
    if (!startTime) {
      console.warn(`No mark found for ${name}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.marks.delete(name)

    // Create browser performance measure
    if (typeof window !== 'undefined' && 'measure' in performance) {
      try {
        performance.measure(name, `${name}-start`)
      } catch (e) {
        // Ignore if mark doesn't exist
      }
    }

    // Send to Sentry as a transaction
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${name} completed`,
      level: 'info',
      data: {
        duration,
        name
      }
    })

    return duration
  }

  // Monitor async operations
  static async measureAsync<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return Sentry.withMonitor(name, async () => {
      this.mark(name)
      try {
        const result = await operation()
        const duration = this.measure(name)

        // Log slow operations
        if (duration > 1000) {
          console.warn(`Slow operation detected: ${name} took ${duration}ms`)
        }

        return result
      } catch (error) {
        this.measure(name) // Still measure even on error
        throw error
      }
    })
  }

  // Track Core Web Vitals
  static trackWebVitals(): void {
    if (typeof window === 'undefined') return

    // Track Largest Contentful Paint
    if ('LargestContentfulPaint' in window) {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]

        Sentry.setMeasurement('lcp', lastEntry.startTime, 'millisecond')

        // Send custom metric
        this.sendMetric('web_vitals_lcp', lastEntry.startTime, {
          element: (lastEntry as any).element?.tagName || 'unknown'
        })
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    }

    // Track First Input Delay
    if ('PerformanceEventTiming' in window) {
      new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEventTiming[]
        entries.forEach((entry) => {
          const delay = entry.processingStart - entry.startTime

          Sentry.setMeasurement('fid', delay, 'millisecond')

          this.sendMetric('web_vitals_fid', delay, {
            event_type: entry.name
          })
        })
      }).observe({ type: 'first-input', buffered: true })
    }

    // Track Cumulative Layout Shift
    if ('LayoutShift' in window) {
      let clsValue = 0

      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        })

        Sentry.setMeasurement('cls', clsValue, '')

        this.sendMetric('web_vitals_cls', clsValue)
      }).observe({ type: 'layout-shift', buffered: true })
    }
  }

  // Send custom metrics
  static sendMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    // Send to Sentry
    Sentry.addBreadcrumb({
      category: 'metric',
      message: name,
      level: 'info',
      data: {
        value,
        tags,
        timestamp: Date.now()
      }
    })

    // Send to PostHog if available
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('custom_metric', {
        metric_name: name,
        metric_value: value,
        ...tags
      })
    }

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Metric: ${name} = ${value}`, tags)
    }
  }

  // Monitor resource loading
  static trackResourceLoading(): void {
    if (typeof window === 'undefined') return

    new PerformanceObserver((list) => {
      const entries = list.getEntries()

      entries.forEach((entry) => {
        const resource = entry as PerformanceResourceTiming

        // Track slow resources
        if (resource.duration > 1000) {
          Sentry.addBreadcrumb({
            category: 'resource',
            message: `Slow resource: ${resource.name}`,
            level: 'warning',
            data: {
              duration: resource.duration,
              size: resource.transferSize,
              type: resource.initiatorType
            }
          })
        }

        // Track failed resources
        if (resource.transferSize === 0 && resource.duration > 0) {
          Sentry.addBreadcrumb({
            category: 'resource',
            message: `Failed resource: ${resource.name}`,
            level: 'error',
            data: {
              duration: resource.duration,
              type: resource.initiatorType
            }
          })
        }
      })
    }).observe({ type: 'resource', buffered: true })
  }

  // Monitor long tasks
  static trackLongTasks(): void {
    if (typeof window === 'undefined') return

    if ('PerformanceLongTaskTiming' in window) {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()

        entries.forEach((entry) => {
          const longTask = entry as any

          Sentry.addBreadcrumb({
            category: 'performance',
            message: `Long task detected: ${longTask.duration}ms`,
            level: 'warning',
            data: {
              duration: longTask.duration,
              startTime: longTask.startTime,
              attribution: longTask.attribution
            }
          })

          this.sendMetric('long_task', longTask.duration, {
            start_time: longTask.startTime.toString()
          })
        })
      }).observe({ type: 'longtask', buffered: true })
    }
  }

  // Memory usage monitoring
  static trackMemoryUsage(): void {
    if (typeof window === 'undefined') return

    // Check if memory API is available
    if ('memory' in performance) {
      const memory = (performance as any).memory

      const memoryInfo = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      }

      this.sendMetric('memory_used', memoryInfo.used)
      this.sendMetric('memory_total', memoryInfo.total)

      // Warn if memory usage is high
      const usagePercentage = (memoryInfo.used / memoryInfo.limit) * 100

      if (usagePercentage > 80) {
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `High memory usage: ${usagePercentage.toFixed(1)}%`,
          level: 'warning',
          data: memoryInfo
        })
      }
    }
  }

  // Initialize all monitoring
  static initialize(): void {
    if (typeof window === 'undefined') return

    this.trackWebVitals()
    this.trackResourceLoading()
    this.trackLongTasks()

    // Track memory usage periodically
    setInterval(() => {
      this.trackMemoryUsage()
    }, 30000) // Every 30 seconds

    console.log('📊 Performance monitoring initialized')
  }
}

// React hooks for performance monitoring
export function usePerformanceMonitor() {
  const measureRender = (componentName: string) => {
    React.useEffect(() => {
      PerformanceMonitor.mark(`${componentName}-render`)

      return () => {
        PerformanceMonitor.measure(`${componentName}-render`)
      }
    }, [componentName])
  }

  const measureAsync = PerformanceMonitor.measureAsync

  return {
    measureRender,
    measureAsync,
    mark: PerformanceMonitor.mark,
    measure: PerformanceMonitor.measure,
    sendMetric: PerformanceMonitor.sendMetric
  }
}

// Server-side performance monitoring
export class ServerPerformanceMonitor {
  static measureServerAction<T extends any[], R>(
    actionName: string,
    action: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const startTime = process.hrtime()

      try {
        const result = await action(...args)
        const [seconds, nanoseconds] = process.hrtime(startTime)
        const duration = seconds * 1000 + nanoseconds / 1000000

        // Log slow server actions
        if (duration > 1000) {
          console.warn(`Slow server action: ${actionName} took ${duration}ms`)
        }

        // Send metric to monitoring service
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Server action: ${actionName}`,
          level: 'info',
          data: {
            duration,
            success: true
          }
        })

        return result
      } catch (error) {
        const [seconds, nanoseconds] = process.hrtime(startTime)
        const duration = seconds * 1000 + nanoseconds / 1000000

        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Server action failed: ${actionName}`,
          level: 'error',
          data: {
            duration,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })

        throw error
      }
    }
  }

  static trackMemoryUsage(): void {
    const memoryUsage = process.memoryUsage()

    console.log('Memory usage:', {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    })
  }
}