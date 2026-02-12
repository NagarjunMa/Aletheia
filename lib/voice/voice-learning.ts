// Voice Learning Algorithm with Vector Storage
// Purpose: Advanced AI system that learns user's writing voice/style from their content history

import { vectorService } from '@/lib/vectors/vector-service'
import { createClient } from '@/lib/supabase/server'
import { generateBaselinePrompts, getCategoryBaseline } from '@/lib/templates/category-baselines'
import type {
  EmbeddingVector,
  StyleVector,
  PreferenceVector,
  SimilaritySearchResult
} from '@/lib/database/types'

export interface VoicePattern {
  patternType: 'vocabulary' | 'sentence_structure' | 'tone' | 'complexity' | 'style'
  strength: number // 0-1, how strong this pattern is
  examples: string[]
  description: string
  frequency: number // How often this pattern appears
}

export interface VoiceLearningProfile {
  userId: string
  styleVector: StyleVector
  voicePatterns: VoicePattern[]
  confidenceScore: number // 0-1, how confident we are in this profile
  sampleCount: number // Number of writing samples analyzed
  lastUpdated: Date
  preferences: {
    complexity: PreferenceVector
    formality: PreferenceVector
    vocabulary: PreferenceVector
    sentenceLength: PreferenceVector
    tone: PreferenceVector
  }
  voiceMetrics: {
    averageWordsPerSentence: number
    vocabularyDiversity: number // Unique words / total words
    complexityLevel: 'simple' | 'moderate' | 'complex' | 'advanced'
    formalityLevel: 'informal' | 'semi-formal' | 'formal' | 'academic'
    toneCharacteristics: string[]
  }
}

export interface WritingSample {
  content: string
  embedding: EmbeddingVector
  metadata: {
    wordCount: number
    sentenceCount: number
    averageWordsPerSentence: number
    vocabularyScore: number
    complexityScore: number
    formalityScore: number
    createdAt: Date
  }
}

export class VoiceLearningEngine {
  private static instance: VoiceLearningEngine | null = null

  static getInstance(): VoiceLearningEngine {
    if (!VoiceLearningEngine.instance) {
      VoiceLearningEngine.instance = new VoiceLearningEngine()
    }
    return VoiceLearningEngine.instance
  }

  private getSupabaseClient() {
    return createClient()
  }

  /**
   * Analyze a new writing sample and extract voice patterns
   */
  async analyzeWritingSample(
    userId: string,
    content: string,
    storeInHistory: boolean = true
  ): Promise<{
    success: boolean
    sample?: WritingSample
    patterns?: VoicePattern[]
    error?: string
  }> {
    try {
      if (content.length < 50) {
        return {
          success: false,
          error: 'Content too short for voice analysis (minimum 50 characters)'
        }
      }

      // Generate embedding for the content
      const embedding = await vectorService.generateEmbedding(content)

      // Extract linguistic features
      const linguisticFeatures = this.extractLinguisticFeatures(content)

      // Create writing sample
      const sample: WritingSample = {
        content,
        embedding,
        metadata: {
          ...linguisticFeatures,
          createdAt: new Date()
        }
      }

      // Identify voice patterns
      const patterns = await this.identifyVoicePatterns(sample)

      // Store in vector database if requested
      if (storeInHistory) {
        await vectorService.storeEmbedding(
          userId,
          content,
          embedding,
          'voice_learning',
          'writing_sample',
          {
            linguistic_features: linguisticFeatures,
            voice_patterns: patterns.map(p => p.patternType),
            analysis_timestamp: new Date().toISOString(),
            confidence_score: this.calculateSampleConfidence(sample)
          }
        )
      }

      return {
        success: true,
        sample,
        patterns
      }
    } catch (error) {
      console.error('Voice analysis error:', error)
      return {
        success: false,
        error: 'Failed to analyze writing sample'
      }
    }
  }

  /**
   * Build comprehensive voice profile from user's writing history
   */
  async buildVoiceProfile(
    userId: string,
    maxSamples: number = 100
  ): Promise<{
    success: boolean
    profile?: VoiceLearningProfile
    error?: string
  }> {
    try {
      // Get user's writing samples from vector database
      const supabase = this.getSupabaseClient()
      const { data: samples, error } = await supabase
        .from('user_embeddings')
        .select('content_snippet, embedding, metadata, created_at')
        .eq('user_id', userId)
        .in('content_type', ['voice_learning', 'user_input', 'cpl_analysis'])
        .order('created_at', { ascending: false })
        .limit(maxSamples)

      if (error || !samples || samples.length < 3) {
        return {
          success: false,
          error: 'Insufficient writing samples for voice profile (minimum 3 required)'
        }
      }

      console.log(`Building voice profile from ${samples.length} samples`)

      // Convert samples to WritingSample format
      const writingSamples = samples
        .filter(s => s.embedding && s.content_snippet)
        .map(s => ({
          content: s.content_snippet,
          embedding: s.embedding as EmbeddingVector,
          metadata: {
            wordCount: this.countWords(s.content_snippet),
            sentenceCount: this.countSentences(s.content_snippet),
            averageWordsPerSentence: this.countWords(s.content_snippet) / this.countSentences(s.content_snippet),
            vocabularyScore: s.metadata?.vocabulary_score || this.calculateVocabularyScore(s.content_snippet),
            complexityScore: s.metadata?.complexity_score || this.calculateComplexityScore(s.content_snippet),
            formalityScore: s.metadata?.formality_score || this.calculateFormalityScore(s.content_snippet),
            createdAt: new Date(s.created_at)
          }
        }))

      // Generate style vector (average of all embeddings)
      const styleVector = this.calculateStyleVector(writingSamples)

      // Extract voice patterns across all samples
      const allPatterns = await this.extractAggregatedPatterns(writingSamples)

      // Calculate preferences based on patterns
      const preferences = this.calculateVoicePreferences(writingSamples, allPatterns)

      // Calculate voice metrics
      const voiceMetrics = this.calculateVoiceMetrics(writingSamples)

      // Calculate confidence score
      const confidenceScore = this.calculateProfileConfidence(writingSamples.length, allPatterns)

      const profile: VoiceLearningProfile = {
        userId,
        styleVector,
        voicePatterns: allPatterns,
        confidenceScore,
        sampleCount: writingSamples.length,
        lastUpdated: new Date(),
        preferences,
        voiceMetrics
      }

      // Store the voice profile
      await this.storeVoiceProfile(profile)

      return {
        success: true,
        profile
      }
    } catch (error) {
      console.error('Build voice profile error:', error)
      return {
        success: false,
        error: 'Failed to build voice profile'
      }
    }
  }

  /**
   * Get voice-aware content suggestions based on user's writing style
   */
  async getVoiceAwareSuggestions(
    userId: string,
    currentText: string,
    targetVoiceStrength: number = 0.8 // 0-1, how much to match user's voice
  ): Promise<{
    success: boolean
    suggestions?: Array<{
      type: 'vocabulary' | 'structure' | 'tone' | 'style'
      suggestion: string
      confidence: number
      voiceMatch: number // How well it matches user's voice
      originalPhrase?: string
      suggestedPhrase?: string
    }>
    error?: string
  }> {
    try {
      // Get user's voice profile
      const profileResult = await this.getUserVoiceProfile(userId)

      if (!profileResult.success || !profileResult.profile) {
        return {
          success: false,
          error: 'Voice profile not available. Please write more content to build your voice profile.'
        }
      }

      const profile = profileResult.profile

      // Analyze current text
      const currentAnalysis = await this.analyzeWritingSample(userId, currentText, false)

      if (!currentAnalysis.success || !currentAnalysis.sample) {
        return {
          success: false,
          error: 'Failed to analyze current text'
        }
      }

      // Find similarities with user's style
      const styleSimilarity = await this.calculateStyleSimilarity(
        currentAnalysis.sample.embedding,
        profile.styleVector
      )

      const suggestions = []

      // Vocabulary suggestions
      if (profile.voicePatterns.some(p => p.patternType === 'vocabulary')) {
        const vocabPattern = profile.voicePatterns.find(p => p.patternType === 'vocabulary')!
        const vocabSuggestions = await this.generateVocabularySuggestions(
          currentText,
          vocabPattern,
          profile.voiceMetrics.vocabularyDiversity
        )
        suggestions.push(...vocabSuggestions)
      }

      // Sentence structure suggestions
      if (profile.voiceMetrics.averageWordsPerSentence > 0) {
        const structureSuggestions = await this.generateStructureSuggestions(
          currentText,
          profile.voiceMetrics.averageWordsPerSentence,
          profile.preferences.sentenceLength
        )
        suggestions.push(...structureSuggestions)
      }

      // Tone suggestions
      const toneSuggestions = await this.generateToneSuggestions(
        currentText,
        profile.voiceMetrics.toneCharacteristics,
        profile.preferences.tone
      )
      suggestions.push(...toneSuggestions)

      // Filter suggestions by voice match strength
      const filteredSuggestions = suggestions.filter(s => s.voiceMatch >= targetVoiceStrength)

      return {
        success: true,
        suggestions: filteredSuggestions.sort((a, b) => b.confidence - a.confidence)
      }
    } catch (error) {
      console.error('Get voice-aware suggestions error:', error)
      return {
        success: false,
        error: 'Failed to generate voice-aware suggestions'
      }
    }
  }

  /**
   * Find writing samples similar to user's voice patterns
   */
  async findSimilarVoiceExamples(
    userId: string,
    queryText: string,
    options: {
      minSimilarity?: number
      maxExamples?: number
      voicePatternFilter?: string[]
    } = {}
  ): Promise<{
    success: boolean
    examples?: Array<{
      content: string
      similarity: number
      voicePatterns: string[]
      createdAt: Date
      metrics: {
        voiceMatch: number
        patternAlignment: number
      }
    }>
    error?: string
  }> {
    try {
      const { minSimilarity = 0.7, maxExamples = 10, voicePatternFilter } = options

      // Generate embedding for query text
      const queryEmbedding = await vectorService.generateEmbedding(queryText)

      // Find similar content in user's voice learning history
      const similarSamples = await vectorService.findSimilarContent(
        queryEmbedding,
        {
          contentType: 'voice_learning',
          userId,
          threshold: minSimilarity,
          limit: maxExamples
        }
      )

      // Get user's voice profile for comparison
      const profileResult = await this.getUserVoiceProfile(userId)
      const profile = profileResult.profile

      const examples = similarSamples.map(sample => ({
        content: sample.content_snippet,
        similarity: sample.similarity,
        voicePatterns: sample.metadata?.voice_patterns || [],
        createdAt: new Date(sample.created_at),
        metrics: {
          voiceMatch: profile ? this.calculateVoiceAlignment(
            sample.metadata?.linguistic_features,
            profile.voiceMetrics
          ) : 0,
          patternAlignment: profile ? this.calculatePatternAlignment(
            sample.metadata?.voice_patterns || [],
            profile.voicePatterns.map(p => p.patternType)
          ) : 0
        }
      }))

      // Filter by voice pattern if specified
      const filteredExamples = voicePatternFilter
        ? examples.filter(ex =>
          voicePatternFilter.some(pattern =>
            ex.voicePatterns.includes(pattern)
          )
        )
        : examples

      return {
        success: true,
        examples: filteredExamples
      }
    } catch (error) {
      console.error('Find similar voice examples error:', error)
      return {
        success: false,
        error: 'Failed to find similar voice examples'
      }
    }
  }

  // PRIVATE HELPER METHODS

  private extractLinguisticFeatures(content: string) {
    const words = content.match(/\b\w+\b/g) || []
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      averageWordsPerSentence: words.length / sentences.length,
      vocabularyScore: this.calculateVocabularyScore(content),
      complexityScore: this.calculateComplexityScore(content),
      formalityScore: this.calculateFormalityScore(content)
    }
  }

  private async identifyVoicePatterns(sample: WritingSample): Promise<VoicePattern[]> {
    const patterns: VoicePattern[] = []

    // Vocabulary pattern analysis
    const vocabPattern = this.analyzeVocabularyPattern(sample.content)
    if (vocabPattern.strength > 0.3) {
      patterns.push(vocabPattern)
    }

    // Sentence structure pattern
    const structurePattern = this.analyzeSentenceStructure(sample.content)
    if (structurePattern.strength > 0.3) {
      patterns.push(structurePattern)
    }

    // Tone pattern
    const tonePattern = this.analyzeTonePattern(sample.content)
    if (tonePattern.strength > 0.3) {
      patterns.push(tonePattern)
    }

    return patterns
  }

  private analyzeVocabularyPattern(content: string): VoicePattern {
    const words = content.match(/\b\w+\b/g) || []
    const uniqueWords = new Set(words.map(w => w.toLowerCase()))
    const diversity = uniqueWords.size / words.length

    // Analyze word complexity
    const complexWords = words.filter(w => w.length > 6).length
    const complexityRatio = complexWords / words.length

    return {
      patternType: 'vocabulary',
      strength: Math.min(diversity + complexityRatio, 1),
      examples: Array.from(uniqueWords).slice(0, 10),
      description: `Vocabulary diversity: ${Math.round(diversity * 100)}%, Complex words: ${Math.round(complexityRatio * 100)}%`,
      frequency: 1
    }
  }

  private analyzeSentenceStructure(content: string): VoicePattern {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = content.match(/\b\w+\b/g) || []
    const averageLength = words.length / sentences.length

    const structures = sentences.map(s => {
      const wordCount = (s.match(/\b\w+\b/g) || []).length
      if (wordCount < 10) return 'short'
      if (wordCount < 20) return 'medium'
      return 'long'
    })

    const structureDistribution = {
      short: structures.filter(s => s === 'short').length / structures.length,
      medium: structures.filter(s => s === 'medium').length / structures.length,
      long: structures.filter(s => s === 'long').length / structures.length
    }

    const dominantStructure = Object.entries(structureDistribution)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0]

    return {
      patternType: 'sentence_structure',
      strength: Math.max(...Object.values(structureDistribution)),
      examples: sentences.slice(0, 3),
      description: `Prefers ${dominantStructure} sentences (avg: ${Math.round(averageLength)} words)`,
      frequency: structures.length
    }
  }

  private analyzeTonePattern(content: string): VoicePattern {
    const lowerContent = content.toLowerCase()

    // Simple tone indicators
    const formalWords = ['therefore', 'furthermore', 'consequently', 'moreover', 'nevertheless']
    const informalWords = ['really', 'pretty', 'quite', 'actually', 'basically']
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic']
    const technicalWords = ['implement', 'optimize', 'algorithm', 'efficient', 'framework']

    const formalScore = formalWords.filter(w => lowerContent.includes(w)).length
    const informalScore = informalWords.filter(w => lowerContent.includes(w)).length
    const positiveScore = positiveWords.filter(w => lowerContent.includes(w)).length
    const technicalScore = technicalWords.filter(w => lowerContent.includes(w)).length

    const totalWords = (content.match(/\b\w+\b/g) || []).length
    const toneScores = {
      formal: formalScore / totalWords,
      informal: informalScore / totalWords,
      positive: positiveScore / totalWords,
      technical: technicalScore / totalWords
    }

    const dominantTone = Object.entries(toneScores)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0]

    return {
      patternType: 'tone',
      strength: Math.max(...Object.values(toneScores)) * 10, // Amplify small differences
      examples: [dominantTone],
      description: `Tends toward ${dominantTone} tone`,
      frequency: 1
    }
  }

  private calculateSampleConfidence(sample: WritingSample): number {
    const { wordCount, sentenceCount, vocabularyScore } = sample.metadata

    // Confidence increases with:
    // - More content (up to a point)
    // - Balanced sentence count
    // - Diverse vocabulary

    const lengthFactor = Math.min(wordCount / 100, 1) // Maxes out at 100 words
    const structureFactor = Math.min(sentenceCount / 5, 1) // Maxes out at 5 sentences
    const vocabularyFactor = vocabularyScore

    return (lengthFactor + structureFactor + vocabularyFactor) / 3
  }

  private calculateStyleVector(samples: WritingSample[]): StyleVector {
    if (samples.length === 0) return []

    // Average all embeddings to create style vector
    const embeddings = samples.map(s => s.embedding)
    const dimensions = embeddings[0].length

    return Array.from({ length: dimensions }, (_, i) => {
      const sum = embeddings.reduce((acc, emb) => acc + emb[i], 0)
      return sum / embeddings.length
    })
  }

  private async extractAggregatedPatterns(samples: WritingSample[]): Promise<VoicePattern[]> {
    const allPatterns: VoicePattern[][] = []

    for (const sample of samples) {
      const patterns = await this.identifyVoicePatterns(sample)
      allPatterns.push(patterns)
    }

    // Aggregate patterns by type
    const patternMap = new Map<string, VoicePattern[]>()

    allPatterns.flat().forEach(pattern => {
      const key = pattern.patternType
      if (!patternMap.has(key)) {
        patternMap.set(key, [])
      }
      patternMap.get(key)!.push(pattern)
    })

    // Create aggregated patterns
    const aggregatedPatterns: VoicePattern[] = []

    patternMap.forEach((patterns, type) => {
      const avgStrength = patterns.reduce((sum, p) => sum + p.strength, 0) / patterns.length
      const totalFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0)
      const allExamples = patterns.flatMap(p => p.examples).slice(0, 10)

      aggregatedPatterns.push({
        patternType: type as VoicePattern['patternType'],
        strength: avgStrength,
        examples: allExamples,
        description: patterns[0].description, // Use first description as template
        frequency: totalFrequency
      })
    })

    return aggregatedPatterns.filter(p => p.strength > 0.2) // Filter weak patterns
  }

  // Additional helper methods would continue here...
  // (Implementing preference calculation, voice metrics, similarity calculations, etc.)

  private calculateVoicePreferences(samples: WritingSample[], patterns: VoicePattern[]): VoiceLearningProfile['preferences'] {
    // Calculate preference vectors based on samples and patterns
    // This is a simplified implementation
    return {
      complexity: [0.5, 0.3, 0.2], // Simple, moderate, complex preferences
      formality: [0.3, 0.4, 0.3], // Informal, semi-formal, formal
      vocabulary: [0.4, 0.4, 0.2], // Basic, intermediate, advanced
      sentenceLength: [0.3, 0.5, 0.2], // Short, medium, long
      tone: [0.5, 0.3, 0.2] // Positive, neutral, formal
    }
  }

  private calculateVoiceMetrics(samples: WritingSample[]) {
    const avgWordsPerSentence = samples.reduce((sum, s) => sum + s.metadata.averageWordsPerSentence, 0) / samples.length
    const avgVocabularyScore = samples.reduce((sum, s) => sum + s.metadata.vocabularyScore, 0) / samples.length
    const avgComplexityScore = samples.reduce((sum, s) => sum + s.metadata.complexityScore, 0) / samples.length
    const avgFormalityScore = samples.reduce((sum, s) => sum + s.metadata.formalityScore, 0) / samples.length

    return {
      averageWordsPerSentence: Math.round(avgWordsPerSentence),
      vocabularyDiversity: avgVocabularyScore,
      complexityLevel: avgComplexityScore > 0.7 ? 'advanced' :
        avgComplexityScore > 0.5 ? 'complex' :
          avgComplexityScore > 0.3 ? 'moderate' : 'simple' as const,
      formalityLevel: avgFormalityScore > 0.7 ? 'academic' :
        avgFormalityScore > 0.5 ? 'formal' :
          avgFormalityScore > 0.3 ? 'semi-formal' : 'informal' as const,
      toneCharacteristics: ['neutral'] // Simplified for now
    }
  }

  private calculateProfileConfidence(sampleCount: number, patterns: VoicePattern[]): number {
    const sampleFactor = Math.min(sampleCount / 20, 1) // Maxes out at 20 samples
    const patternFactor = Math.min(patterns.length / 5, 1) // Maxes out at 5 patterns
    const strengthFactor = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.strength, 0) / patterns.length
      : 0

    return (sampleFactor + patternFactor + strengthFactor) / 3
  }

  private async storeVoiceProfile(profile: VoiceLearningProfile): Promise<void> {
    // Store in Supabase user_style_profiles table
    await vectorService.updateUserStyle(
      profile.userId,
      profile.styleVector,
      {
        complexity: profile.preferences.complexity,
        formality: profile.preferences.formality,
        vocabulary: profile.preferences.vocabulary
      }
    )
  }

  private async getUserVoiceProfile(userId: string): Promise<{
    success: boolean
    profile?: VoiceLearningProfile
    error?: string
  }> {
    try {
      const preferences = await vectorService.getUserStylePreferences(userId)
      const styleVector = await vectorService.generateUserStyleVector(userId)

      if (!preferences.has_profile || !styleVector) {
        return {
          success: false,
          error: 'Voice profile not found'
        }
      }

      // This is a simplified return - in a full implementation,
      // we'd reconstruct the full profile from stored data
      return {
        success: true,
        profile: {
          userId,
          styleVector,
          voicePatterns: [],
          confidenceScore: preferences.confidence_score,
          sampleCount: preferences.sample_count,
          lastUpdated: new Date(),
          preferences: {
            complexity: preferences.complexity_preference || [0.33, 0.33, 0.34],
            formality: preferences.formality_preference || [0.33, 0.33, 0.34],
            vocabulary: preferences.vocabulary_preference || [0.33, 0.33, 0.34],
            sentenceLength: [0.33, 0.33, 0.34],
            tone: [0.33, 0.33, 0.34]
          },
          voiceMetrics: {
            averageWordsPerSentence: 15,
            vocabularyDiversity: 0.7,
            complexityLevel: 'moderate',
            formalityLevel: 'semi-formal',
            toneCharacteristics: ['neutral']
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve voice profile'
      }
    }
  }

  // Utility methods for text analysis
  private countWords(text: string): number {
    return (text.match(/\b\w+\b/g) || []).length
  }

  private countSentences(text: string): number {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length
  }

  private calculateVocabularyScore(text: string): number {
    const words = (text.match(/\b\w+\b/g) || []).map(w => w.toLowerCase())
    const uniqueWords = new Set(words)
    return uniqueWords.size / Math.max(words.length, 1)
  }

  private calculateComplexityScore(text: string): number {
    const words = text.match(/\b\w+\b/g) || []
    const longWords = words.filter(w => w.length > 6).length
    return longWords / Math.max(words.length, 1)
  }

  private calculateFormalityScore(text: string): number {
    const formalIndicators = ['therefore', 'however', 'furthermore', 'consequently']
    const informalIndicators = ['really', 'pretty', 'quite', 'stuff']

    const lowerText = text.toLowerCase()
    const formalCount = formalIndicators.filter(w => lowerText.includes(w)).length
    const informalCount = informalIndicators.filter(w => lowerText.includes(w)).length

    return formalCount / Math.max(formalCount + informalCount, 1)
  }

  private async calculateStyleSimilarity(embedding1: EmbeddingVector, embedding2: StyleVector): Promise<number> {
    // Cosine similarity calculation
    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0)
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0))
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0))

    return dotProduct / (magnitude1 * magnitude2)
  }

  // Placeholder methods for suggestion generation
  private async generateVocabularySuggestions(text: string, pattern: VoicePattern, diversity: number): Promise<any[]> {
    return [] // Implementation would analyze text and suggest vocabulary improvements
  }

  private async generateStructureSuggestions(text: string, avgLength: number, preferences: PreferenceVector): Promise<any[]> {
    return [] // Implementation would suggest sentence structure improvements
  }

  private async generateToneSuggestions(text: string, characteristics: string[], preferences: PreferenceVector): Promise<any[]> {
    return [] // Implementation would suggest tone improvements
  }

  private calculateVoiceAlignment(features: any, metrics: any): number {
    return 0.5 // Simplified calculation
  }

  private calculatePatternAlignment(patterns1: string[], patterns2: string[]): number {
    const intersection = patterns1.filter(p => patterns2.includes(p))
    return intersection.length / Math.max(patterns1.length, patterns2.length, 1)
  }
}

// Export singleton instance
export const voiceLearningEngine = VoiceLearningEngine.getInstance()

/**
 * Update user's voice learning profile with new accepted content
 * Used by feedback API to learn from user's accepted drafts
 */
export async function updateUserVoiceLearning(
  userId: string,
  data: {
    content: string
    embedding?: number[]
    acceptedAt: Date
    hadUserEdits: boolean
    category: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const engine = VoiceLearningEngine.getInstance()

    // Analyze the accepted content to extract voice patterns
    const analysisResult = await engine.analyzeWritingSample(userId, data.content, true)

    if (!analysisResult.success) {
      console.warn('Voice analysis skipped:', analysisResult.error)
      // Don't fail - still try to update the profile
    }

    // Rebuild the voice profile with the new sample included
    await engine.buildVoiceProfile(userId, 100)

    console.log(`Voice learning updated for user ${userId} (category: ${data.category}, had edits: ${data.hadUserEdits})`)

    return { success: true }
  } catch (error) {
    console.error('Failed to update user voice learning:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate a personalized prompt based on user's voice profile
 */
export async function getPersonalizedPrompt(
  userId: string,
  userText: string,
  category: string
): Promise<string> {
  try {
    // Get user's voice profile
    const engine = VoiceLearningEngine.getInstance()
    const profileResult = await engine.buildVoiceProfile(userId, 50)

    if (!profileResult.success || !profileResult.profile || profileResult.profile.sampleCount === 0) {
      // 🌟 COLD START BASELINE: Use gold standard templates for new users
      console.log(`Using cold start baseline for user ${userId}, category: ${category}`)
      const baseline = generateBaselinePrompts(category, userText)
      return baseline.polishPrompt
    }

    const profile = profileResult.profile

    // Build personalized prompt based on voice profile
    const categoryContext = getCategoryContext(category)
    const voiceContext = buildVoiceContext(profile)

    return `You are Ascendia, an adaptive writing assistant. Polish the following text to match the user's authentic writing voice while optimizing it for ${categoryContext}.

USER'S WRITING VOICE PROFILE:
${voiceContext}

INSTRUCTIONS:
- Maintain the user's natural ${profile.voiceMetrics.complexityLevel} complexity level
- Preserve their ${profile.voiceMetrics.formalityLevel} tone
- Keep sentence length around ${profile.voiceMetrics.averageWordsPerSentence} words on average
- Match their vocabulary diversity level (${Math.round(profile.voiceMetrics.vocabularyDiversity * 100)}%)
- Optimize for ${categoryContext} while preserving authenticity

Content to polish: "${userText}"

Return only the improved text without explanations.`

  } catch (error) {
    console.error('Error generating personalized prompt:', error)
    // Fallback to standard prompt on error
    return getStandardPolishPrompt(userText, category)
  }
}

function getStandardPolishPrompt(text: string, category: string): string {
  const categoryContext = getCategoryContext(category)

  return `You are Ascendia, a writing assistant. Please polish the following text to be more effective as ${categoryContext}. Enhance clarity, professionalism, and impact while maintaining the original intent and voice.

Content: "${text}"

Return only the improved text without explanations.`
}

function getCategoryContext(category: string): string {
  const contexts = {
    'instagram_post': 'an engaging Instagram post',
    'linkedin': 'a professional LinkedIn post',
    'medium_article': 'a thoughtful Medium article',
    'email': 'a professional email',
    'conversational': 'natural conversation'
  }
  return contexts[category as keyof typeof contexts] || 'professional content'
}

function buildVoiceContext(profile: VoiceLearningProfile): string {
  const patterns = profile.voicePatterns.map(p =>
    `- ${p.patternType}: ${p.description} (strength: ${Math.round(p.strength * 100)}%)`
  ).join('\n')

  const characteristics = [
    `Average sentence length: ${profile.voiceMetrics.averageWordsPerSentence} words`,
    `Vocabulary diversity: ${Math.round(profile.voiceMetrics.vocabularyDiversity * 100)}%`,
    `Complexity level: ${profile.voiceMetrics.complexityLevel}`,
    `Formality level: ${profile.voiceMetrics.formalityLevel}`,
    `Tone characteristics: ${profile.voiceMetrics.toneCharacteristics.join(', ')}`
  ].join('\n')

  return `VOICE PATTERNS:
${patterns}

WRITING CHARACTERISTICS:
${characteristics}

CONFIDENCE: ${Math.round(profile.confidenceScore * 100)}% (based on ${profile.sampleCount} samples)`
}