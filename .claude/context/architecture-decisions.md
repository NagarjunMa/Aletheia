# Ascendia Architecture Decisions

## Technology Stack Rationale

### Next.js 14.x vs 15.x Decision

#### Decision: Next.js 14.x
**Rationale:**
- **Supabase Compatibility**: Critical incompatibility between Supabase auth helpers and Next.js 15.x async APIs
- **Production Stability**: Next.js 14.x is battle-tested in production environments
- **Migration Path**: Clear upgrade path to 15.x when Supabase compatibility is resolved (expected Q1 2025)

**Technical Details:**
```typescript
// Next.js 15.x breaks this pattern (used by Supabase)
import { cookies } from 'next/headers'

// Current usage (works in 14.x)
const cookieStore = cookies()

// Next.js 15.x requires (not supported by Supabase yet)
const cookieStore = await cookies()
```

**Risk Mitigation:**
- Monitor Supabase v3.0 release for Next.js 15 compatibility
- Create migration branch for testing when compatibility is achieved

### Vercel AI SDK vs LangChain Comparison

#### Decision: Vercel AI SDK (Primary) + LangChain (Specific Features)

| Aspect | Vercel AI SDK | LangChain | Winner |
|--------|---------------|-----------|--------|
| Bundle Size | 45KB (optimized) | 180KB+ (full) | Vercel AI SDK |
| Next.js Integration | Native, seamless | Requires adapters | Vercel AI SDK |
| Streaming Support | Excellent, built-in | Good, needs setup | Vercel AI SDK |
| TypeScript Support | Excellent | Good | Vercel AI SDK |
| Learning Curve | Low | High | Vercel AI SDK |
| Customization | Limited but sufficient | Extensive | LangChain |
| Community | Growing, Vercel-backed | Large, established | Tie |
| Documentation | Excellent, focused | Comprehensive but complex | Vercel AI SDK |

**Implementation Strategy:**
```typescript
// Primary: Vercel AI SDK for streaming and UI
import { useCompletion } from 'ai/react'
import { streamText } from 'ai'

// Secondary: LangChain for advanced features when needed
import { ChatAnthropic } from 'langchain/chat_models/anthropic'
```

### Supabase vs Alternatives Analysis

#### Decision: Supabase
**Evaluation Matrix:**

| Feature | Supabase | Firebase | Auth0 + Prisma | Clerk + Prisma |
|---------|----------|-----------|----------------|----------------|
| Cost (1K MAU) | $25/month | $40/month | $70/month | $25/month |
| Auth Features | Excellent | Good | Excellent | Excellent |
| Database | PostgreSQL (superior) | NoSQL (limited) | Requires setup | Requires setup |
| RLS | Native, powerful | Limited | Manual | Manual |
| Real-time | Built-in | Good | Requires Redis | Requires setup |
| TypeScript | Excellent | Good | Excellent | Excellent |
| Learning Curve | Medium | Low | High | Low |

**Key Decision Factors:**
1. **Cost Efficiency**: Most competitive pricing for our use case
2. **PostgreSQL**: Superior relational capabilities for complex user data
3. **RLS**: Built-in Row-Level Security eliminates security implementation complexity
4. **Full-Stack**: Single provider for auth, database, and real-time features

### shadcn/ui + Tailwind CSS Justification

#### Decision: shadcn/ui + Tailwind CSS
**Rationale:**
- **Customization**: Full control over component styling and behavior
- **Bundle Size**: Only includes components actually used
- **Developer Experience**: Excellent TypeScript integration and IDE support
- **Performance**: Utility-first CSS with optimal build-time purging
- **Maintenance**: Copy-paste components reduce dependency management

**Alternative Comparison:**
```typescript
// shadcn/ui approach (chosen)
import { Button } from '@/components/ui/button'
// Full control, customizable, small bundle

// Material-UI approach (rejected)
import { Button } from '@mui/material'
// Large bundle, limited customization, theme lock-in
```

## System Architecture

### Database Design with 4 Core Tables

#### Schema Overview
```sql
-- Core table structure
profiles (1) ← conversations (N) ← user_inputs (N) ← generated_drafts (N)
                                  ↗
                      conversation_id references
```

#### Table Specifications

**1. Profiles Table**
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- CPL and Learning
  cpl_score DECIMAL(5,2) DEFAULT 0.0,
  learning_data JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',

  -- Usage Tracking
  monthly_api_usage INTEGER DEFAULT 0,
  monthly_limit INTEGER DEFAULT 100,
  subscription_status TEXT DEFAULT 'free'
);
```

**2. Conversations Table**
```sql
CREATE TABLE conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('email', 'letter', 'proposal', 'memo', 'general')),
  context JSONB DEFAULT '{}',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**3. User Inputs Table**
```sql
CREATE TABLE user_inputs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  raw_text TEXT NOT NULL,
  input_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**4. Generated Drafts Table**
```sql
CREATE TABLE generated_drafts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_input_id UUID REFERENCES user_inputs(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  draft_type TEXT NOT NULL CHECK (draft_type IN ('grammar_fix', 'adaptive_polish')),
  cpl_score DECIMAL(5,2),
  is_accepted BOOLEAN DEFAULT NULL, -- NULL = not reviewed, true/false = user decision
  ai_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Server Actions Architecture

#### Folder Structure
```
/src/lib/actions/
├── auth/
│   ├── login.ts
│   ├── register.ts
│   └── update-profile.ts
├── conversations/
│   ├── create.ts
│   ├── update.ts
│   └── list.ts
├── drafts/
│   ├── generate.ts
│   ├── accept.ts
│   └── calculate-cpl.ts
└── shared/
    ├── validation.ts
    ├── error-handling.ts
    └── rate-limiting.ts
```

#### Server Action Pattern
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  content: z.string().min(10).max(5000),
  category: z.enum(['email', 'letter', 'proposal', 'memo'])
})

export async function generateDraft(formData: FormData) {
  try {
    // Authentication
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Rate limiting
    const { success } = await rateLimit.check(user.id)
    if (!success) throw new Error('Rate limit exceeded')

    // Validation
    const validatedData = schema.parse({
      content: formData.get('content'),
      category: formData.get('category')
    })

    // Business logic here...

    revalidatePath('/dashboard')
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

### Real-Time Streaming Architecture

#### Streaming Implementation Strategy
```typescript
// Server Action for streaming
export async function streamDraftGeneration(prompt: string, cplScore: number) {
  const stream = new ReadableStream({
    start(controller) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      anthropic.messages.stream({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: buildPromptWithCPL(prompt, cplScore)
        }]
      }).on('text', (text) => {
        const sanitized = sanitizeLLMOutput(text)
        controller.enqueue(`data: ${JSON.stringify({ text: sanitized })}\n\n`)
      }).on('end', () => {
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

### Caching Strategy (Redis + In-Memory)

#### Multi-Layer Caching Architecture
```typescript
interface CacheLayer {
  l1: InMemoryCache    // Hot data, <1MB, 1-5 min TTL
  l2: RedisCache       // Warm data, <10MB, 5-60 min TTL
  l3: DatabaseCache    // Cold data, persistent
}

class CacheManager {
  async get<T>(key: string): Promise<T | null> {
    // L1: Check in-memory first
    let result = await this.l1.get<T>(key)
    if (result) return result

    // L2: Check Redis
    result = await this.l2.get<T>(key)
    if (result) {
      await this.l1.set(key, result, 300) // 5 min TTL
      return result
    }

    // L3: Database fallback
    result = await this.database.get<T>(key)
    if (result) {
      await this.l2.set(key, result, 1800) // 30 min TTL
      await this.l1.set(key, result, 300)  // 5 min TTL
    }

    return result
  }
}
```

## Security Architecture

### Row-Level Security (RLS) Policies

#### Comprehensive RLS Implementation
```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_drafts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Conversations policies
CREATE POLICY "Users can access own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

-- Cascade policies for related data
CREATE POLICY "Users can access own inputs" ON user_inputs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access own drafts" ON generated_drafts
  FOR ALL USING (auth.uid() = user_id);
```

### API Key Management Strategy

#### Secure Key Handling
```typescript
// Environment-based key management
export class APIKeyManager {
  private static readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

  static getAnthropicKey(): string {
    const encrypted = process.env.ANTHROPIC_API_KEY_ENCRYPTED!
    return this.decrypt(encrypted)
  }

  private static decrypt(encryptedKey: string): string {
    // Implementation using Node.js crypto module
    const decipher = crypto.createDecipher('aes-256-cbc', this.ENCRYPTION_KEY)
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
}
```

### Rate Limiting Implementation

#### Redis-Based Rate Limiting
```typescript
import { Redis } from 'ioredis'

export class RateLimiter {
  private redis = new Redis(process.env.REDIS_URL)

  async checkLimit(userId: string, limit = 20, window = 3600): Promise<RateLimitResult> {
    const key = `rate_limit:${userId}`
    const current = await this.redis.incr(key)

    if (current === 1) {
      await this.redis.expire(key, window)
    }

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetTime: await this.redis.ttl(key)
    }
  }
}
```

### Anti-Prompt Injection Protection

#### Input Sanitization
```typescript
export class PromptSanitizer {
  private static readonly DANGEROUS_PATTERNS = [
    /ignore\s+previous\s+instructions/i,
    /system\s*:\s*/i,
    /assistant\s*:\s*/i,
    /<\|system\|>/i,
    /<\|assistant\|>/i
  ]

  static sanitizeInput(input: string): string {
    let sanitized = input.trim()

    // Remove dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REMOVED]')
    }

    // Length limiting
    if (sanitized.length > 5000) {
      sanitized = sanitized.substring(0, 5000) + '...'
    }

    return sanitized
  }

  static isInputSafe(input: string): boolean {
    return !this.DANGEROUS_PATTERNS.some(pattern => pattern.test(input))
  }
}
```

## AI Integration Architecture

### Hybrid Vercel AI SDK + Direct Claude SDK Approach

#### Architecture Decision Matrix
```typescript
// Use Vercel AI SDK for:
// - UI streaming components
// - Simple completions
// - Client-side interactions

import { useCompletion } from 'ai/react'

export function ChatInterface() {
  const { completion, complete } = useCompletion({
    api: '/api/chat/stream'
  })

  return <StreamingText content={completion} />
}

// Use Direct Claude SDK for:
// - Complex prompting with system messages
// - Tool calling and function execution
// - Advanced model parameters

import { Anthropic } from '@anthropic-ai/sdk'

export async function generateWithAdvancedFeatures(prompt: string, cpl: number) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  return anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 2000,
    system: buildDynamicSystemPrompt(cpl),
    messages: [{ role: 'user', content: prompt }]
  })
}
```

### Error Handling and Fallback Strategies

#### Multi-Level Error Handling
```typescript
export class AIServiceManager {
  async generateDraft(input: string, retries = 3): Promise<DraftResult> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.callAnthropicAPI(input)
      } catch (error) {
        if (attempt === retries) {
          // Final fallback: use cached similar response
          return this.getFallbackResponse(input)
        }

        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000)
      }
    }
  }

  private async getFallbackResponse(input: string): Promise<DraftResult> {
    // Return cached similar response or basic grammar fix
    const cached = await this.findSimilarCachedResponse(input)
    return cached || this.basicGrammarFix(input)
  }
}
```

### Cost Optimization Strategies

#### Semantic Caching Implementation
```typescript
export class SemanticCache {
  async get(prompt: string, similarity_threshold = 0.85): Promise<CachedResponse | null> {
    const embeddings = await this.generateEmbeddings(prompt)

    const similar = await this.searchSimilar(embeddings, similarity_threshold)
    if (similar) {
      return this.adjustResponse(similar, prompt)
    }

    return null
  }

  async set(prompt: string, response: string, ttl = 3600): Promise<void> {
    const embeddings = await this.generateEmbeddings(prompt)
    await this.store({ prompt, response, embeddings, ttl })
  }
}
```

## Performance Architecture

### Bundle Optimization Strategy

#### Code Splitting Implementation
```typescript
// Dynamic imports for heavy components
const AIChat = dynamic(() => import('@/components/AIChat'), {
  loading: () => <ChatSkeleton />,
  ssr: false
})

const AdvancedEditor = dynamic(() => import('@/components/AdvancedEditor'), {
  loading: () => <EditorSkeleton />
})

// Route-based splitting (automatic with App Router)
// app/dashboard/chat/page.tsx - loads only when needed
// app/dashboard/history/page.tsx - separate chunk
```

#### Bundle Analysis Configuration
```typescript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})

module.exports = withBundleAnalyzer({
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons']
  }
})
```

### Database Indexing Strategy

#### Optimized Index Creation
```sql
-- User-centric queries
CREATE INDEX CONCURRENTLY idx_conversations_user_activity
ON conversations(user_id, last_activity_at DESC);

CREATE INDEX CONCURRENTLY idx_drafts_user_created
ON generated_drafts(user_id, created_at DESC);

-- CPL scoring queries
CREATE INDEX CONCURRENTLY idx_drafts_cpl_accepted
ON generated_drafts(user_id, cpl_score)
WHERE is_accepted = true;

-- Full-text search (future feature)
CREATE INDEX CONCURRENTLY idx_user_inputs_search
ON user_inputs USING gin(to_tsvector('english', raw_text));
```

### CDN and Edge Computing

#### Vercel Edge Functions Strategy
```typescript
// Use Edge Functions for:
// - Authentication middleware
// - Rate limiting
// - Simple API responses
// - Geolocation-based routing

export const config = { runtime: 'edge' }

export default async function handler(request: Request) {
  // Runs on Edge Runtime - faster cold starts
  return new Response('Hello from the edge!')
}

// Use Serverless Functions for:
// - AI API calls (require full Node.js runtime)
// - Database operations
// - Complex business logic
```

This architecture provides a robust, scalable foundation for Ascendia, balancing performance, security, and development velocity while maintaining cost efficiency and user experience quality.