// Vector Embedding Plugin - Background Task
// Created: January 2025
// Purpose: Generate embeddings for voice learning

import { Plugin, PluginContext, PluginResult, PluginPhase, PluginPriority } from '../types'

/**
 * Vector Embedding Plugin - Priority 200 (lowest priority background)
 * Generates embeddings for similarity search and voice learning
 */
export const vectorEmbeddingPlugin: Plugin = {
  id: 'vector-embedding',
  name: 'Vector Embedding Generation',
  description: 'Generate embeddings for voice learning and similarity search',
  version: '1.0.0',

  phase: PluginPhase.BACKGROUND,
  priority: PluginPriority.BACKGROUND, // Priority 200 - lowest priority

  enabled: true,

  async execute(context: PluginContext): Promise<PluginResult> {
    const startTime = Date.now()

    try {
      if (!context.content || !context.userId) {
        return {
          success: false,
          error: 'Content or userId missing',
          metrics: {
            duration: Date.now() - startTime
          }
        }
      }

      // Import vector service dynamically to avoid circular dependencies
      const { vectorService } = await import('@/lib/vectors/vector-service')

      // Generate embedding for the content
      const embedding = await vectorService.generateEmbedding(context.content)

      // Store embedding for voice learning
      if (context.metadata?.contentType) {
        await vectorService.storeEmbedding(
          context.userId,
          context.content,
          embedding,
          context.metadata.contentType,
          'voice_learning',
          {
            conversationId: context.conversationId,
            category: context.category,
            timestamp: new Date().toISOString(),
            cplScore: context.metadata?.cplScore || 0
          }
        )
      }

      // Find similar content for pattern analysis
      const similarContent = await vectorService.findSimilarContent(
        embedding,
        {
          contentType: 'user_input',
          userId: context.userId,
          threshold: 0.8,
          limit: 5
        }
      )

      return {
        success: true,
        metrics: {
          duration: Date.now() - startTime,
          cost: 0.00001 // Estimated embedding cost
        },
        data: {
          embeddingGenerated: true,
          embeddingDimensions: embedding.length,
          similarContentFound: similarContent.length,
          patterns: this.extractPatterns(similarContent)
        }
      }
    } catch (error) {
      console.error('Vector embedding error:', error)
      return {
        success: false,
        error: `Vector embedding failed: ${error}`,
        metrics: {
          duration: Date.now() - startTime
        }
      }
    }
  },

  async validate(context: PluginContext): Promise<boolean> {
    return !!(context.content && context.userId)
  },

  // Extract patterns from similar content
  extractPatterns(similarContent: any[]): any {
    if (!similarContent || similarContent.length === 0) {
      return {
        commonPhrases: [],
        averageSentenceLength: 0,
        vocabularyComplexity: 'unknown'
      }
    }

    // Simple pattern extraction
    const phrases: string[] = []
    let totalSentenceLength = 0
    let sentenceCount = 0

    for (const item of similarContent) {
      if (item.content_snippet) {
        const sentences = item.content_snippet.split(/[.!?]+/)
        sentenceCount += sentences.length

        for (const sentence of sentences) {
          totalSentenceLength += sentence.trim().split(/\s+/).length
        }
      }
    }

    return {
      commonPhrases: phrases,
      averageSentenceLength: sentenceCount > 0 ? totalSentenceLength / sentenceCount : 0,
      vocabularyComplexity: 'moderate' // Would need more analysis
    }
  }
}