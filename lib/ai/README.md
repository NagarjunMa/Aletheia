# AI Integration - Anthropic Claude API

## Overview

The Ascendia AI integration provides sophisticated text processing capabilities using Anthropic's Claude 3.5 Sonnet model. This integration includes grammar correction, adaptive polishing, CPL analysis, and comprehensive error handling with proper cost management.

## Architecture

### Core Components

1. **Claude API Client** (`lib/ai/claude.ts`)
   - Direct integration with Anthropic's API
   - Streaming and non-streaming processing
   - Error handling and retry logic
   - Token usage tracking and cost estimation

2. **AI Processor** (`lib/ai/processor.ts`)
   - Database integration and orchestration
   - User input processing workflows
   - Draft generation and CPL scoring
   - Batch processing capabilities

3. **Content Sanitization** (`lib/ai/sanitizer.ts`)
   - Multi-layer security validation
   - Profanity filtering and harmful content detection
   - HTML/script injection prevention
   - Text encoding validation and normalization

4. **AI Server Actions** (`lib/actions/ai.ts`)
   - Server-side AI processing endpoints
   - Authentication and authorization
   - Form validation and error handling
   - Performance monitoring

5. **Utility Functions** (`lib/ai/utils.ts`)
   - Content validation and sanitization
   - CPL scoring utilities
   - Performance monitoring
   - Cost calculation and quota management

## Features

### ✅ Text Processing Types

#### Grammar Fix
- Corrects grammar, spelling, and punctuation errors
- Preserves original tone, style, and voice
- Maintains exact meaning and intent
- Minimal changes approach

#### Adaptive Polish
- Enhances clarity, flow, and engagement
- Maintains author's unique voice and style
- Improves word choice and sentence structure
- Targets specific CPL scores while staying authentic

#### CPL Analysis
- Comprehensive Content Polish Level assessment
- Detailed breakdown by grammar, clarity, style, engagement, vocabulary
- Improvement suggestions and strengths identification
- Baseline comparison capabilities

### ✅ Advanced Capabilities

#### Streaming Processing
```typescript
// Real-time streaming for immediate feedback
for await (const chunk of streamProcessUserInput(inputId, 'adaptive_polish')) {
  if (chunk.type === 'content') {
    console.log('Received content:', chunk.content)
  }
}
```

#### Batch Processing
```typescript
// Process multiple inputs efficiently
const results = await processBatch(inputIds, 'grammar_fix', options)
console.log(`Processed ${results.length} inputs`)
```

#### Smart Error Handling
- Automatic retry for transient errors
- User-friendly error messages
- Graceful degradation
- Detailed logging for debugging

### ✅ Security & Safety

#### Content Sanitization
- **Script Injection Prevention**: Blocks `<script>`, `javascript:`, `vbscript:` patterns
- **SQL Injection Protection**: Detects and blocks common SQL injection patterns
- **Command Injection Prevention**: Blocks shell command patterns
- **Personal Information Redaction**: Removes SSN, credit card, email patterns
- **Profanity Filtering**: Configurable profanity detection and filtering
- **Harmful Content Blocking**: Blocks hate speech, violence, illegal activity references

#### Content Validation
- Input sanitization and validation
- Harmful content detection
- Length and format restrictions
- XSS protection measures

#### API Security
- Secure API key management
- Rate limiting and quota enforcement
- Usage tracking and monitoring
- Error boundary implementation

#### User Privacy
- No data retention by AI provider
- Local processing status tracking
- User consent for AI processing
- Audit trail for all operations

## Configuration

### Environment Variables
```env
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional - AI Processing Limits
AI_DAILY_TOKEN_LIMIT=100000
AI_MONTHLY_COST_LIMIT=50.00
AI_MAX_TEXT_LENGTH=10000
AI_BATCH_SIZE_LIMIT=10
```

### Model Configuration
```typescript
export const CLAUDE_CONFIG = {
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4096,
  temperature: 0.7,
  topP: 0.9,
}
```

## Usage Examples

### Basic Text Processing
```typescript
import { processWithClaude } from '@/lib/ai/claude'

// Grammar fix
const grammarResult = await processWithClaude(
  "This sentence have some error's.",
  'grammar_fix'
)

// Adaptive polish
const polishResult = await processWithClaude(
  "Your text here...",
  'adaptive_polish',
  {
    targetCpl: 75,
    preserveTone: true,
    userPreferences: { writing_style: 'professional' }
  }
)

// CPL analysis
const analysisResult = await processWithClaude(
  "Your text here...",
  'cpl_analysis'
)
```

### Content Sanitization
```typescript
import { sanitizeAIOutput, quickSanitize, sanitizeForExport } from '@/lib/ai/sanitizer'

// Comprehensive sanitization
const result = sanitizeAIOutput(aiGeneratedContent, {
  allowHtml: false,
  maxLength: 5000,
  preserveFormatting: true,
  removeProfanity: true,
  validateEncoding: true,
})

if (result.success) {
  console.log('Safe content:', result.sanitizedContent)
  console.log('Modifications:', result.modificationsApplied)
} else {
  console.error('Sanitization failed:', result.error)
}

// Quick sanitization for display
const displayContent = quickSanitize(userText)

// Export sanitization for sharing
const exportResult = sanitizeForExport(contentToShare)
```

### Server Action Integration
```typescript
import { generateDraftFromInput } from '@/lib/actions/ai'

// Generate draft from user input
const formData = new FormData()
formData.append('input_id', 'uuid-here')
formData.append('draft_type', 'adaptive_polish')
formData.append('processing_options', JSON.stringify({
  targetCpl: 80,
  preserveTone: true
}))

const result = await generateDraftFromInput(formData)
if (result.success) {
  console.log('Draft generated:', result.data.draftId)
}
```

### Streaming Implementation
```typescript
import { streamProcessUserInput } from '@/lib/ai/processor'

// Stream processing with real-time updates
async function handleStreaming() {
  for await (const update of streamProcessUserInput(inputId, 'adaptive_polish')) {
    switch (update.type) {
      case 'status':
        setStatus(update.status)
        break
      case 'content':
        appendContent(update.content)
        break
      case 'completed':
        setCplScore(update.cplScore)
        setCompleted(true)
        break
      case 'error':
        setError(update.error)
        break
    }
  }
}
```

### Batch Processing
```typescript
import { processBatchInputs } from '@/lib/actions/ai'

// Process multiple inputs
const formData = new FormData()
formData.append('input_ids', JSON.stringify([id1, id2, id3]))
formData.append('draft_type', 'grammar_fix')

const batchResult = await processBatchInputs(formData)
console.log(`${batchResult.data.summary.successful} inputs processed successfully`)
```

## CPL Scoring System

### Scoring Framework (1-100)

**Grammar & Mechanics (20%)**
- 90-100: Perfect grammar, spelling, punctuation
- 70-89: Minor errors that don't impede understanding
- 50-69: Some errors that occasionally confuse meaning
- 30-49: Frequent errors that impede readability
- 1-29: Many errors that significantly hinder comprehension

**Clarity & Structure (25%)**
- 90-100: Crystal clear, excellent logical flow
- 70-89: Clear with strong organization
- 50-69: Generally clear with minor organizational issues
- 30-49: Somewhat unclear, structural problems
- 1-29: Confusing, poor organization

**Style & Voice (20%)**
- 90-100: Distinctive, engaging, perfectly matched to audience
- 70-89: Strong style, appropriate tone
- 50-69: Adequate style, generally appropriate
- 30-49: Inconsistent or inappropriate style
- 1-29: Poor style, inappropriate for audience

**Engagement & Impact (20%)**
- 90-100: Highly engaging, memorable, compelling
- 70-89: Engaging with good impact
- 50-69: Moderately engaging
- 30-49: Limited engagement
- 1-29: Not engaging, forgettable

**Vocabulary & Word Choice (15%)**
- 90-100: Precise, varied, sophisticated word choice
- 70-89: Good vocabulary, mostly precise
- 50-69: Adequate vocabulary
- 30-49: Limited or imprecise vocabulary
- 1-29: Poor word choice, very limited vocabulary

### CPL Utilities
```typescript
import { getCPLScoreLabel, calculateCPLImprovement } from '@/lib/ai/utils'

// Get user-friendly labels
const label = getCPLScoreLabel(85) // "Very Good"
const color = getCPLScoreColor(85) // "green"

// Track improvement
const improvement = calculateCPLImprovement(65, 78)
console.log(`Improved by ${improvement.improvement} points (${improvement.percentage}%)`)
```

## Performance & Monitoring

### Token Usage Tracking
```typescript
import { estimateTokens, estimateCost } from '@/lib/ai/claude'

const inputTokens = estimateTokens(text)
const cost = estimateCost(inputTokens, outputTokens)
console.log(`Estimated cost: $${cost.toFixed(4)}`)
```

### Performance Monitoring
```typescript
import { trackPerformance } from '@/lib/ai/utils'

trackPerformance({
  processingTime: 2500, // ms
  tokenCount: 1234,
  cplScore: 78,
  success: true
})
```

### Usage Quotas
```typescript
import { checkUsageQuota, getDefaultQuota } from '@/lib/ai/utils'

const quota = getDefaultQuota('premium')
const usage = { tokens: 50000, cost: 12.50 }
const check = checkUsageQuota(usage, quota, 'daily')

if (!check.allowed) {
  console.log('Quota exceeded:', check.reason)
}
```

## Error Handling

### Error Types
```typescript
interface AIError {
  code: string          // Error classification
  message: string       // User-friendly message
  details?: any         // Technical details
  retryable: boolean    // Whether to retry
  suggestedAction?: string // What user should do
}
```

### Error Handling Example
```typescript
import { handleAIError } from '@/lib/ai/utils'

try {
  const result = await processWithClaude(text, 'adaptive_polish')
  // Handle success
} catch (error) {
  const aiError = handleAIError(error)

  if (aiError.retryable) {
    // Show retry option
    setError(`${aiError.message} ${aiError.suggestedAction}`)
  } else {
    // Show permanent error
    setError(aiError.message)
  }
}
```

### Common Error Scenarios
- **Rate Limiting**: Automatic backoff and retry
- **Invalid Input**: Validation and sanitization
- **Network Issues**: Connection retry logic
- **API Errors**: Graceful degradation
- **Quota Exceeded**: Usage limit enforcement

## Testing

### Unit Tests
```typescript
import { validateTextInput, sanitizeTextInput } from '@/lib/ai/utils'

describe('Text Validation', () => {
  test('validates text input correctly', () => {
    const result = validateTextInput('Valid text content')
    expect(result.valid).toBe(true)
  })

  test('rejects harmful content', () => {
    const result = validateTextInput('hack password')
    expect(result.valid).toBe(false)
  })
})
```

### Integration Tests
```typescript
import { processWithClaude } from '@/lib/ai/claude'

describe('Claude API Integration', () => {
  test('processes grammar fix correctly', async () => {
    const result = await processWithClaude(
      'This sentence have errors.',
      'grammar_fix'
    )

    expect(result.success).toBe(true)
    expect(result.content).toContain('has')
  })
})
```

## Deployment Considerations

### Production Setup
1. **API Key Security**: Use secure environment variable management
2. **Rate Limiting**: Implement user-based rate limiting
3. **Monitoring**: Set up error tracking and performance monitoring
4. **Caching**: Implement response caching for repeated requests
5. **Quotas**: Configure appropriate usage limits per user tier

### Scaling Considerations
1. **Queue Management**: Implement processing queues for high load
2. **Load Balancing**: Distribute processing across multiple instances
3. **Caching Strategy**: Cache CPL analyses and common corrections
4. **Database Optimization**: Index processing tables for performance

### Cost Optimization
1. **Smart Batching**: Combine small requests when possible
2. **Caching**: Avoid reprocessing identical content
3. **Quota Management**: Enforce usage limits per user tier
4. **Model Selection**: Use appropriate model for each task type

---

**Status**: ✅ Production Ready

The AI integration provides a robust, secure, and scalable foundation for Ascendia's core text processing capabilities, with comprehensive error handling, performance monitoring, and cost management.