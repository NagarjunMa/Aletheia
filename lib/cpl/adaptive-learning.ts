import { CPLCalculator } from './calculator'

interface DraftFeedback {
  id: string
  content: string
  draftType: 'grammar_fix' | 'adaptive_polish'
  cplScore: number
  accepted: boolean
  userEdits?: string
  timestamp: Date
  category?: string
}

interface CPLAdaptation {
  complexityAdjustment: number
  formalityAdjustment: number
  lengthAdjustment: number
  vocabularyAdjustment: number
}

interface EditAnalysis {
  formalityChange: number
  lengthChange: number
  complexityChange: number
  vocabularyChange: number
  editCount: number
  editTypes: string[]
}

interface LearningInsight {
  pattern: string
  confidence: number
  recommendation: string
  impact: number
}

interface AdaptationResult {
  newCPL: number
  adjustments: CPLAdaptation
  insights: LearningInsight[]
  confidence: number
}

export class AdaptiveLearningSystem {
  /**
   * Adapt user's CPL based on feedback patterns
   */
  async adaptUserCPL(userId: string, feedbackHistory: DraftFeedback[]): Promise<AdaptationResult> {
    console.log(`Adapting CPL for user ${userId} with ${feedbackHistory.length} feedback entries`)

    const currentCPL = await this.getCurrentCPL(userId)
    const recentFeedback = this.getRecentFeedback(feedbackHistory, 15) // Last 15 interactions

    if (recentFeedback.length < 3) {
      console.log('Insufficient feedback data for adaptation')
      return {
        newCPL: currentCPL,
        adjustments: this.getZeroAdjustment(),
        insights: [],
        confidence: 0
      }
    }

    // Calculate adaptation based on multiple factors
    const adaptation = this.calculateComprehensiveAdaptation(recentFeedback, currentCPL)
    const insights = this.generateLearningInsights(recentFeedback, adaptation)

    // Apply adaptation with confidence weighting
    const newCPL = this.applyAdaptation(currentCPL, adaptation, insights)

    // Calculate confidence in this adaptation
    const confidence = this.calculateConfidence(recentFeedback, adaptation)

    await this.updateUserCPL(userId, newCPL, adaptation, insights)

    return {
      newCPL,
      adjustments: adaptation,
      insights,
      confidence
    }
  }

  /**
   * Calculate comprehensive adaptation based on all feedback patterns
   */
  private calculateComprehensiveAdaptation(
    feedback: DraftFeedback[],
    currentCPL: number
  ): CPLAdaptation {
    let complexityAdjustment = 0
    let formalityAdjustment = 0
    let lengthAdjustment = 0
    let vocabularyAdjustment = 0

    const weights = {
      acceptance: 0.4,    // Weight for accept/reject patterns
      editing: 0.3,       // Weight for user edit analysis
      consistency: 0.2,   // Weight for consistent preferences
      recency: 0.1        // Weight for recent feedback
    }

    // Analyze acceptance patterns
    const acceptanceAnalysis = this.analyzeAcceptancePatterns(feedback, currentCPL)
    complexityAdjustment += acceptanceAnalysis.complexityTrend * weights.acceptance
    formalityAdjustment += acceptanceAnalysis.formalityTrend * weights.acceptance

    // Analyze user edit patterns
    const editAnalysis = this.analyzeEditPatterns(feedback)
    complexityAdjustment += editAnalysis.complexityChange * weights.editing
    formalityAdjustment += editAnalysis.formalityChange * weights.editing
    lengthAdjustment += editAnalysis.lengthChange * weights.editing
    vocabularyAdjustment += editAnalysis.vocabularyChange * weights.editing

    // Analyze consistency patterns
    const consistencyAnalysis = this.analyzeConsistencyPatterns(feedback)
    complexityAdjustment += consistencyAnalysis.preferredComplexityShift * weights.consistency
    formalityAdjustment += consistencyAnalysis.preferredFormalityShift * weights.consistency

    // Apply recency weighting
    const recentBias = this.calculateRecentBias(feedback)
    complexityAdjustment += recentBias.complexityBias * weights.recency
    formalityAdjustment += recentBias.formalityBias * weights.recency

    // Normalize adjustments to prevent extreme changes
    return {
      complexityAdjustment: this.normalizeAdjustment(complexityAdjustment),
      formalityAdjustment: this.normalizeAdjustment(formalityAdjustment),
      lengthAdjustment: this.normalizeAdjustment(lengthAdjustment),
      vocabularyAdjustment: this.normalizeAdjustment(vocabularyAdjustment)
    }
  }

  /**
   * Analyze acceptance/rejection patterns
   */
  private analyzeAcceptancePatterns(
    feedback: DraftFeedback[],
    currentCPL: number
  ): { complexityTrend: number; formalityTrend: number } {
    const adaptivePolishFeedback = feedback.filter(fb => fb.draftType === 'adaptive_polish')

    let complexityTrend = 0
    let formalityTrend = 0

    adaptivePolishFeedback.forEach(fb => {
      const draftCPL = fb.cplScore
      const cplDifference = draftCPL - currentCPL

      if (fb.accepted) {
        // User accepted this complexity level - move toward it
        if (Math.abs(cplDifference) > 5) {
          complexityTrend += cplDifference * 0.1
        } else {
          // Small difference - reinforce current level
          complexityTrend += 0.2
        }
      } else {
        // User rejected this complexity level - move away
        complexityTrend -= cplDifference * 0.15
      }

      // Analyze formality specifically
      const contentMetrics = CPLCalculator.calculateBaseMetrics(fb.content)
      if (fb.accepted && contentMetrics.formalityLevel > 60) {
        formalityTrend += 1
      } else if (!fb.accepted && contentMetrics.formalityLevel > 60) {
        formalityTrend -= 1.5
      }
    })

    return {
      complexityTrend: complexityTrend / Math.max(1, adaptivePolishFeedback.length),
      formalityTrend: formalityTrend / Math.max(1, adaptivePolishFeedback.length)
    }
  }

  /**
   * Analyze patterns in user edits
   */
  private analyzeEditPatterns(feedback: DraftFeedback[]): EditAnalysis {
    const editedFeedback = feedback.filter(fb => fb.userEdits && fb.userEdits !== fb.content)

    if (editedFeedback.length === 0) {
      return {
        formalityChange: 0,
        lengthChange: 0,
        complexityChange: 0,
        vocabularyChange: 0,
        editCount: 0,
        editTypes: []
      }
    }

    let totalFormalityChange = 0
    let totalLengthChange = 0
    let totalComplexityChange = 0
    let totalVocabularyChange = 0
    const editTypes = new Set<string>()

    editedFeedback.forEach(fb => {
      const originalMetrics = CPLCalculator.calculateBaseMetrics(fb.content)
      const editedMetrics = CPLCalculator.calculateBaseMetrics(fb.userEdits!)

      totalFormalityChange += editedMetrics.formalityLevel - originalMetrics.formalityLevel
      totalComplexityChange += editedMetrics.sentenceComplexity - originalMetrics.sentenceComplexity
      totalVocabularyChange += editedMetrics.lexicalDiversity - originalMetrics.lexicalDiversity

      const lengthChange = ((fb.userEdits!.length - fb.content.length) / fb.content.length) * 100
      totalLengthChange += lengthChange

      // Identify edit types
      const edits = this.identifyEditTypes(fb.content, fb.userEdits!)
      edits.forEach(edit => editTypes.add(edit))
    })

    const count = editedFeedback.length
    return {
      formalityChange: totalFormalityChange / count,
      lengthChange: totalLengthChange / count,
      complexityChange: totalComplexityChange / count,
      vocabularyChange: totalVocabularyChange / count,
      editCount: count,
      editTypes: Array.from(editTypes)
    }
  }

  /**
   * Identify types of edits user commonly makes
   */
  private identifyEditTypes(original: string, edited: string): string[] {
    const types: string[] = []

    // Length changes
    const lengthRatio = edited.length / original.length
    if (lengthRatio > 1.2) types.push('expansion')
    else if (lengthRatio < 0.8) types.push('contraction')

    // Vocabulary changes
    const originalWords = new Set(original.toLowerCase().split(/\s+/))
    const editedWords = new Set(edited.toLowerCase().split(/\s+/))
    const newWords = [...editedWords].filter(w => !originalWords.has(w))

    if (newWords.length > originalWords.size * 0.2) {
      types.push('vocabulary-enhancement')
    }

    // Structure changes
    const originalSentences = original.split(/[.!?]+/).length
    const editedSentences = edited.split(/[.!?]+/).length

    if (editedSentences > originalSentences * 1.2) {
      types.push('sentence-splitting')
    } else if (editedSentences < originalSentences * 0.8) {
      types.push('sentence-combining')
    }

    // Formality changes
    const originalFormality = CPLCalculator.calculateBaseMetrics(original).formalityLevel
    const editedFormality = CPLCalculator.calculateBaseMetrics(edited).formalityLevel

    if (editedFormality > originalFormality + 10) {
      types.push('formality-increase')
    } else if (editedFormality < originalFormality - 10) {
      types.push('formality-decrease')
    }

    return types
  }

  /**
   * Analyze consistency in user preferences
   */
  private analyzeConsistencyPatterns(feedback: DraftFeedback[]): {
    preferredComplexityShift: number
    preferredFormalityShift: number
  } {
    if (feedback.length < 5) {
      return { preferredComplexityShift: 0, preferredFormalityShift: 0 }
    }

    // Group feedback by category for more accurate analysis
    const categoryGroups = this.groupFeedbackByCategory(feedback)

    let totalComplexityShift = 0
    let totalFormalityShift = 0
    let groupCount = 0

    Object.entries(categoryGroups).forEach(([category, categoryFeedback]) => {
      if (categoryFeedback.length >= 3) {
        const shifts = this.analyzeGroupPreferences(categoryFeedback)
        totalComplexityShift += shifts.complexityShift
        totalFormalityShift += shifts.formalityShift
        groupCount++
      }
    })

    return {
      preferredComplexityShift: groupCount > 0 ? totalComplexityShift / groupCount : 0,
      preferredFormalityShift: groupCount > 0 ? totalFormalityShift / groupCount : 0
    }
  }

  /**
   * Group feedback by category for targeted analysis
   */
  private groupFeedbackByCategory(feedback: DraftFeedback[]): Record<string, DraftFeedback[]> {
    const groups: Record<string, DraftFeedback[]> = {}

    feedback.forEach(fb => {
      const category = fb.category || 'general'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(fb)
    })

    return groups
  }

  /**
   * Analyze preferences within a group
   */
  private analyzeGroupPreferences(groupFeedback: DraftFeedback[]): {
    complexityShift: number
    formalityShift: number
  } {
    const acceptedDrafts = groupFeedback.filter(fb => fb.accepted)
    const rejectedDrafts = groupFeedback.filter(fb => !fb.accepted)

    if (acceptedDrafts.length === 0) {
      return { complexityShift: 0, formalityShift: 0 }
    }

    const acceptedCPLs = acceptedDrafts.map(fb => fb.cplScore)
    const rejectedCPLs = rejectedDrafts.map(fb => fb.cplScore)

    const avgAcceptedCPL = acceptedCPLs.reduce((a, b) => a + b, 0) / acceptedCPLs.length
    const avgRejectedCPL = rejectedCPLs.length > 0
      ? rejectedCPLs.reduce((a, b) => a + b, 0) / rejectedCPLs.length
      : avgAcceptedCPL

    return {
      complexityShift: (avgAcceptedCPL - avgRejectedCPL) * 0.1,
      formalityShift: 0 // Calculate formality-specific preferences
    }
  }

  /**
   * Calculate recent feedback bias
   */
  private calculateRecentBias(feedback: DraftFeedback[]): {
    complexityBias: number
    formalityBias: number
  } {
    const sortedFeedback = feedback.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    const recentFeedback = sortedFeedback.slice(0, Math.min(5, feedback.length))

    const recentAcceptanceRate = recentFeedback.filter(fb => fb.accepted).length / recentFeedback.length
    const overallAcceptanceRate = feedback.filter(fb => fb.accepted).length / feedback.length

    const recentTrend = recentAcceptanceRate - overallAcceptanceRate

    return {
      complexityBias: recentTrend * 2, // Amplify recent trends
      formalityBias: recentTrend * 1.5
    }
  }

  /**
   * Generate learning insights from adaptation
   */
  private generateLearningInsights(
    feedback: DraftFeedback[],
    adaptation: CPLAdaptation
  ): LearningInsight[] {
    const insights: LearningInsight[] = []

    // Complexity insights
    if (Math.abs(adaptation.complexityAdjustment) > 2) {
      insights.push({
        pattern: adaptation.complexityAdjustment > 0
          ? 'User prefers more complex content'
          : 'User prefers simpler content',
        confidence: Math.min(90, Math.abs(adaptation.complexityAdjustment) * 10),
        recommendation: adaptation.complexityAdjustment > 0
          ? 'Increase vocabulary richness and sentence complexity'
          : 'Use simpler vocabulary and shorter sentences',
        impact: Math.abs(adaptation.complexityAdjustment)
      })
    }

    // Formality insights
    if (Math.abs(adaptation.formalityAdjustment) > 2) {
      insights.push({
        pattern: adaptation.formalityAdjustment > 0
          ? 'User prefers more formal language'
          : 'User prefers more casual language',
        confidence: Math.min(85, Math.abs(adaptation.formalityAdjustment) * 8),
        recommendation: adaptation.formalityAdjustment > 0
          ? 'Use more professional and formal language'
          : 'Use more conversational and casual language',
        impact: Math.abs(adaptation.formalityAdjustment)
      })
    }

    // Edit pattern insights
    const editAnalysis = this.analyzeEditPatterns(feedback)
    if (editAnalysis.editCount > 0) {
      const commonEditTypes = editAnalysis.editTypes
      if (commonEditTypes.length > 0) {
        insights.push({
          pattern: `User frequently makes ${commonEditTypes.join(', ')} edits`,
          confidence: Math.min(80, editAnalysis.editCount * 15),
          recommendation: `Anticipate and incorporate ${commonEditTypes[0]} preferences`,
          impact: editAnalysis.editCount * 0.5
        })
      }
    }

    return insights.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Apply adaptation with safeguards
   */
  private applyAdaptation(
    currentCPL: number,
    adaptation: CPLAdaptation,
    insights: LearningInsight[]
  ): number {
    const totalAdjustment = (
      adaptation.complexityAdjustment * 0.4 +
      adaptation.formalityAdjustment * 0.3 +
      adaptation.lengthAdjustment * 0.15 +
      adaptation.vocabularyAdjustment * 0.15
    )

    // Apply confidence weighting
    const avgConfidence = insights.length > 0
      ? insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length
      : 50

    const confidenceMultiplier = avgConfidence / 100
    const adjustedChange = totalAdjustment * confidenceMultiplier

    const newCPL = currentCPL + adjustedChange

    // Ensure CPL stays within reasonable bounds and doesn't change too rapidly
    const maxChange = 5 // Maximum change per adaptation
    const boundedCPL = Math.max(
      currentCPL - maxChange,
      Math.min(currentCPL + maxChange, newCPL)
    )

    return Math.max(10, Math.min(90, Math.round(boundedCPL)))
  }

  /**
   * Calculate confidence in adaptation
   */
  private calculateConfidence(
    feedback: DraftFeedback[],
    adaptation: CPLAdaptation
  ): number {
    let confidence = 50 // Base confidence

    // More feedback = higher confidence
    confidence += Math.min(30, feedback.length * 2)

    // Consistent patterns = higher confidence
    const acceptanceRate = feedback.filter(fb => fb.accepted).length / feedback.length
    if (acceptanceRate > 0.7 || acceptanceRate < 0.3) {
      confidence += 15 // Clear patterns
    }

    // Recent feedback = higher confidence
    const recentFeedback = this.getRecentFeedback(feedback, 5)
    confidence += Math.min(15, recentFeedback.length * 3)

    // Moderate adjustments = higher confidence
    const totalAdjustment = Math.abs(adaptation.complexityAdjustment) +
                           Math.abs(adaptation.formalityAdjustment)
    if (totalAdjustment < 3) {
      confidence += 10 // Moderate, conservative adjustments
    }

    return Math.min(95, Math.max(5, confidence))
  }

  /**
   * Normalize adjustment to prevent extreme changes
   */
  private normalizeAdjustment(adjustment: number): number {
    return Math.max(-8, Math.min(8, adjustment))
  }

  /**
   * Get recent feedback within specified count
   */
  private getRecentFeedback(feedback: DraftFeedback[], count: number): DraftFeedback[] {
    return feedback
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, count)
  }

  /**
   * Get zero adjustment object
   */
  private getZeroAdjustment(): CPLAdaptation {
    return {
      complexityAdjustment: 0,
      formalityAdjustment: 0,
      lengthAdjustment: 0,
      vocabularyAdjustment: 0
    }
  }

  /**
   * Get current CPL for user (placeholder for database integration)
   */
  private async getCurrentCPL(userId: string): Promise<number> {
    // This would integrate with your Supabase database
    console.log(`Getting current CPL for user: ${userId}`)
    return 50 // Default CPL
  }

  /**
   * Update user CPL in database
   */
  private async updateUserCPL(
    userId: string,
    newCPL: number,
    adaptation: CPLAdaptation,
    insights: LearningInsight[]
  ): Promise<void> {
    // This would integrate with your Supabase database
    console.log(`Updating CPL for user ${userId} to ${newCPL}`, { adaptation, insights })

    // Log the adaptation for monitoring
    console.log(`User ${userId} CPL adaptation:`, {
      newCPL,
      adjustments: adaptation,
      insightsCount: insights.length,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Generate learning summary for user insights
   */
  generateLearningSummary(feedback: DraftFeedback[]): string {
    const editAnalysis = this.analyzeEditPatterns(feedback)
    const acceptanceRate = feedback.filter(fb => fb.accepted).length / feedback.length

    let summary = `Based on ${feedback.length} interactions:\n`
    summary += `- Acceptance rate: ${Math.round(acceptanceRate * 100)}%\n`

    if (editAnalysis.editCount > 0) {
      summary += `- Common edits: ${editAnalysis.editTypes.join(', ')}\n`
    }

    summary += `- Writing preferences are becoming more refined`

    return summary
  }
}

// Export singleton instance
export const adaptiveLearningSystem = new AdaptiveLearningSystem()