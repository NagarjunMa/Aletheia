// AI Utility Functions
// Created: December 7, 2024
// Purpose: Utility functions for AI processing, validation, and error handling

import { validateApiKey, estimateTokens, estimateCost } from './claude'
import type { CPLAnalysis } from './claude'

// Content validation and sanitization
export function sanitizeTextInput(text: string): string {
  return text
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .slice(0, 10000) // Enforce max length
}

export function validateTextInput(text: string): { valid: boolean; error?: string } {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'Text is required' }
  }

  const sanitized = sanitizeTextInput(text)

  if (sanitized.length === 0) {
    return { valid: false, error: 'Text cannot be empty' }
  }

  if (sanitized.length < 10) {
    return { valid: false, error: 'Text must be at least 10 characters' }
  }

  if (sanitized.length > 10000) {
    return { valid: false, error: 'Text cannot exceed 10,000 characters' }
  }

  // Check for potentially harmful content
  if (containsHarmfulContent(sanitized)) {
    return { valid: false, error: 'Text contains inappropriate content' }
  }

  return { valid: true }
}

// Content safety checks
export function containsHarmfulContent(text: string): boolean {
  const harmfulPatterns = [
    // Basic harmful patterns - this would be more sophisticated in production
    /hack|crack|exploit/i,
    /password|secret|token|key/i,
    /suicide|self.?harm|kill.?yourself/i,
    /fraud|scam|phishing/i,
  ]

  return harmfulPatterns.some(pattern => pattern.test(text))
}

// Processing status utilities
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export function isValidProcessingStatus(status: string): status is ProcessingStatus {
  return ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status)
}

export function getStatusMessage(status: ProcessingStatus): string {
  const messages = {
    pending: 'Waiting to be processed',
    processing: 'Processing with AI...',
    completed: 'Processing completed successfully',
    failed: 'Processing failed',
    cancelled: 'Processing was cancelled',
  }

  return messages[status] || 'Unknown status'
}

// CPL scoring utilities
export function validateCPLScore(score: number): { valid: boolean; error?: string } {
  if (typeof score !== 'number') {
    return { valid: false, error: 'CPL score must be a number' }
  }

  if (isNaN(score)) {
    return { valid: false, error: 'CPL score cannot be NaN' }
  }

  if (score < 1 || score > 100) {
    return { valid: false, error: 'CPL score must be between 1 and 100' }
  }

  return { valid: true }
}

export function getCPLScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Very Good'
  if (score >= 70) return 'Good'
  if (score >= 60) return 'Fair'
  if (score >= 50) return 'Needs Improvement'
  return 'Poor'
}

export function getCPLScoreColor(score: number): string {
  if (score >= 80) return 'green'
  if (score >= 70) return 'blue'
  if (score >= 60) return 'yellow'
  if (score >= 50) return 'orange'
  return 'red'
}

export function calculateCPLImprovement(oldScore: number, newScore: number): {
  improvement: number
  percentage: number
  direction: 'improved' | 'declined' | 'unchanged'
} {
  const improvement = newScore - oldScore
  const percentage = oldScore > 0 ? (improvement / oldScore) * 100 : 0

  let direction: 'improved' | 'declined' | 'unchanged' = 'unchanged'
  if (improvement > 0) direction = 'improved'
  else if (improvement < 0) direction = 'declined'

  return {
    improvement,
    percentage: Math.round(percentage * 10) / 10,
    direction,
  }
}

// Text analysis utilities
export function analyzeTextComplexity(text: string) {
  const words = text.split(/\s+/).filter(word => word.length > 0)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)

  // Calculate readability metrics
  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0
  const avgSyllablesPerWord = calculateAverageSyllables(words)

  // Flesch Reading Ease approximation
  const fleschScore = Math.max(0, Math.min(100,
    206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)
  ))

  // Complexity categories
  let complexityLevel = 'Medium'
  if (fleschScore >= 70) complexityLevel = 'Easy'
  else if (fleschScore >= 50) complexityLevel = 'Medium'
  else if (fleschScore >= 30) complexityLevel = 'Hard'
  else complexityLevel = 'Very Hard'

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
    fleschScore: Math.round(fleschScore),
    complexityLevel,
    estimatedReadingTimeMinutes: Math.ceil(words.length / 200), // Average reading speed
  }
}

function calculateAverageSyllables(words: string[]): number {
  if (words.length === 0) return 0

  const totalSyllables = words.reduce((sum, word) => {
    return sum + countSyllables(word.toLowerCase().replace(/[^a-z]/g, ''))
  }, 0)

  return totalSyllables / words.length
}

function countSyllables(word: string): number {
  if (word.length === 0) return 0

  // Simple syllable counting algorithm
  word = word.toLowerCase()
  let syllables = 0
  let previousWasVowel = false

  const vowels = 'aeiouy'

  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i])
    if (isVowel && !previousWasVowel) {
      syllables++
    }
    previousWasVowel = isVowel
  }

  // Handle silent e
  if (word.endsWith('e')) {
    syllables--
  }

  // Ensure at least one syllable
  return Math.max(1, syllables)
}

// Processing queue management
export interface ProcessingQueueItem {
  id: string
  userId: string
  inputId: string
  draftType: 'grammar_fix' | 'adaptive_polish'
  priority: number
  createdAt: Date
  estimatedTokens: number
}

export function calculateProcessingPriority(
  user: any,
  draftType: 'grammar_fix' | 'adaptive_polish',
  textLength: number
): number {
  let priority = 50 // Base priority

  // Premium users get higher priority
  if (user?.subscription_tier === 'premium') {
    priority += 30
  }

  // Grammar fixes are higher priority than adaptive polish
  if (draftType === 'grammar_fix') {
    priority += 10
  }

  // Shorter texts get slightly higher priority
  if (textLength < 1000) {
    priority += 5
  }

  // Long-time users get slight boost
  const accountAgeMonths = user?.created_at
    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0

  if (accountAgeMonths > 6) {
    priority += 5
  }

  return Math.min(100, Math.max(1, priority))
}

// Error handling utilities
export interface AIError {
  code: string
  message: string
  details?: any
  retryable: boolean
  suggestedAction?: string
}

export function createAIError(
  code: string,
  message: string,
  details?: any,
  retryable = false,
  suggestedAction?: string
): AIError {
  return {
    code,
    message,
    details,
    retryable,
    suggestedAction,
  }
}

export function handleAIError(error: any): AIError {
  if (error.status === 400) {
    return createAIError(
      'INVALID_REQUEST',
      'The request was invalid. Please check your input.',
      error,
      false,
      'Review your text and try again.'
    )
  }

  if (error.status === 401) {
    return createAIError(
      'UNAUTHORIZED',
      'API authentication failed.',
      error,
      false,
      'Please check your API configuration.'
    )
  }

  if (error.status === 429) {
    return createAIError(
      'RATE_LIMIT',
      'Too many requests. Please wait before trying again.',
      error,
      true,
      'Wait a few moments and retry.'
    )
  }

  if (error.status === 500) {
    return createAIError(
      'SERVER_ERROR',
      'AI service temporarily unavailable.',
      error,
      true,
      'Try again in a few minutes.'
    )
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return createAIError(
      'NETWORK_ERROR',
      'Network connection failed.',
      error,
      true,
      'Check your internet connection and try again.'
    )
  }

  if (error.code === 'TIMEOUT') {
    return createAIError(
      'TIMEOUT',
      'Processing took too long and was cancelled.',
      error,
      true,
      'Try processing a shorter text or retry later.'
    )
  }

  return createAIError(
    'UNKNOWN_ERROR',
    'An unexpected error occurred.',
    error,
    true,
    'Please try again or contact support if the issue persists.'
  )
}

// Configuration validation
export function validateAIConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check API key
  if (!validateApiKey()) {
    errors.push('Invalid or missing Anthropic API key')
  }

  // Check environment variables
  const requiredEnvVars = [
    'ANTHROPIC_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing environment variable: ${envVar}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Performance monitoring
export interface PerformanceMetrics {
  processingTime: number
  tokenCount: number
  cplScore?: number
  success: boolean
  errorCode?: string
}

export function trackPerformance(metrics: PerformanceMetrics) {
  // Log performance metrics
  console.log('AI Performance Metrics:', {
    ...metrics,
    timestamp: new Date().toISOString(),
  })

  // In production, you might want to send this to an analytics service
  // like DataDog, New Relic, or a custom analytics endpoint
}

// Cost calculation utilities
export function calculateProcessingCost(
  inputTokens: number,
  outputTokens: number,
  model = 'claude-3-5-sonnet'
): number {
  const pricing = {
    'claude-3-5-sonnet': {
      input: 0.003, // $3 per 1M tokens
      output: 0.015, // $15 per 1M tokens
    },
  }

  const modelPricing = pricing[model as keyof typeof pricing]
  if (!modelPricing) {
    return 0
  }

  return (
    (inputTokens / 1000) * modelPricing.input +
    (outputTokens / 1000) * modelPricing.output
  )
}

export function formatCost(cost: number): string {
  if (cost < 0.001) {
    return '<$0.001'
  }

  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }

  return `$${cost.toFixed(3)}`
}

// Usage limits and quotas
export interface UsageQuota {
  dailyTokenLimit: number
  monthlyTokenLimit: number
  dailyCostLimit: number
  monthlyCostLimit: number
}

export function getDefaultQuota(userTier: 'free' | 'premium' | 'enterprise'): UsageQuota {
  const quotas = {
    free: {
      dailyTokenLimit: 100000, // 100k tokens per day
      monthlyTokenLimit: 1000000, // 1M tokens per month
      dailyCostLimit: 5.00, // $5 per day
      monthlyCostLimit: 50.00, // $50 per month
    },
    premium: {
      dailyTokenLimit: 500000, // 500k tokens per day
      monthlyTokenLimit: 10000000, // 10M tokens per month
      dailyCostLimit: 25.00, // $25 per day
      monthlyCostLimit: 250.00, // $250 per month
    },
    enterprise: {
      dailyTokenLimit: 2000000, // 2M tokens per day
      monthlyTokenLimit: 50000000, // 50M tokens per month
      dailyCostLimit: 100.00, // $100 per day
      monthlyCostLimit: 1000.00, // $1000 per month
    },
  }

  return quotas[userTier]
}

export function checkUsageQuota(
  currentUsage: { tokens: number; cost: number },
  quota: UsageQuota,
  period: 'daily' | 'monthly'
): { allowed: boolean; reason?: string } {
  const tokenLimit = period === 'daily' ? quota.dailyTokenLimit : quota.monthlyTokenLimit
  const costLimit = period === 'daily' ? quota.dailyCostLimit : quota.monthlyCostLimit

  if (currentUsage.tokens >= tokenLimit) {
    return {
      allowed: false,
      reason: `${period} token limit exceeded (${currentUsage.tokens}/${tokenLimit})`
    }
  }

  if (currentUsage.cost >= costLimit) {
    return {
      allowed: false,
      reason: `${period} cost limit exceeded ($${currentUsage.cost.toFixed(2)}/$${costLimit.toFixed(2)})`
    }
  }

  return { allowed: true }
}