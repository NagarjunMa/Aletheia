import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface EmbeddingResult {
  embedding: number[]
  tokenUsage: number
  processingTime: number
  model: string
  dimensions: number
}

/**
 * Direct embedding generation service for server-side use
 * Bypasses the API route to avoid URL issues in server-side fetch calls
 */
export class EmbeddingService {
  private static instance: EmbeddingService | null = null

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService()
    }
    return EmbeddingService.instance
  }

  /**
   * Generate embedding directly using OpenAI API
   */
  async generateEmbedding(
    text: string,
    model: string = 'text-embedding-3-small'
  ): Promise<EmbeddingResult> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text content is required for embedding generation')
      }

      if (text.length > 8000) {
        throw new Error('Text content exceeds maximum length of 8000 characters')
      }

      const startTime = Date.now()

      const response = await openai.embeddings.create({
        model,
        input: text.trim(),
        encoding_format: 'float'
      })

      const processingTime = Date.now() - startTime

      if (!response.data?.[0]?.embedding) {
        throw new Error('No embedding data received from OpenAI')
      }

      const embedding = response.data[0].embedding
      const tokenUsage = response.usage?.total_tokens || 0

      // Log for monitoring
      console.log(`Direct embedding generated: ${tokenUsage} tokens, ${processingTime}ms`)

      return {
        embedding,
        tokenUsage,
        processingTime,
        model,
        dimensions: embedding.length
      }

    } catch (error) {
      console.error('Direct embedding generation error:', error)

      // Handle specific OpenAI errors
      if (error instanceof OpenAI.APIError) {
        if (error.status === 401) {
          throw new Error('OpenAI API key invalid')
        }
        if (error.status === 429) {
          throw new Error('OpenAI API rate limit exceeded')
        }
        if (error.status === 400) {
          throw new Error('Invalid text content for embedding')
        }
      }

      throw new Error('Failed to generate embedding')
    }
  }

  /**
   * Generate embedding with caching support
   */
  async generateEmbeddingWithCache(
    text: string,
    contentHash?: string
  ): Promise<EmbeddingResult> {
    try {
      // Generate content hash if not provided
      const crypto = require('crypto')
      const hash = contentHash || crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex')

      // Check cache in user_embeddings table
      const supabase = createClient()
      const { data: cachedData, error: cacheError } = await supabase
        .from('user_embeddings')
        .select('embedding, metadata')
        .eq('content_hash', hash)
        .single()

      if (!cacheError && cachedData?.embedding) {
        console.log('Using cached embedding for content hash:', hash.substring(0, 8))

        const metadata = cachedData.metadata as any || {}
        return {
          embedding: cachedData.embedding as number[],
          tokenUsage: 0, // No tokens used for cached result
          processingTime: 0,
          model: metadata.model_version || 'text-embedding-3-small',
          dimensions: (cachedData.embedding as number[]).length
        }
      }

      // Generate new embedding
      const result = await this.generateEmbedding(text)

      // Cache the result (fire and forget, don't block on caching errors)
      this.cacheEmbedding(text, result, hash).catch(err => {
        console.warn('Non-critical: Failed to cache embedding:', err.message)
      })

      return result

    } catch (error) {
      console.error('Error in generateEmbeddingWithCache:', error)
      throw error
    }
  }

  /**
   * Cache embedding result (non-blocking)
   */
  private async cacheEmbedding(
    text: string,
    result: EmbeddingResult,
    contentHash: string
  ): Promise<void> {
    try {
      const supabase = createClient()

      // Get current user if available
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Skip caching for anonymous users
        return
      }

      const embeddingData = {
        user_id: user.id,
        content_hash: contentHash,
        content_snippet: text.substring(0, 100),
        content: text, // Store full content for similarity searches
        embedding: result.embedding,
        content_type: 'cached_embedding',
        category: 'system_generated',
        metadata: {
          text_length: text.length,
          language: 'en',
          generated_at: new Date().toISOString(),
          model_version: result.model,
          token_usage: result.tokenUsage,
          processing_time_ms: result.processingTime,
          cached: true
        }
      }

      const { error } = await supabase
        .from('user_embeddings')
        .insert(embeddingData)

      if (error) {
        console.warn('Failed to cache embedding (non-critical):', error.message)
      } else {
        console.log('Embedding cached successfully for hash:', contentHash.substring(0, 8))
      }

    } catch (error) {
      console.warn('Error caching embedding (non-critical):', error)
    }
  }

  /**
   * Batch generate embeddings for multiple texts
   */
  async generateEmbeddingsBatch(
    texts: string[],
    model: string = 'text-embedding-3-small'
  ): Promise<EmbeddingResult[]> {
    try {
      if (!texts || texts.length === 0) {
        return []
      }

      // OpenAI supports batch processing up to 2048 inputs
      const batchSize = Math.min(texts.length, 2048)
      const validTexts = texts
        .filter(text => text && text.trim().length > 0)
        .slice(0, batchSize)
        .map(text => text.trim())

      if (validTexts.length === 0) {
        return []
      }

      const startTime = Date.now()

      const response = await openai.embeddings.create({
        model,
        input: validTexts,
        encoding_format: 'float'
      })

      const processingTime = Date.now() - startTime
      const totalTokenUsage = response.usage?.total_tokens || 0

      console.log(`Batch embeddings generated: ${validTexts.length} texts, ${totalTokenUsage} tokens, ${processingTime}ms`)

      return response.data.map((item, index) => ({
        embedding: item.embedding,
        tokenUsage: Math.round(totalTokenUsage / validTexts.length), // Distribute tokens evenly
        processingTime: Math.round(processingTime / validTexts.length),
        model,
        dimensions: item.embedding.length
      }))

    } catch (error) {
      console.error('Batch embedding generation error:', error)
      throw new Error('Failed to generate batch embeddings')
    }
  }
}

// Export singleton instance
export const embeddingService = EmbeddingService.getInstance()