// Plugin Registry Implementation
// Created: January 2025
// Purpose: Core plugin orchestration and management system

import {
  Plugin,
  PluginContext,
  PluginResult,
  PluginPhase,
  PluginPriority,
  PluginRegistry as IPluginRegistry,
  PluginMetrics,
  PluginConfig
} from './types'

export class PluginRegistry implements IPluginRegistry {
  private plugins = new Map<string, Plugin>()
  private metrics = new Map<string, PluginMetrics>()
  private configs = new Map<string, PluginConfig>()
  private executionOrder = new Map<PluginPhase, string[]>()

  constructor(private defaultConfig: PluginConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    circuitBreaker: {
      enabled: true,
      threshold: 5,
      resetTimeout: 60000
    }
  }) {}

  /**
   * Register a new plugin
   */
  register(plugin: Plugin): void {
    // Validate plugin
    this.validatePlugin(plugin)

    // Initialize plugin if needed
    if (plugin.onInit) {
      plugin.onInit().catch(error => {
        console.error(`Failed to initialize plugin ${plugin.id}:`, error)
      })
    }

    // Store plugin
    this.plugins.set(plugin.id, plugin)

    // Initialize metrics
    this.metrics.set(plugin.id, {
      pluginId: plugin.id,
      executionCount: 0,
      totalDuration: 0,
      averageDuration: 0,
      successRate: 100,
      lastExecution: new Date(),
      errors: []
    })

    // Update execution order
    this.updateExecutionOrder()

    console.log(`Plugin registered: ${plugin.id} (${plugin.phase}, priority: ${plugin.priority})`)
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)

    if (plugin) {
      // Cleanup plugin
      if (plugin.onDestroy) {
        plugin.onDestroy().catch(error => {
          console.error(`Error destroying plugin ${pluginId}:`, error)
        })
      }

      // Remove from registry
      this.plugins.delete(pluginId)
      this.metrics.delete(pluginId)
      this.configs.delete(pluginId)

      // Update execution order
      this.updateExecutionOrder()

      console.log(`Plugin unregistered: ${pluginId}`)
    }
  }

  /**
   * Get a specific plugin
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * Get all plugins for a specific phase
   */
  getPluginsByPhase(phase: PluginPhase): Plugin[] {
    const plugins = Array.from(this.plugins.values())
      .filter(p => p.phase === phase && (p.enabled !== false))

    return this.sortPluginsByPriorityAndDependencies(plugins)
  }

  /**
   * Execute all plugins for a specific phase
   */
  async executePhase(
    phase: PluginPhase,
    context: PluginContext
  ): Promise<Map<string, PluginResult>> {
    const results = new Map<string, PluginResult>()
    const plugins = this.getPluginsByPhase(phase)

    console.log(`Executing ${plugins.length} plugins for phase: ${phase}`)

    // Execute plugins based on phase strategy
    if (phase === PluginPhase.BACKGROUND) {
      // Fire-and-forget for background plugins
      this.executeBackgroundPlugins(plugins, context)
      return results
    }

    // Execute plugins sequentially or in parallel based on phase
    if (phase === PluginPhase.PRE_STREAM) {
      // Pre-stream can run some plugins in parallel (same priority)
      return this.executePluginsWithPriority(plugins, context)
    }

    // Post-stream plugins run sequentially by priority
    for (const plugin of plugins) {
      try {
        const result = await this.executePlugin(plugin.id, {
          ...context,
          previousResults: results
        })
        results.set(plugin.id, result)

        // Update context with results for next plugin
        if (result.content) {
          context.content = result.content
        }
      } catch (error) {
        console.error(`Plugin ${plugin.id} execution failed:`, error)
        results.set(plugin.id, {
          success: false,
          error: String(error)
        })
      }
    }

    return results
  }

  /**
   * Execute a single plugin
   */
  async executePlugin(
    pluginId: string,
    context: PluginContext
  ): Promise<PluginResult> {
    const plugin = this.plugins.get(pluginId)

    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    if (plugin.enabled === false) {
      return { success: true, content: context.content }
    }

    const startTime = Date.now()
    const config = this.configs.get(pluginId) || this.defaultConfig
    let attempts = 0

    while (attempts < (config.maxRetries || 1)) {
      try {
        // Validate context if validator exists
        if (plugin.validate) {
          const isValid = await plugin.validate(context)
          if (!isValid) {
            throw new Error('Context validation failed')
          }
        }

        // Execute with timeout
        const result = await this.executeWithTimeout(
          plugin.execute(context),
          config.timeout || 30000
        )

        // Update metrics
        this.updateMetrics(pluginId, true, Date.now() - startTime)

        return result
      } catch (error) {
        attempts++
        console.error(`Plugin ${pluginId} attempt ${attempts} failed:`, error)

        // Update metrics
        this.updateMetrics(pluginId, false, Date.now() - startTime, String(error))

        // Check if should retry
        if (attempts >= (config.maxRetries || 1)) {
          // Execute rollback if available
          if (plugin.rollback) {
            try {
              await plugin.rollback(context, error as Error)
            } catch (rollbackError) {
              console.error(`Rollback failed for ${pluginId}:`, rollbackError)
            }
          }

          throw error
        }

        // Wait before retry
        await this.wait(config.retryDelay || 1000)
      }
    }

    return {
      success: false,
      error: `Failed after ${attempts} attempts`
    }
  }

  /**
   * Validate plugin configuration
   */
  private validatePlugin(plugin: Plugin): void {
    if (!plugin.id) {
      throw new Error('Plugin must have an id')
    }

    if (!plugin.name) {
      throw new Error('Plugin must have a name')
    }

    if (!plugin.phase) {
      throw new Error('Plugin must have a phase')
    }

    if (!plugin.execute || typeof plugin.execute !== 'function') {
      throw new Error('Plugin must have an execute function')
    }

    // Check for duplicate IDs
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with id ${plugin.id} already registered`)
    }

    // Validate dependencies
    if (plugin.dependencies) {
      for (const depId of plugin.dependencies) {
        if (!this.plugins.has(depId)) {
          console.warn(`Plugin ${plugin.id} depends on ${depId} which is not registered`)
        }
      }
    }
  }

  /**
   * Sort plugins by priority and dependencies
   */
  private sortPluginsByPriorityAndDependencies(plugins: Plugin[]): Plugin[] {
    // First sort by priority
    const sorted = plugins.sort((a, b) => (a.priority || 100) - (b.priority || 100))

    // Then resolve dependencies
    const resolved: Plugin[] = []
    const visited = new Set<string>()

    const resolveDependencies = (plugin: Plugin) => {
      if (visited.has(plugin.id)) return

      visited.add(plugin.id)

      // Resolve dependencies first
      if (plugin.dependencies) {
        for (const depId of plugin.dependencies) {
          const dep = sorted.find(p => p.id === depId)
          if (dep && !visited.has(depId)) {
            resolveDependencies(dep)
          }
        }
      }

      resolved.push(plugin)
    }

    // Resolve all plugins
    for (const plugin of sorted) {
      resolveDependencies(plugin)
    }

    return resolved
  }

  /**
   * Execute plugins with priority grouping
   */
  private async executePluginsWithPriority(
    plugins: Plugin[],
    context: PluginContext
  ): Promise<Map<string, PluginResult>> {
    const results = new Map<string, PluginResult>()
    const priorityGroups = new Map<number, Plugin[]>()

    // Group plugins by priority
    for (const plugin of plugins) {
      const priority = plugin.priority || 100
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, [])
      }
      priorityGroups.get(priority)!.push(plugin)
    }

    // Sort priority groups
    const sortedPriorities = Array.from(priorityGroups.keys()).sort((a, b) => a - b)

    // Execute each priority group
    for (const priority of sortedPriorities) {
      const group = priorityGroups.get(priority)!

      // Execute plugins in the same priority group in parallel
      const groupResults = await Promise.all(
        group.map(plugin =>
          this.executePlugin(plugin.id, context)
            .catch(error => ({
              success: false,
              error: String(error)
            }))
        )
      )

      // Store results
      group.forEach((plugin, index) => {
        results.set(plugin.id, groupResults[index])
      })
    }

    return results
  }

  /**
   * Execute background plugins (fire-and-forget)
   */
  private executeBackgroundPlugins(
    plugins: Plugin[],
    context: PluginContext
  ): void {
    for (const plugin of plugins) {
      // Execute without waiting
      this.executePlugin(plugin.id, context)
        .then(result => {
          console.log(`Background plugin ${plugin.id} completed:`, result.success)
        })
        .catch(error => {
          console.error(`Background plugin ${plugin.id} failed:`, error)
        })
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), timeout)
      })
    ])
  }

  /**
   * Update plugin metrics
   */
  private updateMetrics(
    pluginId: string,
    success: boolean,
    duration: number,
    error?: string
  ): void {
    const metrics = this.metrics.get(pluginId)

    if (metrics) {
      metrics.executionCount++
      metrics.totalDuration += duration
      metrics.averageDuration = metrics.totalDuration / metrics.executionCount
      metrics.lastExecution = new Date()

      if (!success && error) {
        metrics.errors.push({
          timestamp: new Date(),
          error
        })

        // Keep only last 100 errors
        if (metrics.errors.length > 100) {
          metrics.errors = metrics.errors.slice(-100)
        }
      }

      // Update success rate
      const successCount = metrics.executionCount - metrics.errors.length
      metrics.successRate = (successCount / metrics.executionCount) * 100
    }
  }

  /**
   * Update execution order cache
   */
  private updateExecutionOrder(): void {
    this.executionOrder.clear()

    for (const phase of Object.values(PluginPhase)) {
      const plugins = this.getPluginsByPhase(phase)
      this.executionOrder.set(phase, plugins.map(p => p.id))
    }
  }

  /**
   * Wait utility
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get metrics for a plugin
   */
  getMetrics(pluginId: string): PluginMetrics | undefined {
    return this.metrics.get(pluginId)
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, PluginMetrics> {
    return new Map(this.metrics)
  }

  /**
   * Set plugin configuration
   */
  setPluginConfig(pluginId: string, config: PluginConfig): void {
    this.configs.set(pluginId, config)
  }
}

// Export singleton instance
export const pluginRegistry = new PluginRegistry()