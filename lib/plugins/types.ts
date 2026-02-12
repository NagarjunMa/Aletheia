// Plugin System Type Definitions
// Created: January 2025
// Purpose: Type-safe plugin architecture for extensible processing pipeline

export enum PluginPhase {
  PRE_STREAM = 'pre-stream',    // Before streaming to user
  POST_STREAM = 'post-stream',  // After streaming starts
  BACKGROUND = 'background'     // Long-running background tasks
}

export enum PluginPriority {
  CRITICAL = 0,      // Must run first (e.g., sanitation)
  HIGH = 10,         // Important operations
  MEDIUM = 50,       // Standard processing
  LOW = 100,         // Can be delayed
  BACKGROUND = 200   // Non-critical background tasks
}

export interface PluginContext {
  // Input data
  input?: string
  content?: string

  // User context
  userId: string
  conversationId?: string
  sessionId?: string
  category?: string

  // Processing metadata
  timestamp: number
  phase: PluginPhase
  previousResults?: Map<string, PluginResult>

  // User preferences
  userPreferences?: Record<string, any>
  userBaseline?: Record<string, any>

  // Additional data
  metadata?: Record<string, any>
}

export interface PluginResult {
  success: boolean
  content?: string
  error?: string
  metrics?: {
    duration: number
    tokensUsed?: number
    cost?: number
  }
  data?: Record<string, any>
}

export interface Plugin {
  // Identity
  id: string
  name: string
  description?: string
  version?: string

  // Execution configuration
  phase: PluginPhase
  priority: PluginPriority
  dependencies?: string[]  // Plugin IDs this plugin depends on

  // Configuration
  enabled?: boolean
  config?: Record<string, any>

  // Execution methods
  execute(context: PluginContext): Promise<PluginResult>
  validate?(context: PluginContext): Promise<boolean>
  rollback?(context: PluginContext, error: Error): Promise<void>

  // Lifecycle hooks
  onInit?(): Promise<void>
  onDestroy?(): Promise<void>
}

export interface PluginRegistry {
  register(plugin: Plugin): void
  unregister(pluginId: string): void
  getPlugin(pluginId: string): Plugin | undefined
  getPluginsByPhase(phase: PluginPhase): Plugin[]
  executePhase(phase: PluginPhase, context: PluginContext): Promise<Map<string, PluginResult>>
  executePlugin(pluginId: string, context: PluginContext): Promise<PluginResult>
}

export interface PluginMetrics {
  pluginId: string
  executionCount: number
  totalDuration: number
  averageDuration: number
  successRate: number
  lastExecution: Date
  errors: Array<{
    timestamp: Date
    error: string
    context?: Partial<PluginContext>
  }>
}

export interface PluginConfig {
  maxRetries?: number
  retryDelay?: number
  timeout?: number
  circuitBreaker?: {
    enabled: boolean
    threshold: number
    resetTimeout: number
  }
}