/**
 * Background Task Orchestrator - Non-blocking database operations
 *
 * Purpose: Move non-critical database operations to background to improve response times
 *
 * Performance Impact:
 * - Main request: 2-3s (only critical operations)
 * - Background tasks: Execute independently without blocking user
 * - Overall UX: Immediate response with background processing
 */

import { createClient } from '@/lib/supabase/client'
import { calculateCPLScore } from '@/lib/cpl/scoring'

export interface BackgroundTask {
  id: string
  type: 'cpl_analysis' | 'vector_embedding' | 'analytics' | 'user_baseline_update'
  priority: number // 0 = highest priority
  data: any
  retryCount: number
  maxRetries: number
  createdAt: number
  executeAt: number // for scheduled tasks
}

export interface TaskResult {
  success: boolean
  result?: any
  error?: string
  executionTime: number
}

class BackgroundTaskOrchestrator {
  private tasks: Map<string, BackgroundTask> = new Map()
  private isProcessing = false
  private processingInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startProcessing()
  }

  /**
   * Schedule a task for background execution
   */
  schedule<T>(
    type: BackgroundTask['type'],
    data: T,
    options: {
      priority?: number
      delay?: number // ms delay before execution
      maxRetries?: number
    } = {}
  ): string {
    const taskId = crypto.randomUUID()
    const now = Date.now()

    const task: BackgroundTask = {
      id: taskId,
      type,
      priority: options.priority ?? 100,
      data,
      retryCount: 0,
      maxRetries: options.maxRetries ?? 3,
      createdAt: now,
      executeAt: now + (options.delay ?? 0)
    }

    this.tasks.set(taskId, task)

    console.log(`📋 Scheduled background task: ${type} (priority: ${task.priority})`)

    return taskId
  }

  /**
   * Schedule CPL analysis in background
   */
  scheduleCPLAnalysis(data: {
    content: string
    userId: string
    draftId?: string
    conversationId: string
  }): string {
    return this.schedule('cpl_analysis', data, { priority: 10 })
  }

  /**
   * Schedule vector embedding generation
   */
  scheduleVectorEmbedding(data: {
    content: string
    userId: string
    type: 'user_input' | 'generated_draft'
    metadata: any
  }): string {
    return this.schedule('vector_embedding', data, { priority: 50 })
  }

  /**
   * Schedule analytics tracking
   */
  scheduleAnalytics(data: {
    userId: string
    conversationId: string
    eventType: string
    eventData: any
  }): string {
    return this.schedule('analytics', data, { priority: 100 })
  }

  /**
   * Schedule user baseline update
   */
  scheduleUserBaselineUpdate(data: {
    userId: string
    newDrafts: Array<{ content: string; isAccepted: boolean; cplScore?: number }>
  }): string {
    return this.schedule('user_baseline_update', data, { priority: 20 })
  }

  /**
   * Start the background processing loop
   */
  private startProcessing() {
    if (this.processingInterval) return

    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) return

      await this.processTasks()
    }, 1000) // Process tasks every second

    console.log('🔄 Background task orchestrator started')
  }

  /**
   * Process queued tasks
   */
  private async processTasks() {
    this.isProcessing = true

    try {
      const now = Date.now()
      const readyTasks = Array.from(this.tasks.values())
        .filter(task => task.executeAt <= now)
        .sort((a, b) => a.priority - b.priority) // Lower number = higher priority

      if (readyTasks.length === 0) {
        this.isProcessing = false
        return
      }

      console.log(`🔄 Processing ${readyTasks.length} background tasks`)

      // Process tasks in parallel (but limited to avoid overwhelming the system)
      const concurrentLimit = 3
      const taskBatches = this.chunkArray(readyTasks, concurrentLimit)

      for (const batch of taskBatches) {
        await Promise.all(batch.map(task => this.executeTask(task)))
      }

    } catch (error) {
      console.error('Background task processing error:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: BackgroundTask): Promise<TaskResult> {
    const startTime = Date.now()

    try {
      console.log(`⚡ Executing ${task.type} (attempt ${task.retryCount + 1})`)

      let result: any

      switch (task.type) {
        case 'cpl_analysis':
          result = await this.executeCPLAnalysis(task.data)
          break
        case 'vector_embedding':
          result = await this.executeVectorEmbedding(task.data)
          break
        case 'analytics':
          result = await this.executeAnalytics(task.data)
          break
        case 'user_baseline_update':
          result = await this.executeUserBaselineUpdate(task.data)
          break
        default:
          throw new Error(`Unknown task type: ${task.type}`)
      }

      // Task completed successfully
      this.tasks.delete(task.id)

      const executionTime = Date.now() - startTime
      console.log(`✅ ${task.type} completed in ${executionTime}ms`)

      return {
        success: true,
        result,
        executionTime
      }

    } catch (error) {
      const executionTime = Date.now() - startTime
      console.error(`❌ ${task.type} failed:`, error)

      // Handle retry logic
      task.retryCount++

      if (task.retryCount >= task.maxRetries) {
        console.error(`💀 ${task.type} exceeded max retries, removing from queue`)
        this.tasks.delete(task.id)
      } else {
        // Schedule retry with exponential backoff
        const backoffDelay = Math.pow(2, task.retryCount) * 1000 // 2s, 4s, 8s...
        task.executeAt = Date.now() + backoffDelay
        console.log(`🔄 ${task.type} will retry in ${backoffDelay}ms`)
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      }
    }
  }

  /**
   * Execute CPL analysis task
   */
  private async executeCPLAnalysis(data: any) {
    const { content, userId, draftId, conversationId } = data

    const cplResult = await calculateCPLScore(content, userId, {
      includeBaseline: true,
      cacheResults: true
    })

    if (!cplResult.success) {
      throw new Error(`CPL analysis failed: ${cplResult.error}`)
    }

    const score = cplResult.score!.overall

    // Update draft with CPL score if draftId provided
    if (draftId) {
      const supabase = createClient()
      await supabase
        .from('generated_drafts')
        .update({ cpl_score: score })
        .eq('id', draftId)
    }

    return { cplScore: score, breakdown: cplResult.score }
  }

  /**
   * Execute vector embedding generation
   */
  private async executeVectorEmbedding(data: any) {
    // This would integrate with your vector service (OpenAI embeddings, etc.)
    // For now, we'll simulate the process

    console.log('🔮 Generating vector embedding for content length:', data.content.length)

    // Simulate embedding generation
    await new Promise(resolve => setTimeout(resolve, 500))

    return {
      embedding: new Array(1536).fill(0).map(() => Math.random()), // Simulated embedding
      dimensions: 1536,
      model: 'text-embedding-ada-002'
    }
  }

  /**
   * Execute analytics tracking
   */
  private async executeAnalytics(data: any) {
    const { userId, conversationId, eventType, eventData } = data

    const supabase = createClient()

    const { error } = await supabase
      .from('usage_analytics')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        event_type: eventType,
        event_data: eventData,
        created_at: new Date().toISOString()
      })

    if (error) {
      throw new Error(`Analytics insertion failed: ${error.message}`)
    }

    return { tracked: true }
  }

  /**
   * Execute user baseline update
   */
  private async executeUserBaselineUpdate(data: any) {
    const { userId, newDrafts } = data

    const supabase = createClient()

    // Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('cpl_score, preferences')
      .eq('id', userId)
      .single()

    if (profileError) {
      throw new Error(`Failed to fetch user profile: ${profileError.message}`)
    }

    // Calculate new baseline from accepted drafts
    const acceptedDrafts = newDrafts.filter((draft: any) => draft.isAccepted)

    if (acceptedDrafts.length === 0) {
      return { updated: false, reason: 'No accepted drafts to update baseline' }
    }

    // Simple average for demonstration (would be more sophisticated in production)
    const averageCPL = acceptedDrafts
      .filter((draft: any) => draft.cplScore > 0)
      .reduce((sum: number, draft: any) => sum + draft.cplScore, 0) / acceptedDrafts.length

    if (averageCPL > 0) {
      // Update user's baseline CPL score
      const newCPLScore = Math.round((profile.cpl_score * 0.7) + (averageCPL * 0.3)) // Weighted average

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          cpl_score: newCPLScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        throw new Error(`Failed to update user baseline: ${updateError.message}`)
      }

      return {
        updated: true,
        oldScore: profile.cpl_score,
        newScore: newCPLScore,
        draftsProcessed: acceptedDrafts.length
      }
    }

    return { updated: false, reason: 'No valid CPL scores to process' }
  }

  /**
   * Utility: Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Get task queue status
   */
  getStatus() {
    const tasks = Array.from(this.tasks.values())
    const byType = tasks.reduce((acc, task) => {
      acc[task.type] = (acc[task.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalTasks: tasks.length,
      isProcessing: this.isProcessing,
      tasksByType: byType,
      oldestTask: tasks.length > 0 ? Math.min(...tasks.map(t => t.createdAt)) : null
    }
  }

  /**
   * Stop the orchestrator (cleanup)
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
    console.log('🛑 Background task orchestrator stopped')
  }
}

// Singleton instance
export const backgroundTasks = new BackgroundTaskOrchestrator()

/**
 * Convenience functions for common background operations
 */

export function schedulePostDraftProcessing(data: {
  userId: string
  conversationId: string
  grammarDraft: { id: string; content: string }
  polishDraft: { id: string; content: string }
}) {
  // Schedule multiple background tasks after draft generation

  // CPL analysis for both drafts
  backgroundTasks.scheduleCPLAnalysis({
    content: data.grammarDraft.content,
    userId: data.userId,
    draftId: data.grammarDraft.id,
    conversationId: data.conversationId
  })

  backgroundTasks.scheduleCPLAnalysis({
    content: data.polishDraft.content,
    userId: data.userId,
    draftId: data.polishDraft.id,
    conversationId: data.conversationId
  })

  // Vector embeddings for voice learning
  backgroundTasks.scheduleVectorEmbedding({
    content: data.grammarDraft.content,
    userId: data.userId,
    type: 'generated_draft',
    metadata: { type: 'grammar_fix', draftId: data.grammarDraft.id }
  })

  backgroundTasks.scheduleVectorEmbedding({
    content: data.polishDraft.content,
    userId: data.userId,
    type: 'generated_draft',
    metadata: { type: 'adaptive_polish', draftId: data.polishDraft.id }
  })

  // Analytics tracking
  backgroundTasks.scheduleAnalytics({
    userId: data.userId,
    conversationId: data.conversationId,
    eventType: 'draft_generation_complete',
    eventData: {
      draftsGenerated: 2,
      processingMode: 'parallel',
      timestamp: Date.now()
    }
  })

  console.log('📋 Scheduled 5 background tasks for post-draft processing')
}

/**
 * Usage Example:
 *
 * // In your API route, after generating drafts:
 * schedulePostDraftProcessing({
 *   userId: user.id,
 *   conversationId,
 *   grammarDraft: { id: 'draft-1', content: grammarContent },
 *   polishDraft: { id: 'draft-2', content: polishContent }
 * })
 *
 * // Individual task scheduling:
 * backgroundTasks.scheduleCPLAnalysis({
 *   content: draftContent,
 *   userId: user.id,
 *   draftId: draft.id,
 *   conversationId
 * })
 */