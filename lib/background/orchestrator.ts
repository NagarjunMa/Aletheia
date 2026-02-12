// Background Task Orchestrator
// Created: January 2025
// Purpose: Manage background tasks with event.waitUntil pattern

import { pluginRegistry } from '@/lib/plugins/registry'
import { PluginPhase, PluginContext } from '@/lib/plugins/types'

export interface BackgroundTask {
  id: string
  name: string
  priority: number
  execute: (data: any) => Promise<any>
  onError?: (error: Error) => void
  retryPolicy?: {
    maxAttempts: number
    backoffMs: number
  }
}

export interface TaskResult {
  taskId: string
  success: boolean
  duration: number
  result?: any
  error?: string
}

/**
 * BackgroundOrchestrator - Fire-and-forget task management
 */
export class BackgroundOrchestrator {
  private tasks = new Map<string, BackgroundTask>()
  private runningTasks = new Set<string>()
  private metrics = new Map<string, {
    executions: number
    failures: number
    totalDuration: number
    lastRun?: Date
  }>()

  /**
   * Register a background task
   */
  registerTask(task: BackgroundTask): void {
    this.tasks.set(task.id, task)
    this.metrics.set(task.id, {
      executions: 0,
      failures: 0,
      totalDuration: 0
    })
    console.log(`Background task registered: ${task.name}`)
  }

  /**
   * Trigger a background task (fire-and-forget)
   */
  trigger(taskId: string, data: any): void {
    const task = this.tasks.get(taskId)

    if (!task) {
      console.error(`Task not found: ${taskId}`)
      return
    }

    // Check if task is already running
    if (this.runningTasks.has(taskId)) {
      console.warn(`Task ${taskId} is already running, skipping...`)
      return
    }

    // Use event.waitUntil if available (Vercel Edge Runtime)
    if (typeof (globalThis as any).event !== 'undefined' &&
        typeof (globalThis as any).event.waitUntil === 'function') {
      (globalThis as any).event.waitUntil(
        this.executeTask(task, data)
      )
    } else {
      // Fallback to setImmediate for Node.js
      setImmediate(() => {
        this.executeTask(task, data).catch(error => {
          console.error(`Background task ${taskId} failed:`, error)
        })
      })
    }
  }

  /**
   * Trigger multiple tasks in parallel
   */
  triggerMany(tasks: Array<{ taskId: string; data: any }>): void {
    for (const { taskId, data } of tasks) {
      this.trigger(taskId, data)
    }
  }

  /**
   * Execute a task with retry logic
   */
  private async executeTask(task: BackgroundTask, data: any): Promise<TaskResult> {
    const startTime = Date.now()
    this.runningTasks.add(task.id)

    const metric = this.metrics.get(task.id)!
    metric.executions++
    metric.lastRun = new Date()

    const retryPolicy = task.retryPolicy || { maxAttempts: 1, backoffMs: 1000 }
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        console.log(`Executing background task: ${task.name} (attempt ${attempt})`)

        const result = await task.execute(data)

        const duration = Date.now() - startTime
        metric.totalDuration += duration

        this.runningTasks.delete(task.id)

        return {
          taskId: task.id,
          success: true,
          duration,
          result
        }
      } catch (error) {
        lastError = error as Error
        console.error(`Task ${task.name} failed (attempt ${attempt}):`, error)

        if (attempt < retryPolicy.maxAttempts) {
          // Exponential backoff
          const delay = retryPolicy.backoffMs * Math.pow(2, attempt - 1)
          await this.wait(delay)
        }
      }
    }

    // All attempts failed
    metric.failures++
    const duration = Date.now() - startTime
    metric.totalDuration += duration

    if (task.onError && lastError) {
      task.onError(lastError)
    }

    this.runningTasks.delete(task.id)

    return {
      taskId: task.id,
      success: false,
      duration,
      error: lastError?.message || 'Unknown error'
    }
  }

  /**
   * Execute plugin-based background tasks
   */
  async executePluginTasks(context: PluginContext): Promise<void> {
    try {
      // Get all background plugins
      const backgroundPlugins = pluginRegistry.getPluginsByPhase(PluginPhase.BACKGROUND)

      if (backgroundPlugins.length === 0) {
        return
      }

      console.log(`Executing ${backgroundPlugins.length} background plugins`)

      // Execute all background plugins (fire-and-forget)
      for (const plugin of backgroundPlugins) {
        this.trigger(`plugin-${plugin.id}`, {
          pluginId: plugin.id,
          context
        })
      }
    } catch (error) {
      console.error('Failed to execute plugin tasks:', error)
    }
  }

  /**
   * Get metrics for a task
   */
  getMetrics(taskId: string) {
    return this.metrics.get(taskId)
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    return Array.from(this.metrics.entries()).map(([taskId, metrics]) => ({
      taskId,
      task: this.tasks.get(taskId)?.name,
      ...metrics,
      averageDuration: metrics.executions > 0
        ? Math.round(metrics.totalDuration / metrics.executions)
        : 0,
      successRate: metrics.executions > 0
        ? ((metrics.executions - metrics.failures) / metrics.executions * 100).toFixed(2) + '%'
        : '0%'
    }))
  }

  /**
   * Check if a task is currently running
   */
  isRunning(taskId: string): boolean {
    return this.runningTasks.has(taskId)
  }

  /**
   * Wait utility
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const backgroundOrchestrator = new BackgroundOrchestrator()

// Register plugin execution as a task
backgroundOrchestrator.registerTask({
  id: 'execute-plugins',
  name: 'Execute Background Plugins',
  priority: 100,
  execute: async (data: { pluginId: string; context: PluginContext }) => {
    const result = await pluginRegistry.executePlugin(data.pluginId, data.context)
    return result
  },
  retryPolicy: {
    maxAttempts: 2,
    backoffMs: 1000
  }
})