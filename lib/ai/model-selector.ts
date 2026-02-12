// Model Selection Strategy
// Created: January 2025
// Purpose: Intelligent model selection based on operation type and user tier

export enum ModelTier {
  FAST = 'fast',
  QUALITY = 'quality',
  PREMIUM = 'premium'
}

export enum OperationType {
  GRAMMAR_FIX = 'grammar_fix',
  ADAPTIVE_POLISH = 'adaptive_polish',
  CPL_ANALYSIS = 'cpl_analysis',
  CONTEXT_RETRIEVAL = 'context_retrieval',
  QUICK_SCORING = 'quick_scoring',
  COMPLEX_REASONING = 'complex_reasoning'
}

export interface ModelProfile {
  id: string
  name: string
  tier: ModelTier
  costPer1kTokens: number
  avgLatencyMs: number
  maxTokens: number
  bestFor: OperationType[]
  temperature: {
    default: number
    min: number
    max: number
  }
}

// Model profiles with detailed configuration
export const ModelProfiles: Record<string, ModelProfile> = {
  HAIKU: {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    tier: ModelTier.FAST,
    costPer1kTokens: 0.00025,
    avgLatencyMs: 500,
    maxTokens: 4096,
    bestFor: [
      OperationType.GRAMMAR_FIX,
      OperationType.CPL_ANALYSIS,
      OperationType.CONTEXT_RETRIEVAL,
      OperationType.QUICK_SCORING
    ],
    temperature: {
      default: 0.3,
      min: 0.1,
      max: 0.5
    }
  },

  SONNET: {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude 3.5 Sonnet',
    tier: ModelTier.QUALITY,
    costPer1kTokens: 0.003,
    avgLatencyMs: 2000,
    maxTokens: 8192,
    bestFor: [
      OperationType.ADAPTIVE_POLISH,
      OperationType.COMPLEX_REASONING
    ],
    temperature: {
      default: 0.7,
      min: 0.3,
      max: 0.9
    }
  },

  OPUS: {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    tier: ModelTier.PREMIUM,
    costPer1kTokens: 0.015,
    avgLatencyMs: 3000,
    maxTokens: 8192,
    bestFor: [
      OperationType.COMPLEX_REASONING
    ],
    temperature: {
      default: 0.8,
      min: 0.5,
      max: 1.0
    }
  }
}

// User tier configuration
export enum UserTier {
  FREE = 'free',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export interface UserTierConfig {
  tier: UserTier
  allowedModels: ModelTier[]
  maxTokensPerRequest: number
  maxRequestsPerDay: number
  priorityQueue: boolean
}

export const UserTierConfigs: Record<UserTier, UserTierConfig> = {
  [UserTier.FREE]: {
    tier: UserTier.FREE,
    allowedModels: [ModelTier.FAST],
    maxTokensPerRequest: 1000,
    maxRequestsPerDay: 20,
    priorityQueue: false
  },

  [UserTier.STANDARD]: {
    tier: UserTier.STANDARD,
    allowedModels: [ModelTier.FAST, ModelTier.QUALITY],
    maxTokensPerRequest: 2000,
    maxRequestsPerDay: 100,
    priorityQueue: false
  },

  [UserTier.PREMIUM]: {
    tier: UserTier.PREMIUM,
    allowedModels: [ModelTier.FAST, ModelTier.QUALITY, ModelTier.PREMIUM],
    maxTokensPerRequest: 5000,
    maxRequestsPerDay: 500,
    priorityQueue: true
  },

  [UserTier.ENTERPRISE]: {
    tier: UserTier.ENTERPRISE,
    allowedModels: [ModelTier.FAST, ModelTier.QUALITY, ModelTier.PREMIUM],
    maxTokensPerRequest: 10000,
    maxRequestsPerDay: -1, // Unlimited
    priorityQueue: true
  }
}

/**
 * Select the best model for a given operation and user tier
 */
export class ModelSelector {
  constructor(
    private userTier: UserTier = UserTier.STANDARD,
    private preferredQuality: boolean = false
  ) { }

  /**
   * Select model based on operation type
   */
  selectModel(operation: OperationType): ModelProfile {
    const userConfig = UserTierConfigs[this.userTier]

    // Find best model for operation
    let selectedModel: ModelProfile | null = null

    // If user prefers quality and has access, use higher tier
    if (this.preferredQuality && userConfig.allowedModels.includes(ModelTier.QUALITY)) {
      selectedModel = ModelProfiles.SONNET
    } else {
      // Find the most appropriate model for the operation
      for (const [key, profile] of Object.entries(ModelProfiles)) {
        if (profile.bestFor.includes(operation) &&
          userConfig.allowedModels.includes(profile.tier)) {
          selectedModel = profile
          break
        }
      }
    }

    // Fallback to Haiku if no model found
    return selectedModel || ModelProfiles.HAIKU
  }

  /**
   * Calculate cost estimate for an operation
   */
  estimateCost(
    operation: OperationType,
    estimatedTokens: number
  ): {
    model: string
    estimatedCost: number
    estimatedLatency: number
  } {
    const model = this.selectModel(operation)
    const estimatedCost = (estimatedTokens / 1000) * model.costPer1kTokens

    return {
      model: model.name,
      estimatedCost,
      estimatedLatency: model.avgLatencyMs
    }
  }

  /**
   * Get optimal temperature for an operation
   */
  getTemperature(operation: OperationType): number {
    const model = this.selectModel(operation)

    // Use lower temperature for analytical tasks
    if ([
      OperationType.GRAMMAR_FIX,
      OperationType.CPL_ANALYSIS,
      OperationType.QUICK_SCORING
    ].includes(operation)) {
      return model.temperature.min
    }

    // Use default for most operations
    return model.temperature.default
  }

  /**
   * Check if user can use a specific model
   */
  canUseModel(modelTier: ModelTier): boolean {
    const userConfig = UserTierConfigs[this.userTier]
    return userConfig.allowedModels.includes(modelTier)
  }

  /**
   * Get user's request limits
   */
  getRequestLimits(): {
    maxTokens: number
    maxRequestsPerDay: number
    hasPriority: boolean
  } {
    const config = UserTierConfigs[this.userTier]
    return {
      maxTokens: config.maxTokensPerRequest,
      maxRequestsPerDay: config.maxRequestsPerDay,
      hasPriority: config.priorityQueue
    }
  }
}

/**
 * Model selection strategy for parallel processing
 */
export class ParallelModelStrategy {
  private selector: ModelSelector

  constructor(userTier: UserTier = UserTier.STANDARD) {
    this.selector = new ModelSelector(userTier)
  }

  /**
   * Get models for parallel grammar and polish operations
   */
  getParallelModels(): {
    grammar: ModelProfile
    polish: ModelProfile
    background: ModelProfile
  } {
    return {
      grammar: this.selector.selectModel(OperationType.GRAMMAR_FIX),
      polish: this.selector.selectModel(OperationType.ADAPTIVE_POLISH),
      background: this.selector.selectModel(OperationType.CPL_ANALYSIS)
    }
  }

  /**
   * Estimate total cost for complete processing
   */
  estimateTotalCost(inputLength: number): {
    breakdown: Record<string, number>
    total: number
    savings: number
  } {
    const models = this.getParallelModels()

    // Estimate tokens (rough approximation)
    const estimatedTokens = Math.ceil(inputLength * 0.25) // ~4 chars per token

    const grammarCost = (estimatedTokens / 1000) * models.grammar.costPer1kTokens
    const polishCost = ((estimatedTokens * 1.2) / 1000) * models.polish.costPer1kTokens
    const analysisCost = ((estimatedTokens * 0.5) / 1000) * models.background.costPer1kTokens

    const total = grammarCost + polishCost + analysisCost

    // Calculate savings vs all Sonnet
    const allSonnetCost = ((estimatedTokens * 2.7) / 1000) * ModelProfiles.SONNET.costPer1kTokens
    const savings = allSonnetCost - total

    return {
      breakdown: {
        grammar: grammarCost,
        polish: polishCost,
        analysis: analysisCost
      },
      total,
      savings
    }
  }
}

// Export for easy use
export const defaultModelSelector = new ModelSelector(UserTier.STANDARD)
export const defaultParallelStrategy = new ParallelModelStrategy(UserTier.STANDARD)