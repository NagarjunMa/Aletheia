import { createClient } from '@/lib/supabase/client'
import OpenAI from 'openai'
import { vectorService } from '@/lib/vectors/vector-service'
import type { EmbeddingVector } from '@/lib/database/types'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Batch request types
interface BatchEmbeddingRequest {
  id: string
  userId: string
  content: string
  contentHash: string
  priority: 'low' | 'medium' | 'high'
  metadata?: any
  createdAt: Date
}

interface BatchProcessingResult {
  batchId: string
  requestId: string
  embedding: EmbeddingVector | null
  error?: string
  processingTime: number
  tokenUsage: number
}

interface BatchStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalRequests: number
  completedRequests: number
  estimatedCompletion: Date | null
  costSavings: number
}

export class BatchProcessor {
  private static instance: BatchProcessor | null = null
  private supabase = createClient()
  private batchQueue: Map<string, BatchEmbeddingRequest> = new Map()
  private processingBatches: Map<string, BatchStatus> = new Map()
  private batchSize = 50 // Optimal batch size for OpenAI
  private batchTimeout = 60000 // 1 minute timeout for batching

  static getInstance(): BatchProcessor {
    if (!BatchProcessor.instance) {
      BatchProcessor.instance = new BatchProcessor()
    }
    return BatchProcessor.instance
  }

  /**
   * Add embedding request to batch queue
   */
  async queueEmbeddingRequest(
    userId: string,
    content: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    metadata?: any
  ): Promise<string> {
    const requestId = crypto.randomUUID()
    const contentHash = this.generateContentHash(content)

    // Check if we already have this embedding cached
    const cachedEmbedding = await this.getCachedEmbedding(contentHash)
    if (cachedEmbedding) {
      // Return immediately for cached content
      return Promise.resolve(requestId)
    }

    const request: BatchEmbeddingRequest = {
      id: requestId,
      userId,
      content,
      contentHash,
      priority,
      metadata,
      createdAt: new Date()
    }

    this.batchQueue.set(requestId, request)

    console.log(`Queued embedding request ${requestId} for batch processing`)

    // Trigger batch processing if queue is full or after timeout
    this.scheduleBatchProcessing()

    return requestId
  }

  /**
   * Get status of a batch request
   */
  async getBatchRequestStatus(requestId: string): Promise<{
    status: 'queued' | 'processing' | 'completed' | 'failed'
    result?: EmbeddingVector
    error?: string
    estimatedCompletion?: Date
  }> {
    // Check if still in queue
    const queuedRequest = this.batchQueue.get(requestId)
    if (queuedRequest) {
      return {
        status: 'queued',
        estimatedCompletion: new Date(Date.now() + this.estimatedBatchTime())
      }
    }

    // TODO: Re-enable when batch_processing_results table is recreated
    // Check completed results in database
    // const { data, error } = await this.supabase
    //   .from('batch_processing_results')
    //   .select('*')
    //   .eq('request_id', requestId)
    //   .single()

    // Fallback: Always return null until table is recreated
    const data = null
    const error = 'Table not available'

    if (error || !data) {
      return { status: 'failed', error: 'Request not found' }
    }

    return {
      status: data.status,
      result: data.embedding,
      error: data.error
    }
  }

  /**
   * Process batch of embedding requests
   */
  private async processBatch(requests: BatchEmbeddingRequest[]): Promise<void> {
    const batchId = crypto.randomUUID()
    console.log(`Processing batch ${batchId} with ${requests.length} requests`)

    // Update batch status
    this.processingBatches.set(batchId, {
      id: batchId,
      status: 'processing',
      totalRequests: requests.length,
      completedRequests: 0,
      estimatedCompletion: new Date(Date.now() + 30000), // 30 seconds estimate
      costSavings: requests.length * 0.01 // Estimate $0.01 savings per request
    })

    try {
      // Prepare batch input for OpenAI
      const batchInputs = requests.map((req, index) => ({
        custom_id: req.id,
        method: "POST",
        url: "/v1/embeddings",
        body: {
          model: "text-embedding-3-small",
          input: req.content
        }
      }))

      // Create batch job with OpenAI
      const batchFile = await this.createBatchFile(batchInputs)
      const batch = await openai.batches.create({
        input_file_id: batchFile.id,
        endpoint: "/v1/embeddings",
        completion_window: "24h"
      })

      console.log(`OpenAI batch created: ${batch.id}`)

      // Poll for batch completion
      await this.pollBatchCompletion(batch.id, batchId, requests)

    } catch (error) {
      console.error(`Batch processing failed for batch ${batchId}:`, error)

      // Mark batch as failed
      this.processingBatches.set(batchId, {
        ...this.processingBatches.get(batchId)!,
        status: 'failed'
      })

      // Process requests individually as fallback
      await this.processIndividualFallback(requests)
    }
  }

  /**
   * Create batch file for OpenAI
   */
  private async createBatchFile(batchInputs: any[]): Promise<any> {
    const fileContent = batchInputs
      .map(input => JSON.stringify(input))
      .join('\n')

    const blob = new Blob([fileContent], { type: 'application/jsonl' })
    const file = new File([blob], 'batch_input.jsonl')

    const uploadedFile = await openai.files.create({
      file,
      purpose: 'batch'
    })

    return uploadedFile
  }

  /**
   * Poll OpenAI batch for completion
   */
  private async pollBatchCompletion(
    batchId: string,
    internalBatchId: string,
    requests: BatchEmbeddingRequest[]
  ): Promise<void> {
    const maxPollingTime = 1800000 // 30 minutes
    const pollingInterval = 10000 // 10 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxPollingTime) {
      try {
        const batch = await openai.batches.retrieve(batchId)

        if (batch.status === 'completed') {
          await this.processBatchResults(batch, internalBatchId, requests)
          return
        }

        if (batch.status === 'failed' || batch.status === 'expired') {
          throw new Error(`Batch failed with status: ${batch.status}`)
        }

        // Update progress
        const batchStatus = this.processingBatches.get(internalBatchId)
        if (batchStatus) {
          batchStatus.completedRequests = Math.floor(
            (batch.request_counts?.completed || 0) / batch.request_counts?.total * requests.length
          )
        }

        await new Promise(resolve => setTimeout(resolve, pollingInterval))

      } catch (error) {
        console.error('Error polling batch status:', error)
        throw error
      }
    }

    throw new Error('Batch processing timeout')
  }

  /**
   * Process completed batch results
   */
  private async processBatchResults(
    batch: any,
    internalBatchId: string,
    requests: BatchEmbeddingRequest[]
  ): Promise<void> {
    try {
      // Download results file
      if (!batch.output_file_id) {
        throw new Error('No output file in completed batch')
      }

      const outputFile = await openai.files.content(batch.output_file_id)
      const resultsText = await outputFile.text()
      const results = resultsText
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))

      console.log(`Processing ${results.length} batch results`)

      // Process each result
      for (const result of results) {
        const request = requests.find(r => r.id === result.custom_id)
        if (!request) continue

        if (result.response?.status_code === 200) {
          const embedding = result.response.body.data[0].embedding

          // Store embedding in database
          await vectorService.storeEmbedding(
            request.userId,
            request.content,
            embedding,
            'user_input',
            'batch_processed',
            {
              ...request.metadata,
              batch_id: internalBatchId,
              processing_method: 'batch',
              cost_savings: 0.5 // 50% savings with batch API
            }
          )

          // Store batch result
          await this.storeBatchResult({
            batchId: internalBatchId,
            requestId: request.id,
            embedding,
            error: null,
            processingTime: Date.now() - request.createdAt.getTime(),
            tokenUsage: result.response.body.usage?.total_tokens || 0
          })

        } else {
          console.error(`Batch request ${request.id} failed:`, result.error)
          await this.storeBatchResult({
            batchId: internalBatchId,
            requestId: request.id,
            embedding: null,
            error: result.error?.message || 'Unknown error',
            processingTime: Date.now() - request.createdAt.getTime(),
            tokenUsage: 0
          })
        }
      }

      // Mark batch as completed
      this.processingBatches.set(internalBatchId, {
        ...this.processingBatches.get(internalBatchId)!,
        status: 'completed',
        completedRequests: requests.length
      })

      console.log(`Batch ${internalBatchId} completed successfully`)

    } catch (error) {
      console.error('Error processing batch results:', error)
      throw error
    }
  }

  /**
   * Fallback to individual processing if batch fails
   */
  private async processIndividualFallback(requests: BatchEmbeddingRequest[]): Promise<void> {
    console.log('Falling back to individual processing for failed batch')

    for (const request of requests) {
      try {
        const embedding = await vectorService.generateEmbedding(request.content)

        await vectorService.storeEmbedding(
          request.userId,
          request.content,
          embedding,
          'user_input',
          'individual_fallback',
          {
            ...request.metadata,
            processing_method: 'individual_fallback',
            cost_savings: 0 // No savings in fallback mode
          }
        )

        await this.storeBatchResult({
          batchId: 'fallback',
          requestId: request.id,
          embedding,
          error: null,
          processingTime: Date.now() - request.createdAt.getTime(),
          tokenUsage: Math.ceil(request.content.length / 4) // Estimate token usage
        })

      } catch (error) {
        console.error(`Individual fallback failed for request ${request.id}:`, error)

        await this.storeBatchResult({
          batchId: 'fallback',
          requestId: request.id,
          embedding: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now() - request.createdAt.getTime(),
          tokenUsage: 0
        })
      }
    }
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(): void {
    // Process immediately if queue is full
    if (this.batchQueue.size >= this.batchSize) {
      this.processBatchNow()
      return
    }

    // Schedule timeout-based processing
    setTimeout(() => {
      if (this.batchQueue.size > 0) {
        this.processBatchNow()
      }
    }, this.batchTimeout)
  }

  /**
   * Process current queue immediately
   */
  private async processBatchNow(): Promise<void> {
    if (this.batchQueue.size === 0) return

    // Sort by priority and creation time
    const requests = Array.from(this.batchQueue.values()).sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

    // Take up to batch size
    const batchRequests = requests.slice(0, this.batchSize)

    // Remove from queue
    batchRequests.forEach(req => this.batchQueue.delete(req.id))

    // Process the batch
    await this.processBatch(batchRequests)
  }

  /**
   * Store batch processing result in database
   */
  private async storeBatchResult(result: BatchProcessingResult): Promise<void> {
    // TODO: Re-enable when batch_processing_results table is recreated
    // const { error } = await this.supabase
    //   .from('batch_processing_results')
    //   .insert({
    //     batch_id: result.batchId,
    //     request_id: result.requestId,
    //     embedding: result.embedding,
    //     error: result.error,
    //     processing_time_ms: result.processingTime,
    //     token_usage: result.tokenUsage,
    //     status: result.error ? 'failed' : 'completed'
    //   })

    // Fallback: Log instead of storing until table is recreated
    const error = null
    console.log('Batch result (not stored):', {
      batchId: result.batchId,
      requestId: result.requestId,
      status: result.error ? 'failed' : 'completed'
    })

    if (error) {
      console.error('Failed to store batch result:', error)
    }
  }

  /**
   * Get cached embedding if available
   */
  private async getCachedEmbedding(contentHash: string): Promise<EmbeddingVector | null> {
    const { data, error } = await this.supabase
      .from('user_embeddings')
      .select('embedding')
      .eq('content_hash', contentHash)
      .single()

    if (error || !data?.embedding) {
      return null
    }

    return data.embedding as EmbeddingVector
  }

  /**
   * Generate content hash for caching
   */
  private generateContentHash(content: string): string {
    return require('crypto')
      .createHash('sha256')
      .update(content.trim().toLowerCase())
      .digest('hex')
  }

  /**
   * Estimate batch processing time
   */
  private estimatedBatchTime(): number {
    const queuePosition = this.batchQueue.size
    const batchesInQueue = Math.ceil(queuePosition / this.batchSize)
    return batchesInQueue * 60000 // 1 minute per batch estimate
  }

  /**
   * Get batch processing statistics
   */
  async getBatchStats(): Promise<{
    queueSize: number
    activeBatches: number
    totalProcessed: number
    totalCostSavings: number
    averageProcessingTime: number
  }> {
    // TODO: Re-enable when batch_processing_results table is recreated
    // const { data: results } = await this.supabase
    //   .from('batch_processing_results')

    // Fallback: Return mock stats until table is recreated
    const results = []
    // .select('processing_time_ms, token_usage')
    // .eq('status', 'completed')

    const totalProcessed = results?.length || 0
    const averageProcessingTime = totalProcessed > 0
      ? results!.reduce((sum, r) => sum + r.processing_time_ms, 0) / totalProcessed
      : 0

    const totalTokens = results?.reduce((sum, r) => sum + r.token_usage, 0) || 0
    const totalCostSavings = (totalTokens / 1000) * 0.01 // $0.01 savings per 1k tokens

    return {
      queueSize: this.batchQueue.size,
      activeBatches: this.processingBatches.size,
      totalProcessed,
      totalCostSavings,
      averageProcessingTime
    }
  }
}

// Export singleton instance
export const batchProcessor = BatchProcessor.getInstance()