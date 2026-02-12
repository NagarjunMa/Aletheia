/**
 * Style-based RAG Integration for Voice Learning
 *
 * Purpose: Advanced retrieval-augmented generation system that learns and adapts to user writing styles
 * Features:
 * - Vector embeddings of user writing patterns
 * - Style-aware content retrieval
 * - Dynamic prompt enhancement based on writing history
 * - Continuous learning from user feedback
 * - Personalization at scale
 *
 * Implementation: Uses embeddings to create a personalized knowledge base of user writing style
 */

import { createClient } from '@/lib/supabase/client'

export interface WritingStyleProfile {
  userId: string
  baselineMetrics: {
    averageSentenceLength: number
    vocabularyComplexity: number
    formalityLevel: number
    toneProfile: {
      friendly: number
      professional: number
      authoritative: number
      casual: number
    }
    structuralPatterns: {
      paragraphLength: number
      transitionUsage: number
      punctuationStyle: string[]
    }
  }
  vectorEmbeddings: {
    styleVector: number[]        // 1536-dim embedding representing overall style
    contentVectors: {           // Content-specific embeddings
      id: string
      embedding: number[]
      content: string
      context: string
      cplScore: number
      isAccepted: boolean
    }[]
  }
  adaptivePatterns: {
    preferredPhrases: string[]
    avoidedPatterns: string[]
    contextualPreferences: Record<string, any>
  }
  lastUpdated: Date
}

export interface StyleRetrievalResult {
  relevantExamples: {
    content: string
    similarity: number
    context: string
    cplScore: number
  }[]
  styleGuidance: {
    tone: string
    formality: number
    structure: string
    vocabulary: string
  }
  enhancedPrompt: string
  confidence: number
}

/**
 * Style-based RAG system for personalized voice learning
 */
export class StyleRAGSystem {
  private supabase = createClient()
  private modelDimensions = 1536 // OpenAI text-embedding-ada-002 dimensions

  /**
   * Initialize or update user style profile from writing history
   */
  async initializeStyleProfile(userId: string): Promise<WritingStyleProfile> {
    try {
      // Get user's accepted drafts for analysis
      const { data: acceptedDrafts, error } = await this.supabase
        .from('generated_drafts')
        .select(`
          id, content, cpl_score, created_at, type,
          user_inputs!inner(content, category)
        `)
        .eq('user_id', userId)
        .eq('is_accepted', true)
        .order('created_at', { ascending: false })
        .limit(50) // Last 50 accepted drafts for analysis

      if (error) throw error

      const drafts = acceptedDrafts || []

      // Analyze baseline metrics
      const baselineMetrics = await this.analyzeBaselineMetrics(drafts)

      // Generate style embeddings
      const vectorEmbeddings = await this.generateStyleEmbeddings(drafts, userId)

      // Extract adaptive patterns
      const adaptivePatterns = await this.extractAdaptivePatterns(drafts)

      const styleProfile: WritingStyleProfile = {
        userId,
        baselineMetrics,
        vectorEmbeddings,
        adaptivePatterns,
        lastUpdated: new Date()
      }

      // Store profile in database
      await this.storeStyleProfile(styleProfile)

      console.log(`✅ Style profile initialized for user ${userId}`)
      return styleProfile

    } catch (error) {
      console.error('Failed to initialize style profile:', error)
      throw error
    }
  }

  /**
   * Retrieve style-relevant examples for a given input
   */
  async retrieveStyleGuidance(
    userId: string,
    userInput: string,
    category: string
  ): Promise<StyleRetrievalResult> {
    try {
      // Get or create style profile
      let styleProfile = await this.getStyleProfile(userId)
      if (!styleProfile) {
        styleProfile = await this.initializeStyleProfile(userId)
      }

      // Generate embedding for user input
      const inputEmbedding = await this.generateEmbedding(userInput)

      // Find most relevant style examples
      const relevantExamples = await this.findRelevantExamples(
        inputEmbedding,
        styleProfile,
        category
      )

      // Generate style guidance
      const styleGuidance = this.generateStyleGuidance(styleProfile, category)

      // Create enhanced prompt
      const enhancedPrompt = this.createEnhancedPrompt({
        originalInput: userInput,
        category,
        relevantExamples,
        styleGuidance,
        styleProfile
      })

      // Calculate confidence score
      const confidence = this.calculateConfidence(relevantExamples, styleProfile)

      return {
        relevantExamples,
        styleGuidance,
        enhancedPrompt,
        confidence
      }

    } catch (error) {
      console.error('Failed to retrieve style guidance:', error)
      // Return fallback guidance
      return {
        relevantExamples: [],
        styleGuidance: {
          tone: 'professional',
          formality: 70,
          structure: 'clear and concise',
          vocabulary: 'accessible'
        },
        enhancedPrompt: userInput,
        confidence: 0
      }
    }
  }

  /**
   * Update style profile based on user feedback
   */
  async updateStyleProfile(
    userId: string,
    draftContent: string,
    userInput: string,
    category: string,
    isAccepted: boolean,
    cplScore: number
  ): Promise<void> {
    try {
      // Generate embedding for the new content
      const contentEmbedding = await this.generateEmbedding(draftContent)

      // Store the new content vector
      await this.supabase
        .from('user_style_vectors')
        .insert({
          user_id: userId,
          content: draftContent,
          user_input: userInput,
          category,
          embedding: contentEmbedding,
          cpl_score: cplScore,
          is_accepted: isAccepted,
          created_at: new Date().toISOString()
        })

      // Update style profile if content was accepted
      if (isAccepted) {
        const styleProfile = await this.getStyleProfile(userId)
        if (styleProfile) {
          await this.incrementalStyleUpdate(styleProfile, {
            content: draftContent,
            embedding: contentEmbedding,
            cplScore,
            category,
            userInput
          })
        }
      }

      console.log(`✅ Style profile updated for user ${userId} (accepted: ${isAccepted})`)

    } catch (error) {
      console.error('Failed to update style profile:', error)
    }
  }

  /**
   * Analyze baseline writing metrics from user's accepted drafts
   */
  private async analyzeBaselineMetrics(drafts: any[]): Promise<WritingStyleProfile['baselineMetrics']> {
    if (drafts.length === 0) {
      return this.getDefaultMetrics()
    }

    let totalSentenceLength = 0
    let totalVocabComplexity = 0
    let totalFormality = 0
    let toneScores = { friendly: 0, professional: 0, authoritative: 0, casual: 0 }
    let totalParagraphLength = 0
    let transitionCount = 0
    let punctuationPatterns: string[] = []

    for (const draft of drafts) {
      const content = draft.content

      // Sentence length analysis
      const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0)
      const avgSentenceLength = sentences.length > 0
        ? content.length / sentences.length
        : 20

      totalSentenceLength += avgSentenceLength

      // Vocabulary complexity (unique words ratio)
      const words = content.toLowerCase().split(/\s+/)
      const uniqueWords = new Set(words)
      const vocabComplexity = words.length > 0 ? (uniqueWords.size / words.length) * 100 : 50

      totalVocabComplexity += vocabComplexity

      // Formality analysis (simple heuristic)
      const formalityScore = this.calculateFormality(content)
      totalFormality += formalityScore

      // Tone analysis
      const toneAnalysis = this.analyzeTone(content)
      toneScores.friendly += toneAnalysis.friendly
      toneScores.professional += toneAnalysis.professional
      toneScores.authoritative += toneAnalysis.authoritative
      toneScores.casual += toneAnalysis.casual

      // Structural analysis
      const paragraphs = content.split('\n\n').filter((p: string) => p.trim().length > 0)
      totalParagraphLength += paragraphs.length > 0 ? content.length / paragraphs.length : 100

      // Transition words
      const transitions = this.countTransitions(content)
      transitionCount += transitions

      // Punctuation style
      const punctuation = this.analyzePunctuation(content)
      punctuationPatterns.push(punctuation)
    }

    const draftCount = drafts.length

    return {
      averageSentenceLength: totalSentenceLength / draftCount,
      vocabularyComplexity: totalVocabComplexity / draftCount,
      formalityLevel: totalFormality / draftCount,
      toneProfile: {
        friendly: toneScores.friendly / draftCount,
        professional: toneScores.professional / draftCount,
        authoritative: toneScores.authoritative / draftCount,
        casual: toneScores.casual / draftCount
      },
      structuralPatterns: {
        paragraphLength: totalParagraphLength / draftCount,
        transitionUsage: transitionCount / draftCount,
        punctuationStyle: this.getMostCommonPunctuation(punctuationPatterns)
      }
    }
  }

  /**
   * Generate style embeddings for user's content
   */
  private async generateStyleEmbeddings(drafts: any[], userId: string): Promise<WritingStyleProfile['vectorEmbeddings']> {
    // Create a consolidated style document
    const styleDocument = drafts.map(d => d.content).join(' ')
    const styleVector = await this.generateEmbedding(styleDocument)

    // Generate individual content embeddings
    const contentVectors = []

    for (const draft of drafts) {
      try {
        const embedding = await this.generateEmbedding(draft.content)
        contentVectors.push({
          id: draft.id,
          embedding,
          content: draft.content,
          context: draft.user_inputs?.category || 'general',
          cplScore: draft.cpl_score || 0,
          isAccepted: true
        })
      } catch (error) {
        console.error('Failed to generate embedding for draft:', draft.id, error)
      }
    }

    return {
      styleVector,
      contentVectors
    }
  }

  /**
   * Generate text embedding using OpenAI (or alternative service)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // In production, this would call OpenAI's embedding API
      // For now, we'll simulate with a random vector
      const dimensions = this.modelDimensions
      const embedding = new Array(dimensions)
        .fill(0)
        .map(() => (Math.random() - 0.5) * 2) // Random vector between -1 and 1

      // Normalize the vector
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
      return embedding.map(val => val / magnitude)

    } catch (error) {
      console.error('Failed to generate embedding:', error)
      // Return zero vector as fallback
      return new Array(this.modelDimensions).fill(0)
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) return 0

    const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0)
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0))
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0))

    if (magnitudeA === 0 || magnitudeB === 0) return 0

    return dotProduct / (magnitudeA * magnitudeB)
  }

  /**
   * Find most relevant style examples for given input
   */
  private async findRelevantExamples(
    inputEmbedding: number[],
    styleProfile: WritingStyleProfile,
    category: string,
    limit: number = 5
  ): Promise<StyleRetrievalResult['relevantExamples']> {
    const examples = styleProfile.vectorEmbeddings.contentVectors
      .map(cv => ({
        content: cv.content,
        context: cv.context,
        cplScore: cv.cplScore,
        similarity: this.cosineSimilarity(inputEmbedding, cv.embedding)
      }))
      .filter(ex => ex.context === category || ex.context === 'general') // Context filtering
      .sort((a, b) => b.similarity - a.similarity) // Sort by similarity
      .slice(0, limit)

    return examples
  }

  /**
   * Generate style guidance based on user profile
   */
  private generateStyleGuidance(
    styleProfile: WritingStyleProfile,
    category: string
  ): StyleRetrievalResult['styleGuidance'] {
    const metrics = styleProfile.baselineMetrics

    // Determine dominant tone
    const tones = Object.entries(metrics.toneProfile)
    const dominantTone = tones.reduce((max, current) =>
      current[1] > max[1] ? current : max
    )[0]

    // Structure guidance based on metrics
    const avgSentenceLength = metrics.averageSentenceLength
    const structureGuidance = avgSentenceLength < 15
      ? 'concise, punchy sentences'
      : avgSentenceLength > 25
      ? 'longer, detailed sentences with clauses'
      : 'balanced sentence structure'

    // Vocabulary guidance
    const vocabComplexity = metrics.vocabularyComplexity
    const vocabGuidance = vocabComplexity > 70
      ? 'rich, varied vocabulary'
      : vocabComplexity < 50
      ? 'simple, accessible language'
      : 'moderate vocabulary complexity'

    return {
      tone: dominantTone,
      formality: Math.round(metrics.formalityLevel),
      structure: structureGuidance,
      vocabulary: vocabGuidance
    }
  }

  /**
   * Create enhanced prompt with style guidance
   */
  private createEnhancedPrompt({
    originalInput,
    category,
    relevantExamples,
    styleGuidance,
    styleProfile
  }: {
    originalInput: string
    category: string
    relevantExamples: StyleRetrievalResult['relevantExamples']
    styleGuidance: StyleRetrievalResult['styleGuidance']
    styleProfile: WritingStyleProfile
  }): string {
    let enhancedPrompt = `You are helping a user who has a specific writing style. Here's their style profile:

**Writing Style Analysis:**
- Tone: ${styleGuidance.tone}
- Formality Level: ${styleGuidance.formality}/100
- Sentence Structure: ${styleGuidance.structure}
- Vocabulary: ${styleGuidance.vocabulary}
- Average Sentence Length: ${Math.round(styleProfile.baselineMetrics.averageSentenceLength)} words
- Content Category: ${category}
`

    // Add relevant examples if available
    if (relevantExamples.length > 0) {
      enhancedPrompt += `\n**Style Examples from User's Previous Writing:**\n`
      relevantExamples.slice(0, 3).forEach((example, index) => {
        enhancedPrompt += `${index + 1}. "${example.content.substring(0, 150)}..." (Similarity: ${(example.similarity * 100).toFixed(1)}%)\n`
      })
    }

    // Add adaptive patterns
    if (styleProfile.adaptivePatterns.preferredPhrases.length > 0) {
      enhancedPrompt += `\n**User's Preferred Phrases:** ${styleProfile.adaptivePatterns.preferredPhrases.slice(0, 5).join(', ')}\n`
    }

    if (styleProfile.adaptivePatterns.avoidedPatterns.length > 0) {
      enhancedPrompt += `**Patterns to Avoid:** ${styleProfile.adaptivePatterns.avoidedPatterns.slice(0, 3).join(', ')}\n`
    }

    enhancedPrompt += `\n**Task:** Please help improve the following content while preserving the user's natural writing style and voice:\n\n"${originalInput}"\n\nMaintain their ${styleGuidance.tone} tone, ${styleGuidance.formality}/100 formality level, and ${styleGuidance.structure} approach. Focus on enhancing clarity and correctness while keeping their unique voice intact.`

    return enhancedPrompt
  }

  /**
   * Helper methods for text analysis
   */
  private calculateFormality(text: string): number {
    const formalWords = ['therefore', 'furthermore', 'consequently', 'nevertheless', 'moreover']
    const informalWords = ['so', 'but', 'and then', 'anyway', 'basically']

    const formalCount = formalWords.filter(word => text.toLowerCase().includes(word)).length
    const informalCount = informalWords.filter(word => text.toLowerCase().includes(word)).length

    const words = text.split(/\s+/).length
    const formalityScore = ((formalCount - informalCount) / words) * 1000 + 50

    return Math.max(0, Math.min(100, formalityScore))
  }

  private analyzeTone(text: string): WritingStyleProfile['baselineMetrics']['toneProfile'] {
    // Simple keyword-based tone analysis
    const friendlyWords = ['thanks', 'please', 'appreciate', 'wonderful', 'great']
    const professionalWords = ['analysis', 'implementation', 'strategy', 'framework', 'solution']
    const authoritativeWords = ['must', 'should', 'required', 'essential', 'critical']
    const casualWords = ['cool', 'awesome', 'nice', 'pretty', 'kinda']

    const text_lower = text.toLowerCase()

    return {
      friendly: friendlyWords.filter(word => text_lower.includes(word)).length,
      professional: professionalWords.filter(word => text_lower.includes(word)).length,
      authoritative: authoritativeWords.filter(word => text_lower.includes(word)).length,
      casual: casualWords.filter(word => text_lower.includes(word)).length
    }
  }

  private countTransitions(text: string): number {
    const transitions = ['however', 'therefore', 'furthermore', 'additionally', 'moreover', 'consequently']
    return transitions.filter(word => text.toLowerCase().includes(word)).length
  }

  private analyzePunctuation(text: string): string {
    const exclamations = (text.match(/!/g) || []).length
    const questions = (text.match(/\?/g) || []).length
    const semicolons = (text.match(/;/g) || []).length

    if (exclamations > questions && exclamations > semicolons) return 'exclamatory'
    if (questions > exclamations && questions > semicolons) return 'questioning'
    if (semicolons > 0) return 'complex'
    return 'simple'
  }

  private getMostCommonPunctuation(patterns: string[]): string[] {
    const counts = patterns.reduce((acc, pattern) => {
      acc[pattern] = (acc[pattern] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pattern]) => pattern)
  }

  private getDefaultMetrics(): WritingStyleProfile['baselineMetrics'] {
    return {
      averageSentenceLength: 20,
      vocabularyComplexity: 60,
      formalityLevel: 70,
      toneProfile: { friendly: 3, professional: 5, authoritative: 2, casual: 2 },
      structuralPatterns: {
        paragraphLength: 100,
        transitionUsage: 2,
        punctuationStyle: ['simple']
      }
    }
  }

  private calculateConfidence(
    relevantExamples: StyleRetrievalResult['relevantExamples'],
    styleProfile: WritingStyleProfile
  ): number {
    if (relevantExamples.length === 0) return 20

    const avgSimilarity = relevantExamples.reduce((sum, ex) => sum + ex.similarity, 0) / relevantExamples.length
    const dataPoints = styleProfile.vectorEmbeddings.contentVectors.length
    const dataConfidence = Math.min(100, dataPoints * 5) // 5% per data point, max 100%

    return Math.round((avgSimilarity * 70) + (dataConfidence * 0.3))
  }

  /**
   * Database operations
   */
  private async getStyleProfile(userId: string): Promise<WritingStyleProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_style_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (!data) return null

      return {
        userId: data.user_id,
        baselineMetrics: data.baseline_metrics,
        vectorEmbeddings: data.vector_embeddings,
        adaptivePatterns: data.adaptive_patterns,
        lastUpdated: new Date(data.updated_at)
      }
    } catch (error) {
      console.error('Failed to get style profile:', error)
      return null
    }
  }

  private async storeStyleProfile(profile: WritingStyleProfile): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_style_profiles')
        .upsert({
          user_id: profile.userId,
          baseline_metrics: profile.baselineMetrics,
          vector_embeddings: profile.vectorEmbeddings,
          adaptive_patterns: profile.adaptivePatterns,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error
    } catch (error) {
      console.error('Failed to store style profile:', error)
      throw error
    }
  }

  private async extractAdaptivePatterns(drafts: any[]): Promise<WritingStyleProfile['adaptivePatterns']> {
    // Simple pattern extraction - in production this would be more sophisticated
    const allText = drafts.map(d => d.content).join(' ')
    const words = allText.toLowerCase().split(/\s+/)

    // Find frequently used phrases (2-3 words)
    const phrases = []
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`
      if (phrase.length > 5 && phrase.length < 20) {
        phrases.push(phrase)
      }
    }

    const phraseCounts = phrases.reduce((acc, phrase) => {
      acc[phrase] = (acc[phrase] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const preferredPhrases = Object.entries(phraseCounts)
      .filter(([phrase, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phrase]) => phrase)

    return {
      preferredPhrases,
      avoidedPatterns: [], // Would be populated based on user feedback
      contextualPreferences: {}
    }
  }

  private async incrementalStyleUpdate(
    profile: WritingStyleProfile,
    newContent: {
      content: string
      embedding: number[]
      cplScore: number
      category: string
      userInput: string
    }
  ): Promise<void> {
    // Add new content vector
    profile.vectorEmbeddings.contentVectors.push({
      id: crypto.randomUUID(),
      embedding: newContent.embedding,
      content: newContent.content,
      context: newContent.category,
      cplScore: newContent.cplScore,
      isAccepted: true
    })

    // Keep only last 100 content vectors for performance
    if (profile.vectorEmbeddings.contentVectors.length > 100) {
      profile.vectorEmbeddings.contentVectors = profile.vectorEmbeddings.contentVectors.slice(-100)
    }

    // Update profile timestamp
    profile.lastUpdated = new Date()

    // Store updated profile
    await this.storeStyleProfile(profile)
  }
}

/**
 * Singleton instance for application-wide use
 */
export const styleRAG = new StyleRAGSystem()

/**
 * Convenience function for getting style-enhanced prompts
 */
export async function getStyleEnhancedPrompt(
  userId: string,
  userInput: string,
  category: string
): Promise<string> {
  try {
    const result = await styleRAG.retrieveStyleGuidance(userId, userInput, category)
    return result.enhancedPrompt
  } catch (error) {
    console.error('Failed to get style-enhanced prompt:', error)
    return userInput // Fallback to original input
  }
}

/**
 * Usage Examples:
 *
 * // Initialize user style profile
 * await styleRAG.initializeStyleProfile(userId)
 *
 * // Get style-enhanced prompt for AI
 * const enhancedPrompt = await getStyleEnhancedPrompt(userId, userInput, category)
 * const aiResponse = await generateContent(enhancedPrompt)
 *
 * // Update profile with user feedback
 * await styleRAG.updateStyleProfile(userId, aiResponse, userInput, category, isAccepted, cplScore)
 *
 * Performance Notes:
 * - Vector similarity calculations: O(n*d) where n=content vectors, d=dimensions
 * - Embeddings cached in database to avoid API calls
 * - Incremental updates prevent full profile regeneration
 * - Content vectors limited to 100 most recent for performance
 */