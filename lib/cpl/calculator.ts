interface CPLMetrics {
  lexicalDiversity: number
  sentenceComplexity: number
  formalityLevel: number
  coherence: number
}

interface CPLResult {
  score: number
  metrics: CPLMetrics
  breakdown: {
    lexicalContribution: number
    complexityContribution: number
    formalityContribution: number
    coherenceContribution: number
  }
}

export class CPLCalculator {
  /**
   * Calculate the main CPL score for content
   */
  static calculate(content: string, userHistory: string[] = []): number {
    const result = this.calculateDetailed(content, userHistory)
    return result.score
  }

  /**
   * Calculate detailed CPL metrics and breakdown
   */
  static calculateDetailed(content: string, userHistory: string[] = []): CPLResult {
    const baseMetrics = this.calculateBaseMetrics(content)
    const contextualAdjustment = userHistory.length > 0
      ? this.calculateContextualAdjustment(baseMetrics, userHistory)
      : 0

    // Weighted scoring system
    const lexicalContribution = baseMetrics.lexicalDiversity * 0.30
    const complexityContribution = baseMetrics.sentenceComplexity * 0.25
    const formalityContribution = baseMetrics.formalityLevel * 0.25
    const coherenceContribution = baseMetrics.coherence * 0.20

    const rawScore = lexicalContribution + complexityContribution +
                     formalityContribution + coherenceContribution +
                     contextualAdjustment

    const finalScore = Math.round(Math.min(100, Math.max(0, rawScore)))

    return {
      score: finalScore,
      metrics: baseMetrics,
      breakdown: {
        lexicalContribution,
        complexityContribution,
        formalityContribution,
        coherenceContribution
      }
    }
  }

  /**
   * Calculate base metrics for text analysis
   */
  static calculateBaseMetrics(content: string): CPLMetrics {
    return {
      lexicalDiversity: this.calculateTTR(content),
      sentenceComplexity: this.calculateSentenceComplexity(content),
      formalityLevel: this.calculateFormality(content),
      coherence: this.calculateCoherence(content)
    }
  }

  /**
   * Calculate Type-Token Ratio (TTR) for lexical diversity
   */
  private static calculateTTR(text: string): number {
    if (!text || text.trim().length === 0) return 0

    // Normalize text: remove punctuation, convert to lowercase
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0)

    if (words.length === 0) return 0

    const uniqueWords = new Set(words)
    const ttr = uniqueWords.size / words.length

    // Apply Moving Average Type-Token Ratio (MATTR) for longer texts
    if (words.length > 100) {
      return this.calculateMATTR(words)
    }

    // Normalize TTR to 0-100 scale
    // Typical TTR ranges: 0.3-0.8, with higher values indicating more diversity
    return Math.min(100, Math.max(0, (ttr - 0.3) * 200))
  }

  /**
   * Calculate Moving Average Type-Token Ratio for longer texts
   */
  private static calculateMATTR(words: string[], windowSize: number = 50): number {
    if (words.length < windowSize) {
      const uniqueWords = new Set(words)
      return Math.min(100, Math.max(0, ((uniqueWords.size / words.length) - 0.3) * 200))
    }

    let totalTTR = 0
    let windowCount = 0

    for (let i = 0; i <= words.length - windowSize; i += 10) {
      const window = words.slice(i, i + windowSize)
      const uniqueInWindow = new Set(window)
      const windowTTR = uniqueInWindow.size / windowSize
      totalTTR += windowTTR
      windowCount++
    }

    const avgTTR = totalTTR / windowCount
    return Math.min(100, Math.max(0, (avgTTR - 0.3) * 200))
  }

  /**
   * Calculate sentence complexity score
   */
  private static calculateSentenceComplexity(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length === 0) return 0

    let totalComplexityScore = 0

    sentences.forEach(sentence => {
      const words = sentence.trim().split(/\s+/)
      const wordCount = words.length

      // Length complexity scoring
      let lengthScore = this.calculateLengthComplexity(wordCount)

      // Structural complexity scoring
      const structuralScore = this.analyzeStructuralComplexity(sentence)

      // Syntactic complexity scoring
      const syntacticScore = this.analyzeSyntacticComplexity(sentence)

      // Combined sentence complexity (weighted average)
      const sentenceComplexity = (lengthScore * 0.4) + (structuralScore * 0.35) + (syntacticScore * 0.25)
      totalComplexityScore += sentenceComplexity
    })

    return totalComplexityScore / sentences.length
  }

  /**
   * Calculate length complexity based on word count
   */
  private static calculateLengthComplexity(wordCount: number): number {
    // Optimal complexity curve based on psycholinguistic research
    if (wordCount >= 15 && wordCount <= 25) {
      return 100 // Optimal range
    } else if (wordCount >= 10 && wordCount <= 30) {
      return 85 // Good range
    } else if (wordCount >= 8 && wordCount <= 35) {
      return 70 // Acceptable range
    } else if (wordCount >= 5 && wordCount <= 40) {
      return 55 // Suboptimal range
    } else {
      return 30 // Poor range (too short or too long)
    }
  }

  /**
   * Analyze structural complexity of sentences
   */
  private static analyzeStructuralComplexity(sentence: string): number {
    let score = 40 // Base score

    // Subordinate clauses (complexity indicators)
    const subordinateMarkers = [
      'because', 'although', 'while', 'since', 'whereas', 'if', 'when',
      'that', 'which', 'who', 'where', 'unless', 'until', 'before', 'after',
      'though', 'even though', 'provided that', 'in order that'
    ]

    const subordinateClauses = subordinateMarkers.filter(marker =>
      new RegExp(`\\b${marker}\\b`, 'i').test(sentence)
    ).length

    score += Math.min(30, subordinateClauses * 12)

    // Coordinating conjunctions
    const coordinatingConjunctions = ['and', 'but', 'or', 'nor', 'for', 'yet', 'so']
    const coordinates = coordinatingConjunctions.filter(conj =>
      new RegExp(`\\b${conj}\\b`, 'i').test(sentence)
    ).length

    score += Math.min(20, coordinates * 8)

    // Passive voice construction
    const passiveMarkers = /\b(is|are|was|were|being|been|be)\s+\w*ed\b/gi
    const passiveMatches = sentence.match(passiveMarkers)
    if (passiveMatches) {
      score += Math.min(15, passiveMatches.length * 6)
    }

    // Relative clauses
    const relativePronouns = /\b(who|whom|whose|which|that)\b/gi
    const relativeMatches = sentence.match(relativePronouns)
    if (relativeMatches) {
      score += Math.min(15, relativeMatches.length * 5)
    }

    return Math.min(100, score)
  }

  /**
   * Analyze syntactic complexity
   */
  private static analyzeSyntacticComplexity(sentence: string): number {
    let score = 30 // Base score

    // Prepositional phrases
    const prepositions = [
      'of', 'in', 'to', 'for', 'with', 'by', 'from', 'about', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between', 'among', 'against'
    ]

    const prepositionalPhrases = prepositions.filter(prep =>
      new RegExp(`\\b${prep}\\s+\\w+`, 'i').test(sentence)
    ).length

    score += Math.min(25, prepositionalPhrases * 3)

    // Modal verbs (complexity indicators)
    const modals = ['could', 'should', 'would', 'might', 'may', 'must', 'ought']
    const modalCount = modals.filter(modal =>
      new RegExp(`\\b${modal}\\b`, 'i').test(sentence)
    ).length

    score += modalCount * 4

    // Gerunds and participles
    const gerundPattern = /\b\w+ing\b/g
    const gerundMatches = sentence.match(gerundPattern)
    if (gerundMatches) {
      score += Math.min(20, gerundMatches.length * 2)
    }

    // Complex punctuation usage
    const complexPunctuation = /[;:()—]/g
    const punctuationMatches = sentence.match(complexPunctuation)
    if (punctuationMatches) {
      score += Math.min(15, punctuationMatches.length * 3)
    }

    return Math.min(100, score)
  }

  /**
   * Calculate formality level of the text
   */
  private static calculateFormality(text: string): number {
    let formalityScore = 50 // Neutral baseline

    // Formal vocabulary indicators
    const formalWords = [
      'therefore', 'furthermore', 'consequently', 'nevertheless', 'moreover',
      'subsequently', 'accordingly', 'specifically', 'particularly', 'essentially',
      'establish', 'demonstrate', 'indicate', 'suggest', 'recommend', 'propose',
      'analysis', 'evaluation', 'assessment', 'implementation', 'methodology',
      'facilitate', 'utilize', 'commence', 'terminate', 'endeavor', 'ascertain',
      'substantial', 'comprehensive', 'significant', 'considerable', 'adequate',
      'preliminary', 'subsequent', 'concurrent', 'respective', 'predominant'
    ]

    const formalMatches = formalWords.filter(word =>
      new RegExp(`\\b${word}`, 'i').test(text)
    ).length

    formalityScore += Math.min(30, formalMatches * 2)

    // Informal indicators (reduce formality)
    const informalWords = [
      'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'yeah', 'ok', 'okay',
      'stuff', 'things', 'get', 'got', 'really', 'very', 'pretty', 'quite',
      'awesome', 'cool', 'great', 'amazing', 'super', 'totally', 'basically',
      'actually', 'like', 'you know', 'I mean', 'whatever', 'anyway'
    ]

    const informalMatches = informalWords.filter(word =>
      new RegExp(`\\b${word}\\b`, 'i').test(text)
    ).length

    formalityScore -= Math.min(25, informalMatches * 2)

    // Contractions (reduce formality)
    const contractions = text.match(/\w+'\w+/g) || []
    formalityScore -= Math.min(15, contractions.length * 1.5)

    // First person usage (context-dependent formality reduction)
    const firstPerson = text.match(/\b(I|me|my|mine|myself)\b/gi) || []
    formalityScore -= Math.min(10, firstPerson.length * 0.8)

    // Academic/technical terms (increase formality)
    const academicTerms = [
      'hypothesis', 'methodology', 'empirical', 'theoretical', 'paradigm',
      'systematic', 'comprehensive', 'rigorous', 'substantial', 'significant',
      'correlation', 'causation', 'phenomenon', 'criteria', 'parameter'
    ]

    const academicMatches = academicTerms.filter(term =>
      new RegExp(`\\b${term}`, 'i').test(text)
    ).length

    formalityScore += Math.min(20, academicMatches * 3)

    return Math.min(100, Math.max(0, formalityScore))
  }

  /**
   * Calculate coherence score based on textual cohesion
   */
  private static calculateCoherence(text: string): number {
    let coherenceScore = 40 // Base score

    // Transition words and phrases
    const transitionWords = [
      'however', 'therefore', 'furthermore', 'moreover', 'nevertheless',
      'consequently', 'additionally', 'similarly', 'likewise', 'in contrast',
      'on the other hand', 'for example', 'for instance', 'in conclusion',
      'first', 'second', 'third', 'finally', 'next', 'then', 'meanwhile',
      'subsequently', 'as a result', 'in addition', 'despite this', 'although'
    ]

    const transitions = transitionWords.filter(transition =>
      new RegExp(`\\b${transition}\\b`, 'i').test(text)
    ).length

    coherenceScore += Math.min(25, transitions * 4)

    // Lexical cohesion through repetition
    const words = text.toLowerCase().split(/\s+/)
    const contentWords = words.filter(word =>
      word.length > 4 && !this.isStopWord(word)
    )

    const wordFreq = new Map()
    contentWords.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    })

    const repeatedTerms = Array.from(wordFreq.values()).filter(freq => freq > 1)
    coherenceScore += Math.min(20, repeatedTerms.length * 2)

    // Pronoun reference chains
    const pronouns = text.match(/\b(this|that|these|those|it|they|them|such)\b/gi) || []
    coherenceScore += Math.min(15, pronouns.length * 1.5)

    // Paragraph/sentence structure coherence
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length > 1) {
      coherenceScore += 10 // Bonus for multi-sentence structure

      // Check for consistent tense usage
      const tenseConsistency = this.analyzeTenseConsistency(sentences)
      coherenceScore += tenseConsistency * 10
    }

    return Math.min(100, coherenceScore)
  }

  /**
   * Analyze tense consistency across sentences
   */
  private static analyzeTenseConsistency(sentences: string[]): number {
    const pastTenseMarkers = /\b\w+ed\b|\bwas\b|\bwere\b|\bhad\b/gi
    const presentTenseMarkers = /\bis\b|\bare\b|\bhave\b|\bhas\b/gi
    const futureTenseMarkers = /\bwill\b|\bshall\b|\bgoing to\b/gi

    let pastCount = 0
    let presentCount = 0
    let futureCount = 0

    sentences.forEach(sentence => {
      if (pastTenseMarkers.test(sentence)) pastCount++
      if (presentTenseMarkers.test(sentence)) presentCount++
      if (futureTenseMarkers.test(sentence)) futureCount++
    })

    const totalTenseMarkers = pastCount + presentCount + futureCount
    if (totalTenseMarkers === 0) return 0.5

    const dominantTenseCount = Math.max(pastCount, presentCount, futureCount)
    return dominantTenseCount / totalTenseMarkers
  }

  /**
   * Check if word is a stop word
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
      'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ])

    return stopWords.has(word.toLowerCase())
  }

  /**
   * Calculate contextual adjustment based on user history
   */
  private static calculateContextualAdjustment(
    currentMetrics: CPLMetrics,
    userHistory: string[]
  ): number {
    if (userHistory.length === 0) return 0

    // Calculate user's average historical CPL
    const historicalScores = userHistory.map(text => this.calculate(text))
    const avgHistoricalCPL = historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length

    // Calculate current text's raw score
    const currentRawScore = (
      currentMetrics.lexicalDiversity * 0.30 +
      currentMetrics.sentenceComplexity * 0.25 +
      currentMetrics.formalityLevel * 0.25 +
      currentMetrics.coherence * 0.20
    )

    // Apply contextual adjustment (smaller weight to avoid over-correction)
    const difference = avgHistoricalCPL - currentRawScore
    return difference * 0.1 // 10% weight for historical context
  }

  /**
   * Utility method to get CPL description
   */
  static getCPLDescription(score: number): string {
    if (score < 20) return 'Very Simple'
    if (score < 40) return 'Simple'
    if (score < 60) return 'Moderate'
    if (score < 80) return 'Complex'
    return 'Very Complex'
  }

  /**
   * Get detailed breakdown for debugging/analysis
   */
  static getDetailedAnalysis(content: string): any {
    const result = this.calculateDetailed(content)
    return {
      finalScore: result.score,
      description: this.getCPLDescription(result.score),
      metrics: result.metrics,
      breakdown: result.breakdown,
      wordCount: content.split(/\s+/).length,
      sentenceCount: content.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
      avgWordsPerSentence: content.split(/\s+/).length / Math.max(1, content.split(/[.!?]+/).filter(s => s.trim().length > 0).length)
    }
  }
}

// Export for backwards compatibility
export const calculateCPL = CPLCalculator.calculate