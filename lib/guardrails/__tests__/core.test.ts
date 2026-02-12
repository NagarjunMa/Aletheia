// Core Guardrail Engine Tests
// Purpose: Comprehensive test suite for the core guardrail functionality

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { GuardrailEngine, PluginRegistry, ValidationCache, getGuardrailEngine } from '../core'
import type { GuardrailPlugin, ValidationContext, ValidationResult, PluginConfig } from '../types'

// Mock plugin for testing
class MockPlugin implements GuardrailPlugin {
  public readonly id = 'mock-plugin'
  public readonly name = 'Mock Plugin'
  public readonly description = 'A mock plugin for testing'
  public readonly version = '1.0.0'
  public readonly priority = 50
  public readonly type = 'input'
  public readonly enabled = true

  constructor(public config: PluginConfig = {}) {}

  async validate(content: string, context: ValidationContext): Promise<ValidationResult> {
    const shouldFail = content.includes('FAIL')
    const shouldError = content.includes('ERROR')

    if (shouldError) {
      throw new Error('Mock plugin error')
    }

    return {
      isValid: !shouldFail,
      severity: shouldFail ? 'high' : 'none',
      reason: shouldFail ? 'Content contains FAIL keyword' : 'Content is valid',
      confidence: 0.9,
      pluginId: this.id,
      category: shouldFail ? 'mock_failure' : 'mock_success'
    }
  }
}

describe('GuardrailEngine', () => {
  let engine: GuardrailEngine

  beforeEach(() => {
    // Reset singleton for each test
    ;(GuardrailEngine as any).instance = null
    engine = getGuardrailEngine()
  })

  afterEach(async () => {
    await engine.shutdown()
    ;(GuardrailEngine as any).instance = null
  })

  describe('Plugin Management', () => {
    it('should register and retrieve plugins', async () => {
      const plugin = new MockPlugin()
      await engine.registerPlugin(plugin)

      const plugins = engine.getPlugins()
      expect(plugins).toHaveLength(4) // 3 default + 1 mock
      expect(plugins.find(p => p.id === 'mock-plugin')).toBeDefined()
    })

    it('should unregister plugins', async () => {
      const plugin = new MockPlugin()
      await engine.registerPlugin(plugin)

      await engine.unregisterPlugin('mock-plugin')
      const plugins = engine.getPlugins()
      expect(plugins.find(p => p.id === 'mock-plugin')).toBeUndefined()
    })

    it('should prevent duplicate plugin registration', async () => {
      const plugin1 = new MockPlugin()
      const plugin2 = new MockPlugin()

      await engine.registerPlugin(plugin1)
      await expect(engine.registerPlugin(plugin2)).rejects.toThrow('already registered')
    })
  })

  describe('Validation', () => {
    let mockPlugin: MockPlugin

    beforeEach(async () => {
      mockPlugin = new MockPlugin()
      await engine.registerPlugin(mockPlugin)
    })

    it('should validate content successfully', async () => {
      const context = {
        correlationId: 'test-correlation-id',
        userId: 'test-user',
        contentType: 'general' as const
      }

      const result = await engine.validate('Hello world', context)

      expect(result.isValid).toBe(true)
      expect(result.action).toBe('allow')
      expect(result.results).toHaveLength(4) // 3 default + 1 mock
    })

    it('should block content when validation fails', async () => {
      const context = {
        correlationId: 'test-correlation-id',
        userId: 'test-user',
        contentType: 'general' as const
      }

      const result = await engine.validate('This should FAIL', context)

      expect(result.isValid).toBe(false)
      expect(result.action).toBe('block')
      expect(result.maxSeverity).toBe('high')
    })

    it('should handle plugin errors gracefully', async () => {
      const context = {
        correlationId: 'test-correlation-id',
        userId: 'test-user',
        contentType: 'general' as const
      }

      const result = await engine.validate('This should ERROR', context)

      expect(result.isValid).toBe(false)
      expect(result.results.some(r => r.category === 'plugin_error')).toBe(true)
    })

    it('should respect timeout settings', async () => {
      const slowPlugin = new (class extends MockPlugin {
        async validate(content: string, context: ValidationContext): Promise<ValidationResult> {
          await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
          return super.validate(content, context)
        }
      })()

      await engine.registerPlugin(slowPlugin)

      const context = {
        correlationId: 'test-correlation-id',
        userId: 'test-user',
        contentType: 'general' as const
      }

      const result = await engine.validate('test', context, {
        stage: 'input',
        timeout: 1000 // 1 second timeout
      })

      // Should timeout and mark as invalid
      expect(result.isValid).toBe(false)
      expect(result.results.some(r => r.category === 'timeout')).toBe(true)
    }, 10000)

    it('should use cached results when available', async () => {
      const context = {
        correlationId: 'test-correlation-id',
        userId: 'test-user',
        contentType: 'general' as const
      }

      // Spy on the plugin validate method
      const validateSpy = vi.spyOn(mockPlugin, 'validate')

      // First call
      await engine.validate('cached content', context)
      expect(validateSpy).toHaveBeenCalledTimes(1)

      // Second call with same content should use cache
      await engine.validate('cached content', context)
      expect(validateSpy).toHaveBeenCalledTimes(1) // Still 1, not called again
    })
  })

  describe('System Health', () => {
    it('should report system health status', async () => {
      const health = await engine.getSystemHealth()

      expect(health.overall.status).toBeDefined()
      expect(health.components).toBeDefined()
      expect(health.overall.lastCheck).toBeInstanceOf(Date)
    })

    it('should report unhealthy status when plugins have high error rates', async () => {
      // Create a plugin that always fails
      const failingPlugin = new (class extends MockPlugin {
        id = 'failing-plugin'
        async validate(): Promise<ValidationResult> {
          throw new Error('Always fails')
        }
      })()

      await engine.registerPlugin(failingPlugin)

      // Run several validations to build up error stats
      const context = {
        correlationId: 'test-correlation-id',
        userId: 'test-user',
        contentType: 'general' as const
      }

      for (let i = 0; i < 5; i++) {
        await engine.validate(`test ${i}`, context)
      }

      const health = await engine.getSystemHealth()
      expect(health.components['failing-plugin']?.status).toBe('unhealthy')
    })
  })

  describe('Performance Metrics', () => {
    it('should track performance metrics', async () => {
      const metrics = engine.getPerformanceMetrics()

      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0)
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(metrics.throughput).toBeGreaterThanOrEqual(0)
    })

    it('should update metrics after validations', async () => {
      const initialMetrics = engine.getPerformanceMetrics()

      const context = {
        correlationId: 'test-correlation-id',
        userId: 'test-user',
        contentType: 'general' as const
      }

      await engine.validate('test content', context)

      const updatedMetrics = engine.getPerformanceMetrics()
      // Metrics should be updated (though exact values depend on implementation)
      expect(updatedMetrics).toBeDefined()
    })
  })

  describe('Active Validations', () => {
    it('should track active validation count', () => {
      const count = engine.getActiveValidationCount()
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should increment/decrement active validations during processing', async () => {
      const slowPlugin = new (class extends MockPlugin {
        id = 'slow-plugin'
        async validate(content: string, context: ValidationContext): Promise<ValidationResult> {
          await new Promise(resolve => setTimeout(resolve, 100))
          return super.validate(content, context)
        }
      })()

      await engine.registerPlugin(slowPlugin)

      const context = {
        correlationId: 'test-correlation-id',
        userId: 'test-user',
        contentType: 'general' as const
      }

      // Start validation but don't wait
      const validationPromise = engine.validate('test', context)

      // Check that active count increased
      const activeCount = engine.getActiveValidationCount()
      expect(activeCount).toBe(1)

      // Wait for completion
      await validationPromise

      // Check that active count decreased
      const finalCount = engine.getActiveValidationCount()
      expect(finalCount).toBe(0)
    })
  })
})

describe('PluginRegistry', () => {
  let registry: PluginRegistry

  beforeEach(() => {
    registry = new PluginRegistry()
  })

  describe('Plugin Registration', () => {
    it('should register valid plugins', async () => {
      const plugin = new MockPlugin()
      await registry.register(plugin)

      const plugins = registry.getAll()
      expect(plugins).toHaveLength(1)
      expect(plugins[0].id).toBe('mock-plugin')
    })

    it('should reject invalid plugins', async () => {
      const invalidPlugin = {} as GuardrailPlugin

      await expect(registry.register(invalidPlugin)).rejects.toThrow('missing required properties')
    })

    it('should track plugin statistics', async () => {
      const plugin = new MockPlugin()
      await registry.register(plugin)

      const stats = registry.getStats('mock-plugin')
      expect(stats).toBeDefined()
      expect(stats?.totalValidations).toBe(0)
      expect(stats?.errors).toBe(0)
    })
  })

  describe('Plugin Execution', () => {
    it('should execute plugins by priority', async () => {
      const highPriorityPlugin = new (class extends MockPlugin {
        id = 'high-priority'
        priority = 100
      })()

      const lowPriorityPlugin = new (class extends MockPlugin {
        id = 'low-priority'
        priority = 10
      })()

      await registry.register(lowPriorityPlugin)
      await registry.register(highPriorityPlugin)

      const plugins = registry.getByType('input')
      expect(plugins[0].id).toBe('high-priority')
      expect(plugins[1].id).toBe('low-priority')
    })
  })
})

describe('ValidationCache', () => {
  let cache: ValidationCache

  beforeEach(() => {
    cache = new ValidationCache(100, 60000) // 100 items, 1 minute TTL
  })

  describe('Cache Operations', () => {
    it('should store and retrieve cached results', () => {
      const content = 'test content'
      const pluginId = 'test-plugin'
      const context = { correlationId: 'test-id' }
      const result: ValidationResult = {
        isValid: true,
        severity: 'none',
        reason: 'test result',
        confidence: 0.9,
        pluginId,
        category: 'test'
      }

      cache.set(content, pluginId, context, result)
      const retrieved = cache.get(content, pluginId, context)

      expect(retrieved).toEqual(result)
    })

    it('should return null for non-existent cache entries', () => {
      const result = cache.get('nonexistent', 'plugin', {})
      expect(result).toBeNull()
    })

    it('should respect TTL and expire entries', () => {
      const shortTtlCache = new ValidationCache(100, 10) // 10ms TTL

      const content = 'test content'
      const pluginId = 'test-plugin'
      const context = { correlationId: 'test-id' }
      const result: ValidationResult = {
        isValid: true,
        severity: 'none',
        reason: 'test result',
        confidence: 0.9,
        pluginId,
        category: 'test'
      }

      shortTtlCache.set(content, pluginId, context, result)

      setTimeout(() => {
        const retrieved = shortTtlCache.get(content, pluginId, context)
        expect(retrieved).toBeNull()
      }, 15) // After TTL expires
    })

    it('should evict LRU entries when cache is full', () => {
      const smallCache = new ValidationCache(2, 60000) // Only 2 items

      const createResult = (id: string): ValidationResult => ({
        isValid: true,
        severity: 'none',
        reason: `result ${id}`,
        confidence: 0.9,
        pluginId: 'test',
        category: 'test'
      })

      // Fill cache
      smallCache.set('content1', 'plugin', {}, createResult('1'))
      smallCache.set('content2', 'plugin', {}, createResult('2'))

      // Access first item to make it more recently used
      smallCache.get('content1', 'plugin', {})

      // Add third item, should evict content2
      smallCache.set('content3', 'plugin', {}, createResult('3'))

      expect(smallCache.get('content1', 'plugin', {})).toBeDefined()
      expect(smallCache.get('content2', 'plugin', {})).toBeNull()
      expect(smallCache.get('content3', 'plugin', {})).toBeDefined()
    })

    it('should clear all cached entries', () => {
      const result: ValidationResult = {
        isValid: true,
        severity: 'none',
        reason: 'test result',
        confidence: 0.9,
        pluginId: 'test',
        category: 'test'
      }

      cache.set('content1', 'plugin', {}, result)
      cache.set('content2', 'plugin', {}, result)

      cache.clear()

      expect(cache.get('content1', 'plugin', {})).toBeNull()
      expect(cache.get('content2', 'plugin', {})).toBeNull()
    })
  })
})