// Plugin Registry Index
// Purpose: Central registration and management of all guardrail plugins

import { PluginRegistry } from '../core'
import { createInputValidationPlugin } from './input-validation'
import { createOutputValidationPlugin } from './output-validation'
import { createContentSafetyPlugin } from './content-safety'
import type { PluginConfig } from '../types'

// ============================================================================
// DEFAULT PLUGIN CONFIGURATIONS
// ============================================================================

const DEFAULT_PLUGIN_CONFIGS = {
  inputValidation: {
    enabled: true,
    timeout: 5000,
    strictMode: false
  } as PluginConfig,

  outputValidation: {
    enabled: true,
    timeout: 10000,
    schemaValidation: true,
    qualityChecks: true
  } as PluginConfig,

  contentSafety: {
    enabled: true,
    timeout: 8000,
    useOpenAIModeration: true,
    hallucinationDetection: true
  } as PluginConfig
}

// ============================================================================
// PLUGIN REGISTRATION
// ============================================================================

/**
 * Register all default plugins with the registry
 */
export async function registerDefaultPlugins(
  registry: PluginRegistry,
  configs: Partial<typeof DEFAULT_PLUGIN_CONFIGS> = {}
): Promise<void> {
  const finalConfigs = {
    ...DEFAULT_PLUGIN_CONFIGS,
    ...configs
  }

  // Register plugins in order of priority
  const plugins = [
    createInputValidationPlugin(finalConfigs.inputValidation),
    createContentSafetyPlugin(finalConfigs.contentSafety),
    createOutputValidationPlugin(finalConfigs.outputValidation)
  ]

  for (const plugin of plugins) {
    try {
      await registry.register(plugin)
    } catch (error) {
      console.error(`Failed to register plugin ${plugin.id}:`, error)
      throw error
    }
  }
}

/**
 * Register individual plugins with custom configurations
 */
export const PluginFactories = {
  inputValidation: createInputValidationPlugin,
  outputValidation: createOutputValidationPlugin,
  contentSafety: createContentSafetyPlugin
} as const

// ============================================================================
// PLUGIN CONFIGURATION HELPERS
// ============================================================================

/**
 * Create plugin configurations for different environments
 */
export function createEnvironmentConfigs(environment: 'development' | 'staging' | 'production') {
  const baseConfigs = { ...DEFAULT_PLUGIN_CONFIGS }

  switch (environment) {
    case 'development':
      return {
        ...baseConfigs,
        inputValidation: {
          ...baseConfigs.inputValidation,
          strictMode: false,
          timeout: 10000 // More lenient timeouts for development
        },
        outputValidation: {
          ...baseConfigs.outputValidation,
          timeout: 15000
        },
        contentSafety: {
          ...baseConfigs.contentSafety,
          timeout: 12000
        }
      }

    case 'staging':
      return {
        ...baseConfigs,
        inputValidation: {
          ...baseConfigs.inputValidation,
          strictMode: true
        }
      }

    case 'production':
      return {
        ...baseConfigs,
        inputValidation: {
          ...baseConfigs.inputValidation,
          strictMode: true,
          timeout: 3000 // Faster timeouts for production
        },
        outputValidation: {
          ...baseConfigs.outputValidation,
          timeout: 5000
        },
        contentSafety: {
          ...baseConfigs.contentSafety,
          timeout: 4000
        }
      }

    default:
      return baseConfigs
  }
}

/**
 * Create content-type specific plugin configurations
 */
export function createContentTypeConfigs(contentType: string) {
  const configs = { ...DEFAULT_PLUGIN_CONFIGS }

  switch (contentType) {
    case 'proposal':
    case 'letter':
      return {
        ...configs,
        inputValidation: {
          ...configs.inputValidation,
          strictMode: true
        },
        outputValidation: {
          ...configs.outputValidation,
          schemaValidation: true,
          qualityChecks: true
        },
        contentSafety: {
          ...configs.contentSafety,
          hallucinationDetection: true
        }
      }

    case 'email':
      return {
        ...configs,
        outputValidation: {
          ...configs.outputValidation,
          schemaValidation: true
        }
      }

    case 'cpl-analysis':
      return {
        ...configs,
        inputValidation: {
          ...configs.inputValidation,
          strictMode: false // More lenient for analysis
        },
        contentSafety: {
          ...configs.contentSafety,
          hallucinationDetection: false // Analysis content might be more speculative
        }
      }

    default:
      return configs
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  createInputValidationPlugin,
  createOutputValidationPlugin,
  createContentSafetyPlugin
}

export type { PluginConfig }
export { DEFAULT_PLUGIN_CONFIGS }