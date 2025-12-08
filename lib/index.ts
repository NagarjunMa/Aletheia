/**
 * Ascendia AI Integration System - Track 2
 * Complete implementation of the core AI processing pipeline
 *
 * This file provides centralized exports for all AI integration components
 */

// Core AI Service
export { claudeService, ClaudeService } from './ai/claude-service'

// Content Polish Level (CPL) System
export { CPLCalculator, calculateCPL } from './cpl/calculator'
export { adaptiveLearningSystem, AdaptiveLearningSystem } from './cpl/adaptive-learning'

// Content Sanitization
export {
  ContentSanitizer,
  sanitizeLLMOutput,
  validateInput
} from './sanitization/sanitizer'

// Draft Generation System
export { dualDraftManager, DualDraftManager } from './drafts/dual-draft-manager'

// Server Actions
export {
  generateDraftAction,
  getUserDraftsAction,
  deleteDraftAction,
  getConversationAction,
  updateConversationTitleAction
} from './actions/generate-draft'

export {
  streamDraftGeneration,
  streamDraftGenerationGenerator,
  streamHealthCheck
} from './actions/stream-response'

/**
 * System Health Check
 * Verifies all components are working correctly
 */
export async function systemHealthCheck() {
  const results = {
    claudeService: false,
    dualDraftManager: false,
    streamingService: false,
    timestamp: new Date().toISOString()
  }

  try {
    // Test Claude service
    results.claudeService = await claudeService.healthCheck()

    // Test dual draft manager
    results.dualDraftManager = await dualDraftManager.healthCheck()

    // Test streaming service
    const streamHealth = await streamHealthCheck()
    results.streamingService = streamHealth.success

    const allHealthy = Object.values(results).slice(0, -1).every(r => r === true)

    return {
      healthy: allHealthy,
      results,
      status: allHealthy ? 'All systems operational' : 'Some components need attention'
    }
  } catch (error) {
    console.error('System health check failed:', error)
    return {
      healthy: false,
      results,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'System health check failed'
    }
  }
}

/**
 * System Information
 * Provides details about the AI integration system
 */
export const SYSTEM_INFO = {
  name: 'Ascendia AI Integration System',
  version: '1.0.0',
  track: 'Track 2 - Parallel Implementation',
  components: {
    'Claude API Service': {
      file: 'lib/ai/claude-service.ts',
      description: 'Main integration with Anthropic Claude API including error handling and streaming',
      features: ['Response generation', 'Streaming support', 'Dual draft generation', 'Health monitoring']
    },
    'CPL Calculator': {
      file: 'lib/cpl/calculator.ts',
      description: 'Content Polish Level scoring with comprehensive text analysis metrics',
      features: ['Lexical diversity (TTR/MATTR)', 'Sentence complexity', 'Formality analysis', 'Coherence scoring']
    },
    'Adaptive Learning': {
      file: 'lib/cpl/adaptive-learning.ts',
      description: 'Machine learning system for adapting to user preferences over time',
      features: ['Feedback analysis', 'Pattern recognition', 'CPL adjustment', 'Learning insights']
    },
    'Content Sanitizer': {
      file: 'lib/sanitization/sanitizer.ts',
      description: 'Comprehensive input/output sanitization and security scanning',
      features: ['Prompt injection detection', 'LLM artifact removal', 'Quality validation', 'Security scanning']
    },
    'Dual Draft Manager': {
      file: 'lib/drafts/dual-draft-manager.ts',
      description: 'System for generating grammar fix and adaptive polish drafts',
      features: ['Grammar-only corrections', 'Adaptive polishing', 'Voice preservation', 'Quality validation']
    },
    'Server Actions': {
      file: 'lib/actions/generate-draft.ts',
      description: 'Next.js Server Actions for secure AI processing',
      features: ['Authentication', 'Validation', 'Database integration', 'Error handling']
    },
    'Streaming System': {
      file: 'lib/actions/stream-response.ts',
      description: 'Real-time streaming of AI responses using Server-Sent Events',
      features: ['Real-time streaming', 'Progress tracking', 'Error recovery', 'Analytics logging']
    }
  },
  capabilities: {
    'AI Processing': [
      'Dual draft generation (Grammar Fix + Adaptive Polish)',
      'Real-time streaming responses',
      'Content Polish Level (CPL) scoring',
      'Adaptive learning from user feedback'
    ],
    'Security': [
      'Prompt injection detection and prevention',
      'Content sanitization and validation',
      'User authentication and authorization',
      'Rate limiting and abuse prevention'
    ],
    'Quality Assurance': [
      'Output validation and quality scoring',
      'Voice preservation metrics',
      'Grammar and style analysis',
      'User satisfaction tracking'
    ],
    'Performance': [
      'Streaming for real-time feedback',
      'Efficient text processing algorithms',
      'Caching and optimization',
      'Health monitoring and diagnostics'
    ]
  },
  usage: {
    'Basic Draft Generation': `
      import { generateDraftAction } from '@/lib/actions/generate-draft'

      const result = await generateDraftAction(null, formData)
      if (result.success) {
        console.log('Grammar Fix:', result.data.grammarFix.content)
        console.log('Adaptive Polish:', result.data.adaptivePolish.content)
      }
    `,
    'CPL Analysis': `
      import { CPLCalculator } from '@/lib/cpl/calculator'

      const cplScore = CPLCalculator.calculate(content)
      const detailed = CPLCalculator.getDetailedAnalysis(content)
      console.log('CPL Score:', cplScore, 'Analysis:', detailed)
    `,
    'Content Sanitization': `
      import { ContentSanitizer } from '@/lib/sanitization/sanitizer'

      const validation = ContentSanitizer.validateAndClean(input)
      if (validation.valid) {
        const clean = ContentSanitizer.sanitizeLLMOutput(output)
      }
    `,
    'Streaming Response': `
      import { streamDraftGeneration } from '@/lib/actions/stream-response'

      const response = await streamDraftGeneration({
        content: 'Text to improve',
        type: 'adaptive_polish',
        cplTarget: 65
      })

      // Process the streaming response...
    `
  }
}

/**
 * Quick Start Guide
 */
export const QUICK_START = {
  requirements: [
    'ANTHROPIC_API_KEY environment variable',
    'Supabase database with required tables',
    'Next.js 14.x with App Router',
    'TypeScript 5.6+'
  ],
  setup: [
    '1. Install dependencies: npm install @anthropic-ai/sdk ai zod',
    '2. Set up environment variables',
    '3. Initialize Supabase tables using schema in CLAUDE.md',
    '4. Import and use the AI integration components'
  ],
  basicUsage: `
    // 1. Generate drafts
    import { generateDraftAction } from '@/lib'
    const result = await generateDraftAction(null, formData)

    // 2. Calculate CPL score
    import { CPLCalculator } from '@/lib'
    const score = CPLCalculator.calculate(content)

    // 3. Stream AI responses
    import { streamDraftGeneration } from '@/lib'
    const stream = await streamDraftGeneration(request)
  `
}

console.log('🚀 Ascendia AI Integration System loaded successfully!')
console.log('📊 System Info available at SYSTEM_INFO export')
console.log('🔧 Quick Start Guide available at QUICK_START export')
console.log('💡 Run systemHealthCheck() to verify all components')