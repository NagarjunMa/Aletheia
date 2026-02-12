/**
 * Background Task Middleware - Seamless integration with API routes
 *
 * Purpose: Automatically handle background task scheduling in API routes
 * without blocking the main response thread.
 *
 * Features:
 * - Automatic task scheduling after response
 * - Performance monitoring
 * - Error handling and retry logic
 * - Development debugging tools
 */

import { NextRequest, NextResponse } from 'next/server'
import { backgroundTasks } from './task-orchestrator'

export interface BackgroundTaskContext {
  schedule: typeof backgroundTasks.schedule
  scheduleCPLAnalysis: typeof backgroundTasks.scheduleCPLAnalysis
  scheduleVectorEmbedding: typeof backgroundTasks.scheduleVectorEmbedding
  scheduleAnalytics: typeof backgroundTasks.scheduleAnalytics
  scheduleUserBaselineUpdate: typeof backgroundTasks.scheduleUserBaselineUpdate
}

export interface BackgroundMiddlewareOptions {
  enableAnalytics?: boolean
  enablePerformanceMonitoring?: boolean
  debugMode?: boolean
}

/**
 * Background task middleware for API routes
 */
export function withBackgroundTasks<T extends any[]>(
  handler: (
    request: NextRequest,
    context: BackgroundTaskContext,
    ...args: T
  ) => Promise<NextResponse>,
  options: BackgroundMiddlewareOptions = {}
) {
  return async function wrappedHandler(request: NextRequest, ...args: T): Promise<NextResponse> {
    const startTime = Date.now()
    const {
      enableAnalytics = true,
      enablePerformanceMonitoring = true,
      debugMode = process.env.NODE_ENV === 'development'
    } = options

    // Create background task context
    const backgroundContext: BackgroundTaskContext = {
      schedule: backgroundTasks.schedule.bind(backgroundTasks),
      scheduleCPLAnalysis: backgroundTasks.scheduleCPLAnalysis.bind(backgroundTasks),
      scheduleVectorEmbedding: backgroundTasks.scheduleVectorEmbedding.bind(backgroundTasks),
      scheduleAnalytics: backgroundTasks.scheduleAnalytics.bind(backgroundTasks),
      scheduleUserBaselineUpdate: backgroundTasks.scheduleUserBaselineUpdate.bind(backgroundTasks)
    }

    try {
      // Execute the main handler
      const response = await handler(request, backgroundContext, ...args)

      // Schedule analytics tracking if enabled
      if (enableAnalytics) {
        const responseTime = Date.now() - startTime
        const url = new URL(request.url)

        backgroundTasks.scheduleAnalytics({
          userId: 'system', // Will be overridden if user context is available
          conversationId: 'system',
          eventType: 'api_request',
          eventData: {
            method: request.method,
            path: url.pathname,
            responseTime,
            statusCode: response.status,
            timestamp: Date.now(),
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        })
      }

      // Log performance metrics if enabled
      if (enablePerformanceMonitoring && debugMode) {
        const responseTime = Date.now() - startTime
        const queueStatus = backgroundTasks.getStatus()

        console.log('📊 API Performance Metrics:', {
          endpoint: new URL(request.url).pathname,
          responseTime: `${responseTime}ms`,
          backgroundTasks: queueStatus.totalTasks,
          status: response.status
        })
      }

      return response

    } catch (error) {
      // Schedule error tracking
      if (enableAnalytics) {
        backgroundTasks.scheduleAnalytics({
          userId: 'system',
          conversationId: 'system',
          eventType: 'api_error',
          eventData: {
            method: request.method,
            path: new URL(request.url).pathname,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
          }
        })
      }

      // Re-throw the error for normal error handling
      throw error
    }
  }
}

/**
 * Hook for scheduling multiple related background tasks
 */
export function useBackgroundTaskBatch() {
  const scheduledTasks: string[] = []

  const batch = {
    schedule: (type: any, data: any, options?: any) => {
      const taskId = backgroundTasks.schedule(type, data, options)
      scheduledTasks.push(taskId)
      return taskId
    },

    scheduleCPLAnalysis: (data: any) => {
      const taskId = backgroundTasks.scheduleCPLAnalysis(data)
      scheduledTasks.push(taskId)
      return taskId
    },

    scheduleVectorEmbedding: (data: any) => {
      const taskId = backgroundTasks.scheduleVectorEmbedding(data)
      scheduledTasks.push(taskId)
      return taskId
    },

    scheduleAnalytics: (data: any) => {
      const taskId = backgroundTasks.scheduleAnalytics(data)
      scheduledTasks.push(taskId)
      return taskId
    },

    scheduleUserBaselineUpdate: (data: any) => {
      const taskId = backgroundTasks.scheduleUserBaselineUpdate(data)
      scheduledTasks.push(taskId)
      return taskId
    },

    getScheduledTasks: () => [...scheduledTasks],
    getTaskCount: () => scheduledTasks.length
  }

  return batch
}

/**
 * Server action wrapper for background tasks
 */
export function withBackgroundTasksAction<T extends any[], R>(
  action: (context: BackgroundTaskContext, ...args: T) => Promise<R>
) {
  return async function wrappedAction(...args: T): Promise<R> {
    const backgroundContext: BackgroundTaskContext = {
      schedule: backgroundTasks.schedule.bind(backgroundTasks),
      scheduleCPLAnalysis: backgroundTasks.scheduleCPLAnalysis.bind(backgroundTasks),
      scheduleVectorEmbedding: backgroundTasks.scheduleVectorEmbedding.bind(backgroundTasks),
      scheduleAnalytics: backgroundTasks.scheduleAnalytics.bind(backgroundTasks),
      scheduleUserBaselineUpdate: backgroundTasks.scheduleUserBaselineUpdate.bind(backgroundTasks)
    }

    return await action(backgroundContext, ...args)
  }
}

/**
 * Performance monitoring hook
 */
export function useBackgroundTaskMonitoring() {
  if (process.env.NODE_ENV !== 'development') {
    return {
      logStatus: () => {},
      getMetrics: () => ({}),
      startMonitoring: () => {},
      stopMonitoring: () => {}
    }
  }

  let monitoringInterval: NodeJS.Timeout | null = null

  return {
    logStatus: () => {
      const status = backgroundTasks.getStatus()
      console.log('📋 Background Task Queue Status:', {
        totalTasks: status.totalTasks,
        isProcessing: status.isProcessing,
        tasksByType: status.tasksByType,
        queueAge: status.oldestTask ? `${Date.now() - status.oldestTask}ms` : 'empty'
      })
    },

    getMetrics: () => backgroundTasks.getStatus(),

    startMonitoring: (intervalMs: number = 10000) => {
      if (monitoringInterval) return

      monitoringInterval = setInterval(() => {
        const status = backgroundTasks.getStatus()
        if (status.totalTasks > 0) {
          console.log('📊 Background Tasks:', status.tasksByType)
        }
      }, intervalMs)

      console.log('🔍 Background task monitoring started')
    },

    stopMonitoring: () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval)
        monitoringInterval = null
        console.log('🔍 Background task monitoring stopped')
      }
    }
  }
}

/**
 * Edge runtime compatible background task scheduling
 * Uses event.waitUntil() when available, falls back to setImmediate
 */
export function scheduleEdgeTask<T>(
  taskType: string,
  data: T,
  executor: (data: T) => Promise<void>
) {
  const executeTask = async () => {
    try {
      await executor(data)
      console.log(`✅ Edge task completed: ${taskType}`)
    } catch (error) {
      console.error(`❌ Edge task failed: ${taskType}`, error)
    }
  }

  // Use event.waitUntil if available (Vercel Edge Runtime)
  if (typeof (globalThis as any).event?.waitUntil === 'function') {
    (globalThis as any).event.waitUntil(executeTask())
  } else {
    // Fallback to setImmediate for Node.js runtime
    setImmediate(executeTask)
  }
}

/**
 * Usage Examples:
 *
 * // 1. API Route with background tasks
 * export const POST = withBackgroundTasks(async (request, bgTasks) => {
 *   const { content, userId } = await request.json()
 *
 *   // Main processing
 *   const result = await processContent(content)
 *
 *   // Schedule background tasks
 *   bgTasks.scheduleCPLAnalysis({ content, userId })
 *   bgTasks.scheduleVectorEmbedding({ content, userId, type: 'user_input' })
 *
 *   return NextResponse.json({ result })
 * })
 *
 * // 2. Server action with background tasks
 * export const processUserInput = withBackgroundTasksAction(
 *   async (bgTasks, input: string, userId: string) => {
 *     // Main processing
 *     const processed = await processInput(input)
 *
 *     // Schedule background tasks
 *     bgTasks.scheduleCPLAnalysis({ content: processed, userId })
 *
 *     return { success: true, processed }
 *   }
 * )
 *
 * // 3. Batch task scheduling
 * const batch = useBackgroundTaskBatch()
 * batch.scheduleCPLAnalysis({ content: draft1, userId })
 * batch.scheduleCPLAnalysis({ content: draft2, userId })
 * console.log(`Scheduled ${batch.getTaskCount()} tasks`)
 */