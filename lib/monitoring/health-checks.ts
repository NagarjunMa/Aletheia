// Health check and system monitoring utilities

export interface HealthCheckResult {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  message?: string
  duration?: number
  metadata?: Record<string, any>
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  checks: HealthCheckResult[]
  timestamp: string
  version: string
  uptime: number
}

export class HealthMonitor {
  private static checks: Map<string, () => Promise<HealthCheckResult>> = new Map()

  // Register a health check
  static registerCheck(
    name: string,
    checkFunction: () => Promise<HealthCheckResult>
  ): void {
    this.checks.set(name, checkFunction)
  }

  // Run all health checks
  static async runChecks(): Promise<SystemHealth> {
    const startTime = Date.now()
    const results: HealthCheckResult[] = []

    // Run all registered checks
    for (const [name, checkFn] of this.checks.entries()) {
      try {
        const checkStart = Date.now()
        const result = await Promise.race([
          checkFn(),
          new Promise<HealthCheckResult>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ])

        results.push({
          ...result,
          duration: Date.now() - checkStart
        })
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        })
      }
    }

    // Determine overall health
    const hasUnhealthy = results.some(r => r.status === 'unhealthy')
    const hasDegraded = results.some(r => r.status === 'degraded')

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (hasUnhealthy) overall = 'unhealthy'
    else if (hasDegraded) overall = 'degraded'

    return {
      overall,
      checks: results,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      uptime: process.uptime?.() || 0
    }
  }

  // Initialize default health checks
  static initializeDefaultChecks(): void {
    // Database connectivity check
    this.registerCheck('database', async (): Promise<HealthCheckResult> => {
      try {
        if (typeof window !== 'undefined') {
          return {
            name: 'database',
            status: 'healthy',
            message: 'Skipped on client side'
          }
        }

        const { createClient } = await import('@/lib/supabase/server')
        const supabase = createClient()

        const { error } = await supabase.from('profiles').select('id').limit(1)

        if (error) {
          return {
            name: 'database',
            status: 'unhealthy',
            message: `Database error: ${error.message}`
          }
        }

        return {
          name: 'database',
          status: 'healthy',
          message: 'Database connection successful'
        }
      } catch (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Database connection failed'
        }
      }
    })

    // AI service check
    this.registerCheck('ai_service', async (): Promise<HealthCheckResult> => {
      try {
        if (!process.env.ANTHROPIC_API_KEY) {
          return {
            name: 'ai_service',
            status: 'degraded',
            message: 'AI service API key not configured'
          }
        }

        // Simple API connectivity test (not a real API call)
        const controller = new AbortController()
        setTimeout(() => controller.abort(), 3000)

        const response = await fetch('https://api.anthropic.com/', {
          method: 'HEAD',
          signal: controller.signal
        })

        if (response.ok || response.status === 405) { // 405 is expected for HEAD request
          return {
            name: 'ai_service',
            status: 'healthy',
            message: 'AI service reachable'
          }
        }

        return {
          name: 'ai_service',
          status: 'degraded',
          message: `AI service returned status: ${response.status}`
        }
      } catch (error) {
        return {
          name: 'ai_service',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'AI service unreachable'
        }
      }
    })

    // Memory usage check
    this.registerCheck('memory', async (): Promise<HealthCheckResult> => {
      try {
        if (typeof window !== 'undefined') {
          // Client-side memory check
          if ('memory' in performance) {
            const memory = (performance as any).memory
            const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100

            if (usagePercent > 90) {
              return {
                name: 'memory',
                status: 'unhealthy',
                message: `High memory usage: ${usagePercent.toFixed(1)}%`,
                metadata: {
                  used: memory.usedJSHeapSize,
                  limit: memory.jsHeapSizeLimit,
                  usage_percent: usagePercent
                }
              }
            } else if (usagePercent > 70) {
              return {
                name: 'memory',
                status: 'degraded',
                message: `Elevated memory usage: ${usagePercent.toFixed(1)}%`,
                metadata: {
                  used: memory.usedJSHeapSize,
                  limit: memory.jsHeapSizeLimit,
                  usage_percent: usagePercent
                }
              }
            }

            return {
              name: 'memory',
              status: 'healthy',
              message: `Memory usage: ${usagePercent.toFixed(1)}%`,
              metadata: {
                used: memory.usedJSHeapSize,
                limit: memory.jsHeapSizeLimit,
                usage_percent: usagePercent
              }
            }
          }
        } else {
          // Server-side memory check
          const memUsage = process.memoryUsage()
          const usedMB = memUsage.heapUsed / 1024 / 1024
          const totalMB = memUsage.heapTotal / 1024 / 1024

          if (usedMB > 500) { // 500MB threshold
            return {
              name: 'memory',
              status: 'degraded',
              message: `High memory usage: ${usedMB.toFixed(1)}MB`,
              metadata: memUsage
            }
          }

          return {
            name: 'memory',
            status: 'healthy',
            message: `Memory usage: ${usedMB.toFixed(1)}MB / ${totalMB.toFixed(1)}MB`,
            metadata: memUsage
          }
        }

        return {
          name: 'memory',
          status: 'healthy',
          message: 'Memory API not available'
        }
      } catch (error) {
        return {
          name: 'memory',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Memory check failed'
        }
      }
    })

    // External dependencies check
    this.registerCheck('external_deps', async (): Promise<HealthCheckResult> => {
      try {
        const checks = []

        // Check Vercel status (if deployed)
        if (process.env.VERCEL) {
          checks.push(
            fetch('https://www.vercel-status.com/api/v2/status.json', {
              signal: AbortSignal.timeout(3000)
            }).then(r => r.ok)
          )
        }

        // Check if any external dependencies are down
        const results = await Promise.allSettled(checks)
        const failures = results.filter(r => r.status === 'rejected' || !r.value)

        if (failures.length > 0) {
          return {
            name: 'external_deps',
            status: 'degraded',
            message: `${failures.length} external dependency(ies) degraded`,
            metadata: {
              total_checks: checks.length,
              failures: failures.length
            }
          }
        }

        return {
          name: 'external_deps',
          status: 'healthy',
          message: 'All external dependencies healthy',
          metadata: {
            total_checks: checks.length,
            failures: 0
          }
        }
      } catch (error) {
        return {
          name: 'external_deps',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'External dependency check failed'
        }
      }
    })

    console.log('🏥 Health checks initialized')
  }
}

// API route handler for health checks
export async function healthCheckHandler(request: Request): Promise<Response> {
  try {
    const health = await HealthMonitor.runChecks()

    const status = health.overall === 'healthy' ? 200 :
                  health.overall === 'degraded' ? 200 : 503

    return new Response(JSON.stringify(health), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        overall: 'unhealthy',
        checks: [],
        timestamp: new Date().toISOString(),
        version: 'unknown',
        uptime: 0,
        error: error instanceof Error ? error.message : 'Health check failed'
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    )
  }
}

// Simple health check for basic endpoints
export async function simpleHealthCheck(): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  )
}

// React hook for client-side health monitoring
export function useHealthMonitor() {
  const [health, setHealth] = React.useState<SystemHealth | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const checkHealth = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await HealthMonitor.runChecks()
      setHealth(result)
    } catch (error) {
      console.error('Health check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    HealthMonitor.initializeDefaultChecks()
    checkHealth()

    // Check health periodically
    const interval = setInterval(checkHealth, 60000) // Every minute

    return () => clearInterval(interval)
  }, [checkHealth])

  return {
    health,
    isLoading,
    checkHealth
  }
}

// Automated health monitoring
export class HealthWatchdog {
  private static interval: NodeJS.Timeout | null = null
  private static alertThreshold = 3 // Number of consecutive failures before alert

  static start(intervalMs: number = 60000): void {
    if (this.interval) {
      clearInterval(this.interval)
    }

    let consecutiveFailures = 0

    this.interval = setInterval(async () => {
      try {
        const health = await HealthMonitor.runChecks()

        if (health.overall === 'unhealthy') {
          consecutiveFailures++

          if (consecutiveFailures >= this.alertThreshold) {
            await this.sendAlert(health)
            consecutiveFailures = 0 // Reset after sending alert
          }
        } else {
          consecutiveFailures = 0 // Reset on healthy check
        }

        // Log health status
        console.log(`Health check: ${health.overall} (${health.checks.length} checks)`)

      } catch (error) {
        console.error('Health watchdog error:', error)
      }
    }, intervalMs)

    console.log('🐕 Health watchdog started')
  }

  static stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private static async sendAlert(health: SystemHealth): Promise<void> {
    try {
      // Send to monitoring service
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureMessage('Health check failure', {
          level: 'error',
          extra: health
        })
      }

      // Send to analytics
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.capture('health_check_failure', {
          overall_status: health.overall,
          failed_checks: health.checks.filter(c => c.status === 'unhealthy').length,
          timestamp: health.timestamp
        })
      }

      // Log to console
      console.error('🚨 Health check alert:', health)

      // Could also send to Slack, PagerDuty, etc.
    } catch (error) {
      console.error('Failed to send health alert:', error)
    }
  }
}