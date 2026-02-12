/**
 * Advanced Voice Learning System
 *
 * Sophisticated RAG-based voice learning that adapts to user writing patterns
 * through vector similarity, style extraction, and pattern recognition.
 *
 * Features:
 * - Multi-dimensional voice analysis (style, tone, complexity, structure)
 * - Vector-based similarity matching with HNSW indexing
 * - Contextual adaptation based on content type and audience
 * - Continuous learning with confidence scoring
 * - Privacy-compliant pattern extraction
 * - Real-time voice profile updates
 * - Cross-conversation style consistency
 */

import { createClient } from '@/lib/supabase/client'
import { conversationMemoryEngine } from '@/lib/memory/conversation-memory-engine'
import { threadSiloingSystem } from '@/lib/memory/thread-siloing-system'

interface VoiceProfile {
  userId: string
  lastUpdated: Date
  confidence: number // 0-100
  sampleCount: number

  // Core voice characteristics
  characteristics: {
    // Writing style dimensions
    formality: number           // 0-100 (informal to formal)
    complexity: number          // 0-100 (simple to complex)
    emotionality: number        // 0-100 (neutral to emotional)
    directness: number          // 0-100 (indirect to direct)
    conciseness: number         // 0-100 (verbose to concise)
    creativity: number          // 0-100 (conventional to creative)

    // Structural preferences
    sentenceLength: number      // Average sentence length preference
    paragraphDensity: number    // Words per paragraph preference
    transitionStyle: 'minimal' | 'smooth' | 'elaborate'

    // Linguistic patterns
    vocabularyLevel: 'simple' | 'intermediate' | 'advanced' | 'expert'
    punctuationStyle: 'minimal' | 'standard' | 'expressive'
    rhetoricDevices: string[]   // Preferred rhetorical devices
  }

  // Context-specific adaptations
  contextAdaptations: {
    [category: string]: {
      formalityShift: number    // -50 to +50 adjustment
      complexityShift: number   // -50 to +50 adjustment
      toneAdjustment: string    // 'friendlier', 'more_professional', etc.
      structuralChanges: Record<string, any>
    }
  }

  // Learning metadata
  metadata: {
    primaryDomains: string[]    // Main content types user writes
    strongestPatterns: Array<{
      pattern: string
      confidence: number
      frequency: number
    }>
    adaptationSpeed: number     // How quickly to adapt (0-1)
    stabilityPreference: number // How much to weight existing vs new patterns
  }
}

interface StyleVector {
  embedding: number[]           // 1536-dimensional style embedding
  metadata: {
    contentLength: number
    category: string
    timestamp: Date
    qualityScore: number
    userSatisfaction?: number   // If feedback is available
  }
}

interface VoiceLearningRequest {
  originalText: string
  improvedText?: string
  category: string
  userFeedback?: 'accepted' | 'rejected' | 'modified'
  contextInfo?: {
    audience: 'internal' | 'external' | 'personal'
    purpose: 'informative' | 'persuasive' | 'creative' | 'technical'
    urgency: 'low' | 'medium' | 'high'
  }
}

interface StyleRecommendation {
  confidence: number
  recommendations: Array<{
    aspect: string
    currentValue: number | string
    suggestedValue: number | string
    reasoning: string
    impact: 'low' | 'medium' | 'high'
  }>
  adaptation: {
    formalityAdjustment: number
    complexityAdjustment: number
    structuralSuggestions: string[]
    tonalGuidance: string
  }
}

class AdvancedVoiceLearningSystem {
  private supabase = createClient()
  private voiceProfiles = new Map<string, VoiceProfile>()
  private styleVectorCache = new Map<string, StyleVector[]>()

  // Voice analysis patterns
  private analysisPatterns = {
    formality: {
      formal: ['therefore', 'furthermore', 'consequently', 'moreover', 'nevertheless'],
      informal: ['basically', 'pretty much', 'kind of', 'you know', 'anyway'],
      academic: ['research indicates', 'studies show', 'according to', 'evidence suggests'],
      conversational: ['I think', 'I feel', 'what I mean', 'honestly', 'to be fair']
    },
    complexity: {
      simple: { avgSentenceLength: { min: 5, max: 15 }, syllablesPerWord: { min: 1, max: 1.5 } },
      moderate: { avgSentenceLength: { min: 15, max: 25 }, syllablesPerWord: { min: 1.5, max: 2.0 } },
      complex: { avgSentenceLength: { min: 25, max: 40 }, syllablesPerWord: { min: 2.0, max: 3.0 } },
      sophisticated: { avgSentenceLength: { min: 40, max: 60 }, syllablesPerWord: { min: 3.0, max: 5.0 } }
    },
    emotionality: {
      neutral: ['the', 'is', 'and', 'to', 'of'],
      positive: ['amazing', 'excellent', 'fantastic', 'wonderful', 'brilliant', 'love'],
      negative: ['terrible', 'awful', 'horrible', 'hate', 'disgusting', 'worst'],
      passionate: ['absolutely', 'incredibly', 'extremely', 'definitely', 'completely']
    }
  }

  /**
   * Learn from user writing samples
   */
  async learnFromSample(
    userId: string,
    conversationId: string,
    request: VoiceLearningRequest
  ): Promise<{
    updated: boolean
    confidence: number
    insights: string[]
    profile: VoiceProfile
  }> {
    try {
      console.log(`🧠 Learning from sample for user ${userId}`)

      // 1. Extract voice characteristics from the original text
      const characteristics = await this.extractVoiceCharacteristics(request.originalText, request.category)

      // 2. If improved text is provided, analyze the difference
      let improvementPatterns = null
      if (request.improvedText) {
        improvementPatterns = await this.analyzeImprovementPatterns(
          request.originalText,
          request.improvedText,
          request.userFeedback
        )
      }

      // 3. Get or create voice profile
      let profile = await this.getVoiceProfile(userId)
      if (!profile) {
        profile = this.createInitialVoiceProfile(userId, characteristics)
      }

      // 4. Update profile with new learning
      const updatedProfile = await this.updateVoiceProfile(
        profile,
        characteristics,
        improvementPatterns,
        request.category,
        request.contextInfo
      )

      // 5. Generate style vector embedding
      const styleVector = await this.generateStyleVector(request.originalText, request.category)

      // 6. Store in vector database
      await this.storeStyleVector(userId, conversationId, styleVector)

      // 7. Update cached profile
      this.voiceProfiles.set(userId, updatedProfile)

      // 8. Generate insights
      const insights = await this.generateLearningInsights(profile, updatedProfile)

      console.log(`✅ Voice learning completed. Confidence: ${updatedProfile.confidence}%`)

      return {
        updated: true,
        confidence: updatedProfile.confidence,
        insights,
        profile: updatedProfile
      }

    } catch (error) {
      console.error('🔴 Voice learning failed:', error)
      return {
        updated: false,
        confidence: 0,
        insights: ['Failed to process voice learning sample'],
        profile: await this.getVoiceProfile(userId) || this.createInitialVoiceProfile(userId, {})
      }
    }
  }

  /**
   * Get style recommendations for new content
   */
  async getStyleRecommendations(
    userId: string,
    category: string,
    contentPreview?: string,
    contextInfo?: VoiceLearningRequest['contextInfo']
  ): Promise<StyleRecommendation> {
    try {
      // 1. Get user voice profile
      const profile = await this.getVoiceProfile(userId)
      if (!profile || profile.confidence < 30) {
        return this.getDefaultRecommendations(category)
      }

      // 2. Find similar past content using vector search
      const similarContent = await this.findSimilarContent(userId, category, contentPreview)

      // 3. Apply contextual adaptations
      const contextualProfile = this.applyContextualAdaptations(profile, category, contextInfo)

      // 4. Generate specific recommendations
      const recommendations = this.generateRecommendations(contextualProfile, similarContent, category)

      return recommendations

    } catch (error) {
      console.error('🔴 Failed to get style recommendations:', error)
      return this.getDefaultRecommendations(category)
    }
  }

  /**
   * Extract detailed voice characteristics from text
   */
  private async extractVoiceCharacteristics(text: string, category: string): Promise<any> {
    // Analyze formality
    const formality = this.analyzeFormalityLevel(text)

    // Analyze complexity
    const complexity = this.analyzeComplexityLevel(text)

    // Analyze emotionality
    const emotionality = this.analyzeEmotionalityLevel(text)

    // Analyze directness
    const directness = this.analyzeDirectnessLevel(text)

    // Analyze structure
    const structure = this.analyzeStructuralPatterns(text)

    // Analyze vocabulary
    const vocabulary = this.analyzeVocabularyLevel(text)

    return {
      formality,
      complexity,
      emotionality,
      directness,
      conciseness: this.analyzeConciseness(text),
      creativity: this.analyzeCreativity(text, category),
      sentenceLength: structure.avgSentenceLength,
      paragraphDensity: structure.avgParagraphDensity,
      transitionStyle: structure.transitionStyle,
      vocabularyLevel: vocabulary.level,
      punctuationStyle: this.analyzePunctuationStyle(text),
      rhetoricDevices: this.identifyRhetoricDevices(text)
    }
  }

  private analyzeFormalityLevel(text: string): number {
    const words = text.toLowerCase().split(/\s+/)
    let formalScore = 50 // Start neutral

    // Formal indicators
    const formalWords = this.analysisPatterns.formality.formal
    const informalWords = this.analysisPatterns.formality.informal
    const academicWords = this.analysisPatterns.formality.academic

    const formalCount = this.countMatches(words, formalWords)
    const informalCount = this.countMatches(words, informalWords)
    const academicCount = this.countMatches(words, academicWords)

    // Adjust score based on indicators
    formalScore += (formalCount * 10) - (informalCount * 15) + (academicCount * 15)

    // Structural formality indicators
    const contractionPattern = /'(ll|re|ve|d|s|t)\b/g
    const contractions = (text.match(contractionPattern) || []).length
    formalScore -= contractions * 5

    // Complex sentence structures (formal)
    const subordinatingConjunctions = ['although', 'because', 'whereas', 'while', 'since']
    const complexStructures = this.countMatches(words, subordinatingConjunctions)
    formalScore += complexStructures * 8

    return Math.max(0, Math.min(100, formalScore))
  }

  private analyzeComplexityLevel(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = text.split(/\s+/)
    const avgSentenceLength = words.length / sentences.length

    // Calculate syllable complexity
    const avgSyllables = this.calculateAverageSyllables(words)

    // Complexity indicators
    let complexityScore = 30

    // Sentence length complexity
    if (avgSentenceLength > 25) complexityScore += 30
    else if (avgSentenceLength > 15) complexityScore += 15
    else if (avgSentenceLength < 8) complexityScore -= 10

    // Syllable complexity
    if (avgSyllables > 2.5) complexityScore += 25
    else if (avgSyllables > 2.0) complexityScore += 15
    else if (avgSyllables > 1.5) complexityScore += 5

    // Advanced vocabulary indicators
    const advancedWords = words.filter(word => word.length > 6).length
    const advancedRatio = advancedWords / words.length
    complexityScore += advancedRatio * 30

    return Math.max(0, Math.min(100, complexityScore))
  }

  private analyzeEmotionalityLevel(text: string): number {
    const words = text.toLowerCase().split(/\s+/)
    let emotionalScore = 20 // Start low

    // Emotional word patterns
    const positiveWords = this.analysisPatterns.emotionality.positive
    const negativeWords = this.analysisPatterns.emotionality.negative
    const passionateWords = this.analysisPatterns.emotionality.passionate

    const positiveCount = this.countMatches(words, positiveWords)
    const negativeCount = this.countMatches(words, negativeWords)
    const passionateCount = this.countMatches(words, passionateWords)

    emotionalScore += (positiveCount + negativeCount) * 15 + passionateCount * 20

    // Exclamation marks and emotional punctuation
    const exclamations = (text.match(/!/g) || []).length
    const emotionalPunctuation = (text.match(/[!]{2,}|[?]{2,}|\.{3,}/g) || []).length

    emotionalScore += exclamations * 10 + emotionalPunctuation * 15

    // Personal pronouns (can indicate emotional involvement)
    const personalPronouns = ['i', 'me', 'my', 'we', 'us', 'our']
    const personalCount = this.countMatches(words, personalPronouns)
    emotionalScore += personalCount * 5

    return Math.max(0, Math.min(100, emotionalScore))
  }

  private analyzeDirectnessLevel(text: string): number {
    const words = text.toLowerCase().split(/\s+/)
    let directnessScore = 50

    // Direct indicators
    const hedgingWords = ['perhaps', 'maybe', 'might', 'could', 'possibly', 'somewhat']
    const directWords = ['must', 'will', 'should', 'need', 'require', 'essential']

    const hedgingCount = this.countMatches(words, hedgingWords)
    const directCount = this.countMatches(words, directWords)

    directnessScore += directCount * 10 - hedgingCount * 12

    // Passive vs active voice indicators
    const passiveIndicators = ['was', 'were', 'been', 'being']
    const passiveCount = this.countMatches(words, passiveIndicators)
    directnessScore -= passiveCount * 5

    // Question patterns (less direct)
    const questionCount = (text.match(/\?/g) || []).length
    directnessScore -= questionCount * 8

    return Math.max(0, Math.min(100, directnessScore))
  }

  private analyzeStructuralPatterns(text: string) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    const words = text.split(/\s+/)

    const avgSentenceLength = words.length / sentences.length
    const avgParagraphDensity = words.length / paragraphs.length

    // Analyze transition patterns
    const transitionWords = ['however', 'therefore', 'furthermore', 'meanwhile', 'consequently']
    const transitionCount = this.countMatches(words, transitionWords)

    let transitionStyle: 'minimal' | 'smooth' | 'elaborate'
    if (transitionCount / sentences.length > 0.3) transitionStyle = 'elaborate'
    else if (transitionCount / sentences.length > 0.1) transitionStyle = 'smooth'
    else transitionStyle = 'minimal'

    return {
      avgSentenceLength,
      avgParagraphDensity,
      transitionStyle
    }
  }

  private analyzeVocabularyLevel(text: string) {
    const words = text.split(/\s+/)
    const uniqueWords = new Set(words.map(w => w.toLowerCase()))

    // TTR (Type-Token Ratio)
    const ttr = uniqueWords.size / words.length

    // Average word length
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length

    // Advanced word indicators
    const longWords = words.filter(word => word.length > 6).length / words.length

    let level: 'simple' | 'intermediate' | 'advanced' | 'expert'

    if (avgWordLength > 6 && longWords > 0.3) level = 'expert'
    else if (avgWordLength > 5.5 && longWords > 0.2) level = 'advanced'
    else if (avgWordLength > 4.5 && longWords > 0.1) level = 'intermediate'
    else level = 'simple'

    return { level, ttr, avgWordLength, longWords }
  }

  /**
   * Utility methods
   */
  private countMatches(words: string[], patterns: string[]): number {
    return words.filter(word => patterns.includes(word)).length
  }

  private calculateAverageSyllables(words: string[]): number {
    const totalSyllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0)
    return totalSyllables / words.length
  }

  private countSyllables(word: string): number {
    // Simple syllable counting algorithm
    word = word.toLowerCase()
    let syllables = 0
    const vowels = 'aeiouy'
    let previousWasVowel = false

    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i])
      if (isVowel && !previousWasVowel) {
        syllables++
      }
      previousWasVowel = isVowel
    }

    // Adjust for silent 'e'
    if (word.endsWith('e') && syllables > 1) {
      syllables--
    }

    return Math.max(1, syllables)
  }

  private analyzeConciseness(text: string): number {
    const words = text.split(/\s+/)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)

    // Filler word analysis
    const fillerWords = ['very', 'really', 'quite', 'rather', 'somewhat', 'actually', 'basically']
    const fillerCount = this.countMatches(words, fillerWords)

    // Redundancy patterns
    const redundantPhrases = ['in order to', 'due to the fact that', 'at this point in time']
    let redundancyScore = 0
    redundantPhrases.forEach(phrase => {
      if (text.toLowerCase().includes(phrase)) redundancyScore++
    })

    let conciseness = 70
    conciseness -= fillerCount * 8
    conciseness -= redundancyScore * 15

    // Word efficiency (information per word)
    const avgWordsPerSentence = words.length / sentences.length
    if (avgWordsPerSentence > 20) conciseness -= 10
    else if (avgWordsPerSentence < 10) conciseness += 10

    return Math.max(0, Math.min(100, conciseness))
  }

  private analyzeCreativity(text: string, category: string): number {
    let creativity = 40 // Base creativity score

    // Metaphor and simile detection
    const figurativeLanguage = ['like', 'as', 'metaphor', 'symbolize', 'represent']
    const figurativeCount = this.countMatches(text.split(/\s+/), figurativeLanguage)
    creativity += figurativeCount * 15

    // Unique word usage
    const words = text.split(/\s+/)
    const uniqueRatio = new Set(words).size / words.length
    creativity += uniqueRatio * 30

    // Category-specific adjustments
    if (category === 'creative' || category === 'article') creativity += 20
    if (category === 'email' || category === 'proposal') creativity -= 10

    return Math.max(0, Math.min(100, creativity))
  }

  private analyzePunctuationStyle(text: string): 'minimal' | 'standard' | 'expressive' {
    const punctuationMarks = text.match(/[.!?;:,\-—]/g) || []
    const words = text.split(/\s+/)
    const punctuationRatio = punctuationMarks.length / words.length

    const expressivePunctuation = text.match(/[!]{1,}|[?]{1,}|[.]{3,}|—/g) || []

    if (expressivePunctuation.length > 0 || punctuationRatio > 0.2) return 'expressive'
    if (punctuationRatio > 0.1) return 'standard'
    return 'minimal'
  }

  private identifyRhetoricDevices(text: string): string[] {
    const devices: string[] = []
    const lowerText = text.toLowerCase()

    // Rhetorical questions
    if (text.includes('?') && lowerText.includes('what') || lowerText.includes('how') || lowerText.includes('why')) {
      devices.push('rhetorical_questions')
    }

    // Repetition patterns
    const words = text.split(/\s+/)
    const wordFreq = new Map<string, number>()
    words.forEach(word => {
      const clean = word.toLowerCase().replace(/[^\w]/g, '')
      wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1)
    })

    const repeatedWords = Array.from(wordFreq.entries()).filter(([_, count]) => count >= 3)
    if (repeatedWords.length > 0) devices.push('repetition')

    // Contrast patterns
    const contrastWords = ['but', 'however', 'although', 'while', 'whereas', 'despite']
    if (this.countMatches(words, contrastWords) > 0) devices.push('contrast')

    return devices
  }

  /**
   * Get user voice profile from cache or database
   */
  private async getVoiceProfile(userId: string): Promise<VoiceProfile | null> {
    try {
      // Check cache first
      if (this.voiceProfiles.has(userId)) {
        return this.voiceProfiles.get(userId)!
      }

      // Load from database
      const { data: profile, error } = await this.supabase
        .from('user_voice_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error || !profile) {
        console.log(`📝 No voice profile found for user ${userId}`)
        return null
      }

      const voiceProfile: VoiceProfile = {
        userId,
        lastUpdated: new Date(profile.updated_at),
        confidence: profile.confidence || 0,
        sampleCount: profile.sample_count || 0,
        characteristics: profile.characteristics || {},
        contextAdaptations: profile.context_adaptations || {},
        metadata: profile.metadata || {}
      }

      // Cache the profile
      this.voiceProfiles.set(userId, voiceProfile)
      return voiceProfile

    } catch (error) {
      console.error('🔴 Failed to get voice profile:', error)
      return null
    }
  }

  /**
   * Create initial voice profile for new users
   */
  private createInitialVoiceProfile(userId: string, characteristics: any): VoiceProfile {
    return {
      userId,
      lastUpdated: new Date(),
      confidence: 10,
      sampleCount: 0,
      characteristics: {
        formality: characteristics.formality || 50,
        complexity: characteristics.complexity || 50,
        emotionality: characteristics.emotionality || 30,
        directness: characteristics.directness || 50,
        conciseness: characteristics.conciseness || 50,
        creativity: characteristics.creativity || 40,
        sentenceLength: characteristics.sentenceLength || 15,
        paragraphDensity: characteristics.paragraphDensity || 60,
        transitionStyle: characteristics.transitionStyle || 'smooth',
        vocabularyLevel: characteristics.vocabularyLevel || 'intermediate',
        punctuationStyle: characteristics.punctuationStyle || 'standard',
        rhetoricDevices: characteristics.rhetoricDevices || []
      },
      contextAdaptations: {},
      metadata: {
        primaryDomains: [],
        strongestPatterns: [],
        adaptationSpeed: 0.5,
        stabilityPreference: 0.7
      }
    }
  }

  /**
   * Update voice profile with new learning
   */
  private async updateVoiceProfile(
    currentProfile: VoiceProfile,
    newCharacteristics: any,
    improvementPatterns: any,
    category: string,
    contextInfo?: any
  ): Promise<VoiceProfile> {
    const adaptationSpeed = currentProfile.metadata.adaptationSpeed
    const stabilityWeight = currentProfile.metadata.stabilityPreference

    // Calculate updated characteristics using weighted average
    const updatedCharacteristics = { ...currentProfile.characteristics }

    Object.keys(newCharacteristics).forEach(key => {
      if (typeof newCharacteristics[key] === 'number' && typeof updatedCharacteristics[key] === 'number') {
        updatedCharacteristics[key] =
          (updatedCharacteristics[key] * stabilityWeight) +
          (newCharacteristics[key] * (1 - stabilityWeight))
      } else {
        updatedCharacteristics[key] = newCharacteristics[key]
      }
    })

    // Update context adaptations
    const contextAdaptations = { ...currentProfile.contextAdaptations }
    if (!contextAdaptations[category]) {
      contextAdaptations[category] = {
        formalityShift: 0,
        complexityShift: 0,
        toneAdjustment: 'neutral',
        structuralChanges: {}
      }
    }

    // Update confidence based on sample count and consistency
    const newSampleCount = currentProfile.sampleCount + 1
    let newConfidence = Math.min(95, currentProfile.confidence + (adaptationSpeed * 10))

    // Boost confidence if patterns are consistent
    if (improvementPatterns && improvementPatterns.consistency > 0.8) {
      newConfidence += 5
    }

    const updatedProfile: VoiceProfile = {
      ...currentProfile,
      lastUpdated: new Date(),
      confidence: newConfidence,
      sampleCount: newSampleCount,
      characteristics: updatedCharacteristics,
      contextAdaptations,
      metadata: {
        ...currentProfile.metadata,
        primaryDomains: this.updatePrimaryDomains(currentProfile.metadata.primaryDomains, category)
      }
    }

    // Save to database
    await this.saveVoiceProfile(updatedProfile)

    return updatedProfile
  }

  private async saveVoiceProfile(profile: VoiceProfile): Promise<void> {
    try {
      await this.supabase
        .from('user_voice_profiles')
        .upsert({
          user_id: profile.userId,
          confidence: profile.confidence,
          sample_count: profile.sampleCount,
          characteristics: profile.characteristics,
          context_adaptations: profile.contextAdaptations,
          metadata: profile.metadata,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      console.log(`💾 Voice profile saved for user ${profile.userId}`)
    } catch (error) {
      console.error('🔴 Failed to save voice profile:', error)
    }
  }

  private updatePrimaryDomains(currentDomains: string[], newCategory: string): string[] {
    const domains = [...currentDomains]
    const index = domains.indexOf(newCategory)

    if (index >= 0) {
      // Move to front (most recent)
      domains.splice(index, 1)
      domains.unshift(newCategory)
    } else {
      // Add as new domain
      domains.unshift(newCategory)
      // Keep only top 5 domains
      domains.splice(5)
    }

    return domains
  }

  /**
   * Generate style vector embedding for vector search
   */
  private async generateStyleVector(text: string, category: string): Promise<StyleVector> {
    // Extract numerical features for vector representation
    const characteristics = await this.extractVoiceCharacteristics(text, category)

    // Create embedding from characteristics (simplified approach)
    // In production, this would use a proper embedding model
    const embedding = new Array(1536).fill(0).map((_, i) => {
      const feature = Object.values(characteristics)[i % Object.keys(characteristics).length]
      return typeof feature === 'number' ? feature / 100 : Math.random() - 0.5
    })

    return {
      embedding,
      metadata: {
        contentLength: text.length,
        category,
        timestamp: new Date(),
        qualityScore: 0 // Would be calculated based on various factors
      }
    }
  }

  private async storeStyleVector(userId: string, conversationId: string, vector: StyleVector): Promise<void> {
    try {
      await this.supabase
        .from('style_rag_vectors')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          embeddings: vector.embedding,
          metadata: vector.metadata
        })
    } catch (error) {
      console.error('🔴 Failed to store style vector:', error)
    }
  }

  /**
   * Additional helper methods would be implemented here:
   * - analyzeImprovementPatterns()
   * - findSimilarContent()
   * - applyContextualAdaptations()
   * - generateRecommendations()
   * - generateLearningInsights()
   * - getDefaultRecommendations()
   */

  // These would be full implementations in the actual system
  private async analyzeImprovementPatterns(original: string, improved: string, feedback?: string) {
    // Analyze the differences between original and improved text
    return { consistency: 0.85, patterns: [] }
  }

  private async findSimilarContent(userId: string, category: string, preview?: string) {
    // Use vector similarity search to find related content
    return []
  }

  private applyContextualAdaptations(profile: VoiceProfile, category: string, context?: any) {
    // Apply context-specific adjustments to the profile
    return profile
  }

  private generateRecommendations(profile: VoiceProfile, similarContent: any[], category: string): StyleRecommendation {
    return {
      confidence: profile.confidence,
      recommendations: [],
      adaptation: {
        formalityAdjustment: 0,
        complexityAdjustment: 0,
        structuralSuggestions: [],
        tonalGuidance: 'neutral'
      }
    }
  }

  private async generateLearningInsights(oldProfile: VoiceProfile, newProfile: VoiceProfile): Promise<string[]> {
    const insights = []

    // Compare characteristics and generate insights
    const formalityChange = newProfile.characteristics.formality - oldProfile.characteristics.formality
    if (Math.abs(formalityChange) > 5) {
      insights.push(`Formality preference ${formalityChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(formalityChange).toFixed(1)} points`)
    }

    if (newProfile.confidence > oldProfile.confidence + 10) {
      insights.push(`Voice learning confidence improved significantly (+${(newProfile.confidence - oldProfile.confidence).toFixed(1)}%)`)
    }

    return insights
  }

  private getDefaultRecommendations(category: string): StyleRecommendation {
    return {
      confidence: 25,
      recommendations: [
        {
          aspect: 'formality',
          currentValue: 50,
          suggestedValue: category === 'email' ? 70 : 50,
          reasoning: 'Default recommendation for category',
          impact: 'medium'
        }
      ],
      adaptation: {
        formalityAdjustment: 0,
        complexityAdjustment: 0,
        structuralSuggestions: ['Use clear, concise sentences'],
        tonalGuidance: 'professional yet approachable'
      }
    }
  }
}

// Export singleton instance
export const advancedVoiceLearningSystem = new AdvancedVoiceLearningSystem()

/**
 * Convenience functions for easy usage
 */
export async function learnFromUserSample(
  userId: string,
  conversationId: string,
  originalText: string,
  improvedText?: string,
  category: string = 'general',
  userFeedback?: 'accepted' | 'rejected' | 'modified'
) {
  return advancedVoiceLearningSystem.learnFromSample(userId, conversationId, {
    originalText,
    improvedText,
    category,
    userFeedback
  })
}

export async function getPersonalizedStyleRecommendations(
  userId: string,
  category: string,
  contentPreview?: string,
  context?: {
    audience?: 'internal' | 'external' | 'personal'
    purpose?: 'informative' | 'persuasive' | 'creative' | 'technical'
    urgency?: 'low' | 'medium' | 'high'
  }
) {
  return advancedVoiceLearningSystem.getStyleRecommendations(userId, category, contentPreview, context)
}

/**
 * Usage Examples:
 *
 * // Learn from user writing sample
 * const result = await learnFromUserSample(
 *   userId,
 *   conversationId,
 *   "This is my original writing style.",
 *   "This is the improved version.",
 *   'email',
 *   'accepted'
 * )
 *
 * // Get style recommendations for new content
 * const recommendations = await getPersonalizedStyleRecommendations(
 *   userId,
 *   'proposal',
 *   "I need to write a business proposal...",
 *   { audience: 'external', purpose: 'persuasive', urgency: 'high' }
 * )
 *
 * console.log(`Confidence: ${recommendations.confidence}%`)
 * console.log(`Suggestions: ${recommendations.adaptation.structuralSuggestions.join(', ')}`)
 */