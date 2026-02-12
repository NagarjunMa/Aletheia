// Dual Draft Generation with Streaming
// Purpose: Generate both grammar-only and style-enhanced drafts simultaneously with real-time streaming

import { processWithClaude } from '@/lib/ai/claude'
import { vectorService } from '@/lib/vectors/vector-service'
import { voiceLearningEngine } from '@/lib/voice/voice-learning'
import { createClient } from '@/lib/supabase/server'
import type { EmbeddingVector, StyleVector } from '@/lib/database/types'

export interface DraftGenerationOptions {
  userId: string
  content: string
  targetCPL?: number // Desired Content Polish Level (1-100)
  preserveVoice?: boolean // Whether to maintain user's writing voice
  urgentMode?: boolean // Use immediate processing vs batch for embeddings
  streamingEnabled?: boolean // Enable real-time streaming updates
  customInstructions?: string // Additional user preferences
}

export interface DualDraftResult {
  grammarDraft: {
    content: string
    changes: Array<{
      type: 'grammar' | 'spelling' | 'punctuation'
      original: string
      corrected: string
      explanation: string
    }>
    processingTime: number
    confidence: number
  }
  styleDraft: {
    content: string
    improvements: Array<{
      type: 'vocabulary' | 'clarity' | 'engagement' | 'structure' | 'voice'
      original: string
      improved: string
      explanation: string
      cplImpact: number // Expected CPL improvement
    }>
    voiceAlignment: number // How well it matches user's voice (0-1)
    cplScore: number // Estimated CPL score of result
    processingTime: number
    confidence: number
  }
  metadata: {
    originalCPL: number
    expectedImprovements: {
      grammarOnly: number
      styleEnhanced: number
    }
    costSavings: {
      batchProcessing: boolean
      cacheHits: number
      estimatedSavings: number // in USD
    }
    processingStrategy: 'parallel' | 'sequential'
    totalProcessingTime: number
  }
}

export interface StreamingUpdate {
  type: 'grammar_progress' | 'style_progress' | 'analysis_complete' | 'error' | 'final_result'
  stage: string
  progress: number // 0-100
  content?: Partial<DualDraftResult>
  error?: string
  timestamp: number
}

export class DualDraftGenerator {
  private static instance: DualDraftGenerator | null = null
  private _supabase: ReturnType<typeof createClient> | null = null
  private activeStreams = new Map<string, ReadableStreamDefaultController<StreamingUpdate>>()

  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient()
    }
    return this._supabase
  }

  static getInstance(): DualDraftGenerator {
    if (!DualDraftGenerator.instance) {
      DualDraftGenerator.instance = new DualDraftGenerator()
    }
    return DualDraftGenerator.instance
  }

  /**
   * Generate both grammar and style drafts with optional streaming
   */
  async generateDualDrafts(
    options: DraftGenerationOptions,
    onProgress?: (update: StreamingUpdate) => void
  ): Promise<DualDraftResult> {
    const startTime = Date.now()
    const streamId = crypto.randomUUID()

    try {
      // Initial analysis and setup
      await this.emitProgress(streamId, {
        type: 'analysis_complete',
        stage: 'Analyzing original content and user voice profile',
        progress: 10,
        timestamp: Date.now()
      }, onProgress)

      // Determine processing strategy based on options
      const strategy = await this.determineProcessingStrategy(options)

      // Get user's voice profile for style-aware generation
      const voiceProfile = await this.getUserVoiceContext(options.userId)

      // Generate content embedding for similarity analysis
      const embeddingResult = await vectorService.generateEmbeddingSmart(
        options.content,
        options.userId,
        {
          urgent: options.urgentMode || false,
          priority: 'high',
          metadata: {
            content_type: 'dual_draft_input',
            user_instructions: options.customInstructions
          }
        }
      )

      await this.emitProgress(streamId, {
        type: 'analysis_complete',
        stage: 'Content analysis complete, starting dual generation',
        progress: 25,
        timestamp: Date.now()
      }, onProgress)

      let grammarResult: DualDraftResult['grammarDraft']
      let styleResult: DualDraftResult['styleDraft']

      if (strategy === 'parallel') {
        // Generate both drafts simultaneously
        const [grammar, style] = await Promise.all([
          this.generateGrammarDraft(
            options,
            embeddingResult.embedding || null,
            (progress) => this.emitProgress(streamId, {
              type: 'grammar_progress',
              stage: 'Generating grammar-only fixes',
              progress: 25 + (progress * 0.35), // 25-60%
              timestamp: Date.now()
            }, onProgress)
          ),
          this.generateStyleDraft(
            options,
            voiceProfile,
            embeddingResult.embedding || null,
            (progress) => this.emitProgress(streamId, {
              type: 'style_progress',
              stage: 'Generating style-enhanced version',
              progress: 25 + (progress * 0.35), // 25-60%
              timestamp: Date.now()
            }, onProgress)
          )
        ])

        grammarResult = grammar
        styleResult = style
      } else {
        // Sequential processing for resource-constrained scenarios
        grammarResult = await this.generateGrammarDraft(
          options,
          embeddingResult.embedding || null,
          (progress) => this.emitProgress(streamId, {
            type: 'grammar_progress',
            stage: 'Generating grammar-only fixes',
            progress: 25 + (progress * 0.25), // 25-50%
            timestamp: Date.now()
          }, onProgress)
        )

        await this.emitProgress(streamId, {
          type: 'grammar_progress',
          stage: 'Grammar draft complete, starting style enhancement',
          progress: 50,
          timestamp: Date.now()
        }, onProgress)

        styleResult = await this.generateStyleDraft(
          options,
          voiceProfile,
          embeddingResult.embedding || null,
          (progress) => this.emitProgress(streamId, {
            type: 'style_progress',
            stage: 'Generating style-enhanced version',
            progress: 50 + (progress * 0.25), // 50-75%
            timestamp: Date.now()
          }, onProgress)
        )
      }

      await this.emitProgress(streamId, {
        type: 'analysis_complete',
        stage: 'Finalizing results and calculating metrics',
        progress: 80,
        timestamp: Date.now()
      }, onProgress)

      // Calculate final metadata
      const metadata = await this.calculateResultMetadata(
        options,
        grammarResult,
        styleResult,
        strategy,
        Date.now() - startTime,
        embeddingResult
      )

      const finalResult: DualDraftResult = {
        grammarDraft: grammarResult,
        styleDraft: styleResult,
        metadata
      }

      // Store results for future learning
      await this.storeDualDraftResults(options.userId, options.content, finalResult)

      await this.emitProgress(streamId, {
        type: 'final_result',
        stage: 'Dual draft generation complete',
        progress: 100,
        content: finalResult,
        timestamp: Date.now()
      }, onProgress)

      return finalResult

    } catch (error) {
      console.error('Dual draft generation error:', error)

      await this.emitProgress(streamId, {
        type: 'error',
        stage: 'Generation failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: Date.now()
      }, onProgress)

      throw error
    } finally {
      this.activeStreams.delete(streamId)
    }
  }

  /**
   * Create streaming endpoint for real-time updates
   */
  createDualDraftStream(options: DraftGenerationOptions): ReadableStream<StreamingUpdate> {
    const streamId = crypto.randomUUID()

    return new ReadableStream<StreamingUpdate>({
      start: (controller) => {
        this.activeStreams.set(streamId, controller)

        // Start generation process
        this.generateDualDrafts(options, (update) => {
          try {
            controller.enqueue(update)

            // Close stream on completion or error
            if (update.type === 'final_result' || update.type === 'error') {
              controller.close()
              this.activeStreams.delete(streamId)
            }
          } catch (err) {
            controller.error(err)
            this.activeStreams.delete(streamId)
          }
        }).catch((error) => {
          controller.error(error)
          this.activeStreams.delete(streamId)
        })
      },

      cancel: () => {
        this.activeStreams.delete(streamId)
      }
    })
  }

  // PRIVATE HELPER METHODS

  private async determineProcessingStrategy(options: DraftGenerationOptions): Promise<'parallel' | 'sequential'> {
    // Use parallel processing for better user experience unless resource-constrained
    const contentLength = options.content.length

    if (contentLength > 5000) {
      // Sequential for very long content to manage resources
      return 'sequential'
    }

    if (options.streamingEnabled) {
      // Parallel for streaming for better UX
      return 'parallel'
    }

    return 'parallel'
  }

  private async getUserVoiceContext(userId: string): Promise<{
    hasProfile: boolean
    styleVector: StyleVector | null
    preferences: any
    confidence: number
  }> {
    try {
      const preferences = await vectorService.getUserStylePreferences(userId)
      const styleVector = await vectorService.generateUserStyleVector(userId)

      return {
        hasProfile: preferences.has_profile,
        styleVector,
        preferences: {
          complexity: preferences.complexity_preference,
          formality: preferences.formality_preference,
          vocabulary: preferences.vocabulary_preference
        },
        confidence: preferences.confidence_score
      }
    } catch (error) {
      console.error('Error getting voice context:', error)
      return {
        hasProfile: false,
        styleVector: null,
        preferences: {},
        confidence: 0
      }
    }
  }

  private async generateGrammarDraft(
    options: DraftGenerationOptions,
    embedding: EmbeddingVector | null,
    onProgress?: (progress: number) => void
  ): Promise<DualDraftResult['grammarDraft']> {
    const startTime = Date.now()

    try {
      onProgress?.(10)

      // Use Claude for grammar-only fixes
      const grammarResult = await processWithClaude(
        options.content,
        'grammar_fix',
        {
          preserveStyle: true,
          conservativeApproach: true,
          onlyGrammarAndSpelling: true
        }
      )

      onProgress?.(70)

      if (!grammarResult.success) {
        throw new Error('Grammar processing failed')
      }

      onProgress?.(90)

      // Extract changes made
      const changes = this.extractGrammarChanges(options.content, grammarResult.content || '')

      onProgress?.(100)

      return {
        content: grammarResult.content || options.content,
        changes,
        processingTime: Date.now() - startTime,
        confidence: grammarResult.confidence || 0.8
      }
    } catch (error) {
      console.error('Grammar draft generation error:', error)
      throw error
    }
  }

  private async generateStyleDraft(
    options: DraftGenerationOptions,
    voiceProfile: any,
    embedding: EmbeddingVector | null,
    onProgress?: (progress: number) => void
  ): Promise<DualDraftResult['styleDraft']> {
    const startTime = Date.now()

    try {
      onProgress?.(10)

      // Get contextual suggestions from voice learning
      let voiceSuggestions: any[] = []
      if (voiceProfile.hasProfile && options.preserveVoice) {
        const voiceResult = await voiceLearningEngine.getVoiceAwareSuggestions(
          options.userId,
          options.content,
          0.8
        )
        voiceSuggestions = voiceResult.suggestions || []
      }

      onProgress?.(30)

      // Find similar high-quality content for inspiration
      let similarContent: any[] = []
      if (embedding) {
        const similarResults = await vectorService.findSimilarContent(
          embedding,
          {
            userId: options.userId,
            threshold: 0.7,
            limit: 5
          }
        )

        // Filter for high CPL content
        similarContent = similarResults.filter(
          item => item.metadata?.cpl_score && item.metadata.cpl_score > (options.targetCPL || 75)
        )
      }

      onProgress?.(50)

      // Use Claude for style enhancement
      const styleResult = await processWithClaude(
        options.content,
        'style_enhancement',
        {
          targetCPL: options.targetCPL || 75,
          preserveVoice: options.preserveVoice !== false,
          voiceProfile: voiceProfile.hasProfile ? {
            styleVector: voiceProfile.styleVector,
            preferences: voiceProfile.preferences
          } : null,
          voiceSuggestions: voiceSuggestions.slice(0, 3), // Top 3 suggestions
          inspirationContent: similarContent.slice(0, 2), // Top 2 similar examples
          customInstructions: options.customInstructions
        }
      )

      onProgress?.(80)

      if (!styleResult.success) {
        throw new Error('Style enhancement failed')
      }

      // Calculate voice alignment
      const voiceAlignment = voiceProfile.hasProfile && options.preserveVoice
        ? await this.calculateVoiceAlignment(styleResult.content || '', voiceProfile.styleVector)
        : 0.5

      // Extract improvements made
      const improvements = this.extractStyleImprovements(
        options.content,
        styleResult.content || '',
        voiceSuggestions
      )

      onProgress?.(100)

      return {
        content: styleResult.content || options.content,
        improvements,
        voiceAlignment,
        cplScore: styleResult.cplScore || 0,
        processingTime: Date.now() - startTime,
        confidence: styleResult.confidence || 0.8
      }
    } catch (error) {
      console.error('Style draft generation error:', error)
      throw error
    }
  }

  private extractGrammarChanges(original: string, corrected: string): DualDraftResult['grammarDraft']['changes'] {
    // Simple diff-based change extraction
    // In a production system, this would use a more sophisticated diff algorithm
    const changes: DualDraftResult['grammarDraft']['changes'] = []

    // Basic word-by-word comparison
    const originalWords = original.split(/\s+/)
    const correctedWords = corrected.split(/\s+/)

    for (let i = 0; i < Math.max(originalWords.length, correctedWords.length); i++) {
      const origWord = originalWords[i] || ''
      const corrWord = correctedWords[i] || ''

      if (origWord !== corrWord && origWord && corrWord) {
        changes.push({
          type: this.classifyGrammarChange(origWord, corrWord),
          original: origWord,
          corrected: corrWord,
          explanation: `Corrected "${origWord}" to "${corrWord}"`
        })
      }
    }

    return changes.slice(0, 10) // Limit to most significant changes
  }

  private classifyGrammarChange(original: string, corrected: string): 'grammar' | 'spelling' | 'punctuation' {
    // Simple classification logic
    if (/[^\w\s]/.test(original) || /[^\w\s]/.test(corrected)) {
      return 'punctuation'
    }

    if (original.toLowerCase() !== corrected.toLowerCase()) {
      return 'spelling'
    }

    return 'grammar'
  }

  private extractStyleImprovements(
    original: string,
    improved: string,
    voiceSuggestions: any[]
  ): DualDraftResult['styleDraft']['improvements'] {
    // Extract style improvements based on voice suggestions and content analysis
    const improvements: DualDraftResult['styleDraft']['improvements'] = []

    // Map voice suggestions to improvements
    voiceSuggestions.forEach(suggestion => {
      if (suggestion.originalPhrase && suggestion.suggestedPhrase) {
        improvements.push({
          type: suggestion.type as any,
          original: suggestion.originalPhrase,
          improved: suggestion.suggestedPhrase,
          explanation: suggestion.suggestion,
          cplImpact: suggestion.expectedImprovement || 2
        })
      }
    })

    // Add general improvements (simplified logic)
    if (improved.length > original.length * 1.1) {
      improvements.push({
        type: 'clarity',
        original: 'Overall content',
        improved: 'Expanded and clarified content',
        explanation: 'Added details and examples for better clarity',
        cplImpact: 5
      })
    }

    return improvements.slice(0, 8) // Limit to most impactful improvements
  }

  private async calculateVoiceAlignment(content: string, styleVector: StyleVector | null): Promise<number> {
    if (!styleVector) return 0.5

    try {
      // Generate embedding for the new content
      const contentEmbedding = await vectorService.generateEmbedding(content)

      // Calculate cosine similarity with user's style vector
      const dotProduct = contentEmbedding.reduce((sum, val, i) => sum + val * styleVector[i], 0)
      const magnitude1 = Math.sqrt(contentEmbedding.reduce((sum, val) => sum + val * val, 0))
      const magnitude2 = Math.sqrt(styleVector.reduce((sum, val) => sum + val * val, 0))

      return dotProduct / (magnitude1 * magnitude2)
    } catch (error) {
      console.error('Voice alignment calculation error:', error)
      return 0.5
    }
  }

  private async calculateResultMetadata(
    options: DraftGenerationOptions,
    grammarResult: DualDraftResult['grammarDraft'],
    styleResult: DualDraftResult['styleDraft'],
    strategy: 'parallel' | 'sequential',
    totalTime: number,
    embeddingResult: any
  ): Promise<DualDraftResult['metadata']> {
    // Estimate original CPL (simplified)
    const originalCPL = Math.max(30, Math.min(100, options.content.length / 10 + 40))

    return {
      originalCPL,
      expectedImprovements: {
        grammarOnly: Math.max(2, grammarResult.changes.length * 1.5),
        styleEnhanced: styleResult.cplScore > 0 ? styleResult.cplScore - originalCPL : 10
      },
      costSavings: {
        batchProcessing: embeddingResult.isQueued || false,
        cacheHits: embeddingResult.embedding ? 0 : 1, // Cache hit if no embedding returned
        estimatedSavings: (embeddingResult.isQueued ? 0.01 : 0) + (embeddingResult.embedding ? 0 : 0.02)
      },
      processingStrategy: strategy,
      totalProcessingTime: totalTime
    }
  }

  private async storeDualDraftResults(
    userId: string,
    originalContent: string,
    result: DualDraftResult
  ): Promise<void> {
    try {
      // Store in Supabase for analytics and future learning
      const { error } = await this.supabase
        .from('generated_drafts')
        .insert([
          {
            user_id: userId,
            original_content: originalContent,
            draft_content: result.styleDraft.content,
            draft_type: 'dual_style_enhanced',
            cpl_score: result.styleDraft.cplScore,
            generation_status: 'completed',
            processing_time_ms: result.metadata.totalProcessingTime,
            metadata: {
              grammar_changes: result.grammarDraft.changes.length,
              style_improvements: result.styleDraft.improvements.length,
              voice_alignment: result.styleDraft.voiceAlignment,
              processing_strategy: result.metadata.processingStrategy,
              cost_savings: result.metadata.costSavings
            }
          },
          {
            user_id: userId,
            original_content: originalContent,
            draft_content: result.grammarDraft.content,
            draft_type: 'dual_grammar_only',
            cpl_score: null, // Grammar-only doesn't have CPL scoring
            generation_status: 'completed',
            processing_time_ms: result.grammarDraft.processingTime,
            metadata: {
              grammar_changes: result.grammarDraft.changes.length,
              changes_breakdown: result.grammarDraft.changes.reduce((acc, change) => {
                acc[change.type] = (acc[change.type] || 0) + 1
                return acc
              }, {} as Record<string, number>)
            }
          }
        ])

      if (error) {
        console.error('Error storing dual draft results:', error)
      }
    } catch (error) {
      console.error('Store dual draft results error:', error)
      // Non-critical error - don't throw
    }
  }

  private async emitProgress(
    streamId: string,
    update: StreamingUpdate,
    onProgress?: (update: StreamingUpdate) => void
  ): Promise<void> {
    // Emit to stream controller if available
    const controller = this.activeStreams.get(streamId)
    if (controller) {
      try {
        controller.enqueue(update)
      } catch (error) {
        console.error('Stream emit error:', error)
      }
    }

    // Emit to callback if provided
    if (onProgress) {
      try {
        onProgress(update)
      } catch (error) {
        console.error('Progress callback error:', error)
      }
    }
  }

  /**
   * Cancel all active streams for a user (cleanup utility)
   */
  cancelUserStreams(userId: string): void {
    for (const [streamId, controller] of this.activeStreams) {
      try {
        controller.close()
        this.activeStreams.delete(streamId)
      } catch (error) {
        console.error('Error canceling stream:', error)
      }
    }
  }

  /**
   * Get active stream count for monitoring
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size
  }
}

// Export singleton instance
export const dualDraftGenerator = DualDraftGenerator.getInstance()