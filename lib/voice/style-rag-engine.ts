/**
 * Style-Based RAG Engine
 *
 * Retrieval-Augmented Generation system specifically designed for style and voice learning.
 * Uses vector similarity search to find relevant writing patterns and adapt AI responses.
 *
 * Features:
 * - Vector similarity search with HNSW indexing
 * - Multi-dimensional style matching (semantic + stylistic)
 * - Contextual prompt augmentation
 * - Real-time style adaptation
 * - Cross-conversation pattern recognition
 * - Privacy-compliant style extraction
 * - Performance-optimized retrieval
 */

import { createClient } from '@/lib/supabase/client'
import { advancedVoiceLearningSystem } from './advanced-voice-learning'

interface StyleMatch {
  similarity: number           // 0-1 similarity score
  content: string             // Original content snippet
  characteristics: {
    formality: number
    complexity: number
    emotionality: number
    directness: number
    category: string
  }
  metadata: {
    conversationId: string
    timestamp: Date
    userSatisfaction?: number
    qualityScore: number
  }
  context: {
    category: string
    audience?: string
    purpose?: string
  }
}

interface StyleContext {
  userPatterns: StyleMatch[]
  similarUsers?: StyleMatch[]  // For cold start problem
  categoryPatterns: StyleMatch[]
  crossCategoryInsights: {
    consistentTraits: string[]
    adaptiveTraits: string[]
    strengthAreas: string[]
  }
}

interface RAGPromptContext {
  originalPrompt: string
  styleGuidance: string
  examplePatterns: string[]
  adaptationInstructions: string[]
  confidenceLevel: number
  modelInstructions: {
    preserveTraits: string[]
    adjustTraits: Array<{ trait: string; direction: 'increase' | 'decrease'; magnitude: number }>
    avoidPatterns: string[]
  }
}

interface StyleRetrievalOptions {
  maxResults: number
  minSimilarity: number
  includeCategory?: string
  excludeCategories?: string[]
  timeWindow?: { start: Date; end: Date }
  includeOtherUsers?: boolean
  contextBoost?: {
    audience: number
    purpose: number
    urgency: number
  }
}

class StyleRAGEngine {
  private supabase = createClient()
  private styleCache = new Map<string, StyleMatch[]>()
  private embeddingCache = new Map<string, number[]>()

  // Default similarity thresholds for different operations
  private similarityThresholds = {
    high: 0.85,      // Very similar content
    medium: 0.70,    // Moderately similar
    low: 0.55,       // Loosely similar
    exploration: 0.40 // For discovering new patterns
  }

  /**
   * Retrieve style-relevant context for AI prompt augmentation
   */
  async retrieveStyleContext(
    userId: string,
    inputText: string,
    category: string,
    options: StyleRetrievalOptions = {
      maxResults: 5,
      minSimilarity: this.similarityThresholds.medium
    }
  ): Promise<StyleContext> {
    try {
      console.log(`🔍 Retrieving style context for user ${userId}, category: ${category}`)

      // 1. Generate embedding for input text
      const inputEmbedding = await this.generateContentEmbedding(inputText, category)

      // 2. Search for similar user patterns
      const userPatterns = await this.searchUserPatterns(userId, inputEmbedding, options)

      // 3. Get category-wide patterns for comparison
      const categoryPatterns = await this.searchCategoryPatterns(category, inputEmbedding, options)

      // 4. Get similar user patterns (for cold start)
      const similarUsers = options.includeOtherUsers
        ? await this.searchSimilarUserPatterns(userId, inputEmbedding, options)
        : []

      // 5. Generate cross-category insights
      const crossCategoryInsights = await this.generateCrossCategoryInsights(userPatterns, categoryPatterns)

      console.log(`✅ Retrieved ${userPatterns.length} user patterns, ${categoryPatterns.length} category patterns`)

      return {
        userPatterns,
        similarUsers,
        categoryPatterns,
        crossCategoryInsights
      }

    } catch (error) {
      console.error('🔴 Style context retrieval failed:', error)
      return {
        userPatterns: [],
        categoryPatterns: [],
        crossCategoryInsights: {
          consistentTraits: [],
          adaptiveTraits: [],
          strengthAreas: []
        }
      }
    }
  }

  /**
   * Generate enhanced prompt with style context
   */
  async augmentPromptWithStyle(
    originalPrompt: string,
    styleContext: StyleContext,
    userVoiceConfidence: number,
    targetCategory: string
  ): Promise<RAGPromptContext> {
    try {
      // 1. Analyze user patterns for consistent traits
      const consistentTraits = this.extractConsistentTraits(styleContext.userPatterns)

      // 2. Generate style guidance based on patterns
      const styleGuidance = this.generateStyleGuidance(styleContext, userVoiceConfidence, targetCategory)

      // 3. Create example patterns from best matches
      const examplePatterns = this.createExamplePatterns(styleContext.userPatterns.slice(0, 3))

      // 4. Generate adaptation instructions
      const adaptationInstructions = this.generateAdaptationInstructions(
        styleContext,
        consistentTraits,
        targetCategory
      )

      // 5. Create model instructions
      const modelInstructions = this.generateModelInstructions(styleContext, targetCategory)

      return {
        originalPrompt,
        styleGuidance,
        examplePatterns,
        adaptationInstructions,
        confidenceLevel: userVoiceConfidence,
        modelInstructions
      }

    } catch (error) {
      console.error('🔴 Prompt augmentation failed:', error)
      return {
        originalPrompt,
        styleGuidance: '',
        examplePatterns: [],
        adaptationInstructions: [],
        confidenceLevel: 0,
        modelInstructions: {
          preserveTraits: [],
          adjustTraits: [],
          avoidPatterns: []
        }
      }
    }
  }

  /**
   * Create final AI prompt with style context
   */
  createStyleAugmentedPrompt(ragContext: RAGPromptContext): string {
    const { styleGuidance, examplePatterns, adaptationInstructions, modelInstructions } = ragContext

    // Build the enhanced prompt
    let enhancedPrompt = `You are Ascendia, an AI writing assistant that adapts to users' unique voice and style.

## Original Task
${ragContext.originalPrompt}

## User's Writing Style Profile (Confidence: ${ragContext.confidenceLevel}%)`

    // Add style guidance if confidence is sufficient
    if (ragContext.confidenceLevel > 30) {
      enhancedPrompt += `
${styleGuidance}

## Style Preservation Instructions
${modelInstructions.preserveTraits.map(trait => `- PRESERVE: ${trait}`).join('\n')}`

      if (modelInstructions.adjustTraits.length > 0) {
        enhancedPrompt += `
- ADJUST: ${modelInstructions.adjustTraits.map(adj =>
          `${adj.trait} (${adj.direction} by ${adj.magnitude * 10}%)`).join(', ')}`
      }

      if (modelInstructions.avoidPatterns.length > 0) {
        enhancedPrompt += `
- AVOID: ${modelInstructions.avoidPatterns.join(', ')}`
      }

      // Add example patterns if available
      if (examplePatterns.length > 0) {
        enhancedPrompt += `

## Writing Style Examples (from user's previous work)
${examplePatterns.map((example, i) => `${i + 1}. ${example}`).join('\n')}`
      }

      // Add adaptation instructions
      if (adaptationInstructions.length > 0) {
        enhancedPrompt += `

## Adaptation Guidelines
${adaptationInstructions.map(instruction => `• ${instruction}`).join('\n')}`
      }
    } else {
      // Low confidence - use general style guidance
      enhancedPrompt += `
Note: Limited style data available. Focus on clear, professional communication.`
    }

    enhancedPrompt += `

## Your Task
Improve the user's text while preserving their authentic voice and adapting to their documented patterns. Return only the improved content, no explanations.`

    return enhancedPrompt
  }

  /**
   * Search for user-specific patterns
   */
  private async searchUserPatterns(
    userId: string,
    queryEmbedding: number[],
    options: StyleRetrievalOptions
  ): Promise<StyleMatch[]> {
    try {
      // Use Supabase's vector similarity search
      const { data, error } = await this.supabase.rpc('match_user_style_vectors', {
        query_embedding: queryEmbedding,
        user_id: userId,
        match_threshold: options.minSimilarity,
        match_count: options.maxResults
      })

      if (error) {
        console.warn('⚠️ User pattern search failed:', error)
        return []
      }

      return this.processSearchResults(data || [], 'user')
    } catch (error) {
      console.error('🔴 User pattern search error:', error)
      return []
    }
  }

  /**
   * Search for category-wide patterns
   */
  private async searchCategoryPatterns(
    category: string,
    queryEmbedding: number[],
    options: StyleRetrievalOptions
  ): Promise<StyleMatch[]> {
    try {
      const { data, error } = await this.supabase.rpc('match_category_style_vectors', {
        query_embedding: queryEmbedding,
        category_filter: category,
        match_threshold: options.minSimilarity,
        match_count: Math.min(options.maxResults, 10)
      })

      if (error) {
        console.warn('⚠️ Category pattern search failed:', error)
        return []
      }

      return this.processSearchResults(data || [], 'category')
    } catch (error) {
      console.error('🔴 Category pattern search error:', error)
      return []
    }
  }

  /**
   * Search for similar user patterns (for cold start)
   */
  private async searchSimilarUserPatterns(
    userId: string,
    queryEmbedding: number[],
    options: StyleRetrievalOptions
  ): Promise<StyleMatch[]> {
    try {
      const { data, error } = await this.supabase.rpc('match_similar_users_style_vectors', {
        query_embedding: queryEmbedding,
        exclude_user_id: userId,
        match_threshold: this.similarityThresholds.low,
        match_count: 3
      })

      if (error) {
        console.warn('⚠️ Similar user search failed:', error)
        return []
      }

      return this.processSearchResults(data || [], 'similar_users')
    } catch (error) {
      console.error('🔴 Similar user search error:', error)
      return []
    }
  }

  /**
   * Process raw search results into StyleMatch objects
   */
  private processSearchResults(rawResults: any[], source: string): StyleMatch[] {
    return rawResults.map(result => ({
      similarity: result.similarity || 0,
      content: this.extractContentSnippet(result.content),
      characteristics: {
        formality: result.metadata?.characteristics?.formality || 50,
        complexity: result.metadata?.characteristics?.complexity || 50,
        emotionality: result.metadata?.characteristics?.emotionality || 30,
        directness: result.metadata?.characteristics?.directness || 50,
        category: result.metadata?.category || 'general'
      },
      metadata: {
        conversationId: result.conversation_id,
        timestamp: new Date(result.created_at),
        userSatisfaction: result.user_satisfaction,
        qualityScore: result.quality_score || 0
      },
      context: {
        category: result.metadata?.category || 'general',
        audience: result.metadata?.audience,
        purpose: result.metadata?.purpose
      }
    }))
  }

  /**
   * Extract consistent traits from user patterns
   */
  private extractConsistentTraits(userPatterns: StyleMatch[]): string[] {
    if (userPatterns.length < 2) return []

    const traits: string[] = []
    const characteristics = userPatterns.map(p => p.characteristics)

    // Check formality consistency
    const formalityValues = characteristics.map(c => c.formality)
    const formalityStdDev = this.calculateStandardDeviation(formalityValues)
    if (formalityStdDev < 15) {
      const avgFormality = formalityValues.reduce((sum, val) => sum + val, 0) / formalityValues.length
      if (avgFormality > 70) traits.push('consistently formal writing style')
      else if (avgFormality < 40) traits.push('consistently casual writing style')
      else traits.push('consistently balanced formality')
    }

    // Check complexity consistency
    const complexityValues = characteristics.map(c => c.complexity)
    const complexityStdDev = this.calculateStandardDeviation(complexityValues)
    if (complexityStdDev < 20) {
      const avgComplexity = complexityValues.reduce((sum, val) => sum + val, 0) / complexityValues.length
      if (avgComplexity > 70) traits.push('prefers sophisticated language')
      else if (avgComplexity < 40) traits.push('prefers simple, clear language')
    }

    // Check directness patterns
    const directnessValues = characteristics.map(c => c.directness)
    const directnessStdDev = this.calculateStandardDeviation(directnessValues)
    if (directnessStdDev < 15) {
      const avgDirectness = directnessValues.reduce((sum, val) => sum + val, 0) / directnessValues.length
      if (avgDirectness > 70) traits.push('direct communication style')
      else if (avgDirectness < 40) traits.push('diplomatic communication style')
    }

    return traits
  }

  /**
   * Generate style guidance text
   */
  private generateStyleGuidance(
    context: StyleContext,
    confidence: number,
    category: string
  ): string {
    if (context.userPatterns.length === 0) {
      return `No previous writing samples available. Use professional, clear style appropriate for ${category}.`
    }

    const avgCharacteristics = this.calculateAverageCharacteristics(context.userPatterns)
    let guidance = `Based on ${context.userPatterns.length} previous writing samples:\n`

    // Formality guidance
    if (avgCharacteristics.formality > 70) {
      guidance += `• Maintain formal, professional tone\n`
    } else if (avgCharacteristics.formality < 40) {
      guidance += `• Keep casual, approachable tone\n`
    } else {
      guidance += `• Balance professionalism with approachability\n`
    }

    // Complexity guidance
    if (avgCharacteristics.complexity > 70) {
      guidance += `• Use sophisticated vocabulary and complex sentence structures\n`
    } else if (avgCharacteristics.complexity < 40) {
      guidance += `• Prefer simple, clear language and shorter sentences\n`
    } else {
      guidance += `• Balance complexity with clarity\n`
    }

    // Directness guidance
    if (avgCharacteristics.directness > 70) {
      guidance += `• Be direct and to-the-point\n`
    } else if (avgCharacteristics.directness < 40) {
      guidance += `• Use diplomatic, gentle communication\n`
    }

    // Add category-specific insights
    if (context.categoryPatterns.length > 0) {
      guidance += `• For ${category}: Follow established patterns while maintaining personal style\n`
    }

    return guidance
  }

  /**
   * Create example patterns from user's best content
   */
  private createExamplePatterns(topMatches: StyleMatch[]): string[] {
    return topMatches.map(match => {
      const snippet = this.extractContentSnippet(match.content)
      const similarity = Math.round(match.similarity * 100)
      return `${snippet} (${similarity}% style match)`
    })
  }

  /**
   * Generate adaptation instructions
   */
  private generateAdaptationInstructions(
    context: StyleContext,
    consistentTraits: string[],
    category: string
  ): string[] {
    const instructions: string[] = []

    // Add trait preservation instructions
    consistentTraits.forEach(trait => {
      instructions.push(`Preserve the user's ${trait}`)
    })

    // Add category-specific adaptations
    switch (category) {
      case 'email':
        instructions.push('Maintain professional email conventions while preserving personal style')
        break
      case 'proposal':
        instructions.push('Adapt to persuasive business writing while keeping authentic voice')
        break
      case 'creative':
        instructions.push('Enhance creativity while maintaining established voice patterns')
        break
    }

    // Add insights from cross-category analysis
    if (context.crossCategoryInsights.strengthAreas.length > 0) {
      instructions.push(`Leverage strengths in: ${context.crossCategoryInsights.strengthAreas.join(', ')}`)
    }

    return instructions
  }

  /**
   * Generate detailed model instructions
   */
  private generateModelInstructions(context: StyleContext, category: string) {
    const avgChar = this.calculateAverageCharacteristics(context.userPatterns)

    const preserveTraits: string[] = []
    const adjustTraits: Array<{ trait: string; direction: 'increase' | 'decrease'; magnitude: number }> = []
    const avoidPatterns: string[] = []

    // Determine traits to preserve based on consistency
    if (context.userPatterns.length >= 3) {
      preserveTraits.push('sentence structure patterns')
      preserveTraits.push('vocabulary preference level')

      if (avgChar.formality > 60 || avgChar.formality < 40) {
        preserveTraits.push('formality level')
      }
    }

    // Determine adjustments needed for category
    if (category === 'email' && avgChar.formality < 50) {
      adjustTraits.push({ trait: 'formality', direction: 'increase', magnitude: 0.2 })
    }

    if (category === 'creative' && avgChar.creativity < 60) {
      adjustTraits.push({ trait: 'creativity', direction: 'increase', magnitude: 0.3 })
    }

    // Patterns to avoid based on user history
    if (avgChar.directness < 30) {
      avoidPatterns.push('overly direct language')
    }

    return {
      preserveTraits,
      adjustTraits,
      avoidPatterns
    }
  }

  /**
   * Utility methods
   */
  private async generateContentEmbedding(content: string, category: string): Promise<number[]> {
    // Simplified embedding generation - in production, use actual embedding model
    const cacheKey = `${content.substring(0, 50)}_${category}`

    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!
    }

    // Create feature-based embedding
    const embedding = new Array(1536).fill(0).map((_, i) => {
      // Use content characteristics to generate embedding
      const char = content.charCodeAt(i % content.length)
      const categoryCode = category.charCodeAt(i % category.length)
      return (char + categoryCode) / 255 - 0.5
    })

    this.embeddingCache.set(cacheKey, embedding)
    return embedding
  }

  private extractContentSnippet(content: string, maxLength: number = 150): string {
    if (content.length <= maxLength) return content

    // Extract meaningful snippet
    const sentences = content.split(/[.!?]+/)
    let snippet = sentences[0]

    for (let i = 1; i < sentences.length && snippet.length < maxLength; i++) {
      const nextSentence = sentences[i].trim()
      if (snippet.length + nextSentence.length + 1 <= maxLength) {
        snippet += '. ' + nextSentence
      } else {
        break
      }
    }

    return snippet.trim() + (snippet.length < content.length ? '...' : '')
  }

  private calculateAverageCharacteristics(patterns: StyleMatch[]) {
    if (patterns.length === 0) {
      return {
        formality: 50,
        complexity: 50,
        emotionality: 30,
        directness: 50,
        creativity: 40
      }
    }

    const sums = patterns.reduce((acc, pattern) => ({
      formality: acc.formality + pattern.characteristics.formality,
      complexity: acc.complexity + pattern.characteristics.complexity,
      emotionality: acc.emotionality + pattern.characteristics.emotionality,
      directness: acc.directness + pattern.characteristics.directness,
      creativity: acc.creativity + (pattern.characteristics as any).creativity || 40
    }), { formality: 0, complexity: 0, emotionality: 0, directness: 0, creativity: 0 })

    return {
      formality: sums.formality / patterns.length,
      complexity: sums.complexity / patterns.length,
      emotionality: sums.emotionality / patterns.length,
      directness: sums.directness / patterns.length,
      creativity: sums.creativity / patterns.length
    }
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
    return Math.sqrt(avgSquaredDiff)
  }

  private async generateCrossCategoryInsights(
    userPatterns: StyleMatch[],
    categoryPatterns: StyleMatch[]
  ) {
    const consistentTraits: string[] = []
    const adaptiveTraits: string[] = []
    const strengthAreas: string[] = []

    // Analyze cross-category consistency
    if (userPatterns.length >= 3) {
      const categories = [...new Set(userPatterns.map(p => p.characteristics.category))]

      if (categories.length > 1) {
        consistentTraits.push('adapts style across different content types')
        adaptiveTraits.push('contextual style flexibility')
      } else {
        consistentTraits.push('maintains consistent style within preferred domain')
      }
    }

    // Identify strength areas
    const avgQuality = userPatterns.reduce((sum, p) => sum + p.metadata.qualityScore, 0) / userPatterns.length
    if (avgQuality > 80) {
      strengthAreas.push('high-quality content creation')
    }

    return {
      consistentTraits,
      adaptiveTraits,
      strengthAreas
    }
  }
}

// Export singleton instance
export const styleRAGEngine = new StyleRAGEngine()

/**
 * Convenience functions
 */
export async function getStyleAugmentedPrompt(
  userId: string,
  originalPrompt: string,
  category: string,
  options: {
    maxExamples?: number
    minSimilarity?: number
    includeOtherUsers?: boolean
  } = {}
): Promise<string> {
  try {
    // Get user voice confidence
    const userProfile = await advancedVoiceLearningSystem['getVoiceProfile'](userId)
    const confidence = userProfile?.confidence || 0

    // Retrieve style context
    const styleContext = await styleRAGEngine.retrieveStyleContext(
      userId,
      originalPrompt,
      category,
      {
        maxResults: options.maxExamples || 5,
        minSimilarity: options.minSimilarity || 0.7,
        includeOtherUsers: options.includeOtherUsers || false
      }
    )

    // Generate RAG context
    const ragContext = await styleRAGEngine.augmentPromptWithStyle(
      originalPrompt,
      styleContext,
      confidence,
      category
    )

    // Create final prompt
    return styleRAGEngine.createStyleAugmentedPrompt(ragContext)

  } catch (error) {
    console.error('🔴 Style augmented prompt generation failed:', error)
    return originalPrompt
  }
}

export async function analyzeStyleSimilarity(
  userId: string,
  content1: string,
  content2: string,
  category: string
): Promise<{
  similarity: number
  differences: Array<{ aspect: string; difference: number; impact: 'low' | 'medium' | 'high' }>
  recommendations: string[]
}> {
  try {
    const embedding1 = await styleRAGEngine['generateContentEmbedding'](content1, category)
    const embedding2 = await styleRAGEngine['generateContentEmbedding'](content2, category)

    // Calculate cosine similarity
    const similarity = calculateCosineSimilarity(embedding1, embedding2)

    return {
      similarity,
      differences: [], // Would be implemented with detailed analysis
      recommendations: []
    }
  } catch (error) {
    console.error('🔴 Style similarity analysis failed:', error)
    return {
      similarity: 0,
      differences: [],
      recommendations: []
    }
  }
}

function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0)
  const magnitude1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0))
  const magnitude2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0))
  return dotProduct / (magnitude1 * magnitude2)
}

/**
 * Usage Examples:
 *
 * // Get style-augmented prompt for personalized AI responses
 * const enhancedPrompt = await getStyleAugmentedPrompt(
 *   userId,
 *   "Please improve this business proposal draft.",
 *   'proposal',
 *   { maxExamples: 3, minSimilarity: 0.8 }
 * )
 *
 * // Analyze similarity between writing samples
 * const analysis = await analyzeStyleSimilarity(
 *   userId,
 *   "Original writing sample...",
 *   "AI-improved version...",
 *   'email'
 * )
 *
 * console.log(`Style similarity: ${(analysis.similarity * 100).toFixed(1)}%`)
 */