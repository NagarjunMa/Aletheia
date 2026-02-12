// Vercel AI SDK Middleware Integration for Guardrails
// Purpose: Seamless integration with Vercel AI SDK for transparent validation

import {
  experimental_wrapLanguageModel as wrapLanguageModel,
  type LanguageModel,
  type LanguageModelV1,
  type CoreMessage,
  type GenerateObjectResult,
  type StreamObjectResult,
  type GenerateTextResult,
  type StreamTextResult,
} from 'ai'
import { haikunator } from 'haikunator'
import { getGuardrailEngine } from './core'
import { GuardrailLogger } from './logging/logger'
import { getCurrentConfig, isFeatureEnabled } from './config'
import type {
  ValidationContext,
  ValidationAction,
  AggregatedValidationResult,
  CorrelationId,
  GuardrailError,
  TimeoutError,
} from './types'

// ============================================================================
// TYPES FOR MIDDLEWARE
// ============================================================================

interface GuardrailMiddlewareOptions {
  /** User ID for context */
  userId?: string

  /** Session ID for tracking */
  sessionId?: string

  /** Request type */
  requestType?: 'cpl-analysis' | 'draft-generation' | 'voice-learning' | 'embedding-generation'

  /** Content type */
  contentType?: 'email' | 'letter' | 'proposal' | 'general' | 'memo'

  /** Custom correlation ID */
  correlationId?: CorrelationId

  /** Skip specific validation stages */
  skipStages?: ('input' | 'output')[]

  /** Override timeout */
  timeout?: number

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** Callback for validation events */
  onValidation?: (result: AggregatedValidationResult) => void

  /** Callback for validation errors */
  onValidationError?: (error: GuardrailError) => void
}

interface GuardrailValidationError extends Error {
  name: 'GuardrailValidationError'
  code: 'INPUT_BLOCKED' | 'OUTPUT_BLOCKED' | 'VALIDATION_FAILED'
  correlationId: CorrelationId
  validationResult?: AggregatedValidationResult
  action: ValidationAction
}

// ============================================================================
// ERROR TYPES
// ============================================================================

class GuardrailValidationError extends Error implements GuardrailValidationError {
  public readonly name = 'GuardrailValidationError'
  public readonly code: 'INPUT_BLOCKED' | 'OUTPUT_BLOCKED' | 'VALIDATION_FAILED'
  public readonly correlationId: CorrelationId
  public readonly validationResult?: AggregatedValidationResult
  public readonly action: ValidationAction

  constructor(
    message: string,
    code: 'INPUT_BLOCKED' | 'OUTPUT_BLOCKED' | 'VALIDATION_FAILED',
    correlationId: CorrelationId,
    action: ValidationAction,
    validationResult?: AggregatedValidationResult
  ) {
    super(message)
    this.code = code
    this.correlationId = correlationId
    this.action = action
    this.validationResult = validationResult
  }
}

// ============================================================================
// MIDDLEWARE IMPLEMENTATION
// ============================================================================

export function createGuardrailMiddleware(options: GuardrailMiddlewareOptions = {}) {
  const logger = GuardrailLogger.getInstance()
  const engine = getGuardrailEngine()
  const config = getCurrentConfig()

  return wrapLanguageModel({
    wrapGenerate: async ({ model, params }) => {
      const correlationId = options.correlationId || haikunator()
      const skipStages = options.skipStages || []

      logger.debug('Middleware: wrapping generate call', {
        correlationId,
        model: model.modelId,
        requestType: options.requestType,
      })

      // Check if guardrails are enabled
      if (!config.system.enabled || !isFeatureEnabled('enableAdvancedPromptInjection')) {
        logger.debug('Guardrails disabled, skipping validation', { correlationId })
        return model.doGenerate(params)
      }

      try {
        // Extract content for validation
        const inputContent = extractContentFromMessages(params.prompt)

        // Input validation
        if (!skipStages.includes('input') && inputContent) {
          await validateInput(
            inputContent,
            correlationId,
            options,
            logger,
            engine
          )
        }

        // Execute the original generation
        const startTime = Date.now()
        const result = await model.doGenerate(params)
        const generationTime = Date.now() - startTime

        // Output validation
        if (!skipStages.includes('output') && result.text) {
          await validateOutput(
            result.text,
            correlationId,
            options,
            logger,
            engine,
            inputContent
          )
        }

        // Log successful completion
        await logger.logValidationComplete(correlationId, {
          isValid: true,
          action: 'allow',
          maxSeverity: 'none',
          totalTime: generationTime,
          pluginResults: [],
        }, {
          userId: options.userId,
          content: inputContent,
          metadata: { generationTime, model: model.modelId },
        })

        return result

      } catch (error) {
        // Handle validation errors
        if (error instanceof GuardrailValidationError) {
          await logger.logSecurityViolation(correlationId, {
            type: error.code,
            severity: error.validationResult?.maxSeverity === 'critical' ? 'critical' : 'high',
            pluginId: 'middleware',
            reason: error.message,
            action: error.action,
          }, {
            userId: options.userId,
            metadata: { model: model.modelId },
          })

          // Call error callback if provided
          if (options.onValidationError) {
            options.onValidationError(error)
          }

          throw error
        }

        // Handle other errors
        await logger.logValidationFailed(correlationId, error as Error, {
          userId: options.userId,
          metadata: { model: model.modelId },
        })

        throw error
      }
    },

    wrapStream: async ({ model, params }) => {
      const correlationId = options.correlationId || haikunator()
      const skipStages = options.skipStages || []

      logger.debug('Middleware: wrapping stream call', {
        correlationId,
        model: model.modelId,
        requestType: options.requestType,
      })

      // Check if guardrails are enabled
      if (!config.system.enabled) {
        return model.doStream(params)
      }

      try {
        // Extract content for validation
        const inputContent = extractContentFromMessages(params.prompt)

        // Input validation
        if (!skipStages.includes('input') && inputContent) {
          await validateInput(
            inputContent,
            correlationId,
            options,
            logger,
            engine
          )
        }

        // Execute the original streaming
        const stream = await model.doStream(params)

        // For streaming, we'll validate the final text when available
        // This is a simplified approach - full streaming validation would require
        // chunk-by-chunk validation
        if (!skipStages.includes('output')) {
          return wrapStreamWithValidation(
            stream,
            correlationId,
            options,
            logger,
            engine,
            inputContent
          )
        }

        return stream

      } catch (error) {
        // Handle validation errors (similar to generate)
        if (error instanceof GuardrailValidationError) {
          await logger.logSecurityViolation(correlationId, {
            type: error.code,
            severity: error.validationResult?.maxSeverity === 'critical' ? 'critical' : 'high',
            pluginId: 'middleware',
            reason: error.message,
            action: error.action,
          }, {
            userId: options.userId,
            metadata: { model: model.modelId },
          })

          if (options.onValidationError) {
            options.onValidationError(error)
          }

          throw error
        }

        await logger.logValidationFailed(correlationId, error as Error, {
          userId: options.userId,
          metadata: { model: model.modelId },
        })

        throw error
      }
    },
  })
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

async function validateInput(
  content: string,
  correlationId: CorrelationId,
  options: GuardrailMiddlewareOptions,
  logger: GuardrailLogger,
  engine: ReturnType<typeof getGuardrailEngine>
): Promise<void> {
  logger.debug('Validating input', { correlationId, contentLength: content.length })

  const context: Partial<ValidationContext> = {
    correlationId,
    userId: options.userId,
    sessionId: options.sessionId,
    requestType: options.requestType,
    contentType: options.contentType,
    metadata: options.metadata,
  }

  try {
    const result = await engine.validate(content, context, {
      stage: 'input',
      timeout: options.timeout,
    })

    // Call validation callback if provided
    if (options.onValidation) {
      options.onValidation(result)
    }

    if (!result.isValid && (result.action === 'block' || result.maxSeverity === 'critical')) {
      throw new GuardrailValidationError(
        `Input validation failed: ${result.results.map(r => r.reason).filter(Boolean).join(', ')}`,
        'INPUT_BLOCKED',
        correlationId,
        result.action,
        result
      )
    }

    if (!result.isValid && result.action === 'flag') {
      logger.warn('Input flagged but allowed', {
        correlationId,
        severity: result.maxSeverity,
        reasons: result.results.map(r => r.reason).filter(Boolean),
      })
    }

  } catch (error) {
    if (error instanceof GuardrailValidationError) {
      throw error
    }

    // Convert other errors to validation errors
    throw new GuardrailValidationError(
      `Input validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'VALIDATION_FAILED',
      correlationId,
      'block'
    )
  }
}

async function validateOutput(
  content: string,
  correlationId: CorrelationId,
  options: GuardrailMiddlewareOptions,
  logger: GuardrailLogger,
  engine: ReturnType<typeof getGuardrailEngine>,
  inputContent?: string
): Promise<void> {
  logger.debug('Validating output', { correlationId, contentLength: content.length })

  const context: Partial<ValidationContext> = {
    correlationId,
    userId: options.userId,
    sessionId: options.sessionId,
    requestType: options.requestType,
    contentType: options.contentType,
    metadata: {
      ...options.metadata,
      inputContent: inputContent ? inputContent.substring(0, 100) + '...' : undefined,
    },
  }

  try {
    const result = await engine.validate(content, context, {
      stage: 'output',
      timeout: options.timeout,
    })

    if (options.onValidation) {
      options.onValidation(result)
    }

    if (!result.isValid && (result.action === 'block' || result.maxSeverity === 'critical')) {
      throw new GuardrailValidationError(
        `Output validation failed: ${result.results.map(r => r.reason).filter(Boolean).join(', ')}`,
        'OUTPUT_BLOCKED',
        correlationId,
        result.action,
        result
      )
    }

    if (!result.isValid && result.action === 'flag') {
      logger.warn('Output flagged but allowed', {
        correlationId,
        severity: result.maxSeverity,
        reasons: result.results.map(r => r.reason).filter(Boolean),
      })
    }

  } catch (error) {
    if (error instanceof GuardrailValidationError) {
      throw error
    }

    throw new GuardrailValidationError(
      `Output validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'VALIDATION_FAILED',
      correlationId,
      'block'
    )
  }
}

// ============================================================================
// STREAMING VALIDATION WRAPPER
// ============================================================================

function wrapStreamWithValidation(
  stream: any,
  correlationId: CorrelationId,
  options: GuardrailMiddlewareOptions,
  logger: GuardrailLogger,
  engine: ReturnType<typeof getGuardrailEngine>,
  inputContent?: string
): any {
  // For now, we'll collect the stream content and validate at the end
  // In a full implementation, you might want chunk-by-chunk validation

  let collectedContent = ''
  let isValidating = false

  const originalStream = stream

  // Wrap the stream to collect content
  const wrappedStream = new ReadableStream({
    start(controller) {
      const reader = originalStream.getReader()

      const pump = async (): Promise<void> => {
        try {
          const { done, value } = await reader.read()

          if (done) {
            // Validate collected content at the end
            if (collectedContent && !isValidating) {
              isValidating = true
              try {
                await validateOutput(
                  collectedContent,
                  correlationId,
                  options,
                  logger,
                  engine,
                  inputContent
                )
                logger.debug('Stream validation completed successfully', { correlationId })
              } catch (error) {
                logger.error('Stream validation failed', {
                  correlationId,
                  error: error instanceof Error ? error.message : 'Unknown error',
                })
                // For streaming, we can't block after content has been sent
                // So we just log the violation
              }
            }

            controller.close()
            return
          }

          // Collect content for final validation
          if (value && typeof value === 'string') {
            collectedContent += value
          } else if (value && value.text) {
            collectedContent += value.text
          }

          controller.enqueue(value)
          await pump()
        } catch (error) {
          controller.error(error)
        }
      }

      pump()
    },
  })

  return wrappedStream
}

// ============================================================================
// CONTENT EXTRACTION UTILITIES
// ============================================================================

function extractContentFromMessages(prompt: CoreMessage[] | string): string {
  if (typeof prompt === 'string') {
    return prompt
  }

  if (Array.isArray(prompt)) {
    return prompt
      .map(message => {
        if (typeof message.content === 'string') {
          return message.content
        }
        if (Array.isArray(message.content)) {
          return message.content
            .map(part => {
              if (part.type === 'text') {
                return part.text
              }
              return ''
            })
            .join(' ')
        }
        return ''
      })
      .join('\n')
  }

  return ''
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/** Create a guardrailed language model */
export function createGuardrailedModel(
  model: LanguageModel,
  options: GuardrailMiddlewareOptions = {}
): LanguageModel {
  const middleware = createGuardrailMiddleware(options)
  return middleware(model)
}

/** Create guardrail middleware with sensible defaults for different content types */
export function createContentTypeMiddleware(contentType: 'email' | 'letter' | 'proposal' | 'general' | 'memo') {
  const baseOptions: GuardrailMiddlewareOptions = {
    contentType,
    requestType: 'draft-generation',
  }

  // Adjust settings based on content type
  switch (contentType) {
    case 'proposal':
    case 'letter':
      // Stricter validation for formal content
      return createGuardrailMiddleware({
        ...baseOptions,
        metadata: { strictMode: true },
      })

    case 'email':
      // More lenient for casual emails
      return createGuardrailMiddleware({
        ...baseOptions,
        metadata: { strictMode: false },
      })

    default:
      return createGuardrailMiddleware(baseOptions)
  }
}

/** Create middleware for CPL analysis */
export function createCPLAnalysisMiddleware(userId?: string) {
  return createGuardrailMiddleware({
    userId,
    requestType: 'cpl-analysis',
    contentType: 'general',
    metadata: { analysisMode: true },
  })
}

/** Create middleware for voice learning */
export function createVoiceLearningMiddleware(userId: string) {
  return createGuardrailMiddleware({
    userId,
    requestType: 'voice-learning',
    contentType: 'general',
    metadata: { learningMode: true },
  })
}

// ============================================================================
// INTEGRATION WITH EXISTING AI SERVICES
// ============================================================================

/** Wrap existing Claude service with guardrails */
export async function wrapClaudeWithGuardrails(
  claudeService: any,
  options: GuardrailMiddlewareOptions = {}
): Promise<any> {
  // This would integrate with your existing Claude service
  // Implementation depends on your current Claude integration

  return {
    ...claudeService,
    async processWithClaude(prompt: string, context: any = {}) {
      const correlationId = options.correlationId || haikunator()
      const logger = GuardrailLogger.getInstance()
      const engine = getGuardrailEngine()

      try {
        // Input validation
        await validateInput(prompt, correlationId, {
          ...options,
          ...context,
        }, logger, engine)

        // Call original service
        const result = await claudeService.processWithClaude(prompt, context)

        // Output validation
        if (result.content) {
          await validateOutput(result.content, correlationId, {
            ...options,
            ...context,
          }, logger, engine, prompt)
        }

        return result

      } catch (error) {
        if (error instanceof GuardrailValidationError) {
          throw error
        }

        await logger.logValidationFailed(correlationId, error as Error, {
          userId: options.userId,
          content: prompt,
        })

        throw error
      }
    },
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  GuardrailValidationError,
  createGuardrailedModel,
  createContentTypeMiddleware,
  createCPLAnalysisMiddleware,
  createVoiceLearningMiddleware,
  wrapClaudeWithGuardrails,
}

export type {
  GuardrailMiddlewareOptions,
}