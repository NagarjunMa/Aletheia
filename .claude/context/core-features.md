# Ascendia Core Features Specification

## 1. Authentication System

### Google OAuth Implementation

#### Configuration
```typescript
// lib/auth/google-oauth.ts
import { createClient } from '@/lib/supabase/client'

export async function signInWithGoogle() {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  })

  if (error) throw new Error(`Google OAuth failed: ${error.message}`)
  return data
}
```

#### Supabase Dashboard Configuration
```sql
-- Enable Google OAuth in Supabase Auth settings
-- Add these redirect URLs:
-- Development: http://localhost:3000/auth/callback
-- Production: https://ascendia.vercel.app/auth/callback

-- OAuth Scopes Required:
-- - email
-- - profile
-- - openid
```

### Email/Password Authentication Flow

#### Registration Component
```typescript
// components/auth/register-form.tsx
'use client'

import { useFormState } from 'react-dom'
import { registerAction } from '@/lib/actions/auth'

export function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, null)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full p-2 border rounded-md"
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          className="w-full p-2 border rounded-md"
        />
      </div>

      <div>
        <label htmlFor="fullName">Full Name</label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          className="w-full p-2 border rounded-md"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-primary text-white p-2 rounded-md hover:bg-primary/90"
      >
        Create Account
      </button>

      {state?.error && (
        <p className="text-red-500 text-sm">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-green-500 text-sm">
          Account created! Check your email to verify.
        </p>
      )}
    </form>
  )
}
```

#### Server Action for Registration
```typescript
// lib/actions/auth/register.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters')
})

export async function registerAction(prevState: any, formData: FormData) {
  try {
    const validatedData = registerSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      fullName: formData.get('fullName')
    })

    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          full_name: validatedData.fullName
        }
      }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, message: 'Registration successful! Check your email.' }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: 'Registration failed' }
  }
}
```

### User Profile Management

#### Profile Update Component
```typescript
// components/profile/profile-form.tsx
'use client'

import { useFormState } from 'react-dom'
import { updateProfileAction } from '@/lib/actions/profile'

interface ProfileFormProps {
  user: {
    id: string
    email: string
    full_name: string
    avatar_url: string
  }
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [state, formAction] = useFormState(updateProfileAction, null)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="userId" value={user.id} />

      <div>
        <label htmlFor="fullName">Full Name</label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          defaultValue={user.full_name}
          className="w-full p-2 border rounded-md"
        />
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={user.email}
          disabled
          className="w-full p-2 border rounded-md bg-gray-100"
        />
        <p className="text-sm text-gray-500">Email cannot be changed</p>
      </div>

      <button
        type="submit"
        className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90"
      >
        Update Profile
      </button>

      {state?.error && (
        <p className="text-red-500 text-sm">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-green-500 text-sm">Profile updated successfully!</p>
      )}
    </form>
  )
}
```

### Session Handling and Security

#### Session Middleware
```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })

  const {
    data: { session }
  } = await supabase.auth.getSession()

  // Protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Redirect authenticated users away from auth pages
  if (request.nextUrl.pathname.startsWith('/login') ||
      request.nextUrl.pathname.startsWith('/register')) {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register']
}
```

## 2. Content Processing Pipeline

### 4-Step Adaptive Agent Pipeline

#### Pipeline Overview
```typescript
// lib/pipeline/adaptive-pipeline.ts
export class AdaptiveAgentPipeline {
  async process(input: UserInput): Promise<ProcessedResult> {
    // Step 1: Pre-Processing
    const validated = await this.validateAndSanitize(input)

    // Step 2: Orchestration
    const context = await this.gatherContext(validated)

    // Step 3: AI Generation
    const drafts = await this.generateDrafts(validated, context)

    // Step 4: Post-Processing
    const sanitized = await this.sanitizeOutputs(drafts)

    return this.packageResult(sanitized)
  }

  private async validateAndSanitize(input: UserInput): Promise<ValidatedInput> {
    // Input validation
    const validation = ContentSanitizer.validateUserInput(input.content)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Content sanitization
    const sanitized = ContentSanitizer.sanitizeUserInput(input.content)

    return {
      ...input,
      content: sanitized,
      wordCount: sanitized.split(/\s+/).length,
      estimatedComplexity: this.estimateComplexity(sanitized)
    }
  }

  private async gatherContext(input: ValidatedInput): Promise<ProcessingContext> {
    // Get user's CPL history
    const userCPL = await this.getUserCPLScore(input.userId)

    // Get conversation history
    const conversationHistory = await this.getConversationContext(input.conversationId)

    // Get category-specific rules
    const categoryRules = this.getCategoryRules(input.category)

    return {
      userCPL,
      conversationHistory,
      categoryRules,
      timestamp: new Date(),
      estimatedTokens: this.estimateTokenUsage(input.content)
    }
  }
}
```

### Input Validation and Sanitization

#### Comprehensive Input Validator
```typescript
// lib/validation/input-validator.ts
import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

export class InputValidator {
  private static createDOMPurify() {
    const window = new JSDOM('').window
    return DOMPurify(window as any)
  }

  static validateAndClean(input: string): ValidationResult {
    const DOMPurifyInstance = this.createDOMPurify()

    // Remove potentially dangerous HTML/JS
    const cleaned = DOMPurifyInstance.sanitize(input, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: []
    })

    // Check for prompt injection attempts
    const dangerousPatterns = [
      /ignore\s+previous\s+instructions/i,
      /system\s*:\s*/i,
      /assistant\s*:\s*/i,
      /human\s*:\s*/i,
      /<\|system\|>/i,
      /<\|assistant\|>/i,
      /\[SYSTEM\]/i,
      /\[ASSISTANT\]/i
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(cleaned)) {
        return {
          valid: false,
          error: 'Content contains potentially harmful instructions',
          sanitized: cleaned.replace(pattern, '[FILTERED]')
        }
      }
    }

    // Length validation
    if (cleaned.length < 10) {
      return {
        valid: false,
        error: 'Content too short (minimum 10 characters)',
        sanitized: cleaned
      }
    }

    if (cleaned.length > 5000) {
      return {
        valid: false,
        error: 'Content too long (maximum 5000 characters)',
        sanitized: cleaned.substring(0, 5000) + '...'
      }
    }

    return {
      valid: true,
      sanitized: cleaned,
      statistics: {
        wordCount: cleaned.split(/\s+/).length,
        characterCount: cleaned.length,
        sentenceCount: cleaned.split(/[.!?]+/).filter(s => s.trim()).length
      }
    }
  }
}
```

### AI Processing Workflow

#### Draft Generation Service
```typescript
// lib/ai/draft-generator.ts
import { Anthropic } from '@anthropic-ai/sdk'

export class DraftGenerator {
  private anthropic: Anthropic

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })
  }

  async generateDualDrafts(
    input: ValidatedInput,
    context: ProcessingContext
  ): Promise<DraftPair> {
    const systemPrompt = this.buildSystemPrompt(context.userCPL, input.category)
    const userPrompt = this.buildUserPrompt(input.content, context)

    const response = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    })

    const responseText = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    return this.parseDualDrafts(responseText, input, context)
  }

  private buildSystemPrompt(cplScore: number, category: string): string {
    const complexityLevel = this.mapCPLToComplexity(cplScore)

    return `You are Ascendia, a highly specialized Personal Voice Agent. Your core instruction is to preserve the human's raw, unpolished voice while ensuring clarity.

The user's current Content Polish Level (CPL) is ${cplScore}. This indicates they prefer:
- LEXICAL DIVERSITY: ${complexityLevel.lexical}
- SENTENCE STRUCTURE: ${complexityLevel.structure}
- FORMALITY LEVEL: ${complexityLevel.formality}

For ${category} content, apply these additional constraints:
${this.getCategoryConstraints(category)}

You MUST output two distinct versions, labeled clearly:

[DRAFT 1: Grammar Fix Only]: Only correct spelling, grammar, and punctuation. Do NOT alter vocabulary, sentence length, or style. Preserve the user's natural voice completely.

[DRAFT 2: Adaptive Polish]: Apply the CPL constraints above. Polish the text for clarity and professionalism while ensuring the final complexity aligns with CPL ${cplScore}. Maintain the user's unique voice and personality.

Important: Both drafts should feel authentic to the original writer's style and intent.`
  }

  private mapCPLToComplexity(cplScore: number) {
    if (cplScore < 30) {
      return {
        lexical: 'Very simple vocabulary, common words only',
        structure: 'Short, direct sentences (5-15 words)',
        formality: 'Casual, conversational tone'
      }
    } else if (cplScore < 60) {
      return {
        lexical: 'Moderate vocabulary with some professional terms',
        structure: 'Mixed sentence lengths (10-25 words)',
        formality: 'Semi-formal, professional but approachable'
      }
    } else {
      return {
        lexical: 'Rich vocabulary with technical and sophisticated terms',
        structure: 'Complex sentences with varied structure (15-35 words)',
        formality: 'Formal, highly professional tone'
      }
    }
  }

  private parseDualDrafts(
    responseText: string,
    input: ValidatedInput,
    context: ProcessingContext
  ): DraftPair {
    // Parse the dual draft format
    const grammarFixMatch = responseText.match(/\[DRAFT 1: Grammar Fix Only\]:\s*(.*?)(?=\[DRAFT 2|$)/s)
    const adaptivePolishMatch = responseText.match(/\[DRAFT 2: Adaptive Polish\]:\s*(.*?)$/s)

    const grammarFix = grammarFixMatch?.[1]?.trim() || input.content
    const adaptivePolish = adaptivePolishMatch?.[1]?.trim() || input.content

    return {
      grammarFix: {
        content: grammarFix,
        type: 'grammar_fix',
        cplScore: context.userCPL,
        metadata: {
          originalLength: input.content.length,
          processedLength: grammarFix.length,
          changesCount: this.countChanges(input.content, grammarFix)
        }
      },
      adaptivePolish: {
        content: adaptivePolish,
        type: 'adaptive_polish',
        cplScore: CPLCalculator.calculate(adaptivePolish),
        metadata: {
          originalLength: input.content.length,
          processedLength: adaptivePolish.length,
          cplAlignment: Math.abs(context.userCPL - CPLCalculator.calculate(adaptivePolish))
        }
      }
    }
  }
}
```

### Output Sanitization and Content Cleaning

#### Final Sanitation Layer
```typescript
// lib/sanitization/output-sanitizer.ts
export class OutputSanitizer {
  static sanitizeLLMOutput(text: string): string {
    // Step 1: Remove zero-width characters and invisible watermarks
    const zeroWidthRegex = /[\u200B-\u200D\uFEFF\u200E-\u200F\u2060-\u206F]/g
    let cleaned = text.replace(zeroWidthRegex, '')

    // Step 2: Remove other potential watermark characters
    const invisibleChars = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E]/g
    cleaned = cleaned.replace(invisibleChars, '')

    // Step 3: Normalize Unicode characters
    cleaned = cleaned.normalize('NFKC')

    // Step 4: Collapse excessive whitespace
    const whitespaceRegex = /\s\s+/g
    cleaned = cleaned.trim().replace(whitespaceRegex, ' ')

    // Step 5: Remove draft labels if they leak through
    const draftLabelRegex = /\[(DRAFT \d+|Grammar Fix Only|Adaptive Polish)[:\]].*/gi
    cleaned = cleaned.replace(draftLabelRegex, '').trim()

    // Step 6: Clean up trailing punctuation anomalies
    cleaned = cleaned.replace(/([.!?]){2,}/g, '$1')

    return cleaned
  }

  static validateOutputQuality(
    original: string,
    processed: string,
    type: 'grammar_fix' | 'adaptive_polish'
  ): QualityReport {
    const report: QualityReport = {
      passed: true,
      issues: [],
      score: 100,
      recommendations: []
    }

    // Check for appropriate length changes
    const lengthChange = (processed.length - original.length) / original.length

    if (type === 'grammar_fix' && Math.abs(lengthChange) > 0.2) {
      report.issues.push('Grammar fix changed content length by more than 20%')
      report.score -= 20
    }

    if (type === 'adaptive_polish' && Math.abs(lengthChange) > 0.5) {
      report.issues.push('Adaptive polish changed content length dramatically')
      report.score -= 15
    }

    // Check for content preservation
    const similarity = this.calculateSimilarity(original, processed)
    if (similarity < 0.7) {
      report.issues.push('Content similarity too low - may have lost original meaning')
      report.score -= 25
    }

    // Check for grammar improvement
    const grammarScore = this.assessGrammarQuality(processed)
    if (grammarScore < 0.8) {
      report.issues.push('Grammar quality still needs improvement')
      report.score -= 10
    }

    report.passed = report.score >= 70
    return report
  }

  private static calculateSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  private static assessGrammarQuality(text: string): number {
    // Basic grammar quality checks
    let score = 1.0

    // Check for common grammar issues
    const issues = [
      /\bi\s+am\b/gi,  // Should be "I am" not "i am"
      /\.\s*[a-z]/g,   // Sentences should start with capital letters
      /\s{2,}/g,       // Multiple spaces
      /[.!?]{2,}/g     // Multiple punctuation
    ]

    for (const issue of issues) {
      const matches = text.match(issue)
      if (matches) {
        score -= (matches.length * 0.1)
      }
    }

    return Math.max(0, score)
  }
}
```

## 3. Content Polish Level (CPL) System

### CPL Calculation Algorithm

#### Core Calculator Implementation
```typescript
// lib/cpl/calculator.ts
export class CPLCalculator {
  static calculate(content: string, userHistory: string[] = []): number {
    const baseMetrics = this.calculateBaseMetrics(content)
    const contextualAdjustment = userHistory.length > 0
      ? this.calculateContextualAdjustment(baseMetrics, userHistory)
      : 0

    const rawScore = (
      baseMetrics.lexicalDiversity * 30 +
      baseMetrics.sentenceComplexity * 25 +
      baseMetrics.formalityLevel * 25 +
      baseMetrics.coherence * 20
    ) + contextualAdjustment

    return Math.round(Math.min(100, Math.max(0, rawScore)))
  }

  private static calculateBaseMetrics(content: string): CPLMetrics {
    return {
      lexicalDiversity: this.calculateTTR(content),
      sentenceComplexity: this.calculateSentenceComplexity(content),
      formalityLevel: this.calculateFormality(content),
      coherence: this.calculateCoherence(content)
    }
  }

  private static calculateTTR(text: string): number {
    // Type-Token Ratio: unique words / total words
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 0)

    if (words.length === 0) return 0

    const uniqueWords = new Set(words)
    const ttr = uniqueWords.size / words.length

    // Normalize to 0-100 scale (typical TTR ranges from 0.3 to 0.8)
    return Math.min(100, (ttr - 0.3) * 200)
  }

  private static calculateSentenceComplexity(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length === 0) return 0

    let complexityScore = 0

    sentences.forEach(sentence => {
      const words = sentence.trim().split(/\s+/)
      const wordCount = words.length

      // Length complexity (optimal range: 15-25 words)
      let lengthScore = 0
      if (wordCount >= 15 && wordCount <= 25) {
        lengthScore = 100
      } else if (wordCount >= 10 && wordCount <= 30) {
        lengthScore = 80
      } else if (wordCount >= 5 && wordCount <= 35) {
        lengthScore = 60
      } else {
        lengthScore = 30
      }

      // Structural complexity
      const structuralScore = this.analyzeStructuralComplexity(sentence)

      complexityScore += (lengthScore + structuralScore) / 2
    })

    return complexityScore / sentences.length
  }

  private static analyzeStructuralComplexity(sentence: string): number {
    let score = 40 // Base score

    // Check for subordinate clauses
    const subordinateMarkers = [
      'because', 'although', 'while', 'since', 'whereas', 'if', 'when',
      'that', 'which', 'who', 'where', 'unless', 'until'
    ]

    const subordinateClauses = subordinateMarkers.filter(marker =>
      sentence.toLowerCase().includes(` ${marker} `)
    ).length

    score += subordinateClauses * 15

    // Check for coordinating conjunctions
    const coordinatingConjunctions = ['and', 'but', 'or', 'nor', 'for', 'yet', 'so']
    const coordinates = coordinatingConjunctions.filter(conj =>
      sentence.toLowerCase().includes(` ${conj} `)
    ).length

    score += coordinates * 10

    // Check for passive voice
    const passiveMarkers = /\b(is|are|was|were|being|been)\s+\w+ed\b/gi
    const passiveMatches = sentence.match(passiveMarkers)
    if (passiveMatches) {
      score += passiveMatches.length * 8
    }

    return Math.min(100, score)
  }

  private static calculateFormality(text: string): number {
    let formalityScore = 50 // Neutral baseline

    // Formal indicators
    const formalWords = [
      'therefore', 'furthermore', 'consequently', 'nevertheless', 'moreover',
      'subsequently', 'accordingly', 'specifically', 'particularly', 'essentially',
      'establish', 'demonstrate', 'indicate', 'suggest', 'recommend', 'propose',
      'analysis', 'evaluation', 'assessment', 'implementation', 'methodology'
    ]

    const formalMatches = formalWords.filter(word =>
      text.toLowerCase().includes(word)
    ).length

    formalityScore += formalMatches * 5

    // Informal indicators
    const informalWords = [
      'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'yeah', 'ok', 'okay',
      'stuff', 'things', 'get', 'got', 'really', 'very', 'pretty', 'quite',
      'awesome', 'cool', 'great', 'amazing', 'super', 'totally'
    ]

    const informalMatches = informalWords.filter(word =>
      text.toLowerCase().includes(word)
    ).length

    formalityScore -= informalMatches * 3

    // Contractions reduce formality
    const contractions = text.match(/\w+'\w+/g) || []
    formalityScore -= contractions.length * 2

    // First person usage reduces formality in formal contexts
    const firstPerson = text.match(/\b(I|me|my|mine|myself)\b/gi) || []
    formalityScore -= firstPerson.length * 1.5

    return Math.min(100, Math.max(0, formalityScore))
  }

  private static calculateCoherence(text: string): number {
    let coherenceScore = 50 // Base score

    // Transition words and phrases
    const transitionWords = [
      'however', 'therefore', 'furthermore', 'moreover', 'nevertheless',
      'consequently', 'additionally', 'similarly', 'likewise', 'in contrast',
      'on the other hand', 'for example', 'for instance', 'in conclusion',
      'first', 'second', 'third', 'finally', 'next', 'then', 'meanwhile'
    ]

    const transitions = transitionWords.filter(transition =>
      text.toLowerCase().includes(transition)
    ).length

    coherenceScore += transitions * 8

    // Repetition of key terms (good for coherence)
    const words = text.toLowerCase().split(/\s+/)
    const wordFreq = new Map()

    words.forEach(word => {
      if (word.length > 4) { // Only consider substantial words
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
      }
    })

    const repeatedTerms = Array.from(wordFreq.values()).filter(freq => freq > 1)
    coherenceScore += repeatedTerms.length * 3

    // Paragraph structure (assuming sentences as proxy)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length > 3) {
      coherenceScore += 10 // Bonus for multi-sentence structure
    }

    return Math.min(100, coherenceScore)
  }
}
```

### User Adaptation Mechanism

#### Adaptive Learning System
```typescript
// lib/cpl/adaptive-learning.ts
export class AdaptiveLearningSystem {
  async adaptUserCPL(userId: string, draftFeedback: DraftFeedback[]): Promise<number> {
    const currentCPL = await this.getCurrentCPL(userId)
    const recentFeedback = draftFeedback.slice(-10) // Last 10 interactions

    const adaptation = this.calculateAdaptation(recentFeedback, currentCPL)
    const newCPL = this.applyAdaptation(currentCPL, adaptation)

    await this.updateUserCPL(userId, newCPL)
    return newCPL
  }

  private calculateAdaptation(feedback: DraftFeedback[], currentCPL: number): CPLAdaptation {
    let complexityAdjustment = 0
    let formalityAdjustment = 0
    let lengthAdjustment = 0

    feedback.forEach(fb => {
      if (fb.draftType === 'adaptive_polish') {
        // Analyze user acceptance patterns
        if (fb.accepted) {
          // User liked this complexity level
          const draftCPL = CPLCalculator.calculate(fb.content)
          const difference = draftCPL - currentCPL

          if (Math.abs(difference) < 5) {
            // Small difference, user likes current level
            complexityAdjustment += 0.5
          } else {
            // Large difference, move toward accepted level
            complexityAdjustment += difference * 0.1
          }
        } else {
          // User rejected this draft
          const draftCPL = CPLCalculator.calculate(fb.content)
          const difference = draftCPL - currentCPL

          // Move away from rejected complexity
          complexityAdjustment -= difference * 0.1
        }

        // Learn from user edits
        if (fb.userEdits) {
          const editAnalysis = this.analyzeUserEdits(fb.content, fb.userEdits)
          formalityAdjustment += editAnalysis.formalityChange * 0.05
          lengthAdjustment += editAnalysis.lengthChange * 0.03
        }
      }
    })

    return {
      complexityAdjustment: Math.max(-10, Math.min(10, complexityAdjustment)),
      formalityAdjustment: Math.max(-10, Math.min(10, formalityAdjustment)),
      lengthAdjustment: Math.max(-10, Math.min(10, lengthAdjustment))
    }
  }

  private analyzeUserEdits(original: string, edited: string): EditAnalysis {
    const originalMetrics = CPLCalculator.calculateBaseMetrics(original)
    const editedMetrics = CPLCalculator.calculateBaseMetrics(edited)

    return {
      formalityChange: editedMetrics.formalityLevel - originalMetrics.formalityLevel,
      lengthChange: (edited.length - original.length) / original.length,
      complexityChange: editedMetrics.sentenceComplexity - originalMetrics.sentenceComplexity,
      vocabularyChange: editedMetrics.lexicalDiversity - originalMetrics.lexicalDiversity
    }
  }

  private applyAdaptation(currentCPL: number, adaptation: CPLAdaptation): number {
    const totalAdjustment = (
      adaptation.complexityAdjustment * 0.5 +
      adaptation.formalityAdjustment * 0.3 +
      adaptation.lengthAdjustment * 0.2
    )

    const newCPL = currentCPL + totalAdjustment

    // Ensure CPL stays within reasonable bounds
    return Math.max(10, Math.min(90, newCPL))
  }
}
```

### Learning Loop Implementation

#### Feedback Processing System
```typescript
// lib/actions/feedback/process-feedback.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { AdaptiveLearningSystem } from '@/lib/cpl/adaptive-learning'
import { revalidatePath } from 'next/cache'

export async function processDraftFeedback(
  draftId: string,
  accepted: boolean,
  userEdits?: string
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    // Update draft acceptance status
    const { error: updateError } = await supabase
      .from('generated_drafts')
      .update({
        is_accepted: accepted,
        user_edits: userEdits || null,
        feedback_timestamp: new Date().toISOString()
      })
      .eq('id', draftId)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    // Get recent feedback for learning
    const { data: recentFeedback } = await supabase
      .from('generated_drafts')
      .select('content, is_accepted, user_edits, draft_type, cpl_score')
      .eq('user_id', user.id)
      .not('is_accepted', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)

    if (recentFeedback && recentFeedback.length > 0) {
      // Trigger adaptive learning
      const learningSystem = new AdaptiveLearningSystem()
      const newCPL = await learningSystem.adaptUserCPL(user.id, recentFeedback)

      // Update user's CPL score
      await supabase
        .from('profiles')
        .update({ cpl_score: newCPL })
        .eq('id', user.id)
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Feedback processing failed:', error)
    return { success: false, error: 'Failed to process feedback' }
  }
}
```

## 4. Draft Generation System

### Two-Draft Generation Logic

#### Dual Draft Manager
```typescript
// lib/drafts/dual-draft-manager.ts
export class DualDraftManager {
  async generateDrafts(
    userInput: string,
    userId: string,
    conversationId: string,
    category: string
  ): Promise<DraftPair> {
    // Get user's current CPL score
    const userProfile = await this.getUserProfile(userId)
    const cplScore = userProfile.cpl_score || 50

    // Generate both drafts in parallel for efficiency
    const [grammarDraft, adaptiveDraft] = await Promise.all([
      this.generateGrammarFixDraft(userInput),
      this.generateAdaptivePolishDraft(userInput, cplScore, category)
    ])

    // Save both drafts to database
    const savedDrafts = await this.saveDrafts(
      userInput,
      userId,
      conversationId,
      grammarDraft,
      adaptiveDraft
    )

    return {
      grammarFix: savedDrafts.grammarFix,
      adaptivePolish: savedDrafts.adaptivePolish
    }
  }

  private async generateGrammarFixDraft(input: string): Promise<Draft> {
    const systemPrompt = `You are a precise grammar and spelling checker. Your ONLY task is to correct grammatical errors, spelling mistakes, and punctuation issues.

CRITICAL RULES:
1. Do NOT change vocabulary or word choice
2. Do NOT alter sentence structure or length
3. Do NOT modify the tone or style
4. Do NOT add or remove content
5. ONLY fix clear grammatical errors

Preserve the writer's natural voice and personality completely.`

    const response = await this.callClaude({
      system: systemPrompt,
      user: `Please fix only the grammar and spelling in this text: "${input}"`
    })

    return {
      content: ContentSanitizer.sanitizeLLMOutput(response),
      type: 'grammar_fix',
      cplScore: CPLCalculator.calculate(input), // Same as original
      metadata: {
        changesCount: this.countDifferences(input, response),
        preservationScore: this.calculatePreservationScore(input, response)
      }
    }
  }

  private async generateAdaptivePolishDraft(
    input: string,
    targetCPL: number,
    category: string
  ): Promise<Draft> {
    const systemPrompt = this.buildAdaptiveSystemPrompt(targetCPL, category)

    const response = await this.callClaude({
      system: systemPrompt,
      user: `Original text: "${input}"\n\nPlease create an adaptive polish version that maintains the writer's voice while targeting CPL ${targetCPL}.`
    })

    const polishedContent = ContentSanitizer.sanitizeLLMOutput(response)
    const actualCPL = CPLCalculator.calculate(polishedContent)

    return {
      content: polishedContent,
      type: 'adaptive_polish',
      cplScore: actualCPL,
      metadata: {
        targetCPL,
        cplAlignment: Math.abs(targetCPL - actualCPL),
        improvementAreas: this.identifyImprovements(input, polishedContent)
      }
    }
  }

  private buildAdaptiveSystemPrompt(targetCPL: number, category: string): string {
    const complexity = this.mapCPLToInstructions(targetCPL)
    const categoryRules = this.getCategorySpecificRules(category)

    return `You are Ascendia, an adaptive writing assistant. Polish the text to match CPL ${targetCPL}.

TARGET COMPLEXITY LEVEL:
- Vocabulary: ${complexity.vocabulary}
- Sentence Structure: ${complexity.sentences}
- Formality: ${complexity.formality}

CATEGORY-SPECIFIC RULES (${category}):
${categoryRules}

CRITICAL REQUIREMENTS:
1. Maintain the writer's unique voice and personality
2. Preserve the core message and intent
3. Apply improvements that align with CPL ${targetCPL}
4. Ensure the result feels natural, not artificial
5. Focus on clarity and readability within the complexity level

The result should feel like the original writer on their best day.`
  }

  private mapCPLToInstructions(cpl: number): ComplexityInstructions {
    if (cpl < 30) {
      return {
        vocabulary: 'Use simple, everyday words. Avoid jargon or technical terms.',
        sentences: 'Keep sentences short and direct (5-15 words). Use simple structure.',
        formality: 'Maintain casual, conversational tone. Use contractions if natural.'
      }
    } else if (cpl < 60) {
      return {
        vocabulary: 'Use clear, professional language. Some technical terms are okay if explained.',
        sentences: 'Mix sentence lengths (10-25 words). Use some compound sentences.',
        formality: 'Professional but approachable. Balance formality with personality.'
      }
    } else {
      return {
        vocabulary: 'Use sophisticated vocabulary including technical and academic terms.',
        sentences: 'Vary sentence structure (15-35 words). Use complex and compound-complex sentences.',
        formality: 'Formal, professional tone. Minimize contractions and colloquialisms.'
      }
    }
  }
}
```

### Grammar Fix Only Algorithm

#### Conservative Grammar Correction
```typescript
// lib/drafts/grammar-fix.ts
export class GrammarFixEngine {
  static async fixGrammarOnly(text: string): Promise<GrammarFixResult> {
    // Use a conservative approach that only fixes clear errors
    const corrections = []

    // Common grammar patterns to fix
    const grammarRules = [
      {
        pattern: /\bi\b/g,
        replacement: 'I',
        description: 'Capitalize pronoun "I"'
      },
      {
        pattern: /([.!?])\s*([a-z])/g,
        replacement: (match, punctuation, letter) => `${punctuation} ${letter.toUpperCase()}`,
        description: 'Capitalize first letter of sentences'
      },
      {
        pattern: /\s+([.!?])/g,
        replacement: '$1',
        description: 'Remove space before punctuation'
      },
      {
        pattern: /([.!?]){2,}/g,
        replacement: '$1',
        description: 'Remove multiple punctuation marks'
      },
      {
        pattern: /\s{2,}/g,
        replacement: ' ',
        description: 'Replace multiple spaces with single space'
      }
    ]

    let correctedText = text

    grammarRules.forEach(rule => {
      const originalText = correctedText
      if (typeof rule.replacement === 'function') {
        correctedText = correctedText.replace(rule.pattern, rule.replacement)
      } else {
        correctedText = correctedText.replace(rule.pattern, rule.replacement)
      }

      if (originalText !== correctedText) {
        corrections.push({
          rule: rule.description,
          before: originalText,
          after: correctedText
        })
      }
    })

    return {
      correctedText: correctedText.trim(),
      corrections,
      preservationScore: this.calculatePreservationScore(text, correctedText)
    }
  }

  private static calculatePreservationScore(original: string, corrected: string): number {
    const originalWords = original.toLowerCase().split(/\s+/)
    const correctedWords = corrected.toLowerCase().split(/\s+/)

    // Count preserved words
    const preservedWords = originalWords.filter((word, index) =>
      correctedWords[index] === word
    ).length

    return (preservedWords / originalWords.length) * 100
  }
}
```

### Adaptive Polish Algorithm

#### Intelligent Content Enhancement
```typescript
// lib/drafts/adaptive-polish.ts
export class AdaptivePolishEngine {
  static async polishContent(
    text: string,
    targetCPL: number,
    userPreferences: UserPreferences
  ): Promise<PolishResult> {
    const currentCPL = CPLCalculator.calculate(text)
    const cplDifference = targetCPL - currentCPL

    let polishingStrategy: PolishingStrategy

    if (Math.abs(cplDifference) < 10) {
      polishingStrategy = 'minimal' // Text is already close to target
    } else if (cplDifference > 0) {
      polishingStrategy = 'enhance' // Need to increase complexity
    } else {
      polishingStrategy = 'simplify' // Need to decrease complexity
    }

    const polishedText = await this.applyPolishingStrategy(
      text,
      polishingStrategy,
      targetCPL,
      userPreferences
    )

    return {
      polishedText,
      strategy: polishingStrategy,
      cplChange: CPLCalculator.calculate(polishedText) - currentCPL,
      improvements: this.analyzeImprovements(text, polishedText)
    }
  }

  private static async applyPolishingStrategy(
    text: string,
    strategy: PolishingStrategy,
    targetCPL: number,
    preferences: UserPreferences
  ): Promise<string> {
    switch (strategy) {
      case 'minimal':
        return this.applyMinimalPolish(text, preferences)

      case 'enhance':
        return this.enhanceComplexity(text, targetCPL, preferences)

      case 'simplify':
        return this.simplifyContent(text, targetCPL, preferences)

      default:
        return text
    }
  }

  private static applyMinimalPolish(
    text: string,
    preferences: UserPreferences
  ): string {
    // Apply minimal improvements while preserving style
    let polished = text

    // Improve sentence flow with better transitions
    if (preferences.useTransitions) {
      polished = this.addTransitions(polished)
    }

    // Enhance clarity without changing complexity
    polished = this.improveClarity(polished)

    // Fix awkward phrasings
    polished = this.smoothPhrasing(polished)

    return polished
  }

  private static enhanceComplexity(
    text: string,
    targetCPL: number,
    preferences: UserPreferences
  ): string {
    let enhanced = text

    // Increase vocabulary sophistication
    enhanced = this.upgradeVocabulary(enhanced, targetCPL)

    // Combine short sentences into more complex ones
    enhanced = this.combineShortSentences(enhanced)

    // Add sophisticated transitions
    enhanced = this.addSophisticatedTransitions(enhanced)

    // Increase formality if appropriate
    if (preferences.allowFormalityIncrease) {
      enhanced = this.increaseFormality(enhanced)
    }

    return enhanced
  }

  private static simplifyContent(
    text: string,
    targetCPL: number,
    preferences: UserPreferences
  ): string {
    let simplified = text

    // Replace complex vocabulary with simpler alternatives
    simplified = this.simplifyVocabulary(simplified, targetCPL)

    // Break down complex sentences
    simplified = this.breakDownComplexSentences(simplified)

    // Use more direct language
    simplified = this.makeMoreDirect(simplified)

    // Reduce formality if appropriate
    if (preferences.allowFormalityDecrease) {
      simplified = this.reduceFormality(simplified)
    }

    return simplified
  }
}
```

### User Feedback Integration

#### Feedback Collection and Processing
```typescript
// components/drafts/draft-feedback.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { processDraftFeedback } from '@/lib/actions/feedback/process-feedback'

interface DraftFeedbackProps {
  draft: Draft
  onFeedbackSubmitted: () => void
}

export function DraftFeedback({ draft, onFeedbackSubmitted }: DraftFeedbackProps) {
  const [userEdits, setUserEdits] = useState(draft.content)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAccept = async () => {
    setIsSubmitting(true)
    try {
      await processDraftFeedback(draft.id, true, userEdits)
      onFeedbackSubmitted()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    setIsSubmitting(true)
    try {
      await processDraftFeedback(draft.id, false)
      onFeedbackSubmitted()
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasEdits = userEdits !== draft.content

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="edits" className="block text-sm font-medium mb-2">
          Edit the draft if needed:
        </label>
        <Textarea
          id="edits"
          value={userEdits}
          onChange={(e) => setUserEdits(e.target.value)}
          className="w-full h-32"
          placeholder="Make any edits to improve the draft..."
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleAccept}
          disabled={isSubmitting}
          variant={hasEdits ? "secondary" : "default"}
        >
          {hasEdits ? 'Accept with Edits' : 'Accept Draft'}
        </Button>

        <Button
          onClick={handleReject}
          disabled={isSubmitting}
          variant="destructive"
        >
          Reject Draft
        </Button>
      </div>

      {hasEdits && (
        <p className="text-sm text-muted-foreground">
          Your edits will help Ascendia learn your preferences better.
        </p>
      )}
    </div>
  )
}
```

This comprehensive specification provides a complete blueprint for implementing all core features of Ascendia, with detailed code examples and implementation guidance for each major system component.