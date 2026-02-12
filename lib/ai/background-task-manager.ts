/**
 * Background Task Manager
 *
 * Handles non-blocking background operations for optimal user experience.
 * Implements fire-and-forget pattern with intelligent scheduling, retry logic,
 * and resource management.
 *
 * Features:
 * - Priority-based task scheduling
 * - Automatic retry with exponential backoff
 * - Resource management and throttling
 * - Task deduplication and batching
 * - Performance monitoring and health checks
 * - Graceful degradation under load
 */

import { createClient } from '@/lib/supabase/client'
import { cplScoringSystem } from '@/lib/cpl/scoring'
import { conversationMemoryEngine } from '@/lib/memory/conversation-memory-engine'

interface BackgroundTask {
  id: string
  type: TaskType
  priority: number // 0-100 (100 = highest priority)
  data: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying'
  retryCount: number
  maxRetries: number
  createdAt: Date
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  error?: string
  result?: any
  estimatedDuration: number
  actualDuration?: number
}

type TaskType =
  | 'cpl_analysis'
  | 'vector_embedding'
  | 'usage_analytics'
  | 'voice_pattern_update'
  | 'memory_optimization'
  | 'cache_warming'
  | 'performance_analysis'
  | 'security_audit'
  | 'data_cleanup'
  | 'notification_dispatch'

interface TaskExecutor {
  type: TaskType
  execute: (data: any) => Promise<any>
  estimatedDuration: number
  maxConcurrency: number
  retryStrategy: 'exponential' | 'linear' | 'none'
  resourceRequirements: {
    cpu: 'low' | 'medium' | 'high'
    memory: 'low' | 'medium' | 'high'
    io: 'low' | 'medium' | 'high'
  }
}

interface TaskBatch {
  id: string
  type: TaskType
  tasks: BackgroundTask[]
  priority: number
  createdAt: Date
  status: 'pending' | 'running' | 'completed' | 'failed'
}

interface PerformanceMetrics {
  tasksCompleted: number
  averageDuration: number
  successRate: number
  currentLoad: number
  queueLength: number
  resourceUtilization: {
    cpu: number
    memory: number
    activeWorkers: number
  }
}

class BackgroundTaskManager {
  private supabase = createClient()
  private taskQueue: BackgroundTask[] = []
  private runningTasks = new Map<string, BackgroundTask>()
  private completedTasks = new Map<string, BackgroundTask>()
  private batches = new Map<string, TaskBatch>()

  private isProcessing = false
  private maxConcurrentTasks = 5
  private processingInterval = 1000 // 1 second
  private batchSize = 10
  private maxQueueSize = 1000

  // Task executors registry
  private executors = new Map<TaskType, TaskExecutor>()

  // Performance tracking
  private metrics: PerformanceMetrics = {
    tasksCompleted: 0,
    averageDuration: 0,
    successRate: 0,
    currentLoad: 0,
    queueLength: 0,
    resourceUtilization: {
      cpu: 0,
      memory: 0,
      activeWorkers: 0
    }
  }

  constructor() {
    this.registerTaskExecutors()
    this.startProcessingLoop()
    this.setupCleanupJobs()
  }

  /**
   * Schedule a background task
   */
  scheduleTask(
    type: TaskType,
    data: Record<string, any>,
    options: {
      priority?: number
      maxRetries?: number
      delay?: number
      deduplicate?: boolean
      batchWith?: TaskType[]
    } = {}
  ): string {
    try {
      const taskId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Check for deduplication
      if (options.deduplicate) {
        const existing = this.findExistingTask(type, data)
        if (existing) {
          console.log(`⚡ Task deduplicated: ${existing.id}`)
          return existing.id
        }
      }

      // Check queue capacity
      if (this.taskQueue.length >= this.maxQueueSize) {
        console.warn(`⚠️ Task queue full, dropping low-priority tasks`)
        this.dropLowPriorityTasks()
      }

      const executor = this.executors.get(type)
      if (!executor) {
        throw new Error(`Unknown task type: ${type}`)
      }

      const task: BackgroundTask = {
        id: taskId,
        type,
        priority: options.priority ?? 50,
        data,
        status: 'pending',
        retryCount: 0,
        maxRetries: options.maxRetries ?? 3,
        createdAt: new Date(),
        estimatedDuration: executor.estimatedDuration,
        scheduledAt: options.delay ? new Date(Date.now() + options.delay) : undefined
      }

      // Add to appropriate queue/batch
      if (options.batchWith && options.batchWith.includes(type)) {
        this.addToBatch(task, options.batchWith)
      } else {
        this.taskQueue.push(task)
        this.sortTaskQueue()
      }

      this.updateMetrics()

      console.log(`📋 Scheduled ${type} task: ${taskId} (priority: ${task.priority})`)
      return taskId

    } catch (error) {
      console.error('🔴 Failed to schedule task:', error)
      throw error
    }
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): BackgroundTask | null {
    // Check running tasks first
    if (this.runningTasks.has(taskId)) {
      return this.runningTasks.get(taskId)!
    }

    // Check completed tasks
    if (this.completedTasks.has(taskId)) {
      return this.completedTasks.get(taskId)!
    }

    // Check queue
    return this.taskQueue.find(task => task.id === taskId) || null
  }

  /**
   * Cancel a pending task
   */
  cancelTask(taskId: string): boolean {
    const queueIndex = this.taskQueue.findIndex(task => task.id === taskId)
    if (queueIndex >= 0) {
      this.taskQueue.splice(queueIndex, 1)
      console.log(`❌ Cancelled task: ${taskId}`)
      return true
    }

    // Can't cancel running tasks, but mark for early termination
    const runningTask = this.runningTasks.get(taskId)
    if (runningTask) {
      runningTask.status = 'failed'
      runningTask.error = 'Cancelled by user'
      return true
    }

    return false
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.updateMetrics()
    return { ...this.metrics }
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      pending: this.taskQueue.length,
      running: this.runningTasks.size,
      completed: this.completedTasks.size,
      batches: this.batches.size,
      averageWaitTime: this.calculateAverageWaitTime(),
      estimatedProcessingTime: this.estimateProcessingTime()
    }
  }

  /**
   * Main processing loop
   */
  private async processTaskQueue() {
    if (this.isProcessing || this.runningTasks.size >= this.maxConcurrentTasks) {
      return
    }

    this.isProcessing = true

    try {
      // Process batches first
      await this.processBatches()

      // Process individual tasks
      while (this.runningTasks.size < this.maxConcurrentTasks && this.taskQueue.length > 0) {
        const task = this.getNextTask()
        if (!task) break

        // Check if task is scheduled for later
        if (task.scheduledAt && task.scheduledAt > new Date()) {
          break
        }

        await this.executeTask(task)
      }
    } catch (error) {
      console.error('🔴 Task processing error:', error)
    } finally {
      this.isProcessing = false
    }
  }

  private async executeTask(task: BackgroundTask) {
    try {
      task.status = 'running'
      task.startedAt = new Date()
      this.runningTasks.set(task.id, task)

      const executor = this.executors.get(task.type)!
      console.log(`🚀 Executing ${task.type}: ${task.id}`)

      const result = await executor.execute(task.data)

      task.status = 'completed'
      task.completedAt = new Date()
      task.result = result
      task.actualDuration = Date.now() - task.startedAt.getTime()

      this.runningTasks.delete(task.id)
      this.completedTasks.set(task.id, task)

      console.log(`✅ Completed ${task.type}: ${task.id} in ${task.actualDuration}ms`)

      // Update metrics
      this.metrics.tasksCompleted++
      this.updateAverageDuration(task.actualDuration)
      this.updateSuccessRate(true)

    } catch (error) {
      console.error(`🔴 Task failed ${task.type}: ${task.id}`, error)

      task.status = 'failed'
      task.error = error.message
      task.completedAt = new Date()

      if (task.retryCount < task.maxRetries) {
        await this.scheduleRetry(task)
      } else {
        this.runningTasks.delete(task.id)
        this.completedTasks.set(task.id, task)
        this.updateSuccessRate(false)
      }
    }
  }

  private async scheduleRetry(task: BackgroundTask) {
    task.retryCount++
    task.status = 'retrying'

    const executor = this.executors.get(task.type)!
    let delay = 1000 // Base delay

    if (executor.retryStrategy === 'exponential') {
      delay = Math.min(30000, 1000 * Math.pow(2, task.retryCount))
    } else if (executor.retryStrategy === 'linear') {
      delay = 1000 * task.retryCount
    }

    task.scheduledAt = new Date(Date.now() + delay)

    this.runningTasks.delete(task.id)
    this.taskQueue.push(task)
    this.sortTaskQueue()

    console.log(`🔄 Retry scheduled for ${task.type}: ${task.id} (attempt ${task.retryCount}/${task.maxRetries}) in ${delay}ms`)
  }

  /**
   * Task executors registration
   */
  private registerTaskExecutors() {
    // CPL Analysis
    this.executors.set('cpl_analysis', {
      type: 'cpl_analysis',
      estimatedDuration: 800,
      maxConcurrency: 3,
      retryStrategy: 'exponential',
      resourceRequirements: { cpu: 'medium', memory: 'low', io: 'low' },
      execute: async (data: { conversationId: string; content: string }) => {
        const cplScore = await cplScoringSystem.analyzeCPL(data.content, data.conversationId)

        await this.supabase
          .from('generated_drafts')
          .update({ cpl_score: cplScore.score })
          .eq('conversation_id', data.conversationId)
          .order('created_at', { ascending: false })
          .limit(1)

        return { cplScore: cplScore.score, analysis: cplScore.breakdown }
      }
    })

    // Vector Embeddings
    this.executors.set('vector_embedding', {
      type: 'vector_embedding',
      estimatedDuration: 300,
      maxConcurrency: 2,
      retryStrategy: 'exponential',
      resourceRequirements: { cpu: 'low', memory: 'medium', io: 'high' },
      execute: async (data: { conversationId: string; userId: string; content: string }) => {
        // Generate embeddings (simplified - in production would use actual embedding model)
        const embeddings = this.generateSimpleEmbedding(data.content)

        await this.supabase
          .from('style_rag_vectors')
          .upsert({
            user_id: data.userId,
            conversation_id: data.conversationId,
            embeddings,
            metadata: {
              content_length: data.content.length,
              timestamp: new Date().toISOString(),
              source: 'background_task'
            },
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'conversation_id'
          })

        return { embeddings, dimension: embeddings.length }
      }
    })

    // Usage Analytics
    this.executors.set('usage_analytics', {
      type: 'usage_analytics',
      estimatedDuration: 150,
      maxConcurrency: 5,
      retryStrategy: 'linear',
      resourceRequirements: { cpu: 'low', memory: 'low', io: 'medium' },
      execute: async (data: { conversationId: string; userId: string; category: string; totalTime: number }) => {
        await this.supabase
          .from('usage_analytics')
          .insert({
            user_id: data.userId,
            conversation_id: data.conversationId,
            event_type: 'parallel_processing',
            event_data: {
              category: data.category,
              processing_time: data.totalTime,
              timestamp: new Date().toISOString(),
              background_task: true
            }
          })

        return { logged: true, category: data.category }
      }
    })

    // Voice Pattern Updates
    this.executors.set('voice_pattern_update', {
      type: 'voice_pattern_update',
      estimatedDuration: 600,
      maxConcurrency: 2,
      retryStrategy: 'exponential',
      resourceRequirements: { cpu: 'medium', memory: 'medium', io: 'medium' },
      execute: async (data: { conversationId: string; userId: string; originalContent: string; polishedContent: string }) => {
        // Update voice learning patterns
        const patterns = await this.extractVoicePatterns(data.originalContent, data.polishedContent)

        await conversationMemoryEngine.updateVoiceLearning(
          data.conversationId,
          data.userId,
          patterns
        )

        return { patterns, updated: true }
      }
    })

    // Memory Optimization
    this.executors.set('memory_optimization', {
      type: 'memory_optimization',
      estimatedDuration: 1200,
      maxConcurrency: 1,
      retryStrategy: 'none',
      resourceRequirements: { cpu: 'high', memory: 'high', io: 'high' },
      execute: async (data: { userId: string }) => {
        // Optimize user memory patterns
        const stats = await conversationMemoryEngine.optimizeUserMemory(data.userId)
        return stats
      }
    })

    // Performance Analysis
    this.executors.set('performance_analysis', {
      type: 'performance_analysis',
      estimatedDuration: 2000,
      maxConcurrency: 1,
      retryStrategy: 'linear',
      resourceRequirements: { cpu: 'high', memory: 'medium', io: 'high' },
      execute: async (data: { timeRange: { start: Date; end: Date } }) => {
        // Analyze system performance
        const { data: metrics } = await this.supabase
          .from('usage_analytics')
          .select('*')
          .gte('created_at', data.timeRange.start.toISOString())
          .lte('created_at', data.timeRange.end.toISOString())

        const analysis = this.analyzePerformanceMetrics(metrics || [])
        return analysis
      }
    })
  }

  /**
   * Utility methods
   */
  private getNextTask(): BackgroundTask | null {
    return this.taskQueue.shift() || null
  }

  private sortTaskQueue() {
    this.taskQueue.sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) return b.priority - a.priority
      // Older tasks first for same priority
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  }

  private findExistingTask(type: TaskType, data: Record<string, any>): BackgroundTask | null {
    return this.taskQueue.find(task =>
      task.type === type &&
      task.status === 'pending' &&
      JSON.stringify(task.data) === JSON.stringify(data)
    ) || null
  }

  private dropLowPriorityTasks() {
    // Remove bottom 20% of tasks by priority
    const sortedQueue = [...this.taskQueue].sort((a, b) => a.priority - b.priority)
    const dropCount = Math.floor(this.taskQueue.length * 0.2)
    const tasksToDrop = sortedQueue.slice(0, dropCount)

    tasksToDrop.forEach(task => {
      const index = this.taskQueue.indexOf(task)
      if (index >= 0) {
        this.taskQueue.splice(index, 1)
        console.log(`🗑️ Dropped low-priority task: ${task.id} (priority: ${task.priority})`)
      }
    })
  }

  private addToBatch(task: BackgroundTask, batchTypes: TaskType[]) {
    const batchId = batchTypes.sort().join('_')

    if (!this.batches.has(batchId)) {
      this.batches.set(batchId, {
        id: batchId,
        type: task.type,
        tasks: [],
        priority: task.priority,
        createdAt: new Date(),
        status: 'pending'
      })
    }

    const batch = this.batches.get(batchId)!
    batch.tasks.push(task)

    // Execute batch if it's full or after timeout
    if (batch.tasks.length >= this.batchSize) {
      this.executeBatch(batch)
    }
  }

  private async processBatches() {
    for (const [batchId, batch] of this.batches) {
      if (batch.status === 'pending' &&
          (batch.tasks.length >= this.batchSize ||
           Date.now() - batch.createdAt.getTime() > 5000)) {
        await this.executeBatch(batch)
      }
    }
  }

  private async executeBatch(batch: TaskBatch) {
    try {
      batch.status = 'running'
      console.log(`🚀 Executing batch ${batch.id} with ${batch.tasks.length} tasks`)

      await Promise.all(batch.tasks.map(task => this.executeTask(task)))

      batch.status = 'completed'
      this.batches.delete(batch.id)

      console.log(`✅ Batch completed: ${batch.id}`)
    } catch (error) {
      console.error(`🔴 Batch failed: ${batch.id}`, error)
      batch.status = 'failed'
    }
  }

  private generateSimpleEmbedding(content: string): number[] {
    // Simple hash-based embedding (in production, use actual embedding model)
    const embedding = new Array(1536).fill(0)
    for (let i = 0; i < content.length; i++) {
      const charCode = content.charCodeAt(i)
      embedding[i % 1536] += charCode
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / magnitude)
  }

  private async extractVoicePatterns(original: string, polished: string) {
    // Simple pattern extraction
    return {
      lengthChange: polished.length - original.length,
      formalityChange: this.calculateFormalityChange(original, polished),
      structuralChanges: this.analyzeStructuralChanges(original, polished),
      timestamp: new Date().toISOString()
    }
  }

  private calculateFormalityChange(original: string, polished: string): number {
    // Simple formality scoring
    const formalWords = ['therefore', 'however', 'furthermore', 'consequently']
    const informalWords = ['basically', 'pretty', 'really', 'kind of']

    const originalFormality = this.countWords(original, formalWords) - this.countWords(original, informalWords)
    const polishedFormality = this.countWords(polished, formalWords) - this.countWords(polished, informalWords)

    return polishedFormality - originalFormality
  }

  private analyzeStructuralChanges(original: string, polished: string) {
    return {
      sentenceCountChange: polished.split(/[.!?]+/).length - original.split(/[.!?]+/).length,
      paragraphCountChange: polished.split(/\n\s*\n/).length - original.split(/\n\s*\n/).length
    }
  }

  private countWords(text: string, words: string[]): number {
    const lowerText = text.toLowerCase()
    return words.reduce((count, word) => count + (lowerText.includes(word) ? 1 : 0), 0)
  }

  private analyzePerformanceMetrics(metrics: any[]) {
    if (metrics.length === 0) return { summary: 'No data available' }

    const processingTimes = metrics
      .filter(m => m.event_data?.processing_time)
      .map(m => m.event_data.processing_time)

    return {
      totalRequests: metrics.length,
      averageProcessingTime: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length,
      medianProcessingTime: this.calculateMedian(processingTimes),
      p95ProcessingTime: this.calculatePercentile(processingTimes, 95),
      categories: this.groupBy(metrics, 'event_data.category')
    }
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = numbers.sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle]
  }

  private calculatePercentile(numbers: number[], percentile: number): number {
    const sorted = numbers.sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[index]
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const value = key.split('.').reduce((obj, k) => obj?.[k], item) || 'unknown'
      groups[value] = (groups[value] || 0) + 1
      return groups
    }, {})
  }

  private updateMetrics() {
    this.metrics.queueLength = this.taskQueue.length
    this.metrics.currentLoad = (this.runningTasks.size / this.maxConcurrentTasks) * 100
    this.metrics.resourceUtilization.activeWorkers = this.runningTasks.size
  }

  private updateAverageDuration(duration: number) {
    const totalTasks = this.metrics.tasksCompleted
    this.metrics.averageDuration = ((this.metrics.averageDuration * (totalTasks - 1)) + duration) / totalTasks
  }

  private updateSuccessRate(success: boolean) {
    const totalTasks = this.metrics.tasksCompleted
    const currentSuccesses = this.metrics.successRate * (totalTasks - 1) / 100
    const newSuccesses = currentSuccesses + (success ? 1 : 0)
    this.metrics.successRate = (newSuccesses / totalTasks) * 100
  }

  private calculateAverageWaitTime(): number {
    const now = Date.now()
    if (this.taskQueue.length === 0) return 0

    const waitTimes = this.taskQueue.map(task => now - task.createdAt.getTime())
    return waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
  }

  private estimateProcessingTime(): number {
    if (this.taskQueue.length === 0) return 0

    const totalEstimated = this.taskQueue.reduce((sum, task) => sum + task.estimatedDuration, 0)
    return totalEstimated / this.maxConcurrentTasks
  }

  private startProcessingLoop() {
    setInterval(() => {
      this.processTaskQueue()
    }, this.processingInterval)
  }

  private setupCleanupJobs() {
    // Clean up completed tasks every 5 minutes
    setInterval(() => {
      this.cleanupCompletedTasks()
    }, 5 * 60 * 1000)

    // Performance metrics update every minute
    setInterval(() => {
      this.updateMetrics()
    }, 60 * 1000)
  }

  private cleanupCompletedTasks() {
    const cutoffTime = Date.now() - (60 * 60 * 1000) // 1 hour ago

    for (const [taskId, task] of this.completedTasks) {
      if (task.completedAt && task.completedAt.getTime() < cutoffTime) {
        this.completedTasks.delete(taskId)
      }
    }

    console.log(`🧹 Cleaned up old completed tasks. Current count: ${this.completedTasks.size}`)
  }
}

// Export singleton instance
export const backgroundTaskManager = new BackgroundTaskManager()

/**
 * Convenience functions
 */
export function scheduleBackgroundTask(
  type: TaskType,
  data: Record<string, any>,
  priority: number = 50
): string {
  return backgroundTaskManager.scheduleTask(type, data, { priority })
}

export function getTaskStatus(taskId: string) {
  return backgroundTaskManager.getTaskStatus(taskId)
}

export function getSystemHealth() {
  return {
    metrics: backgroundTaskManager.getMetrics(),
    queueStatus: backgroundTaskManager.getQueueStatus()
  }
}

/**
 * Usage Examples:
 *
 * // Schedule high-priority CPL analysis
 * const taskId = scheduleBackgroundTask('cpl_analysis', {
 *   conversationId: 'conv_123',
 *   content: 'Text to analyze'
 * }, 90)
 *
 * // Check task status
 * const status = getTaskStatus(taskId)
 * console.log(`Task status: ${status?.status}`)
 *
 * // Get system health
 * const health = getSystemHealth()
 * console.log(`Queue length: ${health.queueStatus.pending}`)
 * console.log(`Success rate: ${health.metrics.successRate}%`)
 */